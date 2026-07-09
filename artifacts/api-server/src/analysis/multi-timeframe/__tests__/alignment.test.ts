/**
 * Alignment Engine — comprehensive test suite.
 *
 * Covers:
 *   - Full bullish alignment
 *   - Full bearish alignment
 *   - Internal pullback (HTF bull, lower TF bear)
 *   - External trend (HTF bear, lower TF bull — counter-trend)
 *   - Internal trend (HTF + intermediate aligned)
 *   - Trend conflict (HTF vs intermediate opposition)
 *   - Neutral (all sideways)
 *   - Mixed (no dominant consensus)
 *   - alignmentScore boundaries (0, 50, 100)
 *   - Missing/partial data
 */

import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { computeAlignment } from "../alignment.js";
import type { MTFKey, TimeframeSnapshot } from "../types.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function snap(trend: "bullish" | "bearish" | "sideways"): TimeframeSnapshot {
  return {
    candleCount: 100,
    trend,
    marketPhase: "trending",
    bos:           { detected: false, direction: null, price: null, strength: null, confidence: null },
    choch:         { detected: false, direction: null, confidence: null },
    liquidity:     { levelCount: 0, sweepCount: 0, lastSweepDirection: null, lastSweepRejection: null, lastSweepConfidence: null, lastSweepPrice: null },
    orderBlocks:   { activeCount: 0, lastBullishHigh: null, lastBullishLow: null, lastBullishConfidence: null, lastBullishMitigated: false, lastBearishHigh: null, lastBearishLow: null, lastBearishConfidence: null, lastBearishMitigated: false },
    fairValueGaps: { activeCount: 0, lastBullishGapHigh: null, lastBullishGapLow: null, lastBullishStatus: null, lastBullishFillPct: null, lastBearishGapHigh: null, lastBearishGapLow: null, lastBearishStatus: null, lastBearishFillPct: null },
    premiumDiscount: { available: false, currentZone: null, pricePosition: null, equilibrium: null, rangeHigh: null, rangeLow: null },
    swingHigh: null,
    swingLow: null,
  };
}

function allBullish(): Partial<Record<MTFKey, TimeframeSnapshot>> {
  return {
    weekly: snap("bullish"), daily: snap("bullish"),
    h4: snap("bullish"), h1: snap("bullish"),
    m30: snap("bullish"), m15: snap("bullish"), m5: snap("bullish"), m1: snap("bullish"),
  };
}

function allBearish(): Partial<Record<MTFKey, TimeframeSnapshot>> {
  return {
    weekly: snap("bearish"), daily: snap("bearish"),
    h4: snap("bearish"), h1: snap("bearish"),
    m30: snap("bearish"), m15: snap("bearish"), m5: snap("bearish"), m1: snap("bearish"),
  };
}

// ─── Full alignment ───────────────────────────────────────────────────────────

describe("computeAlignment — full bullish", () => {
  it("returns full_bullish when all TFs are bullish", () => {
    const result = computeAlignment(allBullish());
    assert.equal(result.alignmentType, "full_bullish");
  });

  it("alignmentScore is 100 when all TFs are bullish", () => {
    const result = computeAlignment(allBullish());
    assert.equal(result.alignmentScore, 100);
  });
});

describe("computeAlignment — full bearish", () => {
  it("returns full_bearish when all TFs are bearish", () => {
    const result = computeAlignment(allBearish());
    assert.equal(result.alignmentType, "full_bearish");
  });

  it("alignmentScore is 0 when all TFs are bearish", () => {
    const result = computeAlignment(allBearish());
    assert.equal(result.alignmentScore, 0);
  });
});

// ─── Internal pullback ────────────────────────────────────────────────────────

describe("computeAlignment — internal pullback", () => {
  it("returns internal_pullback when HTF bullish but lower TF bearish", () => {
    const snapshots: Partial<Record<MTFKey, TimeframeSnapshot>> = {
      weekly: snap("bullish"), daily: snap("bullish"),
      h4: snap("bullish"), h1: snap("bullish"),
      m30: snap("bearish"), m15: snap("bearish"), m5: snap("bearish"), m1: snap("bearish"),
    };
    const result = computeAlignment(snapshots);
    assert.equal(result.alignmentType, "internal_pullback");
  });

  it("alignmentScore is above 50 for internal pullback (HTF dominates weight)", () => {
    const snapshots: Partial<Record<MTFKey, TimeframeSnapshot>> = {
      weekly: snap("bullish"), daily: snap("bullish"),
      h4: snap("bullish"), h1: snap("bullish"),
      m30: snap("bearish"), m15: snap("bearish"), m5: snap("bearish"), m1: snap("bearish"),
    };
    const result = computeAlignment(snapshots);
    assert.ok(result.alignmentScore > 50, "HTF weight should keep score above 50");
  });
});

