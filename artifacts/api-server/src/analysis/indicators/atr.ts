/**
 * ATR — Average True Range
 * Uses Wilder's smoothing (same as TradingView).
 */

import type { AtrResult } from "../types.js";
import type { MarketCandle } from "../../market-data/types.js";

/**
 * Compute True Range for each candle (oldest → newest).
 * TR = max(high − low, |high − prevClose|, |low − prevClose|).
 */
export function computeTrueRangeSeries(candles: MarketCandle[]): number[] {
  const tr: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const { high, low } = candles[i]!;
    const prevClose = candles[i - 1]!.close;
    tr.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }
  return tr;
}

export function computeAtr(candles: MarketCandle[], period = 14): AtrResult {
  const currentPrice = candles[candles.length - 1]?.close ?? 1;
  const fallback: AtrResult = { value: 0, pctOfPrice: 0, volatility: "low" };

  if (candles.length < period + 1) return fallback;

  const tr  = computeTrueRangeSeries(candles);
  if (tr.length < period) return fallback;

  // Seed ATR with simple average.
  let atr = tr.slice(0, period).reduce((a, b) => a + b, 0) / period;

  // Wilder's smoothing.
  for (let i = period; i < tr.length; i++) {
    atr = (atr * (period - 1) + tr[i]!) / period;
  }

  const pctOfPrice = currentPrice > 0 ? atr / currentPrice : 0;

  const volatility =
    pctOfPrice < 0.005 ? "low" :
    pctOfPrice < 0.015 ? "medium" :
    "high";

  return {
    value:       +atr.toFixed(8),
    pctOfPrice:  +pctOfPrice.toFixed(6),
    volatility,
  };
}
