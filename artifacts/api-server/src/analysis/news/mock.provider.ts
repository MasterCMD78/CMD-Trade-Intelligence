/**
 * MockNewsProvider (Phase 5, Part 9).
 *
 * Deterministic weekly economic calendar generator. Events are anchored to a
 * fixed epoch and repeat on a weekly cadence per template, so the same
 * `(from, to)` window always yields the same events — no randomness in
 * *which* events exist or *when*, only in their forecast/previous/actual
 * values (via the same `seededRand` approach used by
 * `market-data/mock.provider.ts`).
 *
 * No real network calls are made.
 */

import type { INewsProvider, NewsQueryParams } from "./provider.interface.js";
import type { EconomicEvent, EventCategory, EventImpact } from "./types.js";

function seededRand(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

interface EventTemplate {
  id: string;
  name: string;
  category: EventCategory;
  currency: string;
  country: string;
  impact: EventImpact;
  /** Day of week (0 = Sunday) the event recurs on. */
  weekday: number;
  hourUtc: number;
  minuteUtc: number;
  /** Base value the mock forecast/previous/actual oscillate around. */
  baseValue: number;
  unit: "%" | "K" | "";
}

const TEMPLATES: EventTemplate[] = [
  { id: "usd-nfp", name: "Non-Farm Payrolls", category: "NFP", currency: "USD", country: "US", impact: "high", weekday: 5, hourUtc: 13, minuteUtc: 30, baseValue: 180, unit: "K" },
  { id: "usd-cpi", name: "CPI y/y", category: "CPI", currency: "USD", country: "US", impact: "high", weekday: 3, hourUtc: 13, minuteUtc: 30, baseValue: 3.2, unit: "%" },
  { id: "usd-core-cpi", name: "Core CPI y/y", category: "CORE_CPI", currency: "USD", country: "US", impact: "high", weekday: 3, hourUtc: 13, minuteUtc: 30, baseValue: 3.8, unit: "%" },
  { id: "usd-fomc", name: "FOMC Rate Decision", category: "FOMC", currency: "USD", country: "US", impact: "high", weekday: 3, hourUtc: 18, minuteUtc: 0, baseValue: 5.25, unit: "%" },
  { id: "usd-retail", name: "Retail Sales m/m", category: "RETAIL_SALES", currency: "USD", country: "US", impact: "medium", weekday: 2, hourUtc: 13, minuteUtc: 30, baseValue: 0.4, unit: "%" },
  { id: "usd-unemployment", name: "Unemployment Rate", category: "UNEMPLOYMENT", currency: "USD", country: "US", impact: "high", weekday: 5, hourUtc: 13, minuteUtc: 30, baseValue: 3.9, unit: "%" },
  { id: "eur-cpi", name: "Eurozone CPI y/y", category: "CPI", currency: "EUR", country: "EU", impact: "high", weekday: 2, hourUtc: 10, minuteUtc: 0, baseValue: 2.6, unit: "%" },
  { id: "eur-ecb-speech", name: "ECB President Speech", category: "CENTRAL_BANK_SPEECH", currency: "EUR", country: "EU", impact: "medium", weekday: 1, hourUtc: 9, minuteUtc: 0, baseValue: 0, unit: "" },
  { id: "eur-pmi", name: "Manufacturing PMI", category: "PMI", currency: "EUR", country: "EU", impact: "medium", weekday: 1, hourUtc: 9, minuteUtc: 0, baseValue: 49.5, unit: "" },
  { id: "gbp-gdp", name: "GDP q/q", category: "GDP", currency: "GBP", country: "GB", impact: "high", weekday: 4, hourUtc: 7, minuteUtc: 0, baseValue: 0.3, unit: "%" },
  { id: "gbp-boe-rate", name: "BoE Rate Decision", category: "INTEREST_RATE", currency: "GBP", country: "GB", impact: "high", weekday: 4, hourUtc: 12, minuteUtc: 0, baseValue: 5.0, unit: "%" },
  { id: "jpy-boj-rate", name: "BoJ Rate Decision", category: "INTEREST_RATE", currency: "JPY", country: "JP", impact: "high", weekday: 2, hourUtc: 3, minuteUtc: 0, baseValue: 0.1, unit: "%" },
  { id: "aud-employment", name: "Employment Change", category: "NFP", currency: "AUD", country: "AU", impact: "medium", weekday: 4, hourUtc: 1, minuteUtc: 30, baseValue: 25, unit: "K" },
  { id: "cad-ppi", name: "PPI m/m", category: "PPI", currency: "CAD", country: "CA", impact: "low", weekday: 5, hourUtc: 13, minuteUtc: 30, baseValue: 0.2, unit: "%" },
  { id: "nzd-rbnz-rate", name: "RBNZ Rate Decision", category: "INTEREST_RATE", currency: "NZD", country: "NZ", impact: "medium", weekday: 3, hourUtc: 2, minuteUtc: 0, baseValue: 5.5, unit: "%" },
  { id: "chf-snb-speech", name: "SNB Chair Speech", category: "CENTRAL_BANK_SPEECH", currency: "CHF", country: "CH", impact: "low", weekday: 1, hourUtc: 8, minuteUtc: 0, baseValue: 0, unit: "" },
];

const MS_PER_DAY = 86_400_000;

function formatValue(value: number, unit: EventTemplate["unit"]): string {
  if (unit === "%") return `${value.toFixed(1)}%`;
  if (unit === "K") return `${Math.round(value)}K`;
  return value.toFixed(1);
}

/** Every occurrence of `template` whose scheduled time falls within [from, to]. */
function occurrencesInRange(template: EventTemplate, from: Date, to: Date): Date[] {
  const results: Date[] = [];
  const start = new Date(Math.floor(from.getTime() / MS_PER_DAY) * MS_PER_DAY - MS_PER_DAY);
  const totalDays = Math.ceil((to.getTime() - start.getTime()) / MS_PER_DAY) + 1;

  for (let i = 0; i <= totalDays; i++) {
    const day = new Date(start.getTime() + i * MS_PER_DAY);
    if (day.getUTCDay() !== template.weekday) continue;
    const scheduled = new Date(
      Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), template.hourUtc, template.minuteUtc),
    );
    if (scheduled.getTime() >= from.getTime() && scheduled.getTime() <= to.getTime()) {
      results.push(scheduled);
    }
  }
  return results;
}

