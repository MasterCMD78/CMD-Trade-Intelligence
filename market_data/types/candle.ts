/**
 * MarketCandle model — OHLCV bar for a given symbol and timeframe.
 */

import type { Timeframe } from "./timeframe.js";

export interface MarketCandle {
  symbol: string;
  timeframe: Timeframe;
  /** Candle open price */
  open: number;
  /** Candle high price */
  high: number;
  /** Candle low price */
  low: number;
  /** Candle close price */
  close: number;
  /** Volume traded during this candle */
  volume: number;
  /** Candle open timestamp (UTC) */
  timestamp: Date;
  /** True if the candle is complete; false if still forming */
  closed: boolean;
}
