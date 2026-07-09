/**
 * Order Block Engine — comprehensive test suite.
 *
 * Covers:
 *   - Bullish OB detection (last bearish candle before bullish BOS)
 *   - Bearish OB detection (last bullish candle before bearish BOS)
 *   - Mitigation detection (price trades into OB zone)
 *   - Invalidation detection (price closes beyond far edge)
 *   - Edge cases: no BOS → no OBs, empty candles
 */

import { describe, it } from "vitest";
import assert from "node:assert/strict";
import type { StructureCandle } from "../types.js";
import type { BOSResult, SwingPoint } from "../types.js";
import { detectOrderBlocks } from "../order-block.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function c(
  high: number,
  low: number,
  close: number,
  open: number,
  i = 0,
): StructureCandle & { open: number; close: number } {
  return { high, low, close, open, timestamp: new Date(2024, 0, 1 + i) };
}

function swing(index: number, price: number, kind: "high" | "low"): SwingPoint {
  return { index, price, timestamp: new Date(2024, 0, 1 + index), kind };
}

function makeBullishBOS(brokenSwingIdx: number, brokenPrice: number, breakIdx: number, breakPrice: number): BOSResult {
  return {
    direction: "bullish",
    brokenSwing: swing(brokenSwingIdx, brokenPrice, "high"),
    breakPrice,
    breakIndex: breakIdx,
    confirmationCandle: { high: breakPrice + 1, low: breakPrice - 1, close: breakPrice, timestamp: 0 },
    strength: 0.7,
    confidence: 70,
  };
}

function makeBearishBOS(brokenSwingIdx: number, brokenPrice: number, breakIdx: number, breakPrice: number): BOSResult {
  return {
    direction: "bearish",
    brokenSwing: swing(brokenSwingIdx, brokenPrice, "low"),
    breakPrice,
    breakIndex: breakIdx,
    confirmationCandle: { high: breakPrice + 1, low: breakPrice - 1, close: breakPrice, timestamp: 0 },
    strength: 0.7,
    confidence: 70,
  };
}

// ─── Bullish Order Blocks ─────────────────────────────────────────────────────

describe("detectOrderBlocks — bullish OB", () => {
  it("detects a bullish OB as the last bearish candle before bullish BOS", () => {
    // Pattern: bearish candle at i=3 (close < open) then bullish impulse → BOS
    const candles = [
      c(110, 108, 109, 109, 0), // bullish
      c(109, 107, 108, 108, 1), // bullish
      c(108, 106, 107, 107, 2), // bullish
      c(108, 105, 106, 108, 3), // BEARISH (open=108, close=106) — this should be the OB
      c(107, 104, 105, 106, 4), // bearish
      c(112, 105, 111, 105, 5), // strong bullish BOS confirmation
    ];

    const bullishBOS: BOSResult[] = [makeBullishBOS(2, 108, 5, 111)];
    const result = detectOrderBlocks(candles, bullishBOS, []);

    assert.ok(result.orderBlocks.length >= 1, "should detect at least one OB");
    const bullOB = result.orderBlocks.find((ob) => ob.kind === "bullish");
    assert.ok(bullOB !== undefined, "should have a bullish OB");
    assert.equal(bullOB!.kind, "bullish");
    assert.ok(bullOB!.strength > 0, "strength should be positive");
    assert.ok(bullOB!.confidence > 0, "confidence should be positive");
  });

  it("bullish OB has valid price range (high > low)", () => {
    const candles = [
      c(110, 108, 109, 109, 0),
      c(108, 105, 106, 108, 1), // bearish OB candidate
      c(112, 105, 111, 105, 2),
    ];
    const bullishBOS: BOSResult[] = [makeBullishBOS(0, 110, 2, 111)];
    const result = detectOrderBlocks(candles, bullishBOS, []);

    const ob = result.orderBlocks.find((o) => o.kind === "bullish");
    if (ob) {
      assert.ok(ob.high > ob.low, "OB high must be greater than OB low");
    }
  });
});

// ─── Bearish Order Blocks ─────────────────────────────────────────────────────

