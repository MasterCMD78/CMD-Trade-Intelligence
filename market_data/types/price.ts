/**
 * MarketPrice model — current quote for a trading symbol.
 */

export interface MarketPrice {
  symbol: string;
  /** Best bid price */
  bid: number;
  /** Best ask price */
  ask: number;
  /** Mid-point ((bid + ask) / 2) */
  mid: number;
  /** Spread in pips/ticks (ask - bid) */
  spread: number;
  /** Absolute price change over the last 24 hours */
  change24h: number;
  /** Percentage price change over the last 24 hours */
  changePct24h: number;
  high24h: number;
  low24h: number;
  /** Volume over the last 24 hours (units depend on asset class) */
  volume24h: number;
  /** ISO 8601 timestamp of this quote */
  timestamp: Date;
  /** Name of the data provider */
  source: string;
}
