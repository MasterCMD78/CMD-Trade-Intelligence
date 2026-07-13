/**
 * Institutional Decision Engine — the central brain of CMD Trade Intelligence.
 *
 * Combines every existing analysis module (Indicators, Market Structure, BOS,
 * CHOCH, Liquidity, Order Blocks, Fair Value Gaps, Premium/Discount,
 * Multi-Timeframe, Risk) into one explainable institutional decision. Does
 * not duplicate any detection logic — it only reads the already-computed
 * `AnalysisResult` and scores/combines what's there.
 *
 * Pipeline:
 *   1. Score every module            → ScoreBreakdown[]         (scoring.ts)
 *   2. Combine into a net direction  → netDirectionScore [-1, 1]
 *   3. Combine into overall quality  → institutionalScore [0, 100]
 *   4. Institutional score + net direction → decision (deterministic)
 *   5. Institutional score            → trade grade
 *   6. Decision + net direction + risk data → confidence bundle
 *   7. Market state                   (market-state.ts)
 *   8. Risk plan                      (risk-plan.ts)
 *   9. Explainable reasons
 */

import type { AnalysisResult } from "../types.js";
import { computeAllScores } from "./scoring.js";
import { deriveMarketState } from "./market-state.js";
import { buildRiskPlan } from "./risk-plan.js";
import { gradeFromScore } from "./grade.js";
import { applyNewsAdjustment } from "./news-adjustment.js";
import type {
  ConfidenceBundle,
  DecisionEngineResult,
  InstitutionalDecision,
  ScoreBreakdown,
  TradeGrade,
} from "./types.js";

/** Below this institutional score there isn't enough conviction to hold any opinion. */
const WAIT_THRESHOLD = 45;
/** Minimum |net direction| required to call BUY/SELL rather than HOLD. */
const DECISION_THRESHOLD = 0.22;

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

function computeNetDirectionScore(breakdown: ScoreBreakdown[]): number {
  const weighted = breakdown.reduce((sum, b) => sum + b.score * b.weight, 0);
  return Math.max(-1, Math.min(1, weighted));
}

function computeInstitutionalScore(breakdown: ScoreBreakdown[]): number {
  const weighted = breakdown.reduce((sum, b) => sum + b.confidence * b.weight, 0);
  return Math.round(clamp(weighted));
}

function decideDecision(institutionalScore: number, netDirectionScore: number): InstitutionalDecision {
  if (institutionalScore < WAIT_THRESHOLD) return "WAIT";
  if (netDirectionScore >= DECISION_THRESHOLD) return "BUY";
  if (netDirectionScore <= -DECISION_THRESHOLD) return "SELL";
  return "HOLD";
}

function computeConfidenceBundle(
  institutionalScore: number,
  netDirectionScore: number,
  result: AnalysisResult,
): ConfidenceBundle {
  const decisionConfidence = Math.round(clamp(Math.abs(netDirectionScore) * 220));

  const riskBase = result.riskLevel === "low" ? 80 : result.riskLevel === "medium" ? 60 : 35;
  const rrBonus = Math.max(-15, Math.min(20, (result.riskRewardRatio - 1.5) * 10));
  const riskConfidence = Math.round(clamp(riskBase + rrBonus));

  const overallConfidence = Math.round(clamp((institutionalScore + decisionConfidence + riskConfidence) / 3));

  return { overallConfidence, institutionalScore, decisionConfidence, riskConfidence };
}

function buildReasons(
  decision: InstitutionalDecision,
  institutionalScore: number,
  tradeGrade: TradeGrade,
  marketState: string,
  breakdown: ScoreBreakdown[],
): string[] {
  const reasons: string[] = [
    `Institutional score ${institutionalScore}/100 (Grade ${tradeGrade}) → ${decision}.`,
    `Market state: ${marketState.replace(/_/g, " ")}.`,
  ];

  const decisionSign = decision === "BUY" ? 1 : decision === "SELL" ? -1 : 0;
  if (decisionSign !== 0) {
    const supporting = breakdown
      .filter((b) => Math.sign(b.score) === decisionSign && Math.abs(b.score) > 0.15)
      .sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
    for (const b of supporting) reasons.push(`${b.name}: ${b.explanation}`);

    const conflicting = breakdown.filter((b) => Math.sign(b.score) === -decisionSign && Math.abs(b.score) > 0.15);
    if (conflicting.length > 0) {
      reasons.push(`Caution — ${conflicting.map((b) => b.name).join(", ")} disagree with this call.`);
    }
  } else {
    reasons.push("No module cleared the conviction threshold required to trade — standing aside.");
  }

  return reasons;
}

export function computeDecisionEngine(
  result: AnalysisResult,
  currentBid: number,
  currentAsk: number,
): DecisionEngineResult {
  const breakdown = computeAllScores(result);
  const netDirectionScore = computeNetDirectionScore(breakdown);
  const baseInstitutionalScore = computeInstitutionalScore(breakdown);

  const baseDecision = decideDecision(baseInstitutionalScore, netDirectionScore);
  const baseGrade = gradeFromScore(baseInstitutionalScore);
  const baseConfidence = computeConfidenceBundle(baseInstitutionalScore, netDirectionScore, result);
  const marketState = deriveMarketState(result);

  const newsAdjustment = applyNewsAdjustment({
    news: result.news,
    decision: baseDecision,
    institutionalScore: baseInstitutionalScore,
    tradeGrade: baseGrade,
    confidence: baseConfidence,
  });

  const { decision, institutionalScore, tradeGrade, confidence } = newsAdjustment;
  const risk = buildRiskPlan(result, decision, tradeGrade, currentBid, currentAsk, result.news);
  const reasons = [
    ...buildReasons(decision, institutionalScore, tradeGrade, marketState, breakdown),
    ...newsAdjustment.reasons,
  ];

  return {
    decision,
    institutionalScore,
    tradeGrade,
    confidence,
    marketState,
    riskLevel: result.riskLevel,
    risk,
    reasons,
    breakdown,
  };
}
