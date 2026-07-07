/**
 * MockMarketDataProvider
 *
 * Returns realistic static data for all market data operations.
 * Swap this out for a real provider (Binance, OANDA, Polygon.io, etc.)
 * by implementing IMarketDataProvider and registering it in MarketDataService.
 *
 * Candle ordering: oldest → newest (index 0 = oldest candle, last index = current forming candle).
 * No real network calls are made. No AI signals or predictions are generated.
 *
 * Tick streaming:
 *   subscribeTicks() emits a live price tick on a per-symbol interval (500 ms for crypto,
 *   1 000 ms for forex).  Multiple handlers on the same symbol share a single interval —
 *   no timer buildup occurs regardless of how many WebSocket clients subscribe.
 *   All intervals are cleared on disconnect().
 */

import type { IMarketDataProvider, PriceTickHandler, CandleUpdateHandler } from "./provider.interface.js";
import type { MarketSymbol, MarketPrice, MarketCandle, AssetClass } from "./types.js";
import { Timeframe, TIMEFRAME_LABELS } from "./types.js";

// ─── Static symbol catalogue ──────────────────────────────────────────────────

const FOREX_SYMBOLS: MarketSymbol[] = [
  { symbol: "EURUSD",  baseCurrency: "EUR", quoteCurrency: "USD",  assetClass: "forex", displayName: "EUR/USD",  precision: 5, minSpread: 0.00010, tradingHours: "24/5", active: true },
  { symbol: "GBPUSD",  baseCurrency: "GBP", quoteCurrency: "USD",  assetClass: "forex", displayName: "GBP/USD",  precision: 5, minSpread: 0.00012, tradingHours: "24/5", active: true },
  { symbol: "USDJPY",  baseCurrency: "USD", quoteCurrency: "JPY",  assetClass: "forex", displayName: "USD/JPY",  precision: 3, minSpread: 0.010,   tradingHours: "24/5", active: true },
  { symbol: "USDCHF",  baseCurrency: "USD", quoteCurrency: "CHF",  assetClass: "forex", displayName: "USD/CHF",  precision: 5, minSpread: 0.00012, tradingHours: "24/5", active: true },
  { symbol: "AUDUSD",  baseCurrency: "AUD", quoteCurrency: "USD",  assetClass: "forex", displayName: "AUD/USD",  precision: 5, minSpread: 0.00012, tradingHours: "24/5", active: true },
  { symbol: "USDCAD",  baseCurrency: "USD", quoteCurrency: "CAD",  assetClass: "forex", displayName: "USD/CAD",  precision: 5, minSpread: 0.00015, tradingHours: "24/5", active: true },
  { symbol: "NZDUSD",  baseCurrency: "NZD", quoteCurrency: "USD",  assetClass: "forex", displayName: "NZD/USD",  precision: 5, minSpread: 0.00015, tradingHours: "24/5", active: true },
  { symbol: "EURGBP",  baseCurrency: "EUR", quoteCurrency: "GBP",  assetClass: "forex", displayName: "EUR/GBP",  precision: 5, minSpread: 0.00012, tradingHours: "24/5", active: true },
  { symbol: "EURJPY",  baseCurrency: "EUR", quoteCurrency: "JPY",  assetClass: "forex", displayName: "EUR/JPY",  precision: 3, minSpread: 0.012,   tradingHours: "24/5", active: true },
  { symbol: "GBPJPY",  baseCurrency: "GBP", quoteCurrency: "JPY",  assetClass: "forex", displayName: "GBP/JPY",  precision: 3, minSpread: 0.015,   tradingHours: "24/5", active: true },
];

