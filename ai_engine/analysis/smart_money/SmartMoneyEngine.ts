import { Candle } from "../types";

import {
  LiquidityDetector,
  LiquidityZone,
} from "./LiquidityDetector";

import { OrderBlockDetector } from "./OrderBlockDetector";
import { OrderBlock } from "./type";

import {
  FairValueGapDetector,
  FairValueGap,
} from "./FairValueGapDetector";
export interface SmartMoneyAnalysis {
  orderBlocks: OrderBlock[];
  liquidity: LiquidityZone[];
  fairValueGaps: FairValueGap[];

  score: number;

  bias: "BULLISH" | "BEARISH" | "NEUTRAL";

  summary: string[];
}

export class SmartMoneyEngine {
  static analyze(candles: Candle[]): SmartMoneyAnalysis {
    const orderBlocks =
      OrderBlockDetector.detect(candles);

    const liquidity =
      LiquidityDetector.detect(candles);

    const fairValueGaps =
      FairValueGapDetector.detect(candles);

    let score = 0;

    const summary: string[] = [];

    // Order Blocks
    if (orderBlocks.length > 0) {
      score += 30;
      summary.push(
        `${orderBlocks.length} Order Block(s) detected`
      );
    }

    // Liquidity
    const strongLiquidity =
      liquidity.filter(
        (l) =>
          l.strength === "STRONG" &&
          !l.swept
      );

    if (strongLiquidity.length > 0) {
      score += 40;
      summary.push(
        `${strongLiquidity.length} Strong Liquidity Zone(s)`
      );
    }

    // Fair Value Gaps
    if (fairValueGaps.length > 0) {
      score += 30;
      summary.push(
        `${fairValueGaps.length} Fair Value Gap(s)`
      );
    }

    if (score > 100) {
      score = 100;
    }

    let bias:
      | "BULLISH"
      | "BEARISH"
      | "NEUTRAL";

    const buySide =
      liquidity.filter(
        (l) =>
          l.type === "BUY_SIDE" &&
          !l.swept
      ).length;

    const sellSide =
      liquidity.filter(
        (l) =>
          l.type === "SELL_SIDE" &&
          !l.swept
      ).length;

    if (buySide > sellSide) {
      bias = "BULLISH";
    } else if (sellSide > buySide) {
      bias = "BEARISH";
    } else {
      bias = "NEUTRAL";
    }

    return {
      orderBlocks,
      liquidity,
      fairValueGaps,
      score,
      bias,
      summary,
    };
  }
}