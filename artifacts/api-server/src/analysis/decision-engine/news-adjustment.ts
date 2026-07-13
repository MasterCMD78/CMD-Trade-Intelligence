/**
 * News-driven decision adjustment (Phase 5, Part 8).
 *
 * Applies the News Engine's read as a post-scoring adjustment layer on top
 * of the base institutional decision — it never re-scores the underlying
 * technical modules, it only tempers confidence/grade and, in the narrow
 * "mega-event imminent" case, forces a hard WAIT override.
 *
 * Two distinct effects, matched to two different spec examples:
 *   - Ordinary high-impact proximity (LOCK_TRADING but not mega/imminent):
 *     confidence/score take a material penalty, decision is left alone.
 *   - LOCK_TRADING *and* (mega-event category like FOMC/rate decisions, OR
 *     within `hardLockMinutes` of release): decision is forced to WAIT —
 *     these are the two-sided, coin-flip-risk windows no score should
 *     override.
 */

import { gradeFromScore } from "./grade.js";
import { DEFAULT_NEWS_CONFIG } from "../news/config.js";
import type { EventCategory, NewsAnalysisResult } from "../news/types.js";
import type { ConfidenceBundle, InstitutionalDecision, TradeGrade } from "./types.js";

/** Rate-decision-class categories carry inherent two-sided risk regardless of score conviction. */
const MEGA_EVENT_CATEGORIES: EventCategory[] = ["FOMC", "INTEREST_RATE"];

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

function penaltyForRestriction(news: NewsAnalysisResult): number {
  switch (news.tradingRestriction) {
    case "LOCK_TRADING":
      return DEFAULT_NEWS_CONFIG.confidencePenalties.high;
    case "NO_TRADE":
      return DEFAULT_NEWS_CONFIG.confidencePenalties.medium;
    case "CAUTION":
      return DEFAULT_NEWS_CONFIG.confidencePenalties.low;
    default:
      return 0;
  }
}

/** Small nudge for fundamental bias agreeing or conflicting with the technical decision. */
function biasAdjustment(news: NewsAnalysisResult, decision: InstitutionalDecision): number {
  if (news.fundamentalBias === "unknown" || news.fundamentalBias === "neutral") return 0;
  if (decision !== "BUY" && decision !== "SELL") return 0;

  const decisionSign = decision === "BUY" ? 1 : -1;
  const biasSign = news.fundamentalBias === "bullish" ? 1 : -1;
  return decisionSign === biasSign ? 5 : -8;
}

function isForcedWaitWindow(news: NewsAnalysisResult): boolean {
  if (news.tradingRestriction !== "LOCK_TRADING" || !news.currentEvent) return false;
  const isMegaEvent = MEGA_EVENT_CATEGORIES.includes(news.currentEvent.category);
  const isImminent = news.minutesRemaining !== null && Math.abs(news.minutesRemaining) <= DEFAULT_NEWS_CONFIG.hardLockMinutes;
  return isMegaEvent || isImminent;
}

export interface NewsAdjustmentInput {
  news: NewsAnalysisResult;
  decision: InstitutionalDecision;
  institutionalScore: number;
  tradeGrade: TradeGrade;
  confidence: ConfidenceBundle;
}

export interface NewsAdjustmentResult {
  decision: InstitutionalDecision;
  institutionalScore: number;
  tradeGrade: TradeGrade;
  confidence: ConfidenceBundle;
  reasons: string[];
}

export function applyNewsAdjustment(input: NewsAdjustmentInput): NewsAdjustmentResult {
  const { news } = input;
  const reasons: string[] = [];

  const restrictionPenalty = penaltyForRestriction(news);
  const bias = biasAdjustment(news, input.decision);
  const totalDelta = -restrictionPenalty + bias;

  if (restrictionPenalty === 0 && bias === 0) {
    return { ...input, reasons };
  }

  const institutionalScore = Math.round(clamp(input.institutionalScore + totalDelta));
  const tradeGrade = gradeFromScore(institutionalScore);
  const confidence: ConfidenceBundle = {
    overallConfidence: Math.round(clamp(input.confidence.overallConfidence + totalDelta)),
    institutionalScore,
    decisionConfidence: Math.round(clamp(input.confidence.decisionConfidence + totalDelta)),
    riskConfidence: Math.round(clamp(input.confidence.riskConfidence - restrictionPenalty)),
  };

  const eventName = news.currentEvent?.name ?? "upcoming release";
  if (restrictionPenalty > 0) {
    reasons.push(
      `News: ${news.tradingRestriction.replace(/_/g, " ")} — ${eventName} (${news.severity ?? "n/a"} impact) cuts confidence by ${restrictionPenalty}.`,
    );
  }
  if (bias !== 0) {
    reasons.push(
      bias > 0
        ? `News: fundamental bias (${news.fundamentalBias}) aligns with the ${input.decision} call.`
        : `News: fundamental bias (${news.fundamentalBias}) conflicts with the ${input.decision} call.`,
    );
  }

  let decision = input.decision;
  if (isForcedWaitWindow(news) && decision !== "WAIT") {
    decision = "WAIT";
    reasons.push(`News: trading locked ahead of ${eventName} — forcing WAIT until the event clears.`);
  }

  return { decision, institutionalScore, tradeGrade, confidence, reasons };
}
