/**
 * News Engine configuration (Phase 5, Part 12).
 *
 * Every threshold the News Engine uses is centralised here so behaviour can
 * be tuned (or overridden per-call) without touching the pure computation
 * modules. `DEFAULT_NEWS_CONFIG` is the production default; tests may pass a
 * partial override via `withNewsConfig`.
 */

export interface RiskThresholds {
  /** Raw 0-100 volatility score at/above which risk is classified "extreme". */
  extreme: number;
  /** Raw 0-100 volatility score at/above which risk is classified "high". */
  high: number;
  /** Raw 0-100 volatility score at/above which risk is classified "medium". */
  medium: number;
}

export interface ConfidencePenalties {
  high: number;
  medium: number;
  low: number;
}

export interface NewsEngineConfig {
  /** Minutes before/after an event during which trading is at least CAUTION/NO_TRADE. */
  warningWindowMinutes: number;
  /** Minutes before/after a high-impact event during which trading is fully LOCKED. */
  lockWindowMinutes: number;
  /** Minutes after release still treated as "just happened" for restriction/window purposes. */
  postEventCooldownMinutes: number;
  /**
   * Minutes-to-event at/under which the Decision Engine forces a hard WAIT
   * override even for non-rate-decision high-impact events.
   */
  hardLockMinutes: number;
  /** How far back to look for released data when deriving fundamental bias. */
  biasLookbackHours: number;
  /** How far ahead the provider is queried for upcoming events. */
  lookaheadHours: number;
  /** Per-impact-tier institutional-score penalty weight (0-100 scale), see decision-engine/news-adjustment.ts. */
  confidencePenalties: ConfidencePenalties;
  riskThresholds: RiskThresholds;
  supportedCurrencies: string[];
  timezone: string;
}

export const DEFAULT_NEWS_CONFIG: NewsEngineConfig = {
  warningWindowMinutes: 60,
  lockWindowMinutes: 15,
  postEventCooldownMinutes: 15,
  hardLockMinutes: 5,
  biasLookbackHours: 48,
  lookaheadHours: 72,
  confidencePenalties: { high: 25, medium: 12, low: 5 },
  riskThresholds: { extreme: 80, high: 55, medium: 30 },
  supportedCurrencies: ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD"],
  timezone: "UTC",
};

/** Shallow-merge a partial override onto the default config — used by tests. */
export function withNewsConfig(overrides: Partial<NewsEngineConfig>): NewsEngineConfig {
  return { ...DEFAULT_NEWS_CONFIG, ...overrides };
}
