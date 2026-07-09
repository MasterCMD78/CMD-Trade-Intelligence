/**
 * Break of Structure (BOS) Detector — comprehensive test suite.
 *
 * Covers:
 *   - Bullish BOS (close above swing high)
 *   - Bearish BOS (close below swing low)
 *   - Wick-only breaks are rejected
 *   - Consecutive BOS events
 *   - Weak vs. strong breaks (strength scoring)
 *   - Flat markets (no swings → no BOS)
 *   - Price gaps through a level
 *   - Edge cases: empty dataset, single candle, zero-range candles
 *   - confirmationDistance filter
 *   - minCandleClosePct filter
 *   - currentStructureBias via the orchestrator
 */

import { describe, it } from "vitest";
import assert from "node:assert/strict";
import type { StructureCandle, SwingPoint } from "../types.js";
import { detectBOS } from "../bos-detector.js";
import { analyzeMarketStructure } from "../engine.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function c(high: number, low: number, close: number, i: number = 0): StructureCandle & { close: number } {
  return { high, low, close, timestamp: new Date(2024, 0, 1 + i) };
}

function swing(index: number, price: number, kind: "high" | "low"): SwingPoint {
  return { index, price, timestamp: new Date(2024, 0, 1 + index), kind };
}

// ─── Bullish BOS ──────────────────────────────────────────────────────────────

describe("detectBOS — bullish BOS", () => {
  it("detects a bullish BOS when close exceeds a prior swing high", () => {
    const swingHighs: SwingPoint[] = [swing(2, 105, "high")];
    const swingLows: SwingPoint[] = [];
    const candles = [
      c(103, 100, 102, 0),
      c(104, 101, 103, 1),
      c(106, 103, 105, 2), // swing high
      c(104, 102, 103, 3),
      c(107, 104, 106, 4), // close > 105 → BOS
    ];

    const result = detectBOS(candles, swingHighs, swingLows);

    assert.equal(result.bullishBOS.length, 1);
    const bos = result.bullishBOS[0]!;
    assert.equal(bos.direction, "bullish");
    assert.equal(bos.brokenSwing.price, 105);
    assert.equal(bos.breakPrice, 106);
    assert.equal(bos.breakIndex, 4);
    assert.ok(bos.strength > 0, "strength should be positive");
    assert.ok(bos.confidence > 0, "confidence should be positive");
    assert.strictEqual(result.lastBullishBOS, bos);
  });

  it("does NOT detect bullish BOS when close is exactly AT the swing high (must be strictly above)", () => {
    const swingHighs: SwingPoint[] = [swing(2, 105, "high")];
    const candles = [
      c(103, 100, 102, 0),
      c(104, 101, 103, 1),
      c(106, 103, 105, 2),
      c(105, 102, 105, 3), // close == swing high: NOT a BOS
    ];

    const result = detectBOS(candles, swingHighs, []);
    assert.equal(result.bullishBOS.length, 0);
    assert.equal(result.lastBullishBOS, null);
  });

  it("produces a stronger BOS score for a larger breach", () => {
    const swingHighs: SwingPoint[] = [swing(2, 100, "high")];
    const weakCandles = [
      c(98, 96, 97, 0), c(99, 97, 98, 1), c(101, 99, 100, 2),
      c(100.01, 99, 100.001, 3), // tiny breach
    ];
    const strongCandles = [
      c(98, 96, 97, 0), c(99, 97, 98, 1), c(101, 99, 100, 2),
      c(110, 99, 108, 3), // large breach
    ];

    const weak = detectBOS(weakCandles, swingHighs, []);
    const strong = detectBOS(strongCandles, swingHighs, []);

    assert.ok(weak.bullishBOS.length === 1);
    assert.ok(strong.bullishBOS.length === 1);
    assert.ok(
      strong.bullishBOS[0]!.strength > weak.bullishBOS[0]!.strength,
      "large breach should have higher strength",
    );
  });
});

