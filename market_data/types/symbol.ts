/**
 * MarketSymbol model for CMD Trade Intelligence.
 */

export type AssetClass = "forex" | "crypto" | "indices" | "commodities";

export interface MarketSymbol {
  /** Trading pair identifier, e.g. "EURUSD", "BTCUSDT" */
  symbol: string;
  /** Base currency or asset, e.g. "EUR", "BTC" */
  baseCurrency: string;
  /** Quote currency, e.g. "USD", "USDT" */
  quoteCurrency: string;
  /** Asset classification */
  assetClass: AssetClass;
  /** Human-readable display name, e.g. "EUR/USD" */
  displayName: string;
  /** Number of decimal places for price display */
  precision: number;
  /** Minimum typical spread */
  minSpread: number;
  /** Trading hours string, e.g. "24/5", "24/7" */
  tradingHours: string;
  /** Whether the symbol is currently tradeable */
  active: boolean;
}
