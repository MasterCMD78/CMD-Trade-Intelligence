import { Candle, SwingPoint } from "../types";

/**
 * Detect Swing Highs and Swing Lows
 */
export class SwingDetector {
  static detect(candles: Candle[]): {
    highs: SwingPoint[];
    lows: SwingPoint[];
  } {
    const highs: SwingPoint[] = [];
    const lows: SwingPoint[] = [];

    if (candles.length < 5) {
      return { highs, lows };
    }

    for (let i = 2; i < candles.length - 2; i++) {
      const current = candles[i];

      // Swing High
      if (
        current.high > candles[i - 1].high &&
        current.high > candles[i - 2].high &&
        current.high > candles[i + 1].high &&
        current.high > candles[i + 2].high
      ) {
        highs.push({
          index: i,
          price: current.high,
          time: current.time,
          type: "HIGH",
        });
      }

      // Swing Low
      if (
        current.low < candles[i - 1].low &&
        current.low < candles[i - 2].low &&
        current.low < candles[i + 1].low &&
        current.low < candles[i + 2].low
      ) {
        lows.push({
          index: i,
          price: current.low,
          time: current.time,
          type: "LOW",
        });
      }
    }

    return {
      highs,
      lows,
    };
  }
}