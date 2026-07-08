/**
 * Volume Analysis
 * Compares recent volume to rolling average.  Identifies spikes and trend.
 */

import type { VolumeResult } from "../types.js";
import type { MarketCandle } from "../../market-data/types.js";

export function computeVolume(candles: MarketCandle[], avgPeriod = 20): VolumeResult {
  const fallback: VolumeResult = {
    current: 0, average: 0, ratio: 1, spike: false, trend: "average", signal: "neutral",
  };

  if (candles.length < 2) return fallback;

  const current = candles[candles.length - 1]!.volume;
  const slice   = candles.slice(-Math.min(avgPeriod, candles.length - 1));
  const average = slice.reduce((sum, c) => sum + c.volume, 0) / slice.length;

  if (average === 0) return fallback;

  const ratio = current / average;
  const spike = ratio > 2.0;

  const trend =
    ratio > 1.25  ? "above_average" :
    ratio < 0.75  ? "below_average" :
    "average";

  // Direction of the last candle.
  const lastCandle = candles[candles.length - 1]!;
  const bullishCandle = lastCandle.close >= lastCandle.open;

  // High volume confirms direction; low volume weakens signal.
  let signal: VolumeResult["signal"] = "neutral";
  if (ratio > 1.25) {
    signal = bullishCandle ? "buy" : "sell";
  } else if (ratio < 0.75) {
    signal = "neutral"; // weak volume → no conviction
  }

  return {
    current: Math.round(current),
    average: Math.round(average),
    ratio:   +ratio.toFixed(2),
    spike,
    trend,
    signal,
  };
}
