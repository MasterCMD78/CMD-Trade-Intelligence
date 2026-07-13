/**
 * Economic News & Fundamental Intelligence Engine — shared types (Phase 5).
 *
 * The News Engine is a self-contained module that reads a raw economic
 * calendar (from any `INewsProvider`) and produces one explainable
 * fundamental read for a symbol: what event matters right now, how risky
 * the surrounding window is, what bias the released data implies, and
 * whether trading should be restricted.
 *
 * No detection/trading logic lives outside this module — the Institutional
 * Decision Engine only *consumes* `NewsAnalysisResult`, it never re-derives
 * calendar data itself.
 */

// ─── Event taxonomy ───────────────────────────────────────────────────────────

/** Market-moving significance of an economic release. */
export type EventImpact = "high" | "medium" | "low";

/**
 * Recognized economic event categories. `OTHER` is the escape hatch for any
 * provider-supplied event that doesn't map onto a known category — it is
 * still fully modeled (never dropped), just without category-specific bias
 * directionality.
 */
export type EventCategory =
  | "CPI"
  | "CORE_CPI"
  | "NFP"
  | "FOMC"
  | "INTEREST_RATE"
  | "GDP"
  | "RETAIL_SALES"
  | "UNEMPLOYMENT"
  | "PMI"
  | "PPI"
  | "CENTRAL_BANK_SPEECH"
  | "OTHER";

/**
 * A single scheduled economic calendar event.
 * `forecast`/`previous`/`actual` are kept as provider-formatted strings
 * (e.g. "3.2%", "180K") since real providers report mixed units; the News
 * Engine parses them internally when it needs a numeric surprise.
 * `actual` is `null` until the event has been released.
 */
export interface EconomicEvent {
  id: string;
  name: string;
  category: EventCategory;
  /** ISO currency code, e.g. "USD". */
  currency: string;
  country: string;
  impact: EventImpact;
  /** Release time (UTC). */
  scheduledTime: Date;
  forecast: string | null;
  previous: string | null;
  /** Null until the event has actually been released. */
  actual: string | null;
}

// ─── Fundamental read ──────────────────────────────────────────────────────────

/**
 * Directional read on a currency (or symbol) implied by recently released
 * economic data. `unknown` means no released data was available to judge —
 * distinct from `neutral`, which means data was available but balanced.
 */
export type FundamentalBias = "bullish" | "bearish" | "neutral" | "unknown";

/** Expected volatility around the current news window. */
export type NewsRisk = "low" | "medium" | "high" | "extreme";

/**
 * How the News Engine recommends treating new trade entries right now.
 *   SAFE          — no material calendar risk nearby.
 *   CAUTION       — a lower-impact or more distant event is in play; trade smaller.
 *   NO_TRADE      — a high-impact event is close enough that entries aren't advisable.
 *   LOCK_TRADING  — a high-impact event is imminent (or a rate-decision-class event
 *                   is in its danger window) — do not open new risk at all.
 */
export type TradingRestriction = "SAFE" | "CAUTION" | "NO_TRADE" | "LOCK_TRADING";

/** Plain-language trading recommendation derived from `TradingRestriction`. */
export type NewsRecommendation = "PROCEED" | "CAUTION" | "WAIT" | "AVOID";

/** Time-proximity snapshot relative to the currently relevant event. */
export interface NewsWindow {
  /** Minutes until the relevant event; negative if already released. Null if no event is in play. */
  minutesUntil: number | null;
  /** Same as `minutesUntil`, in hours. */
  hoursUntil: number | null;
  /** True when inside the configured warning window before/after the event. */
  isWarning: boolean;
  /** True when trading is fully locked (`tradingRestriction === "LOCK_TRADING"`). */
  isLocked: boolean;
}

// ─── Full result ──────────────────────────────────────────────────────────────

/**
 * Complete fundamental/news read for one symbol at one point in time.
 * Attached to `AnalysisResult.news` and consumed by the Institutional
 * Decision Engine.
 */
export interface NewsAnalysisResult {
  symbol: string;
  /** The single most urgent relevant event right now; null if none is in play. */
  currentEvent: EconomicEvent | null;
  /** The next upcoming relevant event after `currentEvent` (or overall, if none is current). */
  nextEvent: EconomicEvent | null;
  minutesRemaining: number | null;
  hoursRemaining: number | null;
  /** Impact of `currentEvent`; null when there is no current event. */
  severity: EventImpact | null;
  fundamentalBias: FundamentalBias;
  /** 0-100 confidence in this news read (impact, proximity, relevance, reliability, multiplicity). */
  newsConfidence: number;
  riskLevel: NewsRisk;
  tradingRestriction: TradingRestriction;
  recommendation: NewsRecommendation;
  /** Currencies this symbol is fundamentally exposed to, e.g. ["EUR", "USD"]. */
  affectedCurrencies: string[];
  window: NewsWindow;
  /** All relevant events currently inside the configured warning window, most urgent first. */
  activeEvents: EconomicEvent[];
}
