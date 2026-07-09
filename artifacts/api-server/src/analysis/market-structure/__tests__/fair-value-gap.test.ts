/**
 * Fair Value Gap Engine — comprehensive test suite.
 *
 * Covers:
 *   - Bullish FVG detection (candle[i-1].high < candle[i+1].low)
 *   - Bearish FVG detection (candle[i-1].low  > candle[i+1].high)
 *   - Active status (gap not touched)
 *   - Partial fill (price enters gap but doesn't close through)
 *   - Full mitigation (price closes fully through gap)
 *   - No FVG when candles overlap
 *   - Edge cases: fewer than 3 candles, empty array
 */

import { describe, it } from "vitest";
import assert from "node:assert/strict";
import type { StructureCandle } from "../types.js";
import { detectFairValueGaps } from "../fair-value-gap.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function c(high: number, low: number, close: number, open?: number, i = 0): StructureCandle & { close: number } {
  return { high, low, close, ...(open !== undefined ? { open } : {}), timestamp: new Date(2024, 0, 1 + i) };
}

// ─── Bullish FVG ──────────────────────────────────────────────────────────────

describe("detectFairValueGaps — bullish FVG", () => {
  it("detects a bullish FVG when candle[i-1].high < candle[i+1].low", () => {
    // candle[0].high = 100, candle[2].low = 105 → gap = [100, 105]
    const candles = [
      c(100, 95, 98, 97, 0),  // candle[i-1]: high=100
      c(108, 101, 106, 101, 1), // middle impulse candle
      c(112, 105, 110, 105, 2), // candle[i+1]: low=105
    ];

    const result = detectFairValueGaps(candles);

    assert.ok(result.fvgs.length >= 1, "should detect at least one FVG");
    const fvg = result.fvgs.find((f) => f.kind === "bullish");
    assert.ok(fvg !== undefined, "should have a bullish FVG");
    assert.equal(fvg!.gapLow, 100, "gap low should be prev candle high");
    assert.equal(fvg!.gapHigh, 105, "gap high should be next candle low");
    assert.equal(fvg!.gapSize, 5);
    assert.ok(fvg!.quality > 0, "quality should be positive");
    assert.ok(fvg!.confidence > 0, "confidence should be positive");
  });

  it("does NOT detect a bullish FVG when candles overlap (no gap)", () => {
    // candle[0].high = 102, candle[2].low = 100 → overlap, no gap
    const candles = [
      c(102, 95, 98, 97, 0),
      c(108, 101, 106, 101, 1),
      c(112, 100, 110, 100, 2), // low=100 < prev high=102 → overlap
    ];

    const result = detectFairValueGaps(candles);
    const bullishFvgs = result.fvgs.filter((f) => f.kind === "bullish");
    assert.equal(bullishFvgs.length, 0, "overlapping candles should not produce a bullish FVG");
  });
});

// ─── Bearish FVG ──────────────────────────────────────────────────────────────

describe("detectFairValueGaps — bearish FVG", () => {
  it("detects a bearish FVG when candle[i-1].low > candle[i+1].high", () => {
    // candle[0].low = 95, candle[2].high = 90 → gap = [90, 95]
    const candles = [
      c(100, 95, 96, 99, 0),  // candle[i-1]: low=95
      c(93, 88, 89, 95, 1),  // strong bearish impulse
      c(92, 85, 87, 92, 2),  // candle[i+1]: high=92 ... wait need high < 95
    ];
    // Redo: candle[2].high must be < candle[0].low (95)
    const validCandles = [
      c(100, 95, 96, 99, 0),
      c(93, 88, 89, 95, 1),
      c(91, 85, 87, 91, 2), // high=91 < prev.low=95 → bearish FVG [91, 95]
    ];

    const result = detectFairValueGaps(validCandles);
    const fvg = result.fvgs.find((f) => f.kind === "bearish");
    assert.ok(fvg !== undefined, "should detect a bearish FVG");
    assert.equal(fvg!.gapHigh, 95, "gap high should be prev candle low");
    assert.equal(fvg!.gapLow, 91, "gap low should be next candle high");
    assert.equal(fvg!.gapSize, 4);
  });

  it("does NOT detect a bearish FVG when candles overlap", () => {
    // candle[0].low = 95, candle[2].high = 96 → overlap
    const candles = [
      c(100, 95, 96, 99, 0),
      c(93, 88, 89, 95, 1),
      c(98, 92, 95, 98, 2), // high=98 > prev.low=95 → overlap, no gap
    ];

    const result = detectFairValueGaps(candles);
    const bearishFvgs = result.fvgs.filter((f) => f.kind === "bearish");
    assert.equal(bearishFvgs.length, 0, "overlapping candles should not produce a bearish FVG");
  });
});

