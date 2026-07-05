import { Candle } from "../types";

export interface LiquidityZone {

  price: number;

  type: "BUY_SIDE" | "SELL_SIDE";

  touched: number;

}

export class LiquidityDetector {

  static detect(candles: Candle[]): LiquidityZone[] {

    const zones: LiquidityZone[] = [];

    if (candles.length < 5)
      return zones;

    for (let i = 2; i < candles.length - 2; i++) {

      const current = candles[i];

      let highs = 0;

      let lows = 0;

      for (let j = i - 2; j <= i + 2; j++) {

        if (Math.abs(candles[j].high - current.high) < 0.0005)
          highs++;

        if (Math.abs(candles[j].low - current.low) < 0.0005)
          lows++;

      }

      if (highs >= 3) {

        zones.push({

          price: current.high,

          type: "BUY_SIDE",

          touched: highs,

        });

      }

      if (lows >= 3) {

        zones.push({

          price: current.low,

          type: "SELL_SIDE",

          touched: lows,

        });

      }

    }

    return zones;

  }

}