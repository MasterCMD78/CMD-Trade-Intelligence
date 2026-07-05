import { Candle } from "../types";

export interface FairValueGap {

  type: "BULLISH" | "BEARISH";

  top: number;

  bottom: number;

  index: number;

  filled: boolean;

}

export class FairValueGapDetector {

  static detect(candles: Candle[]): FairValueGap[] {

    const gaps: FairValueGap[] = [];

    if (candles.length < 3)
      return gaps;

    for (let i = 1; i < candles.length - 1; i++) {

      const previous = candles[i - 1];

      const next = candles[i + 1];

      // Bullish FVG
      if (previous.high < next.low) {

        gaps.push({

          type: "BULLISH",

          top: next.low,

          bottom: previous.high,

          index: i,

          filled: false,

        });

      }

      // Bearish FVG
      if (previous.low > next.high) {

        gaps.push({

          type: "BEARISH",

          top: previous.low,

          bottom: next.high,

          index: i,

          filled: false,

        });

      }

    }

    return gaps;

  }

}