const CRYPTO_SYMBOLS: MarketSymbol[] = [
  { symbol: "BTCUSDT",   baseCurrency: "BTC",   quoteCurrency: "USDT", assetClass: "crypto", displayName: "BTC/USDT",   precision: 2, minSpread: 0.50,  tradingHours: "24/7", active: true },
  { symbol: "ETHUSDT",   baseCurrency: "ETH",   quoteCurrency: "USDT", assetClass: "crypto", displayName: "ETH/USDT",   precision: 2, minSpread: 0.10,  tradingHours: "24/7", active: true },
  { symbol: "BNBUSDT",   baseCurrency: "BNB",   quoteCurrency: "USDT", assetClass: "crypto", displayName: "BNB/USDT",   precision: 2, minSpread: 0.05,  tradingHours: "24/7", active: true },
  { symbol: "SOLUSDT",   baseCurrency: "SOL",   quoteCurrency: "USDT", assetClass: "crypto", displayName: "SOL/USDT",   precision: 3, minSpread: 0.01,  tradingHours: "24/7", active: true },
  { symbol: "ADAUSDT",   baseCurrency: "ADA",   quoteCurrency: "USDT", assetClass: "crypto", displayName: "ADA/USDT",   precision: 4, minSpread: 0.001, tradingHours: "24/7", active: true },
  { symbol: "DOTUSDT",   baseCurrency: "DOT",   quoteCurrency: "USDT", assetClass: "crypto", displayName: "DOT/USDT",   precision: 3, minSpread: 0.005, tradingHours: "24/7", active: true },
  { symbol: "MATICUSDT", baseCurrency: "MATIC", quoteCurrency: "USDT", assetClass: "crypto", displayName: "MATIC/USDT", precision: 4, minSpread: 0.001, tradingHours: "24/7", active: true },
];

const ALL_SYMBOLS = [...FOREX_SYMBOLS, ...CRYPTO_SYMBOLS];

/** Fast lookup from symbol string → MarketSymbol */
const SYMBOL_MAP = new Map<string, MarketSymbol>(
  ALL_SYMBOLS.map((s) => [s.symbol, s])
);

// ─── Static mock quote data ───────────────────────────────────────────────────

interface MockQuoteBase {
  bid: number; ask: number; change24h: number; changePct24h: number;
  high24h: number; low24h: number; volume24h: number;
}

const MOCK_QUOTES: Record<string, MockQuoteBase> = {
  EURUSD:    { bid: 1.08342,   ask: 1.08352,   change24h:  0.00120,  changePct24h:  0.11,  high24h: 1.08490,   low24h: 1.08180,   volume24h: 142350   },
  GBPUSD:    { bid: 1.27215,   ask: 1.27228,   change24h: -0.00098,  changePct24h: -0.08,  high24h: 1.27450,   low24h: 1.27100,   volume24h: 98200    },
  USDJPY:    { bid: 149.872,   ask: 149.883,   change24h:  0.254,    changePct24h:  0.17,  high24h: 150.100,   low24h: 149.620,   volume24h: 230400   },
  USDCHF:    { bid: 0.88920,   ask: 0.88932,   change24h: -0.00045,  changePct24h: -0.05,  high24h: 0.89100,   low24h: 0.88850,   volume24h: 67800    },
  AUDUSD:    { bid: 0.64812,   ask: 0.64822,   change24h:  0.00210,  changePct24h:  0.32,  high24h: 0.65050,   low24h: 0.64600,   volume24h: 89100    },
  USDCAD:    { bid: 1.36245,   ask: 1.36260,   change24h: -0.00130,  changePct24h: -0.10,  high24h: 1.36420,   low24h: 1.36100,   volume24h: 76500    },
  NZDUSD:    { bid: 0.60124,   ask: 0.60136,   change24h:  0.00085,  changePct24h:  0.14,  high24h: 0.60350,   low24h: 0.59900,   volume24h: 41200    },
  EURGBP:    { bid: 0.85180,   ask: 0.85192,   change24h:  0.00052,  changePct24h:  0.06,  high24h: 0.85300,   low24h: 0.85050,   volume24h: 55600    },
  EURJPY:    { bid: 162.342,   ask: 162.358,   change24h:  0.318,    changePct24h:  0.20,  high24h: 162.650,   low24h: 162.010,   volume24h: 118900   },
  GBPJPY:    { bid: 190.718,   ask: 190.738,   change24h: -0.215,    changePct24h: -0.11,  high24h: 191.200,   low24h: 190.500,   volume24h: 87400    },
  BTCUSDT:   { bid: 67842.50,  ask: 67846.80,  change24h:  1248.50,  changePct24h:  1.87,  high24h: 68200.00,  low24h: 66500.00,  volume24h: 28450    },
  ETHUSDT:   { bid: 3521.40,   ask: 3521.90,   change24h: -48.60,    changePct24h: -1.36,  high24h: 3595.00,   low24h: 3480.00,   volume24h: 142300   },
  BNBUSDT:   { bid: 584.20,    ask: 584.50,    change24h:  12.80,    changePct24h:  2.24,  high24h: 590.00,    low24h: 568.00,    volume24h: 67800    },
  SOLUSDT:   { bid: 182.450,   ask: 182.490,   change24h:  5.230,    changePct24h:  2.95,  high24h: 185.000,   low24h: 176.500,   volume24h: 2180000  },
  ADAUSDT:   { bid: 0.4521,    ask: 0.4523,    change24h: -0.0082,   changePct24h: -1.78,  high24h: 0.4620,    low24h: 0.4460,    volume24h: 8950000  },
  DOTUSDT:   { bid: 7.842,     ask: 7.846,     change24h:  0.182,    changePct24h:  2.38,  high24h: 7.950,     low24h: 7.620,     volume24h: 3240000  },
  MATICUSDT: { bid: 0.8821,    ask: 0.8824,    change24h:  0.0248,   changePct24h:  2.89,  high24h: 0.8960,    low24h: 0.8540,    volume24h: 14200000 },
};

