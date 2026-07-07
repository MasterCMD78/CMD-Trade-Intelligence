/**
 * MarketDataService
 *
 * The single entry-point for all market data operations within the API server.
 * Wraps the active provider and exposes a clean, provider-agnostic API.
 *
 * To switch providers: call `setProvider(new BinanceProvider(...))` and reconnect.
 */

import type { IMarketDataProvider, PriceTickHandler } from "./provider.interface.js";
import type { MarketSymbol, MarketPrice, MarketCandle } from "./types.js";
import { Timeframe, TIMEFRAME_LABELS, ALL_TIMEFRAMES } from "./types.js";
import { MockMarketDataProvider } from "./mock.provider.js";

export interface TimeframeInfo {
  value: string;
  label: string;
}

class MarketDataService {
  private provider: IMarketDataProvider;

  constructor(provider: IMarketDataProvider) {
    this.provider = provider;
  }

  /** Replace the active provider. Disconnects the old one, connects the new one. */
  async setProvider(newProvider: IMarketDataProvider): Promise<void> {
    if (this.provider.isConnected()) {
      await this.provider.disconnect();
    }
    this.provider = newProvider;
    await this.provider.connect();
  }

  /** Current provider name — useful for health-check responses. */
  get providerName(): string {
    return this.provider.name;
  }

  get isConnected(): boolean {
    return this.provider.isConnected();
  }

  // ─── Catalogue ─────────────────────────────────────────────────────────────

  getTimeframes(): TimeframeInfo[] {
    return ALL_TIMEFRAMES.map((tf) => ({
      value: tf,
      label: TIMEFRAME_LABELS[tf],
    }));
  }

  async getSymbols(opts?: { assetClass?: string; active?: boolean }): Promise<MarketSymbol[]> {
    let symbols = await this.provider.getSymbols();
    if (opts?.assetClass) {
      symbols = symbols.filter((s) => s.assetClass === opts.assetClass);
    }
    if (opts?.active !== undefined) {
      symbols = symbols.filter((s) => s.active === opts.active);
    }
    return symbols;
  }

  async getSymbol(symbol: string): Promise<MarketSymbol> {
    return this.provider.getSymbol(symbol);
  }

  // ─── Quotes ────────────────────────────────────────────────────────────────

  async getPrice(symbol: string): Promise<MarketPrice> {
    return this.provider.getPrice(symbol);
  }

  async getPrices(symbols: string[]): Promise<MarketPrice[]> {
    return this.provider.getPrices(symbols);
  }

  // ─── Candles ───────────────────────────────────────────────────────────────

  async getCandles(symbol: string, timeframe: Timeframe, limit = 100): Promise<MarketCandle[]> {
    return this.provider.getCandles(symbol, timeframe, limit);
  }

  // ─── Real-time tick streaming ───────────────────────────────────────────────

  /**
   * Subscribe to live price ticks for a symbol.
   * Delegates directly to the active provider.
   * Returns an unsubscribe function — call it to stop the subscription.
   */
  subscribeTicks(symbol: string, handler: PriceTickHandler): () => void {
    return this.provider.subscribeTicks(symbol, handler);
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  async connect(): Promise<void> {
    await this.provider.connect();
  }

  async disconnect(): Promise<void> {
    await this.provider.disconnect();
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

const mockProvider = new MockMarketDataProvider();
export const marketDataService = new MarketDataService(mockProvider);

// Auto-connect on module load
marketDataService.connect().catch(() => {
  // Provider connection failures are non-fatal in mock mode
});

export { Timeframe };
