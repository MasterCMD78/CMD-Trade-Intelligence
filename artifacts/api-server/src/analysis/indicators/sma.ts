/**
 * SMA — Simple Moving Average
 */

import type { SmaResult } from "../types.js";

export function computeSmaSeries(closes: number[], period: number): number[] {
  const result: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period) return result;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += closes[i]!;
  result[period - 1] = sum / period;
  for (let i = period; i < closes.length; i++) {
    sum += closes[i]! - closes[i - period]!;
    result[i] = sum / period;
  }
  return result;
}

export function computeSmaValue(closes: number[], period: number): number {
  const series = computeSmaSeries(closes, period);
  return series[series.length - 1] ?? NaN;
}

export function computeSma(closes: number[]): SmaResult {
  const sma20 = computeSmaValue(closes, 20);
  const sma50 = computeSmaValue(closes, 50);
  return {
    sma20: isNaN(sma20) ? closes[closes.length - 1]! : +sma20.toFixed(8),
    sma50: isNaN(sma50) ? closes[closes.length - 1]! : +sma50.toFixed(8),
  };
}
