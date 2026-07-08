/**
 * Trend Analysis
 * Uses price structure (higher highs / lower lows) over multiple lookback windows.
 */

import type { TrendResult, TrendDirection } from "../types.js";
import type { MarketCandle } from "../../market-data/types.js";

/**
 * Determine the trend over the most recent `lookback` candles.
 * Bullish  = close above open average + closes rising on balance.
 * Bearish  = opposite.
 * Sideways = neither.
 */
function detectTrendOver(candles: MarketCandle[], lookback: number): TrendDirection {
  if (candles.length < lookback + 1) return "sideways";
  const window = candles.slice(-lookback);

  // Count bullish vs bearish candles.
  let bull = 0, bear = 0;
  for (const c of window) {
    if (c.close > c.open) bull++;
    else if (c.close < c.open) bear++;
  }

  // Price change over the window.
  const start = window[0]!.open;
  const end   = window[window.length - 1]!.close;
  const pctChange = (end - start) / start;

  // Classify: need both candle majority and price direction agreement.
  if (bull > bear && pctChange > 0.001) return "bullish";
  if (bear > bull && pctChange < -0.001) return "bearish";
  return "sideways";
}

export function computeTrend(candles: MarketCandle[]): TrendResult {
  const shortTerm  = detectTrendOver(candles, 10);
  const mediumTerm = detectTrendOver(candles, 20);
  const longTerm   = detectTrendOver(candles, 50);

  // Overall: majority vote.
  const score =
    (shortTerm  === "bullish" ? 1 : shortTerm  === "bearish" ? -1 : 0) +
    (mediumTerm === "bullish" ? 1 : mediumTerm === "bearish" ? -1 : 0) +
    (longTerm   === "bullish" ? 1 : longTerm   === "bearish" ? -1 : 0);

  const overall: TrendDirection =
    score >= 2  ? "bullish" :
    score <= -2 ? "bearish" :
    "sideways";

  const signal =
    overall === "bullish" ? "buy" :
    overall === "bearish" ? "sell" :
    "neutral";

  return { shortTerm, mediumTerm, longTerm, overall, signal };
}