// ─── Candle generation helpers ────────────────────────────────────────────────

/** Timeframe duration in minutes. */
const TF_MINUTES: Record<Timeframe, number> = {
  [Timeframe.M1]: 1, [Timeframe.M5]: 5, [Timeframe.M15]: 15, [Timeframe.M30]: 30,
  [Timeframe.H1]: 60, [Timeframe.H4]: 240, [Timeframe.D1]: 1440, [Timeframe.W1]: 10080,
};

/** Volatility parameters per asset class (used for both candles and tick streaming). */
const VOLATILITY_BY_ASSET_CLASS: Record<AssetClass, number> = {
  forex:       0.0006,   // ~0.06% per minute — FX majors
  crypto:      0.005,    // ~0.5% per minute — crypto
  indices:     0.0008,
  commodities: 0.001,
};

/**
 * Per-tick volatility (fraction of mid price), tuned so that successive ticks
 * show realistic micro-movement without drifting far from the base price.
 * Forex:  ±0.008% per tick  (1 s interval)
 * Crypto: ±0.025% per tick  (0.5 s interval)
 */
const TICK_VOLATILITY: Record<AssetClass, number> = {
  forex:       0.000080,
  crypto:      0.000250,
  indices:     0.000100,
  commodities: 0.000120,
};

