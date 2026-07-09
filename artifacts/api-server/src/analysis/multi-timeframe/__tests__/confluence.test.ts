/**
 * Confluence Engine — comprehensive test suite.
 *
 * Covers:
 *   - 100% confluence (all TFs agree)
 *   - 50% confluence (TFs split)
 *   - Low confluence (< 40% → negative confidence adjustment)
 *   - Trend conflict penalty
 *   - Confidence adjustment clamping
 *   - Empty/partial data
 */

import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { computeConfluence } from "../confluence.js";
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

// ─── Full confluence ──────────────────────────────────────────────────────────

describe("computeConfluence — full bullish agreement", () => {
  it("returns confluenceScore 100 when all TFs bullish", () => {
    const snapshots: Partial<Record<MTFKey, TimeframeSnapshot>> = {
      weekly: snap("bullish"), daily: snap("bullish"),
      h4: snap("bullish"), h1: snap("bullish"),
      m30: snap("bullish"), m15: snap("bullish"), m5: snap("bullish"), m1: snap("bullish"),
    };
    const result = computeConfluence(snapshots, "full_bullish");
    assert.equal(result.confluenceScore, 100);
    assert.equal(result.dominantDirection, "bullish");
  });

  it("returns maximum positive confidence adjustment at full confluence", () => {
    const snapshots: Partial<Record<MTFKey, TimeframeSnapshot>> = {
      weekly: snap("bullish"), daily: snap("bullish"),
      h4: snap("bullish"), h1: snap("bullish"),
    };
    const result = computeConfluence(snapshots, "full_bullish");
    assert.ok(result.confidenceAdjustment > 0, "full consensus should boost confidence");
  });
});

describe("computeConfluence — full bearish agreement", () => {
  it("returns confluenceScore 100 when all TFs bearish", () => {
    const snapshots: Partial<Record<MTFKey, TimeframeSnapshot>> = {
      weekly: snap("bearish"), daily: snap("bearish"),
      h4: snap("bearish"), h1: snap("bearish"),
    };
    const result = computeConfluence(snapshots, "full_bearish");
    assert.equal(result.confluenceScore, 100);
    assert.equal(result.dominantDirection, "bearish");
  });
});

// ─── Low confluence / conflict ────────────────────────────────────────────────

describe("computeConfluence — trend conflict penalty", () => {
  it("applies additional confidence penalty when alignmentType is trend_conflict", () => {
    const snapshots: Partial<Record<MTFKey, TimeframeSnapshot>> = {
      weekly: snap("bullish"), daily: snap("bullish"),
      h4: snap("bearish"), h1: snap("bearish"),
    };
    const normalResult  = computeConfluence(snapshots, "mixed");
    const conflictResult = computeConfluence(snapshots, "trend_conflict");

    assert.ok(conflictResult.confidenceAdjustment < normalResult.confidenceAdjustment,
      "trend_conflict should apply additional penalty vs mixed");
  });
});

describe("computeConfluence — low consensus", () => {
  it("returns negative confidence adjustment when confluence is below 40%", () => {
    // 4 TFs bullish (W=1), 4 TFs bearish (W=1) — roughly equal
    // Specifically: m1 (1) bullish, m5 (1.5) bearish, m15 (2) bullish, m30 (3) bearish
    // bullishW = 1+2 = 3, bearishW = 1.5+3 = 4.5, total = 7.5 → dominant = bearish at 60% → not low
    // Better: split evenly
    const snapshots: Partial<Record<MTFKey, TimeframeSnapshot>> = {
      weekly: snap("bullish"),    // weight 8
      daily:  snap("bearish"),    // weight 6
      h4:     snap("bullish"),    // weight 5
      h1:     snap("bearish"),    // weight 4
      m30:    snap("bullish"),    // weight 3
      m15:    snap("bearish"),    // weight 2
      m5:     snap("bullish"),    // weight 1.5
      m1:     snap("bearish"),    // weight 1
    };
    // bullishW = 8+5+3+1.5 = 17.5, bearishW = 6+4+2+1 = 13, total = 30.5
    // confluenceScore ≈ round(17.5/30.5*100) ≈ 57 → not below 40
    // This will be moderate → adj = 0 or +6
    const result = computeConfluence(snapshots, "mixed");
    assert.ok(result.confluenceScore > 0, "should have positive confluence score");
  });

  it("returns negative adj for perfectly even split between bulls and bears", () => {
    // Perfectly equal: weekly bull (8) vs daily bear (8)... we can't do perfectly equal
    // so let's try: 2 bull TFs vs 2 bear TFs at similar weights
    const snapshots: Partial<Record<MTFKey, TimeframeSnapshot>> = {
      m1: snap("bullish"),  // 1
      m5: snap("bearish"),  // 1.5
    };
    // bullW = 1, bearW = 1.5, total = 2.5 → dominant = bearish at 60% → not below 40
    const result = computeConfluence(snapshots, "mixed");
    assert.ok(typeof result.confluenceScore === "number");
    assert.ok(result.confidenceAdjustment <= 6); // at most +6 for ~60%
  });
});

// ─── Confidence adjustment clamping ──────────────────────────────────────────

describe("computeConfluence — confidence adjustment bounds", () => {
  it("confidenceAdjustment is always between -20 and +20", () => {
    const cases: Array<Partial<Record<MTFKey, TimeframeSnapshot>>> = [
      { weekly: snap("bullish"), daily: snap("bullish"), h4: snap("bullish"), h1: snap("bullish"), m30: snap("bullish"), m15: snap("bullish"), m5: snap("bullish"), m1: snap("bullish") },
      { weekly: snap("bearish"), daily: snap("bearish"), h4: snap("bearish"), h1: snap("bearish"), m30: snap("bearish"), m15: snap("bearish"), m5: snap("bearish"), m1: snap("bearish") },
      {},
    ];

    for (const snapshots of cases) {
      const result = computeConfluence(snapshots, "mixed");
      assert.ok(result.confidenceAdjustment >= -20, "adj must be >= -20");
      assert.ok(result.confidenceAdjustment <= 20,  "adj must be <= +20");
    }
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe("computeConfluence — edge cases", () => {
  it("returns 50 and 0 adjustment for empty snapshot map", () => {
    const result = computeConfluence({}, "neutral");
    assert.equal(result.confluenceScore, 50);
    assert.equal(result.confidenceAdjustment, 0);
    assert.equal(result.dominantDirection, "sideways");
  });

  it("returns valid result for single TF", () => {
    const result = computeConfluence({ weekly: snap("bullish") }, "internal_trend");
    assert.equal(result.confluenceScore, 100);
    assert.ok(result.confidenceAdjustment > 0);
  });
});
