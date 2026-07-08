import { describe, it } from "vitest";
import assert from "node:assert/strict";
import type { SwingPoint } from "../types.js";
import { computeTrend } from "../trend-engine.js";

function high(index: number, label?: SwingPoint["label"]): SwingPoint {
  return { index, price: index, timestamp: new Date(2024, 0, 1 + index), kind: "high", label };
}
function low(index: number, label?: SwingPoint["label"]): SwingPoint {
  return { index, price: index, timestamp: new Date(2024, 0, 1 + index), kind: "low", label };
}

describe("computeTrend", () => {
  it("is sideways with no classified swings", () => {
    const { currentTrend, previousTrend } = computeTrend([], []);
    assert.equal(currentTrend, "sideways");
    assert.equal(previousTrend, "sideways");
  });

  it("is sideways when only one kind of swing has a label (nothing to confirm against)", () => {
    const { currentTrend } = computeTrend([high(2), high(6, "HH")], []);
    assert.equal(currentTrend, "sideways");
  });

  it("is bullish once the latest high is HH and the latest low is HL", () => {
    const highs = [high(2), high(6, "HH")];
    const lows = [low(4), low(8, "HL")];
    const { currentTrend } = computeTrend(highs, lows);
    assert.equal(currentTrend, "bullish");
  });

  it("is bearish once the latest high is LH and the latest low is LL", () => {
    const highs = [high(2), high(6, "LH")];
    const lows = [low(4), low(8, "LL")];
    const { currentTrend } = computeTrend(highs, lows);
    assert.equal(currentTrend, "bearish");
  });

  it("is sideways on a mixed/conflicting read (HH paired with LL)", () => {
    const highs = [high(2), high(6, "HH")];
    const lows = [low(4), low(8, "LL")];
    const { currentTrend } = computeTrend(highs, lows);
    assert.equal(currentTrend, "sideways");
  });

  it("detects a bullish -> bearish trend transition, reporting the prior directional trend even through a transient sideways blip", () => {
    // Sequence over time: HL(4) -> HH(6) [confirms bullish] -> LH(10) [transient
    // sideways blip, only one side updated] -> LL(12) [confirms bearish].
    // previousTrend should report "bullish" (the last real directional trend),
    // not the transient sideways reading that appeared right before LL confirmed.
    const highs = [high(2), high(6, "HH"), high(10, "LH")];
    const lows = [low(4), low(8, "HL"), low(12, "LL")];
    const { currentTrend, previousTrend } = computeTrend(highs, lows);
    assert.equal(currentTrend, "bearish");
    assert.equal(previousTrend, "bullish");
  });

  it("continues reporting bullish as previousTrend across an uneventful new HH", () => {
    // HL(4)->HH(6) confirms bullish; then another HH(10) keeps it bullish; previousTrend should carry the prior bullish state.
    const highs = [high(2), high(6, "HH"), high(10, "HH")];
    const lows = [low(4), low(8, "HL")];
    const { currentTrend, previousTrend } = computeTrend(highs, lows);
    assert.equal(currentTrend, "bullish");
    assert.equal(previousTrend, "bullish");
  });

  it("small dataset: a single classified high/low pair is enough to confirm a trend", () => {
    const highs = [high(2), high(6, "HH")];
    const lows = [low(4), low(8, "HL")];
    const { currentTrend, previousTrend } = computeTrend(highs, lows);
    assert.equal(currentTrend, "bullish");
    assert.equal(previousTrend, "sideways");
  });
});
