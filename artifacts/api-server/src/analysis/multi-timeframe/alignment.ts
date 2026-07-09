/**
 * Alignment Engine — Phase 3H.
 *
 * Takes a snapshot map (keyed by MTFKey) and computes:
 *   1. A weighted directional score per tier (higher / intermediate / lower).
 *   2. An overall alignmentScore (0 = full bear, 50 = neutral, 100 = full bull).
 *   3. An AlignmentType label describing the multi-TF pattern.
 *
 * Design: pure stateless function — no I/O.
 */

import type { TrendDirection } from "../types.js";
import type {
  MTFKey,
  TimeframeSnapshot,
  AlignmentResult,
  AlignmentType,
} from "./types.js";
import { MTF_WEIGHTS, MTF_TIERS } from "./types.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert a trend direction to a [-1, 0, +1] score. */
function trendScore(trend: TrendDirection): number {
  if (trend === "bullish")  return  1;
  if (trend === "bearish")  return -1;
  return 0;
}

/**
 * Compute a weighted average score for a subset of TFs.
 * Returns NaN when no TF in the subset has data.
 */
function weightedScore(
  snapshots: Partial<Record<MTFKey, TimeframeSnapshot>>,
  keys: readonly MTFKey[],
): number {
  let totalWeight = 0;
  let weightedSum  = 0;

  for (const key of keys) {
    const snap = snapshots[key];
    if (!snap) continue;
    const w = MTF_WEIGHTS[key];
    weightedSum  += trendScore(snap.trend) * w;
    totalWeight  += w;
  }

  return totalWeight === 0 ? NaN : weightedSum / totalWeight;
}

// ─── Alignment type classifier ────────────────────────────────────────────────

/**
 * Determine AlignmentType from the three tier scores.
 *
 * Thresholds:
 *   score > +0.50 → bullish for that tier
 *   score < -0.50 → bearish for that tier
 *   otherwise     → neutral/mixed
 *
 * Rules (in priority order):
 *  1. All tiers bullish           → full_bullish
 *  2. All tiers bearish           → full_bearish
 *  3. Higher bullish, lower bear  → internal_pullback (common retracement)
 *  4. Higher bearish, lower bull  → external_trend (counter-trend bounce)
 *  5. Higher + intermediate same, lower follows → internal_trend
 *  6. Higher and intermediate strongly disagree  → trend_conflict
 *  7. All sideways / near zero    → neutral
 *  8. Otherwise                   → mixed
 */
function classifyAlignment(
  higherScore: number,
  intermediateScore: number,
  lowerScore: number,
): AlignmentType {
  const STRONG = 0.50;
  const WEAK   = 0.25;

  const higherBull = !isNaN(higherScore)       && higherScore       >= STRONG;
  const higherBear = !isNaN(higherScore)       && higherScore       <= -STRONG;
  const interBull  = !isNaN(intermediateScore) && intermediateScore >= STRONG;
  const interBear  = !isNaN(intermediateScore) && intermediateScore <= -STRONG;
  const lowerBull  = !isNaN(lowerScore)        && lowerScore        >= WEAK;
  const lowerBear  = !isNaN(lowerScore)        && lowerScore        <= -WEAK;

  const allNaN = isNaN(higherScore) && isNaN(intermediateScore) && isNaN(lowerScore);
  if (allNaN) return "neutral";

  // Full alignment
  if (higherBull && interBull && lowerBull) return "full_bullish";
  if (higherBear && interBear && lowerBear) return "full_bearish";

  // Internal pullback: HTF bullish, lower TF temporarily bearish
  if (higherBull && interBull && lowerBear) return "internal_pullback";
  if (higherBull && !interBear && lowerBear) return "internal_pullback";

  // External trend: HTF bearish, lower TF bullish (counter-trend)
  if (higherBear && interBear && lowerBull) return "external_trend";
  if (higherBear && !interBull && lowerBull) return "external_trend";

  // HTF + intermediate agree, lower follows
  if (higherBull && interBull) return "internal_trend";
  if (higherBear && interBear) return "internal_trend";

  // HTF and intermediate strongly oppose each other
  if ((higherBull && interBear) || (higherBear && interBull)) return "trend_conflict";

  // Near-zero across all available tiers → neutral
  const allNearZero = [higherScore, intermediateScore, lowerScore].every(
    (s) => isNaN(s) || Math.abs(s) < 0.25,
  );
  if (allNearZero) return "neutral";

  return "mixed";
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function computeAlignment(
  snapshots: Partial<Record<MTFKey, TimeframeSnapshot>>,
): AlignmentResult {
  const higherScore       = weightedScore(snapshots, MTF_TIERS.higher);
  const intermediateScore = weightedScore(snapshots, MTF_TIERS.intermediate);
  const lowerScore        = weightedScore(snapshots, MTF_TIERS.lower);

  // Overall alignment score across ALL TFs
  const allKeys = Object.keys(snapshots) as MTFKey[];
  let totalW = 0;
  let totalS  = 0;
  for (const key of allKeys) {
    const snap = snapshots[key];
    if (!snap) continue;
    const w = MTF_WEIGHTS[key];
    totalW += w;
    totalS  += trendScore(snap.trend) * w;
  }
  const overallNormalized = totalW === 0 ? 0 : totalS / totalW; // [-1, +1]
  // Map [-1, +1] → [0, 100]
  const alignmentScore = Math.round((overallNormalized + 1) * 50);

  const alignmentType = classifyAlignment(
    higherScore,
    intermediateScore,
    lowerScore,
  );

  return {
    alignmentType,
    alignmentScore,
    higherScore:       isNaN(higherScore)       ? 0 : higherScore,
    intermediateScore: isNaN(intermediateScore) ? 0 : intermediateScore,
    lowerScore:        isNaN(lowerScore)        ? 0 : lowerScore,
  };
}