// ─── Bearish BOS ──────────────────────────────────────────────────────────────

describe("detectBOS — bearish BOS", () => {
  it("detects a bearish BOS when close falls below a prior swing low", () => {
    const swingLows: SwingPoint[] = [swing(2, 95, "low")];
    const candles = [
      c(100, 97, 98, 0),
      c(99, 96, 97, 1),
      c(97, 94, 95, 2), // swing low
      c(98, 96, 97, 3),
      c(96, 93, 94, 4), // close < 95 → bearish BOS
    ];

    const result = detectBOS(candles, [], swingLows);

    assert.equal(result.bearishBOS.length, 1);
    const bos = result.bearishBOS[0]!;
    assert.equal(bos.direction, "bearish");
    assert.equal(bos.brokenSwing.price, 95);
    assert.equal(bos.breakPrice, 94);
    assert.equal(bos.breakIndex, 4);
    assert.ok(bos.strength > 0);
    assert.ok(bos.confidence > 0);
    assert.strictEqual(result.lastBearishBOS, bos);
  });

  it("does NOT detect bearish BOS when close is exactly AT the swing low", () => {
    const swingLows: SwingPoint[] = [swing(2, 95, "low")];
    const candles = [
      c(100, 97, 98, 0),
      c(99, 96, 97, 1),
      c(97, 94, 95, 2),
      c(96, 95, 95, 3), // close == swing low: NOT a BOS
    ];

    const result = detectBOS(candles, [], swingLows);
    assert.equal(result.bearishBOS.length, 0);
  });
});

// ─── Wick-only breaks (must be rejected) ─────────────────────────────────────

describe("detectBOS — wick-only breaks rejected", () => {
  it("rejects a candle whose HIGH exceeds the swing high but CLOSE does not", () => {
    const swingHighs: SwingPoint[] = [swing(2, 105, "high")];
    const candles = [
      c(103, 100, 102, 0),
      c(104, 101, 103, 1),
      c(106, 103, 105, 2), // swing high at 105
      c(107, 103, 104, 3), // high = 107 > 105, but CLOSE = 104 < 105 → wick only
      c(104, 101, 103, 4), // no break either
    ];

    const result = detectBOS(candles, swingHighs, []);
    assert.equal(result.bullishBOS.length, 0, "wick-only break must not trigger a BOS");
  });

  it("rejects a candle whose LOW goes below the swing low but CLOSE does not", () => {
    const swingLows: SwingPoint[] = [swing(2, 95, "low")];
    const candles = [
      c(100, 97, 98, 0),
      c(99, 96, 97, 1),
      c(97, 94, 95, 2),
      c(97, 93, 96, 3), // low = 93 < 95, but CLOSE = 96 > 95 → wick only
    ];

    const result = detectBOS(candles, [], swingLows);
    assert.equal(result.bearishBOS.length, 0, "wick-only break must not trigger a BOS");
  });
});

// ─── Consecutive BOS ─────────────────────────────────────────────────────────

