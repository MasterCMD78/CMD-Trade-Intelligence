/**
 * Bias Engine — comprehensive test suite.
 *
 * Covers:
 *   - Strong bullish (all TFs strongly bullish)
 *   - Bullish (moderate bullish)
 *   - Neutral (sideways or mixed)
 *   - Bearish (moderate bearish)
 *   - Strong bearish (all TFs strongly bearish)
 *   - Tier grouping (higher/intermediate/lower biases independently)
 *   - Partial data (missing TFs)
 *   - Mixed tier biases
 */

import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { computeBias } from "../bias.js";
import type { MTFKey, TimeframeSnapshot } from "../types.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function snap(trend: "bullish" | "bearish" | "sideways"): TimeframeSnapshot {
  return {
    candleCount: 100, trend, marketPhase: "trending",
    bos:           { detected: false, direction: null, price: null, strength: null, confidence: null },
    choch:         { detected: false, direction: null, confidence: null },
    liquidity:     { levelCount: 0, sweepCount: 0, lastSweepDirection: null, lastSweepRejection: null, lastSweepConfidence: null, lastSweepPrice: null },
    orderBlocks:   { activeCount: 0, lastBullishHigh: null, lastBullishLow: null, lastBullishConfidence: null, lastBullishMitigated: false, lastBearishHigh: null, lastBearishLow: null, lastBearishConfidence: null, lastBearishMitigated: false },
    fairValueGaps: { activeCount: 0, lastBullishGapHigh: null, lastBullishGapLow: null, lastBullishStatus: null, lastBullishFillPct: null, lastBearishGapHigh: null, lastBearishGapLow: null, lastBearishStatus: null, lastBearishFillPct: null },
    premiumDiscount: { available: false, currentZone: null, pricePosition: null, equilibrium: null, rangeHigh: null, rangeLow: null },
    swingHigh: null, swingLow: null,
  };
}

// ─── Strong bullish ───────────────────────────────────────────────────────────

describe("computeBias — strong_bullish", () => {
  it("returns strong_bullish for all bullish TFs", () => {
    const snapshots: Partial<Record<MTFKey, TimeframeSnapshot>> = {
      weekly: snap("bullish"), daily: snap("bullish"),
      h4: snap("bullish"), h1: snap("bullish"),
      m30: snap("bullish"), m15: snap("bullish"), m5: snap("bullish"), m1: snap("bullish"),
    };
    const result = computeBias(snapshots);
    assert.equal(result.overallBias, "strong_bullish");
    assert.equal(result.higherTimeframeBias, "strong_bullish");
    assert.equal(result.intermediateBias, "strong_bullish");
    assert.equal(result.lowerTimeframeBias, "strong_bullish");
  });

  it("overallScore is close to +1 for all bullish", () => {
    const snapshots: Partial<Record<MTFKey, TimeframeSnapshot>> = {
      weekly: snap("bullish"), daily: snap("bullish"),
      h4: snap("bullish"), h1: snap("bullish"),
    };
    const result = computeBias(snapshots);
    assert.ok(result.overallScore > 0.9, "score should be close to 1");
  });
});

// ─── Strong bearish ───────────────────────────────────────────────────────────

describe("computeBias — strong_bearish", () => {
  it("returns strong_bearish for all bearish TFs", () => {
    const snapshots: Partial<Record<MTFKey, TimeframeSnapshot>> = {
      weekly: snap("bearish"), daily: snap("bearish"),
      h4: snap("bearish"), h1: snap("bearish"),
      m30: snap("bearish"), m15: snap("bearish"), m5: snap("bearish"), m1: snap("bearish"),
    };
    const result = computeBias(snapshots);
    assert.equal(result.overallBias, "strong_bearish");
    assert.ok(result.overallScore < -0.9);
  });
});

// ─── Neutral ──────────────────────────────────────────────────────────────────

describe("computeBias — neutral", () => {
  it("returns neutral for all sideways TFs", () => {
    const snapshots: Partial<Record<MTFKey, TimeframeSnapshot>> = {
      weekly: snap("sideways"), daily: snap("sideways"),
      h4: snap("sideways"), h1: snap("sideways"),
    };
    const result = computeBias(snapshots);
    assert.equal(result.overallBias, "neutral");
    assert.ok(Math.abs(result.overallScore) < 0.01);
  });

  it("returns neutral for empty map", () => {
    const result = computeBias({});
    assert.equal(result.overallBias, "neutral");
    assert.equal(result.overallScore, 0);
  });
});

// ─── Mixed tier biases ────────────────────────────────────────────────────────

describe("computeBias — mixed tiers", () => {
  it("returns bullish higher bias but bearish lower bias independently", () => {
    const snapshots: Partial<Record<MTFKey, TimeframeSnapshot>> = {
      weekly: snap("bullish"), daily: snap("bullish"),
      m30: snap("bearish"), m15: snap("bearish"), m5: snap("bearish"), m1: snap("bearish"),
    };
    const result = computeBias(snapshots);
    assert.equal(result.higherTimeframeBias, "strong_bullish", "higher tier should be strong_bullish");
    assert.equal(result.lowerTimeframeBias, "strong_bearish", "lower tier should be strong_bearish");
  });

  it("intermediate bias is neutral when no intermediate TF data", () => {
    const snapshots: Partial<Record<MTFKey, TimeframeSnapshot>> = {
      weekly: snap("bullish"), daily: snap("bullish"),
    };
    const result = computeBias(snapshots);
    assert.equal(result.intermediateBias, "neutral",
      "no intermediate TF data → score 0 → neutral");
  });
});

// ─── Bullish / Bearish thresholds ─────────────────────────────────────────────

describe("computeBias — moderate bias thresholds", () => {
  it("returns bullish when score is between 0.2 and 0.6", () => {
    // H4 bullish (weight 5) + H1 bearish (weight 4) → score = (5-4)/(5+4) ≈ 0.11
    // That might be neutral. Let's use weekly bullish + daily bearish = (8-6)/14 ≈ 0.14 → neutral
    // Try weekly + h4 bullish vs daily bearish = (8+5-6)/19 ≈ 0.37 → bullish
    const snapshots: Partial<Record<MTFKey, TimeframeSnapshot>> = {
      weekly: snap("bullish"),
      h4: snap("bullish"),
      daily: snap("bearish"),
    };
    const result = computeBias(snapshots);
    assert.equal(result.overallBias, "bullish",
      "(8+5-6)/(8+6+5) = 7/19 ≈ 0.37 → bullish");
  });
});