function buildEvent(template: EventTemplate, scheduledTime: Date, now: Date): EconomicEvent {
  // Seed off the template + the event's own timestamp so values are stable for a given occurrence.
  const seed = scheduledTime.getTime() / MS_PER_DAY + template.id.length;

  const forecastNoise = (seededRand(seed) - 0.5) * (template.baseValue === 0 ? 0.1 : Math.abs(template.baseValue) * 0.15);
  const forecastValue = template.baseValue + forecastNoise;

  const previousNoise = (seededRand(seed + 1) - 0.5) * (template.baseValue === 0 ? 0.1 : Math.abs(template.baseValue) * 0.15);
  const previousValue = template.baseValue + previousNoise;

  const released = scheduledTime.getTime() <= now.getTime();
  let actual: string | null = null;
  if (released && template.category !== "CENTRAL_BANK_SPEECH") {
    const surprise = (seededRand(seed + 2) - 0.5) * (template.baseValue === 0 ? 0.2 : Math.abs(template.baseValue) * 0.3);
    actual = formatValue(forecastValue + surprise, template.unit);
  }

  return {
    id: `${template.id}-${scheduledTime.toISOString()}`,
    name: template.name,
    category: template.category,
    currency: template.currency,
    country: template.country,
    impact: template.impact,
    scheduledTime,
    forecast: template.category === "CENTRAL_BANK_SPEECH" ? null : formatValue(forecastValue, template.unit),
    previous: template.category === "CENTRAL_BANK_SPEECH" ? null : formatValue(previousValue, template.unit),
    actual,
  };
}

export class MockNewsProvider implements INewsProvider {
  async getEvents(params: NewsQueryParams): Promise<EconomicEvent[]> {
    const now = new Date();
    const currencyFilter = params.currencies ? new Set(params.currencies.map((c) => c.toUpperCase())) : null;

    const events: EconomicEvent[] = [];
    for (const template of TEMPLATES) {
      if (currencyFilter && !currencyFilter.has(template.currency)) continue;
      for (const scheduledTime of occurrencesInRange(template, params.from, params.to)) {
        events.push(buildEvent(template, scheduledTime, now));
      }
    }

    return events.sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime());
  }
}
