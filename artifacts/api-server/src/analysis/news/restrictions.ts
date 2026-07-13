/**
 * Trading Restriction & Expected Volatility (Phase 5, Parts 4 & 5).
 *
 * Pure functions mapping (impact, time proximity) to a `TradingRestriction`
 * and a `NewsRisk` level. Both read the same two window thresholds from
 * config so restriction and risk stay consistent with each other.
 */

import { proximityFactor } from "./confidence.js";
import type { NewsEngineConfig } from "./config.js";
import type { EventImpact, NewsRecommendation, NewsRisk, TradingRestriction } from "./types.js";

/**
 * SAFE / CAUTION / NO_TRADE / LOCK_TRADING, keyed off how close the most
 * urgent relevant event is and how impactful it is.
 *   - Outside the warning window entirely        -> SAFE
 *   - High impact inside the lock window          -> LOCK_TRADING
 *   - High impact inside the warning (not lock)   -> NO_TRADE
 *   - Medium impact inside the lock window        -> NO_TRADE
 *   - Medium impact inside the warning (not lock) -> CAUTION
 *   - Low impact anywhere inside the warning       -> CAUTION
 */
export function computeTradingRestriction(
  severity: EventImpact | null,
  minutesUntil: number | null,
  config: NewsEngineConfig,
): TradingRestriction {
  if (severity === null || minutesUntil === null) return "SAFE";

  const distance = Math.abs(minutesUntil);
  const withinLock = distance <= config.lockWindowMinutes;
  const withinWarning = distance <= config.warningWindowMinutes;
  if (!withinWarning) return "SAFE";

  if (severity === "high") return withinLock ? "LOCK_TRADING" : "NO_TRADE";
  if (severity === "medium") return withinLock ? "NO_TRADE" : "CAUTION";
  return "CAUTION";
}

const RESTRICTION_TO_RECOMMENDATION: Record<TradingRestriction, NewsRecommendation> = {
  SAFE: "PROCEED",
  CAUTION: "CAUTION",
  NO_TRADE: "WAIT",
  LOCK_TRADING: "AVOID",
};

export function recommendationForRestriction(restriction: TradingRestriction): NewsRecommendation {
  return RESTRICTION_TO_RECOMMENDATION[restriction];
}

const IMPACT_WEIGHT: Record<EventImpact, number> = { high: 1, medium: 0.6, low: 0.3 };

/** Raw 0-100 volatility score for one event, before threshold classification. */
export function computeRawRiskScore(
  severity: EventImpact | null,
  minutesUntil: number | null,
  config: NewsEngineConfig,
): number {
  if (severity === null || minutesUntil === null) return 0;
  const proximity = proximityFactor(minutesUntil, config);
  return Math.round(IMPACT_WEIGHT[severity] * proximity * 100);
}

export function classifyRisk(rawScore: number, config: NewsEngineConfig): NewsRisk {
  const { extreme, high, medium } = config.riskThresholds;
  if (rawScore >= extreme) return "extreme";
  if (rawScore >= high) return "high";
  if (rawScore >= medium) return "medium";
  return "low";
}
