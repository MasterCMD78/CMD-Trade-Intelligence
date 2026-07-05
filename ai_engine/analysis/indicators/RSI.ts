import { Candle } from "../types";

export class RSI {

  static calculate(
    candles: Candle[],
    period = 14
  ): number {

    if (candles.length <= period) {

      return 50;

    }

    let gains = 0;

    let losses = 0;

    for (
      let i = candles.length - period;
      i < candles.length;
      i++
    ) {

      const diff =
        candles[i].close -
        candles[i - 1].close;

      if (diff > 0) {

        gains += diff;

      } else {

        losses += Math.abs(diff);

      }

    }

    if (losses === 0) {

      return 100;

    }

    const rs =
      gains / losses;

    return 100 -
      100 /
      (1 + rs);

  }

}