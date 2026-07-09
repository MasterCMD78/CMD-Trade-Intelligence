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
  /**
   * Closing price. Optional for swing detection (which only needs high/low)
   * but required for BOS detection: without it the BOS detector skips the
   * candle (no close data → no confirmed BOS).
   */
  close?: number;
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
  // ── BOS additions ────────────────────────────────────────────────────────
  /** Most recent confirmed bullish BOS event, if any. */
  lastBullishBOS: BOSResult | null;
  /** Most recent confirmed bearish BOS event, if any. */
  lastBearishBOS: BOSResult | null;
  /**
   * Direction of the most recent BOS (whichever of the two is more recent by
   * `breakIndex`). `null` when no BOS has been detected yet.
   */
  currentStructureBias: BOSDirection | null;
}

export interface MarketStructureResult extends StructureState {
  swingHighs: SwingPoint[];
  swingLows: SwingPoint[];
  /** All bullish BOS events in chronological order. */
  allBullishBOS: BOSResult[];
  /** All bearish BOS events in chronological order. */
  allBearishBOS: BOSResult[];
}

export interface MarketStructureOptions {
  /** Number of candles required on each side of a pivot. Default 2. */
  swingLength?: number;
  /** Options forwarded to the BOS detector. */
  bos?: BOSOptions;
}

// ─── Break of Structure (Phase 3B) ────────────────────────────────────────────

export type BOSDirection = "bullish" | "bearish";

/**
 * A single confirmed Break of Structure event.
 *
 * A BOS is only valid when price CLOSES beyond the prior confirmed swing
 * level — wick-only breaks are rejected. Optional `confirmationDistance`
 * and `minCandleClosePct` filters tighten the signal further.
 */
export interface BOSResult {
  /** Whether price broke above a swing high (bullish) or below a swing low (bearish). */
  direction: BOSDirection;
  /** The confirmed swing point whose level was broken. */
  brokenSwing: SwingPoint;
  /** Close price of the confirmation candle. */
  breakPrice: number;
  /** Index into the candle array of the confirmation candle. */
  breakIndex: number;
  /** The candle that closed beyond the swing level. */
  confirmationCandle: StructureCandle;
  /** 0–1: how decisively price closed beyond the level (calibrated to 0.5 % breach = 1.0). */
  strength: number;
  /** 0–100: composite confidence in the signal (breach size + structure maturity + candle body quality). */
  confidence: number;
}

export interface BOSOptions {
  /**
   * Minimum additional price distance the close must clear beyond the swing
   * level (in the same units as the price). Default 0 — any close beyond the
   * level qualifies.
   */
  confirmationDistance?: number;
  /**
   * Minimum position of the close within the candle's [low, high] range:
   *   - Bullish BOS: `(close − low) / (high − low) ≥ minCandleClosePct`
   *     (e.g. 0.5 = close must be in the top half of the candle).
   *   - Bearish BOS: `(high − close) / (high − low) ≥ minCandleClosePct`
   *     (close must be in the bottom half).
   * Rejects indecisive doji/spinning-top closes. Default 0 (no filter).
   */
  minCandleClosePct?: number;
}

// ─── Liquidity Sweep (Phase 3D) ───────────────────────────────────────────────

export type { LiquidityKind, LiquidityLevel, LiquiditySweep, LiquiditySweepOptions, LiquiditySweepResult } from "./liquidity-sweep.js";

// ─── Order Block (Phase 3E) ───────────────────────────────────────────────────

export type { OrderBlockKind, OrderBlock, OrderBlockResult } from "./order-block.js";

// ─── Fair Value Gap (Phase 3F) ────────────────────────────────────────────────

export type { FVGKind, FVGStatus, FairValueGap, FairValueGapResult } from "./fair-value-gap.js";

// ─── Premium & Discount (Phase 3G) ───────────────────────────────────────────

export type { PremiumDiscountZone, PremiumDiscountResult } from "./premium-discount.js";
