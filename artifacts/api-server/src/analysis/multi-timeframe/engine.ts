/**
 * Multi-Timeframe Engine — Phase 3H.
 *
 * Orchestrator: given a map of candle arrays keyed by MTFKey, runs the
 * full Smart Money analysis (`analyzeMarketStructureFull`) on each, then
 * delegates to the Alignment, Bias, and Confluence engines.
 *
 * Design: pure stateless function — no I/O.
 * Candle fetching is the caller's responsibility (done in the route or test).
 *
 * Usage:
 *   const result = buildMultiTimeframeResult(candlesByTF, currentPrice);
 *   // result.multiTimeframe is ready to attach to AnalysisResult
 */

import type { MarketCandle } from "../../market-data/types.js";
import { analyzeMarketStructureFull } from "../market-structure/engine.js";
import type {
  BosSummary,
  LiquiditySummary,
  OrderBlockSummary,
  FairValueGapSummary,
  PremiumDiscountSummary,
  TrendDirection,
  MarketPhase,
} from "../types.js";
import type {
  MTFKey,
  TimeframeSnapshot,
  ChochSummary,
  MultiTimeframeResult,
} from "./types.js";
import { MTF_KEYS, MTF_LABELS } from "./types.js";
import { computeAlignment } from "./alignment.js";
import { computeBias } from "./bias.js";
import { computeConfluence } from "./confluence.js";
import type { FullMarketStructureResult } from "../market-structure/engine.js";
import type { MarketStructureResult } from "../market-structure/types.js";

// ─── CHoCH derivation ─────────────────────────────────────────────────────────

/**
 * Derive a CHoCH summary from a full market structure result.
 *
 * A Change of Character occurs when a BOS fires in the direction OPPOSITE
 * to the prior confirmed trend — signalling a potential reversal, not a
 * continuation. This is reflected by `marketPhase === "reversal"` in
 * the existing engine.
 */
function deriveChoch(structure: MarketStructureResult): ChochSummary {
  const { marketPhase, lastBullishBOS, lastBearishBOS, previousTrend } = structure;

  if (marketPhase !== "reversal") {
    return { detected: false, direction: null, confidence: null };
  }

  // Pick whichever BOS opposes the prior trend
  if (previousTrend === "bearish" && lastBullishBOS) {
    return { detected: true, direction: "bullish", confidence: lastBullishBOS.confidence };
  }
  if (previousTrend === "bullish" && lastBearishBOS) {
    return { detected: true, direction: "bearish", confidence: lastBearishBOS.confidence };
  }

  return { detected: false, direction: null, confidence: null };
}

// ─── BOS summary extraction ───────────────────────────────────────────────────

function extractBOS(structure: MarketStructureResult): BosSummary {
  const { lastBullishBOS: bull, lastBearishBOS: bear } = structure;
  let active = null;
  if (bull && bear) {
    active = bull.breakIndex >= bear.breakIndex ? bull : bear;
  } else {
    active = bull ?? bear ?? null;
  }
  if (!active) return { detected: false, direction: null, price: null, strength: null, confidence: null };
  return {
    detected:   true,
    direction:  active.direction,
    price:      active.breakPrice,
    strength:   active.strength,
    confidence: active.confidence,
  };
}

// ─── Liquidity summary extraction ────────────────────────────────────────────

function extractLiquidity(result: FullMarketStructureResult): LiquiditySummary {
  const last = result.liquidity.lastSweep;
  return {
    levelCount:          result.liquidity.liquidityLevels.length,
    sweepCount:          result.liquidity.sweeps.length,
    lastSweepDirection:  last?.direction ?? null,
    lastSweepRejection:  last?.rejectionStrength ?? null,
    lastSweepConfidence: last?.confidence ?? null,
    lastSweepPrice:      last?.sweepPrice ?? null,
  };
}

// ─── Order block summary extraction ──────────────────────────────────────────

