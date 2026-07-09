/**
 * Bias Engine — Phase 3H.
 *
 * Takes per-tier scores (from the Alignment Engine) and translates them into
 * human-readable InstitutionalBias labels for three tiers and an overall bias.
 *
 * Thresholds (applied to [-1, +1] weighted average scores):
 *   > +0.60  → strong_bullish
 *   > +0.20  → bullish
 *   ≥ -0.20  → neutral
 *   ≥ -0.60  → bearish
 *   < -0.60  → strong_bearish
 *
 * Design: pure stateless functions — no I/O.
 */

import type { MTFKey, TimeframeSnapshot, BiasResult, TierBias, InstitutionalBias } from "./types.js";
import { MTF_WEIGHTS, MTF_TIERS } from "./types.js";
import type { TrendDirection } from "../types.js";

// ─── Score → bias mapping ─────────────────────────────────────────────────────

function scoreToBias(score: number): InstitutionalBias {
  if (score >  0.60) return "strong_bullish";
  if (score >  0.20) return "bullish";
  if (score >= -0.20) return "neutral";
  if (score >= -0.60) return "bearish";
  return "strong_bearish";
}

function trendScore(trend: TrendDirection): number {
  if (trend === "bullish") return  1;
  if (trend === "bearish") return -1;
  return 0;
}

// ─── Tier bias computation ────────────────────────────────────────────────────

function computeTierBias(
  snapshots: Partial<Record<MTFKey, TimeframeSnapshot>>,
  keys: readonly MTFKey[],
): TierBias {
  let totalWeight = 0;
  let weightedSum  = 0;
  const available: MTFKey[] = [];

  for (const key of keys) {
    const snap = snapshots[key];
    if (!snap) continue;
    const w = MTF_WEIGHTS[key];
    weightedSum  += trendScore(snap.trend) * w;
    totalWeight  += w;
    available.push(key);
  }

  const score = totalWeight === 0 ? 0 : weightedSum / totalWeight;

  return {
    bias:         scoreToBias(score),
    score,
    availableTFs: available,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function computeBias(
  snapshots: Partial<Record<MTFKey, TimeframeSnapshot>>,
): BiasResult {
  const higher       = computeTierBias(snapshots, MTF_TIERS.higher);
  const intermediate = computeTierBias(snapshots, MTF_TIERS.intermediate);
  const lower        = computeTierBias(snapshots, MTF_TIERS.lower);

  // Overall: weighted across ALL available TFs
  const allKeys = Object.keys(snapshots) as MTFKey[];
  let totalW = 0, totalS = 0;
  for (const key of allKeys) {
    const snap = snapshots[key];
    if (!snap) continue;
    const w = MTF_WEIGHTS[key];
    totalW += w;
    totalS  += trendScore(snap.trend) * w;
  }
  const overallScore = totalW === 0 ? 0 : totalS / totalW;

  return {
    higherTimeframeBias: higher.bias,
    intermediateBias:    intermediate.bias,
    lowerTimeframeBias:  lower.bias,
    overallBias:         scoreToBias(overallScore),
    overallScore,
  };
}

export { scoreToBias };
