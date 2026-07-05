/**
 * Shared IMarketDataProvider interface for CMD Trade Intelligence.
 *
 * This is the canonical contract all market data adapters must implement,
 * regardless of language or platform. TypeScript version is authoritative;
 * Python equivalents should mirror this structure exactly.
 *
 * For the server-side TypeScript implementation see:
 *   artifacts/api-server/src/market-data/provider.interface.ts
 */

export type AssetClass = "forex" | "crypto" | "indices" | "commodities";
export type Timeframe  = "1M" | "5M" | "15M" | "30M" | "1H" | "4H" | "1D" | "1W";

export interface MarketSymbol {
  symbol: string;
  baseCurrency: string;
  quoteCurrency: string;
  assetClass: AssetClass;
  displayName: string;
  precision: number;
  tradingHours: string;
  active: boolean;
}

export interface MarketPrice {
  symbol: string;
  bid: number;
  ask: number;
  mid: number;
  spread: number;
  change24h: number;
  changePct24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  timestamp: Date;
  source: string;
}

export interface MarketCandle {
  symbol: string;
  timeframe: Timeframe;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: Date;
  closed: boolean;
}

export type PriceTickHandler   = (price: MarketPrice) => void;
export type CandleUpdateHandler = (candle: MarketCandle) => void;

export interface IMarketDataProvider {
  readonly name: string;
  readonly supportedAssetClasses: ReadonlyArray<AssetClass>;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  getSymbols(): Promise<MarketSymbol[]>;
  getSymbol(symbol: string): Promise<MarketSymbol>;

  getPrices(symbols: string[]): Promise<MarketPrice[]>;
  getPrice(symbol: string): Promise<MarketPrice>;

  getCandles(symbol: string, timeframe: Timeframe, limit?: number): Promise<MarketCandle[]>;

  subscribeTicks(symbol: string, handler: PriceTickHandler): () => void;
  subscribeCandles(symbol: string, timeframe: Timeframe, handler: CandleUpdateHandler): () => void;
}
