/**
 * MarketDataProvider interface.
 *
 * Every market data source (Binance, OANDA, Polygon.io, etc.) must implement
 * this interface so the service layer can swap providers without touching
 * business logic.
 */

import type { MarketSymbol, MarketPrice, MarketCandle, Timeframe } from "./types.js";

// ─── Subscription callback ────────────────────────────────────────────────────

/** Called each time the provider emits a new price tick for a subscribed symbol. */
export type PriceTickHandler = (price: MarketPrice) => void;

/** Called each time a live candle update arrives for a subscribed symbol+timeframe. */
export type CandleUpdateHandler = (candle: MarketCandle) => void;

// ─── Provider options ─────────────────────────────────────────────────────────

export interface ProviderOptions {
  /** Maximum number of candles to return per request. Default: 500. */
  maxCandlesPerRequest?: number;
  /** Request timeout in milliseconds. Default: 10000. */
  timeoutMs?: number;
}

// ─── Interface ────────────────────────────────────────────────────────────────

export interface IMarketDataProvider {
  /** Human-readable name, e.g. "Binance", "OANDA", "MockProvider" */
  readonly name: string;

  /** Which asset classes this provider supports */
  readonly supportedAssetClasses: ReadonlyArray<"forex" | "crypto" | "indices" | "commodities">;

  /**
   * Initialise the provider (authenticate, open connections, etc.).
   * Must be called before any other method.
   */
  connect(): Promise<void>;

  /**
   * Cleanly shut down the provider (close connections, flush buffers, etc.).
   */
  disconnect(): Promise<void>;

  /** Whether the provider is currently connected and operational. */
  isConnected(): boolean;

  // ─── Catalogue ─────────────────────────────────────────────────────────────

  /**
   * Return the full list of symbols this provider supports.
   */
  getSymbols(): Promise<MarketSymbol[]>;

  /**
   * Return info about a single symbol.
   * Throws if the symbol is not supported.
   */
  getSymbol(symbol: string): Promise<MarketSymbol>;

  // ─── Prices ────────────────────────────────────────────────────────────────

  /**
   * Fetch the latest quote for one or more symbols.
   */
  getPrices(symbols: string[]): Promise<MarketPrice[]>;

  /**
   * Fetch the latest quote for a single symbol.
   * Throws if the symbol is not supported.
   */
  getPrice(symbol: string): Promise<MarketPrice>;

  // ─── Candles ───────────────────────────────────────────────────────────────

  /**
   * Fetch historical OHLCV candles.
   *
   * @param symbol   Trading pair, e.g. "EURUSD"
   * @param timeframe  Candle interval, e.g. Timeframe.H1
   * @param limit    Maximum number of candles to return (newest first)
   */
  getCandles(symbol: string, timeframe: Timeframe, limit?: number): Promise<MarketCandle[]>;

  // ─── Real-time subscriptions ───────────────────────────────────────────────

  /**
   * Subscribe to live price ticks for a symbol.
   * The handler is called each time a new tick arrives.
   * Returns an unsubscribe function.
   */
  subscribeTicks(symbol: string, handler: PriceTickHandler): () => void;

  /**
   * Subscribe to live candle updates for a symbol+timeframe combination.
   * The handler is called each time the current candle is updated.
   * Returns an unsubscribe function.
   */
  subscribeCandles(symbol: string, timeframe: Timeframe, handler: CandleUpdateHandler): () => void;
}
