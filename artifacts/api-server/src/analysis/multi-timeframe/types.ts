/**
 * Multi-Timeframe Engine — shared types (Phase 3H).
 *
 * Reuses summary types from the single-timeframe analysis layer.
 * No indicator feeds here — everything is derived from price-action
 * and Smart Money engines (BOS, Liquidity, OBs, FVGs, P&D).
 */

import type {
  TrendDirection,
  MarketPhase,
  BosSummary,
  LiquiditySummary,
  OrderBlockSummary,
  FairValueGapSummary,
  PremiumDiscountSummary,
} from "../types.js";

// ─── Timeframe key names ───────────────────────────────────────────────────────

/** Short key used on the `MultiTimeframeResult.timeframes` map. */
export type MTFKey = "m1" | "m5" | "m15" | "m30" | "h1" | "h4" | "daily" | "weekly";

/** Ordered from highest to lowest — used for tier grouping and weight tables. */
export const MTF_KEYS: MTFKey[] = ["weekly", "daily", "h4", "h1", "m30", "m15", "m5", "m1"];

/** Human-readable display labels. */
export const MTF_LABELS: Record<MTFKey, string> = {
  weekly: "Weekly",
  daily:  "Daily",
  h4:     "H4",
  h1:     "H1",
  m30:    "M30",
  m15:    "M15",
  m5:     "M5",
  m1:     "M1",
};

/**
 * Weights used when computing alignment and bias scores.
 * Higher timeframes carry more weight. Must be adjusted if
 * tiers or TF list change.
 */
export const MTF_WEIGHTS: Record<MTFKey, number> = {
  weekly: 8,
  daily:  6,
  h4:     5,
  h1:     4,
  m30:    3,
  m15:    2,
  m5:     1.5,
  m1:     1,
};

/** Total weight when all 8 TFs are present. */
export const MTF_TOTAL_WEIGHT = Object.values(MTF_WEIGHTS).reduce((s, w) => s + w, 0);

// ─── Tier grouping ─────────────────────────────────────────────────────────────

export const MTF_TIERS = {
  higher:       ["weekly", "daily"] as MTFKey[],
  intermediate: ["h4", "h1"]        as MTFKey[],
  lower:        ["m30", "m15", "m5", "m1"] as MTFKey[],
} as const;

// ─── CHoCH Summary ────────────────────────────────────────────────────────────

/**
 * A Change of Character (CHoCH) is a BOS that fires in the OPPOSITE direction
 * to the prior confirmed trend — i.e. it represents a potential reversal, not
 * a continuation. Derived from `marketPhase === "reversal"` + BOS data.
 */
export interface ChochSummary {
  detected: boolean;
  direction: "bullish" | "bearish" | null;
  /**
   * Inherited from the underlying BOS confidence when detected.
   * `null` when no CHoCH is present.
   */
  confidence: number | null;
}

// ─── Per-timeframe snapshot ───────────────────────────────────────────────────

/**
 * Summary of one timeframe's full Smart Money analysis.
 * Computed by running `analyzeMarketStructureFull()` on that TF's candles
 * and extracting the flat fields needed by the alignment/bias/confluence engines.
 */
export interface TimeframeSnapshot {
  /** Number of candles used. */
  candleCount: number;
  /** Confirmed structural trend from swing highs/lows. */
  trend: TrendDirection;
  /** Current market phase. */
  marketPhase: MarketPhase;
  /** Break of Structure summary. */
  bos: BosSummary;
  /** Change of Character summary (derived from BOS + market phase). */
  choch: ChochSummary;
  /** Liquidity sweep summary. */
  liquidity: LiquiditySummary;
  /** Order block summary. */
  orderBlocks: OrderBlockSummary;
  /** Fair value gap summary. */
  fairValueGaps: FairValueGapSummary;
  /** Premium & discount zone summary. */
  premiumDiscount: PremiumDiscountSummary;
  /** Latest confirmed swing high price; null if none. */
  swingHigh: number | null;
  /** Latest confirmed swing low price; null if none. */
  swingLow: number | null;
}

