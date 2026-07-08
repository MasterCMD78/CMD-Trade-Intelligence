/**
 * Stochastic RSI
 * StochRSI = (RSI - min(RSI, period)) / (max(RSI, period) - min(RSI, period))
 * %K = SMA(3) of StochRSI * 100
 * %D = SMA(3) of %K
 */

import type { StochasticRsiResult } from "../types.js";
import { computeRsi } from "./rsi.js";

/** Compute full RSI series by sliding window. */
function computeRsiSeries(closes: number[], period: number): number[] {
  const results: number[] = [];
  for (let i = period; i <= closes.length; i++) {
    results.push(computeRsi(closes.slice(0, i), period).value);
  }
  return results;
}

function simpleSma(arr: number[], period: number): number {
  if (arr.length < period) return arr[arr.length - 1] ?? 50;
  const slice = arr.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

export function computeStochasticRsi(
  closes: number[],
  rsiPeriod = 14,
  stochPeriod = 14,
  kSmooth = 3,
  dSmooth = 3,
): StochasticRsiResult {
  const fallback: StochasticRsiResult = {
    k: 50, d: 50, signal: "neutral", overbought: false, oversold: false,
  };

  if (closes.length < rsiPeriod + stochPeriod + kSmooth + dSmooth) return fallback;

  const rsiValues = computeRsiSeries(closes, rsiPeriod);
  if (rsiValues.length < stochPeriod) return fallback;

  // Compute raw StochRSI values.
  const stochRaw: number[] = [];
  for (let i = stochPeriod - 1; i < rsiValues.length; i++) {
    const window = rsiValues.slice(i - stochPeriod + 1, i + 1);
    const minRsi = Math.min(...window);
    const maxRsi = Math.max(...window);
    const range  = maxRsi - minRsi;
    stochRaw.push(range === 0 ? 0.5 : (rsiValues[i]! - minRsi) / range);
  }

  // %K = SMA(kSmooth) of StochRSI * 100.
  const kValues: number[] = [];
  for (let i = kSmooth - 1; i < stochRaw.length; i++) {
    kValues.push(simpleSma(stochRaw.slice(0, i + 1), kSmooth) * 100);
  }

  const k = kValues[kValues.length - 1] ?? 50;
  const d = simpleSma(kValues, dSmooth);

  const signal =
    k < 20 ? "buy" :
    k > 80 ? "sell" :
    "neutral";

  return {
    k:         +k.toFixed(2),
    d:         +d.toFixed(2),
    signal,
    overbought: k > 80,
    oversold:   k < 20,
  };
}
