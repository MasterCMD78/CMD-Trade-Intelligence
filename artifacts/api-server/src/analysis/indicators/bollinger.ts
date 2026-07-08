/**
 * Bollinger Bands
 * Middle = SMA(20), Upper/Lower = Middle ± stdDev * multiplier (default 2).
 */

import type { BollingerResult } from "../types.js";
import { computeSmaSeries } from "./sma.js";

export function computeBollinger(
  closes: number[],
  period = 20,
  multiplier = 2,
): BollingerResult {
  const price = closes[closes.length - 1] ?? 0;
  const fallback: BollingerResult = {
    upper: price, middle: price, lower: price, pctB: 0.5, width: 0, signal: "neutral",
  };

  if (closes.length < period) return fallback;

  const smaSeries = computeSmaSeries(closes, period);
  const middle    = smaSeries[closes.length - 1]!;

  // Standard deviation of the last `period` closes.
  const slice = closes.slice(-period);
  const mean  = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((sum, v) => sum + (v - mean) ** 2, 0) / period;
  const stdDev   = Math.sqrt(variance);

  const upper = middle + multiplier * stdDev;
  const lower = middle - multiplier * stdDev;

  const pctB  = stdDev === 0 ? 0.5 : (price - lower) / (upper - lower);
  const width = middle === 0 ? 0 : (upper - lower) / middle;

  const signal =
    pctB > 0.85 ? "sell" :
    pctB < 0.15 ? "buy" :
    "neutral";

  return {
    upper:  +upper.toFixed(8),
    middle: +middle.toFixed(8),
    lower:  +lower.toFixed(8),
    pctB:   +pctB.toFixed(4),
    width:  +width.toFixed(6),
    signal,
  };
}
