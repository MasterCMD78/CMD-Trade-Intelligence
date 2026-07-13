/**
 * News Engine orchestrator (Phase 5, Parts 4-8).
 *
 * `computeNewsAnalysis` is the pure entry point: given a symbol, a point in
 * time, a raw event list, and config, it produces the full
 * `NewsAnalysisResult` consumed by `AnalysisResult.news` and the
 * Institutional Decision Engine. No I/O — fetching events is the caller's
 * (service/route) job.
 */

import type { ActiveNewsEvent } from "./confidence.js";
import { computeNewsConfidence } from "./confidence.js";
import { combinePairBias, deriveFundamentalBias } from "./bias.js";
import { DEFAULT_NEWS_CONFIG, type NewsEngineConfig } from "./config.js";
import { getRelevantCurrencies } from "./currency-mapping.js";
import {
  classifyRisk,
  computeRawRiskScore,
  computeTradingRestriction,
  recommendationForRestriction,
} from "./restrictions.js";
import type { EconomicEvent, NewsAnalysisResult, NewsWindow } from "./types.js";

function minutesBetween(a: Date, b: Date): number {
  return (a.getTime() - b.getTime()) / 60_000;
}

export interface ComputeNewsAnalysisInput {
  symbol: string;
  now: Date;
  events: EconomicEvent[];
  config?: NewsEngineConfig;
}

export function computeNewsAnalysis(input: ComputeNewsAnalysisInput): NewsAnalysisResult {
  const { symbol, now, events } = input;
  const config = input.config ?? DEFAULT_NEWS_CONFIG;

  const relevance = getRelevantCurrencies(symbol);
  const relevanceByCurrency = new Map(relevance.map((r) => [r.currency, r.weight]));
  const affectedCurrencies = relevance.map((r) => r.currency);

  const relevantEvents = events
    .filter((e) => relevanceByCurrency.has(e.currency))
    .map((e) => ({ event: e, minutesUntil: minutesBetween(e.scheduledTime, now) }))
    .sort((a, b) => Math.abs(a.minutesUntil) - Math.abs(b.minutesUntil));

  // "Active" = inside the warning window (past cooldown or future warning) — these drive risk/confidence.
  const activeCandidates: ActiveNewsEvent[] = relevantEvents
    .filter(({ minutesUntil }) => {
      const distance = Math.abs(minutesUntil);
      const withinWarning = distance <= config.warningWindowMinutes;
      const withinCooldown = minutesUntil < 0 && distance <= config.postEventCooldownMinutes;
      return withinWarning || withinCooldown;
    })
    .map(({ event, minutesUntil }) => ({
      event,
      minutesUntil,
      relevanceWeight: relevanceByCurrency.get(event.currency) ?? 0,
    }));

  const activeEvents = activeCandidates.map((a) => a.event);
  const current = activeCandidates[0] ?? null;

  const upcoming = relevantEvents.find(({ minutesUntil }) => minutesUntil > 0 && (!current || minutesUntil !== current.minutesUntil));
  const nextEvent = upcoming?.event ?? null;

  const minutesRemaining = current?.minutesUntil ?? null;
  const hoursRemaining = minutesRemaining === null ? null : minutesRemaining / 60;
  const severity = current?.event.impact ?? null;

  const tradingRestriction = computeTradingRestriction(severity, minutesRemaining, config);
  const rawRisk = computeRawRiskScore(severity, minutesRemaining, config);
  const riskLevel = classifyRisk(rawRisk, config);
  const recommendation = recommendationForRestriction(tradingRestriction);
  const newsConfidence = computeNewsConfidence(activeCandidates, config);

  const perCurrencyBias = affectedCurrencies.map((c) => deriveFundamentalBias(events, c));
  const fundamentalBias = combinePairBias(perCurrencyBias[0] ?? "unknown", perCurrencyBias[1]);

  const window: NewsWindow = {
    minutesUntil: minutesRemaining,
    hoursUntil: hoursRemaining,
    isWarning: tradingRestriction !== "SAFE",
    isLocked: tradingRestriction === "LOCK_TRADING",
  };

  return {
    symbol,
    currentEvent: current?.event ?? null,
    nextEvent,
    minutesRemaining,
    hoursRemaining,
    severity,
    fundamentalBias,
    newsConfidence,
    riskLevel,
    tradingRestriction,
    recommendation,
    affectedCurrencies,
    window,
    activeEvents,
  };
}