// ─── External trend (counter-trend) ──────────────────────────────────────────

describe("computeAlignment — external trend", () => {
  it("returns external_trend when HTF bearish but lower TF bullish", () => {
    const snapshots: Partial<Record<MTFKey, TimeframeSnapshot>> = {
      weekly: snap("bearish"), daily: snap("bearish"),
      h4: snap("bearish"), h1: snap("bearish"),
      m30: snap("bullish"), m15: snap("bullish"), m5: snap("bullish"), m1: snap("bullish"),
    };
    const result = computeAlignment(snapshots);
    assert.equal(result.alignmentType, "external_trend");
  });
});

// ─── Internal trend ────────────────────────────────────────────────────────────

describe("computeAlignment — internal trend", () => {
  it("returns internal_trend when HTF and intermediate aligned (lower mixed)", () => {
    const snapshots: Partial<Record<MTFKey, TimeframeSnapshot>> = {
      weekly: snap("bullish"), daily: snap("bullish"),
      h4: snap("bullish"), h1: snap("bullish"),
      m30: snap("sideways"), m15: snap("sideways"),
    };
    const result = computeAlignment(snapshots);
    assert.equal(result.alignmentType, "internal_trend");
  });
});

// ─── Trend conflict ────────────────────────────────────────────────────────────

describe("computeAlignment — trend conflict", () => {
  it("returns trend_conflict when HTF bullish and intermediate bearish", () => {
    const snapshots: Partial<Record<MTFKey, TimeframeSnapshot>> = {
      weekly: snap("bullish"), daily: snap("bullish"),
      h4: snap("bearish"), h1: snap("bearish"),
    };
    const result = computeAlignment(snapshots);
    assert.equal(result.alignmentType, "trend_conflict");
  });

  it("returns trend_conflict when HTF bearish and intermediate bullish", () => {
    const snapshots: Partial<Record<MTFKey, TimeframeSnapshot>> = {
      weekly: snap("bearish"), daily: snap("bearish"),
      h4: snap("bullish"), h1: snap("bullish"),
    };
    const result = computeAlignment(snapshots);
    assert.equal(result.alignmentType, "trend_conflict");
  });
});

// ─── Neutral ──────────────────────────────────────────────────────────────────

describe("computeAlignment — neutral", () => {
  it("returns neutral when all TFs are sideways", () => {
    const snapshots: Partial<Record<MTFKey, TimeframeSnapshot>> = {
      weekly: snap("sideways"), daily: snap("sideways"),
      h4: snap("sideways"), h1: snap("sideways"),
    };
    const result = computeAlignment(snapshots);
    assert.equal(result.alignmentType, "neutral");
  });

  it("alignmentScore is 50 when all TFs are sideways", () => {
    const snapshots: Partial<Record<MTFKey, TimeframeSnapshot>> = {
      weekly: snap("sideways"), daily: snap("sideways"),
      h4: snap("sideways"), h1: snap("sideways"),
    };
    const result = computeAlignment(snapshots);
    assert.equal(result.alignmentScore, 50);
  });

  it("returns neutral for empty snapshot map", () => {
    const result = computeAlignment({});
    assert.equal(result.alignmentType, "neutral");
    assert.equal(result.alignmentScore, 50);
  });
});

// ─── Partial data ─────────────────────────────────────────────────────────────

describe("computeAlignment — partial data", () => {
  it("works correctly with only weekly data available", () => {
    const result = computeAlignment({ weekly: snap("bullish") });
    assert.ok(result.alignmentScore > 50, "single bullish TF should score above 50");
  });

  it("works correctly with only lower TF data", () => {
    const result = computeAlignment({ m15: snap("bearish"), m5: snap("bearish") });
    assert.ok(result.alignmentScore < 50, "lower TF bearish should score below 50");
  });
});
