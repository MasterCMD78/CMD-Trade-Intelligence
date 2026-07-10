/**
 * Institutional Decision Engine — shared types (Phase 4).
 *
 * The Decision Engine is a pure combination layer: it consumes the outputs
 * of every existing analysis module (indicators, market structure, BOS,
 * CHoCH, liquidity, order blocks, FVGs, premium/discount, multi-timeframe,
 * risk) and produces one explainable institutional trading decision.
 *
 * No detection logic lives here — only scoring, weighting, and combination.
 */

import type { RiskLevel } from "../types.js";

// ─── Trading decision ─────────────────────────────────────────────────────────

/** Final trading decision. WAIT differs from HOLD: WAIT means signals are too
 *  conflicting/thin to act on; HOLD means a clear neutral read. */
export type InstitutionalDecision = "BUY" | "SELL" | "HOLD" | "WAIT";

/** Institutional trade quality classification. */
export type TradeGrade = "A+" | "A" | "B" | "C" | "D";

/** Market regime, derived from existing Smart Money + volatility analysis. */
export type MarketState =
  | "trending"
  | "ranging"
  | "accumulation"
  | "distribution"
  | "reversal"
  | "expansion"
  | "consolidation";

// ─── Per-module score contribution ────────────────────────────────────────────

export interface ScoreBreakdown {
  /** Name of the contributing module (for display). */
  name: string;
  /** Directional score in [-1, 1]. Positive = bullish, negative = bearish. */
  score: number;
  /** 0-100 confidence in this module's own read. */
  confidence: number;
  /** Human-readable explanation of why this score was produced. */
  explanation: string;
  /** 0-100 normalized contribution shown on the frontend breakdown chart. */
  displayScore: number;
  /** Weight (0-1) this module carries in the final institutional score. */
  weight: number;
}

// ─── Confidence engine ────────────────────────────────────────────────────────

export interface ConfidenceBundle {
  /** Overall confidence across the whole decision (0-100). */
  overallConfidence: number;
  /** Same as institutionalScore, exposed here for the confidence panel. */
  institutionalScore: number;
  /** Confidence specifically in the BUY/SELL/HOLD/WAIT decision (0-100). */
  decisionConfidence: number;
  /** Confidence in the risk parameters (entry/SL/TP) being reliable (0-100). */
  riskConfidence: number;
}

// ─── Risk integration ─────────────────────────────────────────────────────────

export interface DecisionRiskPlan {
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  riskRewardRatio: number;
  /** Suggested position size as a fraction of account equity (0-1). */
  positionSize: number;
  /** Maximum recommended risk on this trade, as a percent of equity. */
  maxRiskPct: number;
  /** Short human-readable trade management guidance. */
  tradeManagement: string;
}

// ─── Full result ──────────────────────────────────────────────────────────────

export interface DecisionEngineResult {
  decision: InstitutionalDecision;
  /** 0-100 composite institutional score. */
  institutionalScore: number;
  tradeGrade: TradeGrade;
  confidence: ConfidenceBundle;
  marketState: MarketState;
  riskLevel: RiskLevel;
  risk: DecisionRiskPlan;
  reasons: string[];
  breakdown: ScoreBreakdown[];
}