function extractOrderBlocks(result: FullMarketStructureResult): OrderBlockSummary {
  const bull = result.orderBlocks.lastBullishOB;
  const bear = result.orderBlocks.lastBearishOB;
  return {
    activeCount:            result.orderBlocks.activeOrderBlocks.length,
    lastBullishHigh:        bull?.high ?? null,
    lastBullishLow:         bull?.low ?? null,
    lastBullishConfidence:  bull?.confidence ?? null,
    lastBullishMitigated:   bull?.mitigated ?? false,
    lastBearishHigh:        bear?.high ?? null,
    lastBearishLow:         bear?.low ?? null,
    lastBearishConfidence:  bear?.confidence ?? null,
    lastBearishMitigated:   bear?.mitigated ?? false,
  };
}

// ─── FVG summary extraction ───────────────────────────────────────────────────

function extractFVG(result: FullMarketStructureResult): FairValueGapSummary {
  const bull = result.fairValueGaps.lastBullishFvg;
  const bear = result.fairValueGaps.lastBearishFvg;
  return {
    activeCount:         result.fairValueGaps.activeFvgs.length,
    lastBullishGapHigh:  bull?.gapHigh ?? null,
    lastBullishGapLow:   bull?.gapLow ?? null,
    lastBullishStatus:   bull?.status ?? null,
    lastBullishFillPct:  bull?.fillPct ?? null,
    lastBearishGapHigh:  bear?.gapHigh ?? null,
    lastBearishGapLow:   bear?.gapLow ?? null,
    lastBearishStatus:   bear?.status ?? null,
    lastBearishFillPct:  bear?.fillPct ?? null,
  };
}

// ─── Premium/Discount summary extraction ──────────────────────────────────────

function extractPD(result: FullMarketStructureResult): PremiumDiscountSummary {
  const pd = result.premiumDiscount;
  if (!pd) {
    return { available: false, currentZone: null, pricePosition: null, equilibrium: null, rangeHigh: null, rangeLow: null };
  }
  return {
    available:     true,
    currentZone:   pd.currentZone,
    pricePosition: pd.pricePosition,
    equilibrium:   pd.equilibrium,
    rangeHigh:     pd.rangeHigh,
    rangeLow:      pd.rangeLow,
  };
}

// ─── Snapshot builder ─────────────────────────────────────────────────────────

function buildSnapshot(
  candles: MarketCandle[],
  currentPrice: number,
): TimeframeSnapshot {
  const result = analyzeMarketStructureFull(candles, currentPrice, { swingLength: 2 });

  const trend      = result.currentTrend as TrendDirection;
  const marketPhase = result.marketPhase as MarketPhase;
  const bos        = extractBOS(result);
  const choch      = deriveChoch(result);
  const liquidity  = extractLiquidity(result);
  const orderBlocks = extractOrderBlocks(result);
  const fairValueGaps = extractFVG(result);
  const premiumDiscount = extractPD(result);

  return {
    candleCount:    candles.length,
    trend,
    marketPhase,
    bos,
    choch,
    liquidity,
    orderBlocks,
    fairValueGaps,
    premiumDiscount,
    swingHigh: result.latestSwingHigh?.price ?? null,
    swingLow:  result.latestSwingLow?.price ?? null,
  };
}

// ─── Reason generation ────────────────────────────────────────────────────────

