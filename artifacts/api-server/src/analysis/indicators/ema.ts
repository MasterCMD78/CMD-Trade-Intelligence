/**
 * EMA — Exponential Moving Average
 * Standard formula: EMA = price × k + prevEMA × (1 − k), k = 2/(period+1).
 */

import type { EmaResult, TrendDirection } from "../types.js";

/**
 * Compute a single EMA series for the given close prices.
 * Returns NaN for each position where there are not yet enough data points.
 */
export function computeEmaSeries(closes: number[], period: number): number[] {
  if (closes.length === 0) return [];
  const k = 2 / (period + 1);
  const result: number[] = new Array(closes.length).fill(NaN);

  // Seed with first close that has enough history (use SMA of first `period` values).
  if (closes.length < period) return result;

  let seed = 0;
  for (let i = 0; i < period; i++) seed += closes[i]!;
  let ema = seed / period;
  result[period - 1] = ema;

  for (let i = period; i < closes.length; i++) {
    ema = closes[i]! * k + ema * (1 - k);
    result[i] = ema;
  }
  return result;
}

/** Return the last value of the EMA series (or NaN if insufficient data). */
export function computeEmaValue(closes: number[], period: number): number {
  const series = computeEmaSeries(closes, period);
  return series[series.length - 1] ?? NaN;
}

/**
 * Compute the full EMA result (20, 50, 200) relative to the current price.
 */
export function computeEma(closes: number[], currentPrice: number): EmaResult {
  const n = closes.length;

  const ema20  = n >= 20  ? computeEmaValue(closes, 20)  : NaN;
  const ema50  = n >= 50  ? computeEmaValue(closes, 50)  : NaN;
  const ema200 = n >= 200 ? computeEmaValue(closes, 200) : NaN;

  // Fallback: if 200-period is unavailable, approximate from available data.
  const e20  = isNaN(ema20)  ? currentPrice : ema20;
  const e50  = isNaN(ema50)  ? currentPrice : ema50;
  const e200 = isNaN(ema200) ? currentPrice : ema200;

  const aboveEma20  = currentPrice > e20;
  const aboveEma50  = currentPrice > e50;
  const aboveEma200 = currentPrice > e200;

  // Trend: EMA stack alignment.
  let trend: TrendDirection;
  if (e20 > e50 && e50 > e200 && aboveEma20) {
    trend = "bullish";
  } else if (e20 < e50 && e50 < e200 && !aboveEma20) {
    trend = "bearish";
  } else {
    trend = "sideways";
  }

  const signal =
    trend === "bullish" ? "buy" :
    trend === "bearish" ? "sell" :
    "neutral";

  return {
    ema20:  +e20.toFixed(8),
    ema50:  +e50.toFixed(8),
    ema200: +e200.toFixed(8),
    trend,
    signal,
    priceAboveEma20:  aboveEma20,
    priceAboveEma50:  aboveEma50,
    priceAboveEma200: aboveEma200,
  };
}
