import { Candle } from "../types";

export interface LiquidityZone {
  price: number;
  type: "BUY_SIDE" | "SELL_SIDE";
  touched: number;
  strength: "WEAK" | "MEDIUM" | "STRONG";
  swept: boolean;
}

export class LiquidityDetector {
  static detect(candles: Candle[]): LiquidityZone[] {
    const zones: LiquidityZone[] = [];

    if (candles.length < 5) {
      return zones;
    }

    for (let i = 2; i < candles.length - 2; i++) {
      const current = candles[i];

      let highs = 0;
      let lows = 0;

      for (let j = i - 2; j <= i + 2; j++) {
        if (Math.abs(candles[j].high - current.high) < 0.0005) {
          highs++;
        }

        if (Math.abs(candles[j].low - current.low) < 0.0005) {
          lows++;
        }
      }

      if (highs >= 3) {
        const strength =
          highs >= 5
            ? "STRONG"
            : highs === 4
            ? "MEDIUM"
            : "WEAK";

        const swept = candles
          .slice(i + 1)
          .some((c) => c.high > current.high);

        zones.push({
          price: current.high,
          type: "BUY_SIDE",
          touched: highs,
          strength,
          swept,
        });
      }

      if (lows >= 3) {
        const strength =
          lows >= 5
            ? "STRONG"
            : lows === 4
            ? "MEDIUM"
            : "WEAK";

        const swept = candles
          .slice(i + 1)
          .some((c) => c.low < current.low);

        zones.push({
          price: current.low,
          type: "SELL_SIDE",
          touched: lows,
          strength,
          swept,
        });
      }
    }

    return zones;
  }
}