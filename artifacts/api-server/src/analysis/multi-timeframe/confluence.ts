/**
 * Confluence Engine — Phase 3H.
 *
 * Measures how much the available timeframes AGREE on a direction.
 * High confluence → raise AI confidence. Low/conflict → lower it.
 *
 * Algorithm:
 *   1. Classify each TF as bullish (+1), bearish (-1), or sideways (0).
 *   2. Sum the weights of the dominant direction vs. all others.
 *   3. confluenceScore = (dominant weight / total weight) × 100.
 *   4. confidenceAdjustment = f(confluenceScore, alignmentType).
 *
 * Confidence adjustment table:
 *   confluenceScore ≥ 85  → +20 (strong institutional agreement)
 *   confluenceScore ≥ 70  → +12
 *   confluenceScore ≥ 55  → +6
 *   confluenceScore ≥ 40  → 0
 *   confluenceScore < 40  → -10 (conflict — do NOT trade)
 *   alignmentType === trend_conflict → additional -5
 *
 * Design: pure stateless function — no I/O.
 */

import type { MTFKey, TimeframeSnapshot, ConfluenceResult, AlignmentType } from "./types.js";
import { MTF_WEIGHTS } from "./types.js";
import type { TrendDirection } from "../types.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function directionOf(trend: TrendDirection): "bullish" | "bearish" | "neutral" {
  if (trend === "bullish") return "bullish";
  if (trend === "bearish") return "bearish";
  return "neutral";
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function computeConfluence(
  snapshots: Partial<Record<MTFKey, TimeframeSnapshot>>,
  alignmentType: AlignmentType,
): ConfluenceResult {
  let bullishW = 0;
  let bearishW = 0;
  let neutralW = 0;

  const keys = Object.keys(snapshots) as MTFKey[];
  for (const key of keys) {
    const snap = snapshots[key];
    if (!snap) continue;
    const w = MTF_WEIGHTS[key];
    const dir = directionOf(snap.trend);
    if (dir === "bullish") bullishW += w;
    else if (dir === "bearish") bearishW += w;
    else neutralW += w;
  }

  const totalW = bullishW + bearishW + neutralW;
  if (totalW === 0) {
    return { confluenceScore: 50, confidenceAdjustment: 0, dominantDirection: "sideways" };
  }

  // Dominant is whichever has the most weighted TFs
  let dominantW: number;
  let dominantDirection: TrendDirection;
  if (bullishW >= bearishW && bullishW >= neutralW) {
    dominantW = bullishW;
    dominantDirection = "bullish";
  } else if (bearishW >= bullishW && bearishW >= neutralW) {
    dominantW = bearishW;
    dominantDirection = "bearish";
  } else {
    dominantW = neutralW;
    dominantDirection = "sideways";
  }

  const confluenceScore = Math.round((dominantW / totalW) * 100);

  // Confidence adjustment
  let adj = 0;
  if (confluenceScore >= 85) adj = 20;
  else if (confluenceScore >= 70) adj = 12;
  else if (confluenceScore >= 55) adj = 6;
  else if (confluenceScore >= 40) adj = 0;
  else adj = -10;

  if (alignmentType === "trend_conflict") adj -= 5;

  // Clamp to [-20, +20]
  const confidenceAdjustment = Math.max(-20, Math.min(20, adj));

  return { confluenceScore, confidenceAdjustment, dominantDirection };
}