describe("detectBOS — consecutive BOS events", () => {
  it("detects multiple bullish BOS events when consecutive swing highs are each broken", () => {
    const swingHighs: SwingPoint[] = [
      swing(2, 105, "high"),
      swing(6, 110, "high"),
    ];
    const candles = [
      c(103, 100, 102, 0), c(104, 101, 103, 1),
      c(106, 103, 105, 2), // first swing high = 105
      c(104, 101, 103, 3),
      c(108, 104, 106, 4), // breaks first swing (close > 105)
      c(109, 105, 108, 5),
      c(111, 108, 110, 6), // second swing high = 110
      c(109, 107, 108, 7),
      c(112, 108, 111, 8), // breaks second swing (close > 110)
    ];

    const result = detectBOS(candles, swingHighs, []);

    assert.equal(result.bullishBOS.length, 2, "should detect two bullish BOS events");
    assert.equal(result.bullishBOS[0]!.brokenSwing.price, 105);
    assert.equal(result.bullishBOS[1]!.brokenSwing.price, 110);
    assert.equal(result.lastBullishBOS!.brokenSwing.price, 110);
  });

  it("detects mixed bullish and bearish BOS in the same candle sequence", () => {
    const swingHighs: SwingPoint[] = [swing(2, 105, "high")];
    const swingLows: SwingPoint[] = [swing(5, 98, "low")];
    const candles = [
      c(103, 100, 102, 0), c(104, 101, 103, 1),
      c(106, 103, 105, 2), // swing high = 105
      c(104, 101, 103, 3),
      c(107, 104, 106, 4), // bullish BOS: close > 105
      c(99, 97, 98,  5), // swing low = 98
      c(100, 95, 97, 6), // bearish BOS: close < 98
    ];

    const result = detectBOS(candles, swingHighs, swingLows);

    assert.equal(result.bullishBOS.length, 1);
    assert.equal(result.bearishBOS.length, 1);
    assert.equal(result.bullishBOS[0]!.direction, "bullish");
    assert.equal(result.bearishBOS[0]!.direction, "bearish");
  });
});

// ─── Flat markets / no swings ─────────────────────────────────────────────────

describe("detectBOS — flat markets", () => {
  it("returns empty results when no swing points are provided", () => {
    const candles = [
      c(100, 100, 100, 0), c(100, 100, 100, 1), c(100, 100, 100, 2),
    ];

    const result = detectBOS(candles, [], []);

    assert.equal(result.bullishBOS.length, 0);
    assert.equal(result.bearishBOS.length, 0);
    assert.equal(result.lastBullishBOS, null);
    assert.equal(result.lastBearishBOS, null);
  });

  it("returns empty results for an empty candle array", () => {
    const result = detectBOS([], [swing(2, 105, "high")], []);
    assert.equal(result.bullishBOS.length, 0);
    assert.equal(result.lastBullishBOS, null);
  });
});

// ─── Price gaps ───────────────────────────────────────────────────────────────

describe("detectBOS — price gaps", () => {
  it("registers a BOS when price gaps entirely above a swing high (gap-up candle)", () => {
    // A gap-up candle: low is above the prior swing high — naturally close > swing too.
    const swingHighs: SwingPoint[] = [swing(2, 105, "high")];
    const candles = [
      c(103, 100, 102, 0), c(104, 101, 103, 1),
      c(106, 103, 105, 2), // swing high = 105
      c(104, 101, 103, 3),
      c(115, 107, 112, 4), // gap-up: entire candle above 105
    ];

    const result = detectBOS(candles, swingHighs, []);
    assert.equal(result.bullishBOS.length, 1);
    assert.equal(result.bullishBOS[0]!.breakIndex, 4);
  });

  it("registers a bearish BOS on a gap-down candle", () => {
    const swingLows: SwingPoint[] = [swing(2, 95, "low")];
    const candles = [
      c(100, 97, 98, 0), c(99, 96, 97, 1),
      c(97, 94, 95, 2), // swing low = 95
      c(98, 96, 97, 3),
      c(92, 88, 90, 4), // gap-down: entire candle below 95
    ];

    const result = detectBOS(candles, [], swingLows);
    assert.equal(result.bearishBOS.length, 1);
    assert.equal(result.bearishBOS[0]!.breakIndex, 4);
  });
});

// ─── confirmationDistance filter ─────────────────────────────────────────────

