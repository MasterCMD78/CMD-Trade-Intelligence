import { Candle, SwingPoint } from "../types";

export interface BOSResult {
  hasBullishBOS: boolean;
  hasBearishBOS: boolean;
  brokenLevel: number | null;
  direction: "BULLISH" | "BEARISH" | "NONE";
}

export class BOSDetector {
  static detect(
    candles: Candle[],
    highs: SwingPoint[],
    lows: SwingPoint[]
  ): BOSResult {

    if (
      candles.length === 0 ||
      highs.length === 0 ||
      lows.length === 0
    ) {
      return {
        hasBullishBOS: false,
        hasBearishBOS: false,
        brokenLevel: null,
        direction: "NONE"
      };
    }

    const currentPrice = candles[candles.length - 1].close;

    const lastHigh = highs[highs.length - 1];
    const lastLow = lows[lows.length - 1];

    if (currentPrice > lastHigh.price) {
      return {
        hasBullishBOS: true,
        hasBearishBOS: false,
        brokenLevel: lastHigh.price,
        direction: "BULLISH"
      };
    }

    if (currentPrice < lastLow.price) {
      return {
        hasBullishBOS: false,
        hasBearishBOS: true,
        brokenLevel: lastLow.price,
        direction: "BEARISH"
      };
    }

    return {
      hasBullishBOS: false,
      hasBearishBOS: false,
      brokenLevel: null,
      direction: "NONE"
    };
  }
}