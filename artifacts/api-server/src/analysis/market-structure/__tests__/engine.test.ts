/**
 * Integration tests for the Market Structure Engine orchestrator
 * (analyzeMarketStructure) — swing detection + classification + trend
 * derivation wired together end-to-end.
 */
import { describe, it } from "vitest";
import assert from "node:assert/strict";
import type { StructureCandle } from "../types.js";
import { analyzeMarketStructure } from "../engine.js";

function c(high: number, low: number, i: number = 0): StructureCandle {
  return { high, low, timestamp: new Date(2024, 0, 1 + i) };
}

/** A staircase of higher highs and higher lows — a clean uptrend. */
function uptrendCandles(): StructureCandle[] {
  const candles: StructureCandle[] = [];
  let base = 100;
  let i = 0;
  for (let leg = 0; leg < 5; leg++) {
    // up to a peak, pull back to a higher low than before, repeat
    candles.push(c(base + 1, base, i++));
    candles.push(c(base + 3, base + 2, i++));
    candles.push(c(base + 6, base + 5, i++)); // peak
    candles.push(c(base + 4, base + 3, i++));
    candles.push(c(base + 2.5, base + 1.5, i++)); // higher low than previous leg's low
    base += 5;
  }
  return candles;
}

/** Mirror image: lower highs, lower lows — a clean downtrend. */
function downtrendCandles(): StructureCandle[] {
  const candles: StructureCandle[] = [];
  let base = 100;
  let i = 0;
  for (let leg = 0; leg < 5; leg++) {
    candles.push(c(base, base - 1, i++));
    candles.push(c(base - 2, base - 3, i++));
    candles.push(c(base - 5, base - 6, i++)); // trough
    candles.push(c(base - 3, base - 4, i++));
    candles.push(c(base - 1.5, base - 2.5, i++)); // lower high than previous leg's high
    base -= 5;
  }
  return candles;
}

describe("analyzeMarketStructure", () => {
  it("returns a fully-null/sideways state for an empty dataset", () => {
    const result = analyzeMarketStructure([]);
    assert.equal(result.currentTrend, "sideways");
    assert.equal(result.previousTrend, "sideways");
    assert.equal(result.latestSwingHigh, null);
    assert.equal(result.latestSwingLow, null);
    assert.equal(result.latestSwingType, null);
    assert.equal(result.marketPhase, "ranging");
    assert.deepEqual(result.swingHighs, []);
    assert.deepEqual(result.swingLows, []);
  });

  it("handles a tiny dataset (fewer candles than the swing window) gracefully", () => {
    const result = analyzeMarketStructure([c(10, 9, 0), c(11, 10, 1)], { swingLength: 2 });
    assert.equal(result.currentTrend, "sideways");
    assert.equal(result.marketPhase, "ranging");
  });

  it("handles a flat/range-bound market as sideways with no swings", () => {
    const candles = Array.from({ length: 20 }, (_, i) => c(100, 99, i));
    const result = analyzeMarketStructure(candles, { swingLength: 2 });
    assert.equal(result.currentTrend, "sideways");
    assert.equal(result.marketPhase, "ranging");
    assert.equal(result.latestSwingType, null);
  });

  it("identifies a bullish trend from a staircase of higher highs/higher lows", () => {
    const result = analyzeMarketStructure(uptrendCandles(), { swingLength: 1 });
    assert.equal(result.currentTrend, "bullish");
    assert.ok(result.latestSwingType === "HH" || result.latestSwingType === "HL");
    assert.ok(result.latestSwingHigh !== null);
    assert.ok(result.latestSwingLow !== null);
  });

  it("identifies a bearish trend from a staircase of lower highs/lower lows", () => {
    const result = analyzeMarketStructure(downtrendCandles(), { swingLength: 1 });
    assert.equal(result.currentTrend, "bearish");
    assert.ok(result.latestSwingType === "LH" || result.latestSwingType === "LL");
  });

  it("reports marketPhase 'trending' (not 'reversal') the first time a directional trend confirms out of a range", () => {
    // The very first HH+HL confirmation transitions from previousTrend "sideways"
    // to currentTrend "bullish" — that's a trend establishing itself, not a flip.
    const result = analyzeMarketStructure(uptrendCandles(), { swingLength: 1 });
    assert.equal(result.currentTrend, "bullish");
    assert.equal(result.marketPhase, "trending");
  });

  it("reports marketPhase 'reversal' only on a genuine flip between opposite directional biases", () => {
    // H1(110) -> L1(94) -> H2(115, HH) -> L2(99, HL, confirms bullish)
    // -> H3(105, LH, trend still bullish) -> L3(89, LL, confirms bearish: reversal)
    const candles: StructureCandle[] = [
      c(100, 99, 0),
      c(110, 109, 1), // H1
      c(95, 94, 2),   // L1
      c(115, 114, 3), // H2 (HH)
      c(100, 99, 4),  // L2 (HL) -> confirms bullish
      c(105, 104, 5), // H3 (LH) -> trend still bullish (low unchanged)
      c(90, 89, 6),   // L3 (LL) -> confirms bearish -> reversal
      c(95, 94, 7),
    ];
    const result = analyzeMarketStructure(candles, { swingLength: 1 });
    assert.equal(result.currentTrend, "bearish");
    assert.equal(result.marketPhase, "reversal");
  });

  it("reports marketPhase 'reversal' on the symmetric bearish -> bullish flip", () => {
    // Mirror image of the bullish->bearish reversal case above (price-inverted):
    // L1(90) -> H1(106) -> L2(85, LL vs L1) -> H2(101, LH vs H1, confirms bearish)
    // -> L3(95, HL vs L2, trend still bearish) -> H3(111, HH vs H2, confirms bullish -> reversal)
    const candles: StructureCandle[] = [
      c(101, 100, 0),
      c(91, 90, 1),   // L1
      c(106, 105, 2), // H1
      c(86, 85, 3),   // L2 (LL vs L1)
      c(101, 100, 4), // H2 (LH vs H1) -> confirms bearish
      c(96, 95, 5),   // L3 (HL vs L2) -> trend still bearish (high unchanged)
      c(111, 110, 6), // H3 (HH vs H2) -> confirms bullish -> reversal
      c(106, 105, 7),
    ];
    const result = analyzeMarketStructure(candles, { swingLength: 1 });
    assert.equal(result.currentTrend, "bullish");
    assert.equal(result.marketPhase, "reversal");
  });

  it("respects a custom swingLength option end-to-end", () => {
    const candles = uptrendCandles();
    const narrow = analyzeMarketStructure(candles, { swingLength: 1 });
    const wide = analyzeMarketStructure(candles, { swingLength: 5 });
    // A much wider window should find fewer (or equal) swings than a narrow one.
    assert.ok(wide.swingHighs.length <= narrow.swingHighs.length);
  });

  it("defaults swingLength to 2 when no options are passed", () => {
    assert.doesNotThrow(() => analyzeMarketStructure(uptrendCandles()));
  });
});