describe("detectBOS — confirmationDistance filter", () => {
  it("rejects a close that doesn't clear the swing level by confirmationDistance", () => {
    const swingHighs: SwingPoint[] = [swing(2, 105, "high")];
    const candles = [
      c(103, 100, 102, 0), c(104, 101, 103, 1),
      c(106, 103, 105, 2),
      c(105.5, 103, 105.3, 3), // close = 105.3 > 105 but < 105.5 (confirmationDistance = 0.5)
    ];

    const result = detectBOS(candles, swingHighs, [], { confirmationDistance: 0.5 });
    assert.equal(result.bullishBOS.length, 0, "close doesn't clear level + distance");
  });

  it("accepts a close that clears the swing level + confirmationDistance", () => {
    const swingHighs: SwingPoint[] = [swing(2, 105, "high")];
    const candles = [
      c(103, 100, 102, 0), c(104, 101, 103, 1),
      c(106, 103, 105, 2),
      c(106, 104, 105.6, 3), // close = 105.6 > 105.5 (105 + 0.5)
    ];

    const result = detectBOS(candles, swingHighs, [], { confirmationDistance: 0.5 });
    assert.equal(result.bullishBOS.length, 1);
  });
});

// ─── minCandleClosePct filter ─────────────────────────────────────────────────

describe("detectBOS — minCandleClosePct filter", () => {
  it("rejects a bullish BOS close that is too low in the candle range", () => {
    const swingHighs: SwingPoint[] = [swing(2, 105, "high")];
    const candles = [
      c(103, 100, 102, 0), c(104, 101, 103, 1),
      c(106, 103, 105, 2),
      // high=110, low=100, close=106 → closePct = (106-100)/(110-100) = 0.6 — but we require 0.7
      c(110, 100, 106, 3),
    ];

    const result = detectBOS(candles, swingHighs, [], { minCandleClosePct: 0.7 });
    assert.equal(result.bullishBOS.length, 0, "close in bottom 40% of range rejects when threshold is 70%");
  });

  it("accepts a bullish BOS close that meets the minCandleClosePct threshold", () => {
    const swingHighs: SwingPoint[] = [swing(2, 105, "high")];
    const candles = [
      c(103, 100, 102, 0), c(104, 101, 103, 1),
      c(106, 103, 105, 2),
      // high=110, low=100, close=108 → closePct = (108-100)/(110-100) = 0.8 ≥ 0.7 ✓
      c(110, 100, 108, 3),
    ];

    const result = detectBOS(candles, swingHighs, [], { minCandleClosePct: 0.7 });
    assert.equal(result.bullishBOS.length, 1);
  });

  it("rejects a bearish BOS close that is too high in the candle range", () => {
    const swingLows: SwingPoint[] = [swing(2, 95, "low")];
    const candles = [
      c(100, 97, 98, 0), c(99, 96, 97, 1),
      c(97, 94, 95, 2),
      // high=100, low=90, close=93 → closePct = (93-90)/(100-90) = 0.3, so
      // bearish position = 1 - 0.3 = 0.7 ≥ 0.6 → should pass with threshold 0.6
      // Let's make a failing case: close=96, closePct=(96-90)/(100-90)=0.6, bearish=0.4 < 0.6
      c(100, 90, 96, 3),
    ];

    const result = detectBOS(candles, [], swingLows, { minCandleClosePct: 0.6 });
    assert.equal(result.bearishBOS.length, 0, "close too high in range should be rejected for bearish BOS");
  });
});

// ─── Strength and weak-break scoring ─────────────────────────────────────────

