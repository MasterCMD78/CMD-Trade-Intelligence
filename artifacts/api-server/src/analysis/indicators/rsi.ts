/**
 * RSI — Relative Strength Index
 * Uses Wilder's smoothing method (identical to TradingView default).
 */

import type { RsiResult } from "../types.js";

/**
 * Compute RSI for the given close-price series.
 * `closes` must be ordered oldest → newest.
 * Returns a neutral result when there are not enough data points.
 */
export function computeRsi(closes: number[], period = 14): RsiResult {
  if (closes.length < period + 1) {
    return { value: 50, signal: "neutral", overbought: false, oversold: false };
  }

  // Seed: simple average of the first `period` changes.
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i]! - closes[i - 1]!;
    if (diff > 0) avgGain += diff;
    else avgLoss += Math.abs(diff);
  }
  avgGain /= period;
  avgLoss /= period;

  // Wilder's smoothing for the remaining candles.
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i]! - closes[i - 1]!;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  // True flat series (no gains AND no losses over the whole window) has no
  // momentum in either direction — treat as neutral (50), not overbought.
  // Only when there ARE losses but avgLoss rounds to 0 relative to gains
  // (all-up-moves case) does RSI correctly saturate at 100.
  let value: number;
  if (avgGain === 0 && avgLoss === 0) {
    value = 50;
  } else if (avgLoss === 0) {
    value = 100;
  } else {
    const rs = avgGain / avgLoss;
    value = 100 - 100 / (1 + rs);
  }

  const signal =
    value < 30 ? "buy" :
    value > 70 ? "sell" :
    "neutral";

  return {
    value:      +value.toFixed(2),
    signal,
    overbought: value > 70,
    oversold:   value < 30,
  };
}
