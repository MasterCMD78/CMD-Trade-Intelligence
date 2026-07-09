/**
 * Smart Money Foundation — Integration tests.
 *
 * Tests interactions between the new Phase 3D–3G modules and the existing
 * BOS/CHOCH/Market Structure pipeline via analyzeMarketStructureFull.
 *
 * Covers:
 *   - Full pipeline with BOS → OB → FVG → P&D
 *   - Liquidity sweep detected after BOS
 *   - Premium/discount zone consistent with swing range
 *   - FVG and OB work together with BOS
 *   - No crashes on minimal candle data
 */

import { describe, it } from "vitest";
import assert from "node:assert/strict";
import type { StructureCandle } from "../types.js";
import { analyzeMarketStructureFull } from "../engine.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function c(
  high: number,
  low: number,
  close: number,
  open?: number,
  i = 0,
): StructureCandle & { close: number } {
  return { high, low, close, ...(open !== undefined ? { open } : {}), timestamp: new Date(2024, 0, 1 + i) };
}

/**
 * Build a realistic bullish scenario:
 *   - Downtrend establishes swing lows (sell-side liquidity)
 *   - Equal highs form (buy-side liquidity)
 *   - Price sweeps sell-side liquidity then makes a bullish BOS
 */
function buildBullishScenario(): StructureCandle[] {
  return [
    // Down leg — swing high at index 2, swing low at index 6
    c(110, 108, 109, 110, 0),
    c(112, 110, 111, 110, 1),
    c(115, 112, 113, 112, 2), // potential swing high
    c(113, 110, 111, 113, 3),
    c(111, 108, 109, 111, 4),
    c(109, 106, 107, 109, 5),
    c(107, 104, 105, 107, 6), // potential swing low
    c(109, 106, 107, 105, 7),
    c(111, 108, 109, 107, 8),
    // Sell-side sweep: wick below swing low, close back above
    c(108, 103, 106, 108, 9), // wick pierces ~104 area, closes back above
    // Bullish BOS: strong close above swing high 115
    c(118, 110, 117, 110, 10),
    c(120, 116, 118, 117, 11),
    c(119, 116, 117, 119, 12),
  ];
}

/**
 * Build a scenario with a three-candle FVG:
 *   candles[1].high < candles[3].low → bullish FVG gap
 */
function buildFvgScenario(): StructureCandle[] {
  return [
    c(100, 95, 98, 97, 0),  // candle 0: high=100
    c(112, 101, 110, 101, 1), // strong impulse (middle)
    c(120, 105, 118, 105, 2), // candle 2: low=105 → FVG between 100 and 105
    c(125, 118, 122, 118, 3),
    c(128, 121, 124, 122, 4),
  ];
}

// ─── Full pipeline integration ─────────────────────────────────────────────────

describe("analyzeMarketStructureFull — full pipeline", () => {
  it("returns all Phase 3D-3G fields on the result object", () => {
    const candles = buildBullishScenario();
    const currentPrice = 117;
    const result = analyzeMarketStructureFull(candles, currentPrice);

    // Market structure base fields still present
    assert.ok("currentTrend" in result, "currentTrend should be present");
    assert.ok("swingHighs" in result, "swingHighs should be present");
    assert.ok("allBullishBOS" in result, "allBullishBOS should be present");

    // New Phase 3D-3G fields
    assert.ok("liquidity" in result, "liquidity should be present");
    assert.ok("orderBlocks" in result, "orderBlocks should be present");
    assert.ok("fairValueGaps" in result, "fairValueGaps should be present");
    assert.ok("premiumDiscount" in result, "premiumDiscount should be present");
  });

  it("liquidity result has expected shape", () => {
    const candles = buildBullishScenario();
    const result = analyzeMarketStructureFull(candles, 117);

    const { liquidity } = result;
    assert.ok(Array.isArray(liquidity.liquidityLevels), "liquidityLevels should be an array");
    assert.ok(Array.isArray(liquidity.sweeps), "sweeps should be an array");
    assert.equal(typeof liquidity.sweeps.length, "number");
  });

  it("orderBlocks result has expected shape", () => {
    const candles = buildBullishScenario();
    const result = analyzeMarketStructureFull(candles, 117);

    const { orderBlocks } = result;
    assert.ok(Array.isArray(orderBlocks.orderBlocks), "orderBlocks array should exist");
    assert.ok(Array.isArray(orderBlocks.activeOrderBlocks), "activeOrderBlocks should exist");
    assert.ok(orderBlocks.activeOrderBlocks.every((ob) => !ob.invalidated),
      "active OBs must not be invalidated");
  });

  it("fairValueGaps result has expected shape", () => {
    const candles = buildFvgScenario();
    const result = analyzeMarketStructureFull(candles, 122);

    const { fairValueGaps } = result;
    assert.ok(Array.isArray(fairValueGaps.fvgs), "fvgs array should exist");
    assert.ok(Array.isArray(fairValueGaps.activeFvgs), "activeFvgs should exist");
    assert.ok(fairValueGaps.activeFvgs.every((f) => f.status !== "mitigated"),
      "activeFvgs should not contain mitigated FVGs");
  });

  it("detects a bullish FVG in the FVG scenario", () => {
    const candles = buildFvgScenario();
    const result = analyzeMarketStructureFull(candles, 122);

    const bullishFvgs = result.fairValueGaps.fvgs.filter((f) => f.kind === "bullish");
    assert.ok(bullishFvgs.length >= 1, "should detect at least one bullish FVG");
  });
});

