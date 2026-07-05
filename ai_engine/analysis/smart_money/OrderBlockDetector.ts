import { Candle } from "../types";
import { OrderBlock } from "./type";

export class OrderBlockDetector {

  static detect(candles: Candle[]): OrderBlock[] {

    const orderBlocks: OrderBlock[] = [];

    for (let i = 1; i < candles.length - 1; i++) {

      const previous = candles[i - 1];

      const current = candles[i];

      const next = candles[i + 1];

      // Bullish Order Block
      if (
        current.close < current.open &&
        next.close > current.high
      ) {

        orderBlocks.push({
          type: "BULLISH",
          high: current.high,
          low: current.low,
          index: i,
          strength: Math.abs(current.open - current.close),
          mitigated: false,
        });

      }

      // Bearish Order Block
      if (
        current.close > current.open &&
        next.close < current.low
      ) {

        orderBlocks.push({
          type: "BEARISH",
          high: current.high,
          low: current.low,
          index: i,
          strength: Math.abs(current.open - current.close),
          mitigated: false,
        });

      }

    }

    return orderBlocks;

  }

}