function generateMTFReasons(
  snapshots: Partial<Record<MTFKey, TimeframeSnapshot>>,
  alignmentType: import("./types.js").AlignmentType,
  overallBias: import("./types.js").InstitutionalBias,
  confluenceScore: number,
): string[] {
  const reasons: string[] = [];

  // Overall institutional bias
  const biasLabel: Record<import("./types.js").InstitutionalBias, string> = {
    strong_bullish: "Strong Bullish",
    bullish: "Bullish",
    neutral: "Neutral",
    bearish: "Bearish",
    strong_bearish: "Strong Bearish",
  };
  reasons.push(`Institutional bias: ${biasLabel[overallBias]}.`);

  // Higher TF summary
  const weekly = snapshots["weekly"];
  const daily  = snapshots["daily"];
  const h4     = snapshots["h4"];
  const h1     = snapshots["h1"];

  if (weekly) reasons.push(`Weekly trend: ${weekly.trend}${weekly.bos.detected ? ` (BOS ${weekly.bos.direction})` : ""}.`);
  if (daily)  reasons.push(`Daily trend: ${daily.trend}${daily.bos.detected ? ` (BOS ${daily.bos.direction})` : ""}.`);

  // Intermediate TF
  if (h4 && h1) {
    if (h4.trend === h1.trend) {
      reasons.push(`H4 and H1 aligned ${h4.trend} — intermediate structure confirms.`);
    } else {
      reasons.push(`H4 ${h4.trend} vs. H1 ${h1.trend} — intermediate timeframe conflict.`);
    }
  } else if (h4) {
    reasons.push(`H4 trend: ${h4.trend}.`);
  }

  // Lower TF context
  const m15 = snapshots["m15"];
  const m5  = snapshots["m5"];
  if (m15 && daily && m15.trend !== daily.trend) {
    reasons.push(`M15 ${m15.trend} pullback inside ${daily.trend} daily uptrend.`);
  }
  if (m5 && h4 && m5.trend !== h4.trend) {
    reasons.push(`M5 ${m5.trend} inside H4 ${h4.trend} structure.`);
  }

  // Alignment pattern
  const alignmentLabels: Record<import("./types.js").AlignmentType, string> = {
    full_bullish:      "Full bullish alignment across all timeframes.",
    full_bearish:      "Full bearish alignment across all timeframes.",
    internal_pullback: "Higher timeframe trend intact — lower timeframe pullback (seek entries with trend).",
    external_trend:    "Higher timeframe trend dominant — lower timeframe bounce is counter-trend (caution).",
    internal_trend:    "Higher and intermediate timeframes aligned — strong institutional trend in force.",
    trend_conflict:    "Significant timeframe conflict detected — reduce position size or wait for resolution.",
    mixed:             "Mixed multi-timeframe structure — no dominant institutional bias.",
    neutral:           "Multi-timeframe neutral — market in equilibrium.",
  };
  reasons.push(alignmentLabels[alignmentType]);

  // Confluence strength
  if (confluenceScore >= 80) {
    reasons.push(`Strong institutional confluence: ${confluenceScore}% of weighted timeframes agree.`);
  } else if (confluenceScore < 45) {
    reasons.push(`Low confluence (${confluenceScore}%) — timeframes are divided.`);
  }

  // Notable CHoCH signals on higher TFs
  for (const key of ["weekly", "daily", "h4"] as MTFKey[]) {
    const snap = snapshots[key];
    if (snap?.choch.detected && snap.choch.direction) {
      reasons.push(`${MTF_LABELS[key]} CHoCH ${snap.choch.direction} — potential reversal signal on high timeframe.`);
    }
  }

  return reasons;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build a full MultiTimeframeResult from candle arrays.
 *
 * @param candlesByKey  Map of MTFKey → MarketCandle[]. Keys with no candles
 *                      (undefined or length < 10) are silently skipped.
 * @param currentPrice  Current mid price, used by the P&D engine.
 */
export function buildMultiTimeframeResult(
  candlesByKey: Partial<Record<MTFKey, MarketCandle[]>>,
  currentPrice: number,
): MultiTimeframeResult {
  const snapshots: Partial<Record<MTFKey, TimeframeSnapshot>> = {};

  for (const key of MTF_KEYS) {
    const candles = candlesByKey[key];
    if (!candles || candles.length < 10) continue;
    try {
      snapshots[key] = buildSnapshot(candles, currentPrice);
    } catch {
      // Silently skip — insufficient or malformed candle data for this TF
    }
  }

  const alignment  = computeAlignment(snapshots);
  const bias       = computeBias(snapshots);
  const confluence = computeConfluence(snapshots, alignment.alignmentType);

  const reasons = generateMTFReasons(
    snapshots,
    alignment.alignmentType,
    bias.overallBias,
    confluence.confluenceScore,
  );

  return {
    timeframes:    snapshots,
    reasons,
    availableCount: Object.keys(snapshots).length,

    alignmentType:  alignment.alignmentType,
    alignmentScore: alignment.alignmentScore,

    higherTimeframeBias: bias.higherTimeframeBias,
    intermediateBias:    bias.intermediateBias,
    lowerTimeframeBias:  bias.lowerTimeframeBias,
    overallBias:         bias.overallBias,
    institutionalBias:   bias.overallBias,

    confluenceScore:      confluence.confluenceScore,
    confidenceAdjustment: confluence.confidenceAdjustment,
  };
}