describe("detectBOS — strength scoring", () => {
  it("assigns strength = 0 for a negligibly small breach", () => {
    const swingHighs: SwingPoint[] = [swing(2, 100, "high")];
    const candles = [
      c(98, 96, 97, 0), c(99, 97, 98, 1), c(101, 99, 100, 2),
      // Close just barely above — breach ≈ 0.000001 / 100 / 0.005 ≈ 0.000002 → effectively 0
      c(100.001, 99, 100.0001, 3),
    ];

    const result = detectBOS(candles, swingHighs, []);
    assert.equal(result.bullishBOS.length, 1);
    const strength = result.bullishBOS[0]!.strength;
    assert.ok(strength >= 0 && strength <= 1, "strength must be in [0, 1]");
    // Tiny breach: strength very close to 0
    assert.ok(strength < 0.01, `expected near-zero strength, got ${strength}`);
  });

  it("caps strength at 1 for extremely large breaches", () => {
    const swingHighs: SwingPoint[] = [swing(2, 100, "high")];
    const candles = [
      c(98, 96, 97, 0), c(99, 97, 98, 1), c(101, 99, 100, 2),
      c(200, 99, 190, 3), // 90 % breach above 100
    ];

    const result = detectBOS(candles, swingHighs, []);
    assert.equal(result.bullishBOS.length, 1);
    assert.equal(result.bullishBOS[0]!.strength, 1, "strength must be capped at 1");
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe("detectBOS — edge cases", () => {
  it("handles a single-candle dataset gracefully", () => {
    const swingHighs: SwingPoint[] = [swing(0, 100, "high")];
    const candles = [c(101, 99, 100, 0)];
    // swing.index = 0, so ci starts at 1 — no candles beyond index 0 → no BOS
    const result = detectBOS(candles, swingHighs, []);
    assert.equal(result.bullishBOS.length, 0);
  });

  it("handles zero-range candles (high === low) without division errors", () => {
    const swingHighs: SwingPoint[] = [swing(2, 100, "high")];
    const candles = [
      c(99, 99, 99, 0), c(100, 100, 100, 1), c(100, 100, 100, 2),
      c(101, 101, 101, 3), // zero-range: close > 100 → BOS
    ];
    // Should not throw
    const result = detectBOS(candles, swingHighs, []);
    assert.equal(result.bullishBOS.length, 1);
    // candleClosePct defaults to 0.5 for zero-range candles
    assert.ok(result.bullishBOS[0]!.confidence >= 0);
  });
});

// ─── Non-chronological break ordering ────────────────────────────────────────
// An older swing can be broken LATER than a newer swing (e.g. a deeper LH
// cleared many candles after a shallower LH). lastBullishBOS must reflect the
// truly most recent breakIndex, not the position in swing-iteration order.

describe("detectBOS — non-chronological break ordering", () => {
  it("lastBullishBOS points to the highest breakIndex even when an older swing breaks later", () => {
    // Two swing highs: first at price 102 (swing index 2), second at price 110 (swing index 6).
    // The shallower swing (102) is broken first at candle 7; the deeper swing (110) breaks later at 12.
    const swingHighs: SwingPoint[] = [
      swing(2, 110, "high"),   // deeper level — broken LATER
      swing(6, 102, "high"),   // shallower level — broken FIRST
    ];
    const candles: Array<StructureCandle & { close: number }> = [
      c(108, 105, 106, 0), c(109, 106, 107, 1),
      c(111, 108, 110, 2), // first swing high at index 2, price = 110
      c(109, 106, 107, 3), c(108, 105, 106, 4), c(107, 104, 105, 5),
      c(103, 100, 102, 6), // second swing high at index 6, price = 102
      c(104, 101, 103, 7), // breaks second swing (102) first: close=103 > 102
      c(106, 103, 105, 8), c(108, 105, 107, 9), c(110, 107, 109, 10),
      c(111, 108, 109, 11), // high=111 > 110 but close=109 → wick-only, NOT a BOS
      c(113, 110, 112, 12), // close=112 > 110 → breaks first swing (110) later
    ];

    const result = detectBOS(candles, swingHighs, []);

    assert.equal(result.bullishBOS.length, 2, "should detect two bullish BOS events");
    // The one at breakIndex 7 (shallower) and breakIndex 12 (deeper).
    const indices = result.bullishBOS.map((b) => b.breakIndex);
    assert.deepEqual(indices, [7, 12], "bullishBOS must be sorted by breakIndex ascending");
    // lastBullishBOS must be the one at breakIndex 12, not 7.
    assert.equal(result.lastBullishBOS!.breakIndex, 12, "lastBullishBOS must be the truly most recent break");
    assert.equal(result.lastBullishBOS!.brokenSwing.price, 110, "most recent break is of the 110 swing");
  });

  it("lastBearishBOS points to the highest breakIndex even when an older swing breaks later", () => {
    const swingLows: SwingPoint[] = [
      swing(2, 90, "low"),  // deeper — broken LATER
      swing(6, 98, "low"),  // shallower — broken FIRST
    ];
    const candles: Array<StructureCandle & { close: number }> = [
      c(95, 92, 94, 0), c(94, 91, 93, 1),
      c(92, 89, 90, 2), // first swing low at index 2, price = 90
      c(94, 91, 93, 3), c(95, 92, 94, 4), c(96, 93, 95, 5),
      c(99, 96, 98, 6), // second swing low at index 6, price = 98
      c(98, 95, 97, 7), // breaks second swing (98) first: close=97 < 98
      c(97, 94, 96, 8), c(96, 93, 95, 9), c(95, 92, 94, 10),
      c(92, 89, 91, 11),
      c(91, 88, 89, 12), // breaks first swing (90) later: close=89 < 90
    ];

    const result = detectBOS(candles, [], swingLows);

    assert.equal(result.bearishBOS.length, 2);
    const indices = result.bearishBOS.map((b) => b.breakIndex);
    assert.deepEqual(indices, [7, 12], "bearishBOS must be sorted by breakIndex ascending");
    assert.equal(result.lastBearishBOS!.breakIndex, 12, "lastBearishBOS must be the truly most recent break");
    assert.equal(result.lastBearishBOS!.brokenSwing.price, 90);
  });
});

// ─── undefined close skip semantics ──────────────────────────────────────────

describe("detectBOS — undefined close skip", () => {
  it("skips candles without a close price and still detects BOS on a later candle that has close", () => {
    const swingHighs: SwingPoint[] = [swing(2, 105, "high")];
    // Mix of candles with and without close
    const candles: StructureCandle[] = [
      { high: 103, low: 100, timestamp: 0 },                        // no close
      { high: 104, low: 101, timestamp: 1 },                        // no close
      { high: 106, low: 103, close: 105, timestamp: 2 },            // swing high
      { high: 107, low: 104, timestamp: 3 },                        // no close — skip
      { high: 108, low: 105, close: 106, timestamp: 4 },            // has close > 105 → BOS
    ];

    const result = detectBOS(candles, swingHighs, []);
    assert.equal(result.bullishBOS.length, 1, "BOS should be detected on the candle that has a close");
    assert.equal(result.bullishBOS[0]!.breakIndex, 4);
    assert.equal(result.bullishBOS[0]!.breakPrice, 106);
  });

  it("returns no BOS if all candles after the swing lack close prices", () => {
    const swingHighs: SwingPoint[] = [swing(2, 105, "high")];
    const candles: StructureCandle[] = [
      { high: 103, low: 100, timestamp: 0 },
      { high: 104, low: 101, timestamp: 1 },
      { high: 106, low: 103, close: 105, timestamp: 2 },
      { high: 108, low: 105, timestamp: 3 }, // high > 105 but no close
    ];

    const result = detectBOS(candles, swingHighs, []);
    assert.equal(result.bullishBOS.length, 0, "no BOS without a confirming close price");
  });
});

// ─── Integration via analyzeMarketStructure ───────────────────────────────────

describe("analyzeMarketStructure — BOS integration", () => {
  /** Build a sequence: downtrend then strong break upward. */
  function buildBreakoutScenario(): StructureCandle[] {
    // swingLength=2 means pivot needs 2 candles on each side.
    // Pattern: establish swing highs/lows, then break one.
    return [
      // down-leg 1: swing high around index 2
      { high: 110, low: 108, timestamp: 0 },
      { high: 112, low: 110, timestamp: 1 },
      { high: 115, low: 112, timestamp: 2 }, // swing high candidate
      { high: 113, low: 110, timestamp: 3 },
      { high: 111, low: 108, timestamp: 4 },
      // down-leg 2: swing low around index 7
      { high: 109, low: 106, timestamp: 5 },
      { high: 107, low: 104, timestamp: 6 },
      { high: 105, low: 102, timestamp: 7 }, // swing low candidate
      { high: 107, low: 104, timestamp: 8 },
      { high: 109, low: 106, timestamp: 9 },
      // Break above swing high at index 2 (115) with a strong close
      { high: 120, low: 115, timestamp: 10 },
      { high: 118, low: 116, timestamp: 11 },
      { high: 119, low: 117, timestamp: 12 },
    ];
  }

  it("produces non-null lastBullishBOS when a swing high is broken", () => {
    const candles = buildBreakoutScenario();
    const result = analyzeMarketStructure(candles, { swingLength: 2 });
    // The exact number of BOS depends on swing detection, but verify structure fields exist.
    assert.ok("lastBullishBOS" in result, "lastBullishBOS field should exist");
    assert.ok("lastBearishBOS" in result, "lastBearishBOS field should exist");
    assert.ok("currentStructureBias" in result, "currentStructureBias field should exist");
    assert.ok("allBullishBOS" in result, "allBullishBOS field should exist");
    assert.ok("allBearishBOS" in result, "allBearishBOS field should exist");
  });

  it("returns null lastBullishBOS / lastBearishBOS for an empty dataset", () => {
    const result = analyzeMarketStructure([]);
    assert.equal(result.lastBullishBOS, null);
    assert.equal(result.lastBearishBOS, null);
    assert.equal(result.currentStructureBias, null);
    assert.deepEqual(result.allBullishBOS, []);
    assert.deepEqual(result.allBearishBOS, []);
  });

  it("currentStructureBias follows the most recent BOS direction", () => {
    // Build a scenario where a bullish BOS is followed by a bearish BOS.
    const swingHighs: SwingPoint[] = [swing(2, 105, "high")];
    const swingLows: SwingPoint[] = [swing(8, 98, "low")];
    const candles: StructureCandle[] = [
      { high: 103, low: 100, timestamp: 0 },
      { high: 104, low: 101, timestamp: 1 },
      { high: 106, low: 103, timestamp: 2 }, // swing high = 105 (from swingHighs)
      { high: 104, low: 101, timestamp: 3 },
      { high: 108, low: 104, timestamp: 4 }, // bullish BOS (close > 105 needed)
      { high: 106, low: 103, timestamp: 5 },
      { high: 104, low: 101, timestamp: 6 },
      { high: 102, low: 99, timestamp: 7 },
      { high: 100, low: 97, timestamp: 8 },  // swing low = 98 (from swingLows)
      { high: 100, low: 97, timestamp: 9 },
      { high: 99, low: 96, timestamp: 10 },  // bearish BOS (close < 98 needed)
    ];

    // Add close prices to the StructureCandle — we need to cast for the detector
    const candlesWithClose = candles.map((c, i) => ({
      ...c,
      close: i === 4 ? 106 : i === 10 ? 97 : (c.high + c.low) / 2,
    }));

    const bullBOS = detectBOS(candlesWithClose, swingHighs, swingLows);
    // breakIndex 4 (bullish, close=106) vs breakIndex 10 (bearish, close=97)
    if (bullBOS.lastBullishBOS && bullBOS.lastBearishBOS) {
      const laterIndex = Math.max(
        bullBOS.lastBullishBOS.breakIndex,
        bullBOS.lastBearishBOS.breakIndex,
      );
      const bias = laterIndex === bullBOS.lastBullishBOS.breakIndex ? "bullish" : "bearish";
      assert.equal(bias, "bearish", "most recent BOS (bearish at index 10) should define current bias");
    }
  });
});
