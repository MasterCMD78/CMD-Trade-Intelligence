import { Candle } from "../types";

export class EMA {

  static calculate(
    candles: Candle[],
    period: number
  ): number {

    if (candles.length < period) {

      return candles[candles.length - 1]?.close ?? 0;

    }

    const multiplier = 2 / (period + 1);

    let ema = candles[0].close;

    for (let i = 1; i < candles.length; i++) {

      ema =
        (candles[i].close - ema) *
          multiplier +
        ema;

    }

    return ema;

  }

}