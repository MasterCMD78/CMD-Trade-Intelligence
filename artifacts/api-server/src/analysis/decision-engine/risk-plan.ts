/**
 * Decision Engine — Risk Plan builder.
 *
 * Reuses the existing Risk Engine output (`result.entryPrice/stopLoss/
 * takeProfit/riskRewardRatio`) rather than recomputing entry/stop levels.
 * Extends it with TP2/TP3 (extrapolated beyond TP1 at 1.5x / 2x the TP1
 * distance) and a position-sizing recommendation.
 *
 * Position sizing model:
 *   maxRiskPct   — policy cap on account risk, scaled by trade grade
 *                  (better setups earn a larger risk allowance).
 *   positionSize — % of allocated capital to deploy, derived from
 *                  maxRiskPct / stopDistance (as a fraction of entry price),
 *                  clamped to [0, 100]. Higher for tighter stops, lower for
 *                  wide stops — the standard "risk-based sizing" formula.
 */

import { computeRisk } from "../risk.js";
import type { AnalysisResult } from "../types.js";
import type { DecisionRiskPlan, InstitutionalDecision, TradeGrade } from "./types.js";

const MAX_RISK_BY_GRADE: Record<TradeGrade, number> = {
  "A+": 2.0,
  A: 1.5,
  B: 1.0,
  C: 0.5,
  D: 0.25,
};

function flat(entry: number): DecisionRiskPlan {
  return {
    entry,
    stopLoss: entry,
    takeProfit1: entry,
    takeProfit2: entry,
    takeProfit3: entry,
    riskRewardRatio: 0,
    positionSize: 0,
    maxRiskPct: 0,
    tradeManagement: "No active trade — standing by for a higher-conviction setup before committing capital.",
  };
}

export function buildRiskPlan(
  result: AnalysisResult,
  decision: InstitutionalDecision,
  tradeGrade: TradeGrade,
  currentBid: number,
  currentAsk: number,
): DecisionRiskPlan {
  if (decision === "HOLD" || decision === "WAIT") {
    return flat(currentBid);
  }

  // Recompute entry/stop/target for the *institutional* decision directly —
  // the base `result.entryPrice/stopLoss/takeProfit` reflect the composite
  // scoring engine's own decision, which can diverge from the Decision
  // Engine's (more conservative) call. Reusing them unconditionally would
  // silently attach a BUY plan to a SELL call (or a flat HOLD plan) whenever
  // the two engines disagree.
  const base = computeRisk(decision, currentBid, currentAsk, result.indicators);
  const entry = base.entryPrice;
  const stopLoss = base.stopLoss;
  const takeProfit1 = base.takeProfit;
  const direction = decision === "BUY" ? 1 : -1;
  const tp1Distance = Math.abs(takeProfit1 - entry);

  const takeProfit2 = +(entry + direction * tp1Distance * 1.5).toFixed(8);
  const takeProfit3 = +(entry + direction * tp1Distance * 2.0).toFixed(8);

  const stopDistance = Math.abs(entry - stopLoss);
  const stopDistanceFraction = entry > 0 ? stopDistance / entry : 0;
  const maxRiskPct = MAX_RISK_BY_GRADE[tradeGrade];
  const positionSize =
    stopDistanceFraction > 0 ? Math.min(100, +(maxRiskPct / stopDistanceFraction).toFixed(2)) : 0;

  const tradeManagement =
    tradeGrade === "A+" || tradeGrade === "A"
      ? "Scale out 50% at TP1, move stop to breakeven, trail the remainder toward TP2/TP3."
      : tradeGrade === "B"
        ? "Take partial profit at TP1, move stop to breakeven before targeting TP2."
        : "High-conviction management not warranted — take profit at TP1 and reassess before adding risk.";

  return {
    entry,
    stopLoss,
    takeProfit1,
    takeProfit2,
    takeProfit3,
    riskRewardRatio: base.riskRewardRatio,
    positionSize,
    maxRiskPct,
    tradeManagement,
  };
}
