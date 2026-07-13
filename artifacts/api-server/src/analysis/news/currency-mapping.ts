/**
 * Currency Mapping (Phase 5, Part 3).
 *
 * Pure, data-driven mapping between a currency and the symbols its economic
 * releases move, and the reverse — which currencies a given symbol is
 * fundamentally exposed to. Extensible to any new fiat currency by adding it
 * to `KNOWN_FIAT_CURRENCIES` (+ its pair convention, if it needs one).
 */

/** All fiat currencies the News Engine currently understands. */
export const KNOWN_FIAT_CURRENCIES = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD"] as const;
export type SupportedCurrency = (typeof KNOWN_FIAT_CURRENCIES)[number];

/** Conventional major-pair ordering: these currencies are quoted *against* USD (e.g. EURUSD). */
const USD_QUOTE_CURRENCIES: SupportedCurrency[] = ["EUR", "GBP", "AUD", "NZD"];
/** These currencies are quoted *as* the counter of USD (e.g. USDJPY). */
const USD_BASE_CURRENCIES: SupportedCurrency[] = ["JPY", "CAD", "CHF"];

/** USD news moves metals with damped/inverse-flavoured sensitivity vs. a direct FX pair. */
const METAL_RELEVANCE_WEIGHT = 0.7;
/** Crypto correlates weakly with fiat macro releases — included, but heavily damped. */
const CRYPTO_RELEVANCE_WEIGHT = 0.3;

export interface CurrencyRelevance {
  currency: string;
  /** 0-1 — how strongly this symbol reacts to this currency's news, used by the confidence engine. */
  weight: number;
}

function isFiat(code: string): code is SupportedCurrency {
  return (KNOWN_FIAT_CURRENCIES as readonly string[]).includes(code);
}

/**
 * Which currencies a symbol is fundamentally exposed to, in [base, quote]
 * order when both legs are known fiat currencies. Forward-compatible with
 * metals (XAU/XAG, USD-damped) and USD-quoted crypto (heavily damped).
 */
export function getRelevantCurrencies(symbol: string): CurrencyRelevance[] {
  const s = symbol.toUpperCase();

  if (s.startsWith("XAU") || s.startsWith("XAG")) {
    const quote = s.slice(3);
    return isFiat(quote) ? [{ currency: quote, weight: METAL_RELEVANCE_WEIGHT }] : [];
  }

  for (const base of KNOWN_FIAT_CURRENCIES) {
    if (!s.startsWith(base)) continue;
    const rest = s.slice(base.length);
    const quote = KNOWN_FIAT_CURRENCIES.find((c) => rest.startsWith(c));
    if (!quote) continue;
    if (quote === base) return [{ currency: base, weight: 1 }];
    return [
      { currency: base, weight: 1 },
      { currency: quote, weight: 1 },
    ];
  }

  // Crypto quoted in dollars (e.g. BTCUSDT, BTCUSD) — no direct base-currency exposure.
  if (s.endsWith("USDT") || s.endsWith("USD")) {
    return [{ currency: "USD", weight: CRYPTO_RELEVANCE_WEIGHT }];
  }

  return [];
}

/** Reverse lookup — the symbols a currency's news typically moves. Used for documentation/UI. */
export function getAffectedSymbols(currency: string): string[] {
  const c = currency.toUpperCase();
  if (c === "USD") {
    return [
      ...USD_QUOTE_CURRENCIES.map((x) => `${x}USD`),
      ...USD_BASE_CURRENCIES.map((x) => `USD${x}`),
      "XAUUSD",
      "XAGUSD",
      "BTCUSDT",
    ];
  }
  if (!isFiat(c)) return [];
  if (USD_QUOTE_CURRENCIES.includes(c)) return [`${c}USD`];
  if (USD_BASE_CURRENCIES.includes(c)) return [`USD${c}`];
  return [];
}
