import { Candle } from "../types";
import { OrderBlockDetector } from "./OrderBlockDetector";
import { LiquidityDetector } from "./LiquidityDetector";
import { FairValueGapDetector } from "./FairValueGapDetector";

export interface SmartMoneyAnalysis {

  orderBlocks: ReturnType<typeof OrderBlockDetector.detect>;

  liquidity: ReturnType<typeof LiquidityDetector.detect>;

  fairValueGaps: ReturnType<typeof FairValueGapDetector.detect>;

}

export class SmartMoneyEngine {

  static analyze(candles: Candle[]): SmartMoneyAnalysis {

    return {

      orderBlocks: OrderBlockDetector.detect(candles),

      liquidity: LiquidityDetector.detect(candles),

      fairValueGaps: FairValueGapDetector.detect(candles),

    };

  }

}