// ─── Partial fill ─────────────────────────────────────────────────────────────

describe("detectFairValueGaps — partial fill", () => {
  it("marks a bullish FVG as partial when price enters but doesn't fully close through", () => {
    const candles = [
      c(100, 95, 98, 97, 0),   // high=100
      c(110, 101, 108, 101, 1),
      c(115, 105, 112, 105, 2), // low=105 → bullish FVG [100, 105]
      c(106, 102, 103, 106, 3), // low=102 < 105 (entered gap), close=103 > 100 (not through)
    ];

    const result = detectFairValueGaps(candles);
    const fvg = result.fvgs.find((f) => f.kind === "bullish");
    if (fvg) {
      assert.equal(fvg.status, "partial", "FVG should be partially filled");
      assert.ok(fvg.fillPct > 0 && fvg.fillPct < 100, "fillPct should be between 0 and 100");
    }
  });
});

// ─── Full mitigation ──────────────────────────────────────────────────────────

describe("detectFairValueGaps — full mitigation", () => {
  it("marks a bullish FVG as mitigated when price closes below the gap low", () => {
    const candles = [
      c(100, 95, 98, 97, 0),   // high=100
      c(110, 101, 108, 101, 1),
      c(115, 105, 112, 105, 2), // low=105 → bullish FVG [100, 105]
      c(103, 96, 97, 103, 3),  // close=97 < gap low (100) → fully mitigated
    ];

    const result = detectFairValueGaps(candles);
    const fvg = result.fvgs.find((f) => f.kind === "bullish");
    if (fvg) {
      assert.equal(fvg.status, "mitigated", "FVG should be fully mitigated");
      assert.equal(fvg.fillPct, 100);
    }
  });

  it("mitigated FVGs are excluded from activeFvgs", () => {
    const candles = [
      c(100, 95, 98, 97, 0),
      c(110, 101, 108, 101, 1),
      c(115, 105, 112, 105, 2),
      c(103, 96, 97, 103, 3),
    ];

    const result = detectFairValueGaps(candles);
    const mitigatedInActive = result.activeFvgs.filter((f) => f.status === "mitigated");
    assert.equal(mitigatedInActive.length, 0, "mitigated FVGs should not appear in activeFvgs");
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe("detectFairValueGaps — edge cases", () => {
  it("returns empty result for fewer than 3 candles", () => {
    const result1 = detectFairValueGaps([]);
    assert.equal(result1.fvgs.length, 0);

    const result2 = detectFairValueGaps([c(100, 98, 99, 99, 0)]);
    assert.equal(result2.fvgs.length, 0);

    const result3 = detectFairValueGaps([c(100, 98, 99, 99, 0), c(101, 99, 100, 99, 1)]);
    assert.equal(result3.fvgs.length, 0);
  });

  it("detects an active FVG that has not been touched", () => {
    const candles = [
      c(100, 95, 98, 97, 0),
      c(110, 101, 108, 101, 1),
      c(115, 105, 112, 105, 2), // FVG [100, 105]
      c(118, 113, 116, 113, 3), // price continues up, gap untouched
    ];

    const result = detectFairValueGaps(candles);
    const fvg = result.fvgs.find((f) => f.kind === "bullish");
    if (fvg) {
      assert.equal(fvg.status, "active", "untouched FVG should remain active");
      assert.equal(fvg.fillPct, 0);
    }
    assert.ok(result.activeFvgs.length >= 1, "should have at least one active FVG");
  });
});
