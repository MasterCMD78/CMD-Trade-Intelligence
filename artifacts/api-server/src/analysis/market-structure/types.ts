/**
 * Market Structure Engine — shared types.
 *
 * The engine works purely off price-action swing points (no RSI/MACD/EMA/
 * other indicators). It answers two questions:
 *   1. Where are the swing highs/lows, and how do they classify
 *      (HH/HL/LH/LL) relative to the prior swing of the same kind?
 *   2. What trend, if any, does that sequence of swings imply?
 */

import type { TrendDirection } from "../types.js";

// ─── Minimal candle shape the engine needs ────────────────────────────────────

/**
 * The engine only needs high/low/timestamp — decoupled from `MarketCandle`
 * so it stays trivially unit-testable and reusable outside the API server.
 */
export interface StructureCandle {
  high: number;
  low: number;
  timestamp: Date | string | number;
}

// ─── Swings ────────────────────────────────────────────────────────────────────

/** Classification of a swing relative to the previous swing of the same kind. */
export type SwingLabel = "HH" | "HL" | "LH" | "LL";

export interface SwingPoint {
  /** Index into the candle array this swing was detected at. */
  index: number;
  price: number;
  timestamp: Date | string | number;
  kind: "high" | "low";
  /**
   * Classification vs. the previous swing of the same kind.
   * `undefined` for the first swing of its kind (nothing to compare against).
   */
  label?: SwingLabel;
}

// ─── Trend ────────────────────────────────────────────────────────────────────

/**
 * Market phase derived from how the trend is behaving, not just its value:
 *   - "trending"  — current trend is directional, and either (a) unchanged
 *                   from before, or (b) just confirmed out of a sideways
 *                   range (establishing a new trend is not a "reversal").
 *   - "reversal"  — trend flipped between opposite directional biases
 *                   (bullish -> bearish or bearish -> bullish).
 *   - "ranging"   — no confirmed directional bias (currently sideways).
 */
export type MarketPhase = "trending" | "ranging" | "reversal";

// ─── Structure State (reusable model) ─────────────────────────────────────────

export interface StructureState {
  currentTrend: TrendDirection;
  previousTrend: TrendDirection;
  latestSwingHigh: SwingPoint | null;
  latestSwingLow: SwingPoint | null;
  /** Label of whichever swing (high or low) formed most recently. */
  latestSwingType: SwingLabel | null;
  marketPhase: MarketPhase;
}

export interface MarketStructureResult extends StructureState {
  swingHighs: SwingPoint[];
  swingLows: SwingPoint[];
}

export interface MarketStructureOptions {
  /** Number of candles required on each side of a pivot. Default 2. */
  swingLength?: number;
}
