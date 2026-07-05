import { Candle } from "../types";

import { EMA } from "./EMA";
import { RSI } from "./RSI";

export interface IndicatorResult {

  ema20: number;

  ema50: number;

  ema200: number;

  rsi: number;

}

export class IndicatorEngine {

  static analyze(
    candles: Candle[]
  ): IndicatorResult {

    return {

      ema20:
        EMA.calculate(candles, 20),

      ema50:
        EMA.calculate(candles, 50),

      ema200:
        EMA.calculate(candles, 200),

      rsi:
        RSI.calculate(candles),

    };

  }

}