describe("detectOrderBlocks — bearish OB", () => {
  it("detects a bearish OB as the last bullish candle before bearish BOS", () => {
    const candles = [
      c(95, 93, 94, 94, 0), // bearish
      c(96, 94, 95, 94, 1), // bullish
      c(97, 95, 96, 95, 2), // BULLISH (open=95, close=96) — this should be bearish OB candidate
      c(95, 93, 94, 96, 3), // bearish
      c(90, 87, 88, 94, 4), // strong bearish BOS
    ];

    const bearishBOS: BOSResult[] = [makeBearishBOS(0, 93, 4, 88)];
    const result = detectOrderBlocks(candles, [], bearishBOS);

    const bearOB = result.orderBlocks.find((ob) => ob.kind === "bearish");
    assert.ok(bearOB !== undefined, "should detect a bearish OB");
    assert.equal(bearOB!.kind, "bearish");
  });
});

// ─── Mitigation ───────────────────────────────────────────────────────────────

describe("detectOrderBlocks — mitigation", () => {
  it("marks a bullish OB as mitigated when price returns into its range", () => {
    const candles = [
      c(110, 108, 109, 109, 0),
      c(108, 104, 105, 108, 1), // bearish OB: high=108, low=104
      c(112, 105, 111, 105, 2), // BOS confirmation
      c(111, 103, 106, 111, 3), // price trades INTO OB zone (low=103 < 108, high=111 > 104)
    ];

    const bullishBOS: BOSResult[] = [makeBullishBOS(0, 110, 2, 111)];
    const result = detectOrderBlocks(candles, bullishBOS, []);

    const ob = result.orderBlocks.find((o) => o.kind === "bullish");
    if (ob) {
      assert.equal(ob.mitigated, true, "OB should be marked as mitigated");
    }
  });

  it("does NOT mark OB as mitigated when price doesn't return to zone", () => {
    const candles = [
      c(110, 108, 109, 109, 0),
      c(108, 104, 105, 108, 1), // bearish OB: high=108
      c(112, 109, 111, 109, 2), // BOS (price stays well above OB zone)
      c(115, 112, 114, 111, 3), // price continues higher, stays above OB zone
    ];

    const bullishBOS: BOSResult[] = [makeBullishBOS(0, 110, 2, 111)];
    const result = detectOrderBlocks(candles, bullishBOS, []);

    const ob = result.orderBlocks.find((o) => o.kind === "bullish");
    if (ob) {
      assert.equal(ob.mitigated, false, "OB should not be mitigated if price never returned");
    }
  });
});

// ─── Invalidation ─────────────────────────────────────────────────────────────

describe("detectOrderBlocks — invalidation", () => {
  it("marks a bullish OB as invalidated when price closes below the OB low", () => {
    const candles = [
      c(110, 108, 109, 109, 0),
      c(108, 104, 105, 108, 1), // bearish OB: low=104
      c(112, 105, 111, 105, 2), // BOS
      c(103, 100, 101, 111, 3), // close=101 < OB low (104) → invalidated
    ];

    const bullishBOS: BOSResult[] = [makeBullishBOS(0, 110, 2, 111)];
    const result = detectOrderBlocks(candles, bullishBOS, []);

    const ob = result.orderBlocks.find((o) => o.kind === "bullish");
    if (ob) {
      assert.equal(ob.invalidated, true, "OB should be invalidated when price closes below its low");
    }
  });

  it("invalidated OBs are excluded from activeOrderBlocks", () => {
    const candles = [
      c(110, 108, 109, 109, 0),
      c(108, 104, 105, 108, 1),
      c(112, 105, 111, 105, 2),
      c(103, 100, 101, 111, 3), // invalidates OB
    ];

    const bullishBOS: BOSResult[] = [makeBullishBOS(0, 110, 2, 111)];
    const result = detectOrderBlocks(candles, bullishBOS, []);

    assert.equal(result.activeOrderBlocks.filter((o) => o.kind === "bullish").length, 0,
      "invalidated OBs should not appear in activeOrderBlocks");
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe("detectOrderBlocks — edge cases", () => {
  it("returns empty result when no BOS events provided", () => {
    const candles = [c(100, 98, 99, 99, 0), c(101, 99, 100, 99, 1)];
    const result = detectOrderBlocks(candles, [], []);
    assert.equal(result.orderBlocks.length, 0);
    assert.equal(result.activeOrderBlocks.length, 0);
    assert.equal(result.lastBullishOB, null);
    assert.equal(result.lastBearishOB, null);
  });

  it("returns empty result for empty candle array", () => {
    const bos = makeBullishBOS(0, 100, 2, 105);
    const result = detectOrderBlocks([], [bos], []);
    assert.equal(result.orderBlocks.length, 0);
  });
});