/** Deterministic pseudo-random value in [0, 1) from a seed. */
function seededRand(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

/**
 * Generate a deterministic series of OHLCV candles.
 * Ordering: oldest → newest (index 0 is the oldest candle, last index is the
 * current forming candle). This matches the convention used by Binance, OANDA,
 * and most charting libraries.
 *
 * OHLC validity is guaranteed: high >= max(open, close), low <= min(open, close).
 */
function generateCandles(
  symbol: string,
  assetClass: AssetClass,
  timeframe: Timeframe,
  count: number,
): MarketCandle[] {
  const quote = MOCK_QUOTES[symbol];
  if (!quote) return [];

  const mid = (quote.bid + quote.ask) / 2;
  const tfMinutes = TF_MINUTES[timeframe];
  const msPerCandle = tfMinutes * 60 * 1000;

  // Align to current candle boundary
  const now = Date.now();
  const latestOpen = Math.floor(now / msPerCandle) * msPerCandle;

  const baseVolatility = VOLATILITY_BY_ASSET_CLASS[assetClass];
  const tfMultiplier = Math.sqrt(tfMinutes); // volatility scales with √time

  const candles: MarketCandle[] = [];
  let price = mid;

  for (let i = count - 1; i >= 0; i--) {
    const candleOpenMs = latestOpen - i * msPerCandle;
    const seed = candleOpenMs / 1000 + symbol.charCodeAt(0);

    const open   = price;
    const move   = (seededRand(seed) - 0.49) * baseVolatility * tfMultiplier * open;
    const close  = open + move;

    // Guarantee high >= max(open, close) and low <= min(open, close)
    const bodyHigh = Math.max(open, close);
    const bodyLow  = Math.min(open, close);
    const wick     = Math.abs(move) * (0.5 + seededRand(seed + 1));
    const high     = bodyHigh + wick * seededRand(seed + 2);
    const low      = bodyLow  - wick * seededRand(seed + 3);

    // Volume scaled by timeframe and asset class
    const baseVolume = assetClass === "crypto" ? 500000 : 50000;
    const volume = (baseVolume + seededRand(seed + 4) * baseVolume * 4) * tfMultiplier;

    candles.push({
      symbol,
      timeframe,
      open:      +open.toFixed(8),
      high:      +high.toFixed(8),
      low:       +low.toFixed(8),
      close:     +close.toFixed(8),
      volume:    Math.round(volume),
      timestamp: new Date(candleOpenMs),
      closed:    i > 0, // only the last candle (i === 0) is still forming
    });

    price = close;
  }

  return candles;
}

// ─── Tick stream state ────────────────────────────────────────────────────────

interface TickStream {
  /** All handlers subscribed to this symbol. Shared single interval. */
  handlers: Set<PriceTickHandler>;
  /** The setInterval handle — cleared when the last handler unsubscribes. */
  interval: ReturnType<typeof setInterval>;
  /** Current mid price — mutated on each tick. */
  currentMid: number;
  /** Half-spread used to compute bid/ask from mid. */
  halfSpread: number;
  /** Decimal precision for display rounding. */
  precision: number;
  /** Static 24 h stats — unchanged during a session. */
  baseQuote: MockQuoteBase;
}

// ─── Provider implementation ──────────────────────────────────────────────────

export class MockMarketDataProvider implements IMarketDataProvider {
  readonly name = "MockProvider";
  readonly supportedAssetClasses = ["forex", "crypto"] as const;

  private _connected = false;

  /**
   * Active tick streaming intervals, keyed by symbol.
   * Multiple handlers on the same symbol share one interval (no timer buildup).
   */
  private _tickStreams = new Map<string, TickStream>();

  async connect(): Promise<void> {
    this._connected = true;
  }

  async disconnect(): Promise<void> {
    // Clear all active tick intervals to prevent timer buildup across reconnects.
    for (const stream of this._tickStreams.values()) {
      clearInterval(stream.interval);
    }
    this._tickStreams.clear();
    this._connected = false;
  }

  isConnected(): boolean {
    return this._connected;
  }

  async getSymbols(): Promise<MarketSymbol[]> {
    return ALL_SYMBOLS;
  }

  async getSymbol(symbol: string): Promise<MarketSymbol> {
    const s = SYMBOL_MAP.get(symbol.toUpperCase());
    if (!s) throw new Error(`Symbol not found: ${symbol}`);
    return s;
  }

  async getPrices(symbols: string[]): Promise<MarketPrice[]> {
    return Promise.all(symbols.map((s) => this.getPrice(s)));
  }

  async getPrice(symbol: string): Promise<MarketPrice> {
    const sym = symbol.toUpperCase();
    const q = MOCK_QUOTES[sym];
    if (!q) throw new Error(`Symbol not found: ${symbol}`);
    const mid = (q.bid + q.ask) / 2;

    // If a live tick stream is running, return the drifted current mid price
    // so that the REST snapshot is consistent with the WS feed.
    const stream = this._tickStreams.get(sym);
    const liveMid = stream ? stream.currentMid : mid;
    const halfSpread = stream ? stream.halfSpread : (q.ask - q.bid) / 2;
    const precision = SYMBOL_MAP.get(sym)?.precision ?? 5;

    const bid = liveMid - halfSpread;
    const ask = liveMid + halfSpread;

    return {
      symbol:       sym,
      bid:          +bid.toFixed(precision + 1),
      ask:          +ask.toFixed(precision + 1),
      mid:          +liveMid.toFixed(precision + 1),
      spread:       +(ask - bid).toFixed(precision + 2),
      change24h:    q.change24h,
      changePct24h: q.changePct24h,
      high24h:      q.high24h,
      low24h:       q.low24h,
      volume24h:    q.volume24h,
      timestamp:    new Date(),
      source:       this.name,
    };
  }

  async getCandles(symbol: string, timeframe: Timeframe, limit = 100): Promise<MarketCandle[]> {
    const sym = symbol.toUpperCase();
    const meta = SYMBOL_MAP.get(sym);
    if (!meta) throw new Error(`Symbol not found: ${symbol}`);
    return generateCandles(sym, meta.assetClass, timeframe, Math.min(limit, 500));
  }

  /**
   * Subscribe to live simulated price ticks for a symbol.
   *
   * All handlers for the same symbol share a single setInterval — subscribing
   * N times creates exactly one timer per symbol, not N timers.
   * Returns an unsubscribe function; when the last handler unsubscribes the
   * interval is cleared immediately (no lingering timers).
   */
  subscribeTicks(symbol: string, handler: PriceTickHandler): () => void {
    const sym = symbol.toUpperCase();
    const q = MOCK_QUOTES[sym];
    const meta = SYMBOL_MAP.get(sym);
    if (!q || !meta) return () => {};

    let stream = this._tickStreams.get(sym);

    if (!stream) {
      const mid = (q.bid + q.ask) / 2;
      const halfSpread = (q.ask - q.bid) / 2;
      const precision = meta.precision;
      const tickVol = TICK_VOLATILITY[meta.assetClass];
      // Crypto ticks are faster (more liquid, higher volatility perception)
      const intervalMs = meta.assetClass === "crypto" ? 500 : 1000;

      const newStream: TickStream = {
        handlers:   new Set(),
        interval:   null as unknown as ReturnType<typeof setInterval>,
        currentMid: mid,
        halfSpread,
        precision,
        baseQuote:  q,
      };

      newStream.interval = setInterval(() => {
        const s = this._tickStreams.get(sym);
        if (!s || s.handlers.size === 0) return;

        // Gaussian-approximated random walk: sum of two uniform draws ≈ normal.
        const noise = (Math.random() + Math.random() - 1.0) * tickVol * s.currentMid;
        s.currentMid += noise;

        const bid = s.currentMid - s.halfSpread;
        const ask = s.currentMid + s.halfSpread;

        const tick: MarketPrice = {
          symbol:       sym,
          bid:          +bid.toFixed(s.precision + 1),
          ask:          +ask.toFixed(s.precision + 1),
          mid:          +s.currentMid.toFixed(s.precision + 1),
          spread:       +(ask - bid).toFixed(s.precision + 2),
          change24h:    s.baseQuote.change24h,
          changePct24h: s.baseQuote.changePct24h,
          high24h:      s.baseQuote.high24h,
          low24h:       s.baseQuote.low24h,
          volume24h:    s.baseQuote.volume24h,
          timestamp:    new Date(),
          source:       "MockProvider",
        };

        for (const h of s.handlers) {
          try { h(tick); } catch { /* never let a bad handler kill the stream */ }
        }
      }, intervalMs);

      this._tickStreams.set(sym, newStream);
      stream = newStream;
    }

    stream.handlers.add(handler);

    return () => {
      const s = this._tickStreams.get(sym);
      if (!s) return;
      s.handlers.delete(handler);
      if (s.handlers.size === 0) {
        clearInterval(s.interval);
        this._tickStreams.delete(sym);
      }
    };
  }

  /** Candle streaming is not simulated in mock mode. */
  subscribeCandles(
    _symbol: string,
    _timeframe: Timeframe,
    _handler: CandleUpdateHandler,
  ): () => void {
    return () => {};
  }
}

export { Timeframe, TIMEFRAME_LABELS };
