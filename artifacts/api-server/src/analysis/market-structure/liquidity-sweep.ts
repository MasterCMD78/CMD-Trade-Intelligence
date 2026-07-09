/**
 * Liquidity Sweep Engine — Phase 3D.
 *
 * Detects:
 *   1. Equal Highs / Equal Lows (clustered liquidity pools above/below price).
 *   2. Valid liquidity sweeps — wick pierces the liquidity level then price
 *      closes BACK INSIDE the prior range (wick-only sweep + close-back-inside).
 *
 * Design:
 *   - Pure stateless function, no I/O.
 *   - Configurable tolerance for "equal" high/low detection.
 *   - Configurable minimum rejection strength to discard weak sweeps.
 *   - Returns ALL sweeps so callers can filter / track history.
 */

import type { StructureCandle, SwingPoint } from "./types.js";

// ─── Public types ─────────────────────────────────────────────────────────────

export type LiquidityKind = "buy-side" | "sell-side";

/**
 * A pool of clustered equal highs or equal lows that act as a magnet for
 * institutional stop-runs before a reversal or continuation move.
 *
 * - "buy-side"  = equal HIGHS  → buy stops sitting above price.
 * - "sell-side" = equal LOWS   → sell stops sitting below price.
 */
export interface LiquidityLevel {
  kind: LiquidityKind;
  price: number;
  /** Indices of the swing points that make up this cluster. */
  swingIndices: number[];
  /** How many swing points cluster at this level (higher = more significant). */
  clusterSize: number;
}

/**
 * A confirmed liquidity sweep event.
 *
 * Confirmation requires:
 *   1. Wick pierces the liquidity level (high > level for buy-side,
 *      low < level for sell-side).
 *   2. Price closes BACK INSIDE (close < level for buy-side,
 *      close > level for sell-side).
 */
export interface LiquiditySweep {
  direction: LiquidityKind;
  /** The liquidity level that was swept. */
  sweptLiquidity: LiquidityLevel;
  /** Price of the sweep wick extreme. */
  sweepPrice: number;
  /** Index of the candle that swept and closed back inside. */
  sweepIndex: number;
  /**
   * How strongly price rejected after piercing the level.
   * = (wick beyond level) / (total candle range), capped at 1.
   */
  rejectionStrength: number;
  /** 0–100 composite confidence. */
  confidence: number;
}

export interface LiquiditySweepOptions {
  /**
   * Maximum price distance (in price units) between two swing points for them
   * to be considered "equal" (same liquidity pool). Default: 0.1 % of price.
   */
  equalTolerance?: number;
  /**
   * Minimum rejectionStrength (0–1) to accept a sweep. Sweeps below this
   * threshold are considered too weak and are discarded. Default: 0.10.
   */
  minRejectionStrength?: number;
  /**
   * Minimum number of swing points that must cluster at a level before it
   * qualifies as a liquidity pool. Default: 2.
   */
  minClusterSize?: number;
}

export interface LiquiditySweepResult {
  /** All detected buy-side and sell-side liquidity levels. */
  liquidityLevels: LiquidityLevel[];
  /** All confirmed sweep events in chronological order. */
  sweeps: LiquiditySweep[];
  /** Most recent sweep, if any. */
  lastSweep: LiquiditySweep | null;
  /** Most recent buy-side sweep. */
  lastBuySideSweep: LiquiditySweep | null;
  /** Most recent sell-side sweep. */
  lastSellSideSweep: LiquiditySweep | null;
}

// ─── Default options ──────────────────────────────────────────────────────────

const DEFAULT_EQUAL_TOLERANCE_PCT = 0.001; // 0.1 % of price
const DEFAULT_MIN_REJECTION_STRENGTH = 0.10;
const DEFAULT_MIN_CLUSTER_SIZE = 2;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Group swing points into clusters where all prices are within `tolerance`
 * of each other. Each cluster becomes one LiquidityLevel.
 */
function clusterSwings(
  swings: SwingPoint[],
  kind: LiquidityKind,
  tolerance: number,
  minClusterSize: number,
): LiquidityLevel[] {
  if (swings.length === 0) return [];

  const sorted = [...swings].sort((a, b) => a.price - b.price);
  const levels: LiquidityLevel[] = [];
  let group: SwingPoint[] = [sorted[0]!];

  for (let i = 1; i < sorted.length; i++) {
    const curr = sorted[i]!;
    const groupMid = group.reduce((s, p) => s + p.price, 0) / group.length;
    if (Math.abs(curr.price - groupMid) <= tolerance) {
      group.push(curr);
    } else {
      if (group.length >= minClusterSize) {
        const avgPrice = group.reduce((s, p) => s + p.price, 0) / group.length;
        levels.push({
          kind,
          price: avgPrice,
          swingIndices: group.map((p) => p.index),
          clusterSize: group.length,
        });
      }
      group = [curr];
    }
  }
  // Final group
  if (group.length >= minClusterSize) {
    const avgPrice = group.reduce((s, p) => s + p.price, 0) / group.length;
    levels.push({
      kind,
      price: avgPrice,
      swingIndices: group.map((p) => p.index),
      clusterSize: group.length,
    });
  }

  return levels;
}

/**
 * Compute rejection strength: how much of the candle body is above/below the
 * swept level (the "wick" that pierced the level) relative to total range.
 */
