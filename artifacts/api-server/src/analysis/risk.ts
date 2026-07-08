/**
 * Risk Management
 *
 * Calculates entry price, stop loss, take profit, and risk:reward ratio.
 *
 * Strategy:
 *   Entry   = current ask (BUY) or bid (SELL) — execute at market.
 *   Stop    = nearest support − 0.5 × ATR (BUY) or nearest resistance + 0.5 × ATR (SELL).
 *             Falls back to entry ± 1.5 × ATR when no level is available.
 *   Target  = nearest resistance (BUY) or nearest support (SELL).
 *             Falls back to entry ± (risk × 2) for a minimum 2:1 R:R.
 *
 * Minimum R:R enforced at 1.2 regardless of levels.
 */

import type { IndicatorSet, Decision } from "./types.js";

export interface RiskParams {
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskRewardRatio: number;
}

const MIN_RR = 1.2;

export function computeRisk(
  decision: Decision,
  currentBid: number,
  currentAsk: number,
  indicators: IndicatorSet,
): RiskParams {
  const { value: atr } = indicators.atr;
  const { nearestSupport, nearestResistance } = indicators.supportResistance;

  if (decision === "HOLD") {
    return { entryPrice: currentBid, stopLoss: currentBid, takeProfit: currentBid, riskRewardRatio: 0 };
  }

  if (decision === "BUY") {
    const entry = +currentAsk.toFixed(8);

    // Stop: below nearest support minus buffer, or ATR-based.
    const rawStop = nearestSupport
      ? nearestSupport - atr * 0.5
      : entry - atr * 1.5;
    const stop = +Math.min(rawStop, entry - atr * 1.0).toFixed(8);
    const risk = entry - stop;

    // Target: nearest resistance, or minimum 2:1 RR target.
    const minTarget  = entry + risk * MIN_RR;
    const rawTarget  = nearestResistance ?? minTarget;
    const takeProfit = +Math.max(rawTarget, minTarget).toFixed(8);

    const rr = risk > 0 ? (takeProfit - entry) / risk : 0;

    return {
      entryPrice:      entry,
      stopLoss:        stop,
      takeProfit,
      riskRewardRatio: +rr.toFixed(2),
    };
  }

  // SELL
  const entry = +currentBid.toFixed(8);

  const rawStop = nearestResistance
    ? nearestResistance + atr * 0.5
    : entry + atr * 1.5;
  const stop = +Math.max(rawStop, entry + atr * 1.0).toFixed(8);
  const risk = stop - entry;

  const minTarget  = entry - risk * MIN_RR;
  const rawTarget  = nearestSupport ?? minTarget;
  const takeProfit = +Math.min(rawTarget, minTarget).toFixed(8);

  const rr = risk > 0 ? (entry - takeProfit) / risk : 0;

  return {
    entryPrice:      entry,
    stopLoss:        stop,
    takeProfit,
    riskRewardRatio: +rr.toFixed(2),
  };
}
