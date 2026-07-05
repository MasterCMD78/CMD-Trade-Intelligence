/**
 * Core domain types for the Market Data layer.
 * These are the canonical in-process representations.
 * API response shapes are generated from the OpenAPI spec.
 */

// ─── Timeframe ────────────────────────────────────────────────────────────────

export enum Timeframe {
  M1  = "1M",
  M5  = "5M",
  M15 = "15M",
  M30 = "30M",
  H1  = "1H",
  H4  = "4H",
  D1  = "1D",
  W1  = "1W",
}

export const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  [Timeframe.M1]:  "1 Minute",
  [Timeframe.M5]:  "5 Minutes",
  [Timeframe.M15]: "15 Minutes",
  [Timeframe.M30]: "30 Minutes",
  [Timeframe.H1]:  "1 Hour",
  [Timeframe.H4]:  "4 Hours",
  [Timeframe.D1]:  "Daily",
  [Timeframe.W1]:  "Weekly",
};

export const ALL_TIMEFRAMES: Timeframe[] = Object.values(Timeframe);

// ─── Asset Class ──────────────────────────────────────────────────────────────

export type AssetClass = "forex" | "crypto" | "indices" | "commodities";

// ─── Symbol ───────────────────────────────────────────────────────────────────

export interface MarketSymbol {
  symbol: string;         // e.g. "EURUSD", "BTCUSDT"
  baseCurrency: string;   // e.g. "EUR", "BTC"
  quoteCurrency: string;  // e.g. "USD", "USDT"
  assetClass: AssetClass;
  displayName: string;    // e.g. "EUR/USD", "BTC/USDT"
  precision: number;      // decimal places for price display
  minSpread: number;      // minimum spread in pips/ticks
  tradingHours: string;   // e.g. "24/5", "24/7"
  active: boolean;
}

// ─── Price (current quote) ────────────────────────────────────────────────────

export interface MarketPrice {
  symbol: string;
  bid: number;
  ask: number;
  mid: number;
  spread: number;          // ask - bid
  change24h: number;       // absolute price change over 24h
  changePct24h: number;    // percentage change over 24h
  high24h: number;
  low24h: number;
  volume24h: number;
  timestamp: Date;
  source: string;          // provider name
}

// ─── Candle (OHLCV) ──────────────────────────────────────────────────────────

export interface MarketCandle {
  symbol: string;
  timeframe: Timeframe;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: Date;        // candle open time
  closed: boolean;        // false = current live candle still forming
}
