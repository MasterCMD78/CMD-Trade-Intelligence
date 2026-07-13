/**
 * News Confidence Engine (Phase 5, Part 7).
 *
 * A 0-100 read on how much weight the current news assessment deserves,
 * combining: impact, time proximity, currency relevance, historical
 * reliability of the indicator, and how many events are compounding at once.
 * Pure function — no I/O, no provider awareness.
 */

import type { NewsEngineConfig } from "./config.js";
import type { EconomicEvent, EventCategory, EventImpact } from "./types.js";

const IMPACT_WEIGHT: Record<EventImpact, number> = { high: 1, medium: 0.6, low: 0.3 };

/**
 * How reliably each category's release actually moves markets the way the
 * headline number suggests. Rate decisions and headline inflation/jobs
 * prints are the most dependable movers; speeches and secondary surveys
 * are noisier.
 */
const HISTORICAL_RELIABILITY: Record<EventCategory, number> = {
  FOMC: 1.0,
  INTEREST_RATE: 1.0,
  NFP: 0.95,
  CPI: 0.95,
  CORE_CPI: 0.9,
  GDP: 0.85,
  UNEMPLOYMENT: 0.8,
  PPI: 0.7,
  RETAIL_SALES: 0.75,
  PMI: 0.65,
  CENTRAL_BANK_SPEECH: 0.55,
  OTHER: 0.5,
};

/** 1.0 at the event itself, decaying linearly to 0 at the edge of the warning window. */
export function proximityFactor(minutesUntil: number, config: NewsEngineConfig): number {
  const distance = Math.abs(minutesUntil);
  if (distance >= config.warningWindowMinutes) return 0;
  return 1 - distance / config.warningWindowMinutes;
}

export interface ActiveNewsEvent {
  event: EconomicEvent;
  minutesUntil: number;
  /** Currency-relevance weight from `getRelevantCurrencies` (0-1). */
  relevanceWeight: number;
}

/** Baseline confidence when no relevant event is anywhere near the window — a quiet calendar is not "certain" either way. */
const QUIET_CALENDAR_BASELINE = 0;
/** Extra confidence per additional simultaneous active event, capped. */
const MULTIPLICITY_STEP = 0.05;
const MAX_MULTIPLICITY_EVENTS = 3;

export function computeNewsConfidence(active: ActiveNewsEvent[], config: NewsEngineConfig): number {
  if (active.length === 0) return QUIET_CALENDAR_BASELINE;

  const contributions = active.map((a) => {
    const impact = IMPACT_WEIGHT[a.event.impact];
    const proximity = proximityFactor(a.minutesUntil, config);
    const reliability = HISTORICAL_RELIABILITY[a.event.category];
    return impact * proximity * a.relevanceWeight * reliability;
  });

  const top = Math.max(...contributions);
  const multiplicityBonus = Math.min(active.length - 1, MAX_MULTIPLICITY_EVENTS) * MULTIPLICITY_STEP;

  return Math.round(Math.max(0, Math.min(1, top + multiplicityBonus)) * 100);
}