// ─── Alignment Engine ─────────────────────────────────────────────────────────

/**
 * Describes the multi-timeframe alignment pattern.
 *
 * - `full_bullish`   — all available TFs trend bullish.
 * - `full_bearish`   — all available TFs trend bearish.
 * - `internal_pullback` — HTF bullish but lower TF temporarily bearish (buy setups).
 * - `external_trend` — HTF bearish but lower TF bullish (counter-trend: caution).
 * - `internal_trend` — HTF & intermediate aligned; lower TF follows.
 * - `trend_conflict` — HTF and intermediate tiers strongly disagree.
 * - `mixed`          — no dominant tier consensus, some bullish some bearish.
 * - `neutral`        — majority of TFs are sideways.
 */
export type AlignmentType =
  | "full_bullish"
  | "full_bearish"
  | "internal_pullback"
  | "external_trend"
  | "internal_trend"
  | "trend_conflict"
  | "mixed"
  | "neutral";

// ─── Bias Engine ─────────────────────────────────────────────────────────────

export type InstitutionalBias =
  | "strong_bullish"
  | "bullish"
  | "neutral"
  | "bearish"
  | "strong_bearish";

export interface TierBias {
  bias: InstitutionalBias;
  /** Weighted raw score for this tier: range [-1, +1]. */
  score: number;
  /** TFs available in this tier. */
  availableTFs: MTFKey[];
}

export interface BiasResult {
  higherTimeframeBias: InstitutionalBias;
  intermediateBias:    InstitutionalBias;
  lowerTimeframeBias:  InstitutionalBias;
  overallBias:         InstitutionalBias;
  /** Weighted score across all TFs: range [-1, +1]. */
  overallScore:        number;
}

// ─── Alignment result ─────────────────────────────────────────────────────────

export interface AlignmentResult {
  alignmentType: AlignmentType;
  /**
   * 0–100: directional strength of the multi-TF consensus.
   * 50 = perfectly neutral/mixed; 100 = fully bullish; 0 = fully bearish.
   */
  alignmentScore: number;
  /** Weighted score per tier (for debugging / display). */
  higherScore: number;
  intermediateScore: number;
  lowerScore: number;
}

// ─── Confluence result ────────────────────────────────────────────────────────

export interface ConfluenceResult {
  /**
   * 0–100: percentage of weighted TFs agreeing on the dominant direction.
   * 100 = all TFs in complete agreement.
   */
  confluenceScore: number;
  /**
   * Points to ADD to (or SUBTRACT from) the base AI confidence.
   * Range: -20 to +20. Never pushes confidence below 0 or above 100.
   */
  confidenceAdjustment: number;
  /** Dominant direction across all TFs. */
  dominantDirection: TrendDirection;
}

// ─── Full MTF result ─────────────────────────────────────────────────────────

export interface MultiTimeframeResult {
  /** Per-timeframe snapshots. Only present when candle data was available. */
  timeframes: Partial<Record<MTFKey, TimeframeSnapshot>>;
  /** Human-readable MTF reasoning (fed into the AI engine reasons list). */
  reasons: string[];
  /** Number of timeframes with data. */
  availableCount: number;

  // ── Alignment ──────────────────────────────────────────────────────────────
  alignmentType:  AlignmentType;
  alignmentScore: number;      // 0–100

  // ── Bias ───────────────────────────────────────────────────────────────────
  higherTimeframeBias: InstitutionalBias;
  intermediateBias:    InstitutionalBias;
  lowerTimeframeBias:  InstitutionalBias;
  overallBias:         InstitutionalBias;
  institutionalBias:   InstitutionalBias;  // alias for overallBias (spec field)

  // ── Confluence ─────────────────────────────────────────────────────────────
  confluenceScore:      number;  // 0–100
  confidenceAdjustment: number;  // -20 to +20
}
