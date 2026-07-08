import { describe, it } from "vitest";
import assert from "node:assert/strict";
import type { SwingPoint } from "../types.js";
import { classifySwings } from "../classifier.js";

function high(index: number, price: number): SwingPoint {
  return { index, price, timestamp: new Date(2024, 0, 1 + index), kind: "high" };
}
function low(index: number, price: number): SwingPoint {
  return { index, price, timestamp: new Date(2024, 0, 1 + index), kind: "low" };
}

describe("classifySwings", () => {
  it("leaves the first swing of each kind unlabeled (nothing to compare against)", () => {
    const { highs, lows } = classifySwings([high(2, 10)], [low(4, 5)]);
    assert.equal(highs[0]!.label, undefined);
    assert.equal(lows[0]!.label, undefined);
  });

  it("classifies a rising sequence of highs as HH", () => {
    const { highs } = classifySwings([high(2, 10), high(6, 12), high(10, 15)], []);
    assert.equal(highs[1]!.label, "HH");
    assert.equal(highs[2]!.label, "HH");
  });

  it("classifies a falling sequence of highs as LH", () => {
    const { highs } = classifySwings([high(2, 15), high(6, 12), high(10, 10)], []);
    assert.equal(highs[1]!.label, "LH");
    assert.equal(highs[2]!.label, "LH");
  });

  it("classifies a rising sequence of lows as HL", () => {
    const { lows } = classifySwings([], [low(2, 5), low(6, 7), low(10, 9)]);
    assert.equal(lows[1]!.label, "HL");
    assert.equal(lows[2]!.label, "HL");
  });

  it("classifies a falling sequence of lows as LL", () => {
    const { lows } = classifySwings([], [low(2, 9), low(6, 7), low(10, 5)]);
    assert.equal(lows[1]!.label, "LL");
    assert.equal(lows[2]!.label, "LL");
  });

  it("classifies an equal-price tie as the 'lower' label (failed to make progress)", () => {
    const { highs } = classifySwings([high(2, 10), high(6, 10)], []);
    assert.equal(highs[1]!.label, "LH");
    const { lows } = classifySwings([], [low(2, 5), low(6, 5)]);
    assert.equal(lows[1]!.label, "LL");
  });

  it("handles empty input for both kinds without throwing", () => {
    const { highs, lows } = classifySwings([], []);
    assert.deepEqual(highs, []);
    assert.deepEqual(lows, []);
  });

  it("classifies highs and lows independently of one another", () => {
    // Highs rising (HH) while lows falling (LL) — a valid, if unusual (expanding
    // range) combination; each series should be classified on its own terms.
    const { highs, lows } = classifySwings(
      [high(2, 10), high(6, 15)],
      [low(4, 5), low(8, 2)],
    );
    assert.equal(highs[1]!.label, "HH");
    assert.equal(lows[1]!.label, "LL");
  });
});