function computeRejectionStrength(
  candle: StructureCandle,
  level: number,
  direction: LiquidityKind,
): number {
  const range = candle.high - candle.low;
  if (range === 0) return 0;

  if (direction === "buy-side") {
    // Wick above the level: candle.high - level
    const wickBeyond = Math.max(0, candle.high - level);
    return Math.min(1, wickBeyond / range);
  } else {
    // Wick below the level: level - candle.low
    const wickBeyond = Math.max(0, level - candle.low);
    return Math.min(1, wickBeyond / range);
  }
}

/**
 * 0–100 confidence for a sweep event.
 * Components:
 *   - Rejection strength        (0–50)
 *   - Cluster size importance   (0–30, each extra swing +10, cap 30)
 *   - Candle body confirmation  (0–20): close well back inside the range
 */
function computeSweepConfidence(
  rejectionStrength: number,
  clusterSize: number,
  candle: StructureCandle,
  level: number,
  direction: LiquidityKind,
): number {
  const strengthScore = rejectionStrength * 50;
  const clusterScore = Math.min(30, (clusterSize - 1) * 15);

  let bodyScore = 0;
  const range = candle.high - candle.low;
  if (range > 0 && candle.close !== undefined) {
    const closeInRange = (candle.close - candle.low) / range; // 0=low, 1=high
    // Buy-side sweep: close should be near the LOW (bearish rejection)
    // Sell-side sweep: close should be near the HIGH (bullish rejection)
    bodyScore =
      direction === "buy-side"
        ? (1 - closeInRange) * 20
        : closeInRange * 20;
  }

  return Math.min(100, Math.round(strengthScore + clusterScore + bodyScore));
}

// ─── Main detector ────────────────────────────────────────────────────────────

export function detectLiquiditySweeps(
  candles: StructureCandle[],
  swingHighs: SwingPoint[],
  swingLows: SwingPoint[],
  options: LiquiditySweepOptions = {},
): LiquiditySweepResult {
  if (!candles || candles.length === 0) {
    return {
      liquidityLevels: [],
      sweeps: [],
      lastSweep: null,
      lastBuySideSweep: null,
      lastSellSideSweep: null,
    };
  }

  const currentPrice =
    candles[candles.length - 1]!.close ?? candles[candles.length - 1]!.high;
  const tolerancePct = options.equalTolerance ?? DEFAULT_EQUAL_TOLERANCE_PCT;
  const tolerance = currentPrice * tolerancePct;
  const minRejectionStrength =
    options.minRejectionStrength ?? DEFAULT_MIN_REJECTION_STRENGTH;
  const minClusterSize = options.minClusterSize ?? DEFAULT_MIN_CLUSTER_SIZE;

  // Build liquidity level clusters
  const buyLevels = clusterSwings(swingHighs, "buy-side", tolerance, minClusterSize);
  const sellLevels = clusterSwings(swingLows, "sell-side", tolerance, minClusterSize);
  const liquidityLevels = [...buyLevels, ...sellLevels];

  const sweeps: LiquiditySweep[] = [];

  // Scan for sweeps of buy-side liquidity (above price) — wick up, close back below
  for (const level of buyLevels) {
    const maxSwingIdx = Math.max(...level.swingIndices);
    for (let ci = maxSwingIdx + 1; ci < candles.length; ci++) {
      const candle = candles[ci]!;
      if (candle.close === undefined) continue;

      const wickPierces = candle.high > level.price;
      const closesBack = candle.close < level.price;
      if (!wickPierces || !closesBack) continue;

      const rejectionStrength = computeRejectionStrength(candle, level.price, "buy-side");
      if (rejectionStrength < minRejectionStrength) continue;

      const confidence = computeSweepConfidence(
        rejectionStrength,
        level.clusterSize,
        candle,
        level.price,
        "buy-side",
      );

      sweeps.push({
        direction: "buy-side",
        sweptLiquidity: level,
        sweepPrice: candle.high,
        sweepIndex: ci,
        rejectionStrength,
        confidence,
      });
      break; // one sweep per level
    }
  }

  // Scan for sweeps of sell-side liquidity (below price) — wick down, close back above
  for (const level of sellLevels) {
    const maxSwingIdx = Math.max(...level.swingIndices);
    for (let ci = maxSwingIdx + 1; ci < candles.length; ci++) {
      const candle = candles[ci]!;
      if (candle.close === undefined) continue;

      const wickPierces = candle.low < level.price;
      const closesBack = candle.close > level.price;
      if (!wickPierces || !closesBack) continue;

      const rejectionStrength = computeRejectionStrength(candle, level.price, "sell-side");
      if (rejectionStrength < minRejectionStrength) continue;

      const confidence = computeSweepConfidence(
        rejectionStrength,
        level.clusterSize,
        candle,
        level.price,
        "sell-side",
      );

      sweeps.push({
        direction: "sell-side",
        sweptLiquidity: level,
        sweepPrice: candle.low,
        sweepIndex: ci,
        rejectionStrength,
        confidence,
      });
      break; // one sweep per level
    }
  }

  // Sort chronologically
  sweeps.sort((a, b) => a.sweepIndex - b.sweepIndex);

  const lastBuySideSweep =
    [...sweeps].filter((s) => s.direction === "buy-side").pop() ?? null;
  const lastSellSideSweep =
    [...sweeps].filter((s) => s.direction === "sell-side").pop() ?? null;
  const lastSweep = sweeps.length > 0 ? sweeps[sweeps.length - 1]! : null;

  return {
    liquidityLevels,
    sweeps,
    lastSweep,
    lastBuySideSweep,
    lastSellSideSweep,
  };
}