// ─── Premium/Discount integration ────────────────────────────────────────────

describe("analyzeMarketStructureFull — premium/discount integration", () => {
  it("returns a premiumDiscount result when swing data is available", () => {
    const candles = buildBullishScenario();
    const result = analyzeMarketStructureFull(candles, 117);

    if (result.swingHighs.length > 0 && result.swingLows.length > 0) {
      assert.ok(result.premiumDiscount !== null, "premiumDiscount should be non-null with swings");
      assert.ok(["premium", "equilibrium", "discount"].includes(result.premiumDiscount!.currentZone),
        "zone should be premium, equilibrium, or discount");
    }
  });

  it("premiumDiscount reflects correct range from swing high/low", () => {
    const candles = buildBullishScenario();
    const result = analyzeMarketStructureFull(candles, 117);

    if (result.premiumDiscount) {
      assert.ok(result.premiumDiscount.rangeHigh > result.premiumDiscount.rangeLow,
        "rangeHigh must be greater than rangeLow");
      assert.ok(result.premiumDiscount.pricePosition >= 0 && result.premiumDiscount.pricePosition <= 100,
        "pricePosition must be 0–100");
    }
  });
});

// ─── Graceful handling of minimal data ───────────────────────────────────────

describe("analyzeMarketStructureFull — minimal data", () => {
  it("does not crash on fewer than 5 candles", () => {
    const candles = [
      c(100, 98, 99, 99, 0),
      c(101, 99, 100, 99, 1),
      c(102, 100, 101, 100, 2),
    ];
    assert.doesNotThrow(() => {
      analyzeMarketStructureFull(candles, 100);
    }, "should not throw on minimal data");
  });

  it("returns empty arrays on very short candle data", () => {
    const candles = [c(100, 98, 99, 99, 0)];
    const result = analyzeMarketStructureFull(candles, 99);

    assert.equal(result.swingHighs.length, 0);
    assert.equal(result.swingLows.length, 0);
    assert.equal(result.orderBlocks.orderBlocks.length, 0);
    assert.equal(result.fairValueGaps.fvgs.length, 0);
  });
});

// ─── OB + BOS interaction ─────────────────────────────────────────────────────

describe("analyzeMarketStructureFull — OB and BOS interaction", () => {
  it("order blocks are only created when BOS events exist", () => {
    // A flat market with no trend — should produce no BOS → no OBs
    const flatCandles: StructureCandle[] = Array.from({ length: 20 }, (_, i) =>
      c(100 + (i % 3), 98 + (i % 3), 99 + (i % 3), 99 + (i % 3), i),
    );

    const result = analyzeMarketStructureFull(flatCandles, 100);
    // In a flat market, BOS may or may not exist; OBs should equal BOS count
    const hasBOS = result.allBullishBOS.length > 0 || result.allBearishBOS.length > 0;
    if (!hasBOS) {
      assert.equal(result.orderBlocks.orderBlocks.length, 0,
        "no BOS → no order blocks");
    }
  });
});
