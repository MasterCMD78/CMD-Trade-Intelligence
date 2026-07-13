/**
 * Fundamental Bias Engine (Phase 5, Part 6).
 *
 * Derives a directional read (bullish/bearish/neutral) for one currency from
 * its recently *released* data (`actual` vs `forecast`), weighted by event
 * impact. Categories with no natural "higher is stronger-currency" reading
 * (speeches, unmapped categories) don't contribute a numeric surprise but
 * still count toward risk/confidence elsewhere.
 */

import { parseEventValue } from "./event-value.js";
import type { EconomicEvent, EventCategory, FundamentalBias } from "./types.js";

/**
 * +1  — a beat (actual > forecast) is bullish for the currency.
 * -1  — a beat is bearish for the currency (e.g. rising unemployment).
 * Categories omitted here (CENTRAL_BANK_SPEECH, OTHER) have no numeric
 * surprise to score and are excluded from bias math.
 */
const CATEGORY_DIRECTION: Partial<Record<EventCategory, 1 | -1>> = {
  CPI: 1,
  CORE_CPI: 1,
  NFP: 1,
  FOMC: 1,
  INTEREST_RATE: 1,
  GDP: 1,
  RETAIL_SALES: 1,
  PMI: 1,
  PPI: 1,
  UNEMPLOYMENT: -1,
};

const IMPACT_WEIGHT: Record<EconomicEvent["impact"], number> = { high: 1, medium: 0.6, low: 0.3 };

/** Surprise magnitude (relative to forecast) beyond which the read counts as directional, not neutral. */
const NEUTRAL_BAND = 0.05;

/** Derives a single currency's fundamental bias from its released events. */
export function deriveFundamentalBias(events: EconomicEvent[], currency: string): FundamentalBias {
  const relevant = events.filter(
    (e) => e.currency === currency && e.actual !== null && CATEGORY_DIRECTION[e.category] !== undefined,
  );
  if (relevant.length === 0) return "unknown";

  let weightedSum = 0;
  let totalWeight = 0;
  for (const e of relevant) {
    const actual = parseEventValue(e.actual);
    const forecast = parseEventValue(e.forecast);
    if (actual === null || forecast === null || forecast === 0) continue;

    const surprise = (actual - forecast) / Math.abs(forecast);
    const direction = CATEGORY_DIRECTION[e.category]!;
    const weight = IMPACT_WEIGHT[e.impact];
    weightedSum += surprise * direction * weight;
    totalWeight += weight;
  }
  if (totalWeight === 0) return "unknown";

  const avgSurprise = weightedSum / totalWeight;
  if (avgSurprise > NEUTRAL_BAND) return "bullish";
  if (avgSurprise < -NEUTRAL_BAND) return "bearish";
  return "neutral";
}

function biasSign(bias: FundamentalBias): -1 | 0 | 1 {
  return bias === "bullish" ? 1 : bias === "bearish" ? -1 : 0;
}

/**
 * Combines a base-currency bias and a quote-currency bias into a pair bias
 * (e.g. EUR bullish + USD bearish => EURUSD bullish). `base`/`quote` must
 * follow the [base, quote] order `getRelevantCurrencies` returns.
 */
export function combinePairBias(base: FundamentalBias, quote?: FundamentalBias): FundamentalBias {
  if (!quote) return base;
  if (base === "unknown" && quote === "unknown") return "unknown";

  const combined = biasSign(base) - biasSign(quote);
  if (combined > 0) return "bullish";
  if (combined < 0) return "bearish";
  return "neutral";
}
