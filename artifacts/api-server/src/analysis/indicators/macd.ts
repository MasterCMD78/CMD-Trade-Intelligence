/**
 * MACD — Moving Average Convergence Divergence
 * Standard parameters: fast=12, slow=26, signal=9.
 */

import type { MacdResult } from "../types.js";
import { computeEmaSeries } from "./ema.js";

export function computeMacd(
  closes: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
): MacdResult {
  const fallback: MacdResult = {
    macdLine: 0, signalLine: 0, histogram: 0, crossover: "none", signal: "neutral",
  };

  if (closes.length < slowPeriod + signalPeriod) return fallback;

  const fastEma = computeEmaSeries(closes, fastPeriod);
  const slowEma = computeEmaSeries(closes, slowPeriod);

  // MACD line = fastEMA - slowEMA (start where both are defined, i.e. from index slowPeriod-1).
  const macdLine: number[] = [];
  const startIdx = slowPeriod - 1;
  for (let i = startIdx; i < closes.length; i++) {
    const fast = fastEma[i];
    const slow = slowEma[i];
    if (fast !== undefined && !isNaN(fast) && slow !== undefined && !isNaN(slow)) {
      macdLine.push(fast - slow);
    }
  }

  if (macdLine.length < signalPeriod) return fallback;

  // Signal line = EMA of MACD line.
  const signalSeries = computeEmaSeries(macdLine, signalPeriod);
  const lastMacd   = macdLine[macdLine.length - 1]!;
  const lastSignal = signalSeries[signalSeries.length - 1]!;
  const prevMacd   = macdLine[macdLine.length - 2] ?? lastMacd;
  const prevSignal = signalSeries[signalSeries.length - 2] ?? lastSignal;
  const histogram  = lastMacd - lastSignal;

  // Detect crossover in the most recent candle pair.
  let crossover: MacdResult["crossover"] = "none";
  if (prevMacd <= prevSignal && lastMacd > lastSignal) crossover = "bullish";
  else if (prevMacd >= prevSignal && lastMacd < lastSignal) crossover = "bearish";

  const signal =
    crossover === "bullish" ? "buy" :
    crossover === "bearish" ? "sell" :
    histogram > 0 ? "buy" :
    histogram < 0 ? "sell" :
    "neutral";

  return {
    macdLine:   +lastMacd.toFixed(8),
    signalLine: +lastSignal.toFixed(8),
    histogram:  +histogram.toFixed(8),
    crossover,
    signal,
  };
}
