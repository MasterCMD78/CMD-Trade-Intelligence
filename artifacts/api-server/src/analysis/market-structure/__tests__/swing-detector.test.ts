import { describe, it } from "vitest";
import assert from "node:assert/strict";
import type { StructureCandle } from "../types.js";
import { detectSwings } from "../swing-detector.js";

function c(high: number, low: number, i = 0): StructureCandle {
  return { high, low, timestamp: new Date(2024, 0, 1 + i) };
}

describe("detectSwings", () => {
  it("returns no swings when there are fewer candles than required for the window", () => {
    const candles = [c(10, 9), c(11, 10), c(12, 11)]; // needs 5 for swingLength=2
    const { highs, lows } = detectSwings(candles, 2);
    assert.deepEqual(highs, []);
    assert.deepEqual(lows, []);
  });

  it("returns no swings for an empty array", () => {
    const { highs, lows } = detectSwings([], 2);
    assert.deepEqual(highs, []);
    assert.deepEqual(lows, []);
  });

  it("detects a single clean swing high in the middle of a V-up-then-down series", () => {
    // 10,11,12(peak),11,10
    const candles = [c(10, 9), c(11, 10), c(12, 11), c(11, 10), c(10, 9)];
    const { highs, lows } = detectSwings(candles, 2);
    assert.equal(highs.length, 1);
    assert.equal(highs[0]!.index, 2);
    assert.equal(highs[0]!.price, 12);
    assert.equal(lows.length, 0);
  });

  it("detects a single clean swing low in a dip series", () => {
    const candles = [c(20, 15), c(19, 14), c(18, 10), c(19, 14), c(20, 15)];
    const { highs, lows } = detectSwings(candles, 2);
    assert.equal(lows.length, 1);
    assert.equal(lows[0]!.index, 2);
    assert.equal(lows[0]!.price, 10);
  });

  it("respects a configurable, larger swing length (fewer, more significant swings)", () => {
    // A peak that is only a local pivot for a narrow window shouldn't
    // qualify once swingLength widens beyond its true significance.
    const candles = [
      c(10, 9), c(11, 10), c(12, 11), c(11, 10), c(10, 9), // small peak at idx 2
      c(15, 14), c(16, 15), c(20, 19), c(16, 15), c(15, 14), // bigger peak at idx 7
      c(14, 13), c(13, 12), // extra padding so idx 7 has a full 4-candle window on the right
    ];
    const narrow = detectSwings(candles, 1);
    const wide = detectSwings(candles, 4);

    assert.ok(narrow.highs.some((h) => h.index === 2), "narrow window should catch the small peak");
    assert.ok(!wide.highs.some((h) => h.index === 2), "wide window should reject the small peak");
    assert.ok(wide.highs.some((h) => h.index === 7), "wide window should still catch the major peak");
  });

  it("does not mark a flat plateau (equal highs) as a swing high", () => {
    const candles = [c(10, 9), c(12, 11), c(12, 11), c(10, 9), c(9, 8)];
    const { highs } = detectSwings(candles, 2);
    // Neither index 1 nor 2 is *strictly* greater than its plateau neighbour.
    assert.equal(highs.length, 0);
  });

  it("handles a perfectly flat market with no swings at all", () => {
    const candles = Array.from({ length: 10 }, () => c(100, 99));
    const { highs, lows } = detectSwings(candles, 2);
    assert.deepEqual(highs, []);
    assert.deepEqual(lows, []);
  });

  it("clamps/normalizes an invalid swingLength to the default rather than throwing", () => {
    const candles = [c(10, 9), c(11, 10), c(12, 11), c(11, 10), c(10, 9)];
    assert.doesNotThrow(() => detectSwings(candles, 0));
    assert.doesNotThrow(() => detectSwings(candles, -3));
    assert.doesNotThrow(() => detectSwings(candles, NaN));
  });
});
