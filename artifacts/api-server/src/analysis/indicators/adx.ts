/**
 * ADX — Average Directional Index
 * Includes +DI and −DI. Uses Wilder's smoothing.
 */

import type { AdxResult } from "../types.js";
import type { MarketCandle } from "../../market-data/types.js";
import { computeTrueRangeSeries } from "./atr.js";

export function computeAdx(candles: MarketCandle[], period = 14): AdxResult {
  const fallback: AdxResult = { adx: 0, plusDI: 0, minusDI: 0, trending: false, signal: "neutral" };

  if (candles.length < period * 2 + 1) return fallback;

  const tr: number[] = computeTrueRangeSeries(candles);
  const plusDM: number[] = [];
  const minusDM: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const upMove   = candles[i]!.high  - candles[i - 1]!.high;
    const downMove = candles[i - 1]!.low - candles[i]!.low;
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }

  // Wilder's running-sum smoothing for TR, +DM, -DM. This is the classic
  // "accumulated sum" form: since +DI/−DI are ratios of two series smoothed
  // identically, the shared scale cancels out and the ratio is correct.
  function wilderSmoothSum(series: number[]): number[] {
    if (series.length < period) return [];
    const smoothed: number[] = [];
    let val = series.slice(0, period).reduce((a, b) => a + b, 0);
    smoothed.push(val);
    for (let i = period; i < series.length; i++) {
      val = val - val / period + series[i]!;
      smoothed.push(val);
    }
    return smoothed;
  }

  // Wilder's *average* smoothing (true moving average, not a running sum).
  // DX values are already percentages in [0, 100]; averaging them (rather
  // than summing) is required to keep ADX itself in the [0, 100] range.
  function wilderSmoothAverage(series: number[]): number[] {
    if (series.length < period) return [];
    const smoothed: number[] = [];
    let avg = series.slice(0, period).reduce((a, b) => a + b, 0) / period;
    smoothed.push(avg);
    for (let i = period; i < series.length; i++) {
      avg = (avg * (period - 1) + series[i]!) / period;
      smoothed.push(avg);
    }
    return smoothed;
  }

  const smoothTR   = wilderSmoothSum(tr);
  const smoothPlus = wilderSmoothSum(plusDM);
  const smoothMinus = wilderSmoothSum(minusDM);

  if (smoothTR.length === 0) return fallback;

  const dxSeries: number[] = [];
  for (let i = 0; i < smoothTR.length; i++) {
    const atr = smoothTR[i]!;
    if (atr === 0) { dxSeries.push(0); continue; }
    const pDI = 100 * smoothPlus[i]! / atr;
    const mDI = 100 * smoothMinus[i]! / atr;
    const sum = pDI + mDI;
    dxSeries.push(sum === 0 ? 0 : 100 * Math.abs(pDI - mDI) / sum);
  }

  // ADX = Wilder's *averaged* smoothing of DX (not a running sum — DX is
  // already a 0-100 percentage, so averaging keeps ADX in the same range).
  const smoothDX = wilderSmoothAverage(dxSeries);
  if (smoothDX.length === 0) return fallback;

  const lastIdx  = smoothTR.length - 1;
  const atrLast  = smoothTR[lastIdx]!;
  const plusDILast  = atrLast > 0 ? 100 * smoothPlus[lastIdx]!  / atrLast : 0;
  const minusDILast = atrLast > 0 ? 100 * smoothMinus[lastIdx]! / atrLast : 0;
  const adx         = smoothDX[smoothDX.length - 1]!;

  const trending = adx > 25;
  const signal =
    plusDILast > minusDILast ? "buy" :
    minusDILast > plusDILast ? "sell" :
    "neutral";

  return {
    adx:      +adx.toFixed(2),
    plusDI:   +plusDILast.toFixed(2),
    minusDI:  +minusDILast.toFixed(2),
    trending,
    signal,
  };
}
