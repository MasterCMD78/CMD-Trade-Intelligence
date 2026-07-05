import { Candle, SwingPoint } from "../types";

export interface CHOCHResult {
  hasBullishCHOCH: boolean;
  hasBearishCHOCH: boolean;
  brokenLevel: number | null;
  direction: "BULLISH" | "BEARISH" | "NONE";
}

export class CHOCHDetector {
  static detect(
    candles: Candle[],
    highs: SwingPoint[],
    lows: SwingPoint[]
  ): CHOCHResult {

    if (
      candles.length === 0 ||
      highs.length === 0 ||
      lows.length === 0
    ) {
      return {
        hasBullishCHOCH: false,
        hasBearishCHOCH: false,
        brokenLevel: null,
        direction: "NONE"
      };
    }

    const currentPrice = candles[candles.length - 1].close;

    const previousHigh = highs[highs.length - 1];
    const previousLow = lows[lows.length - 1];

    if (currentPrice > previousHigh.price) {
      return {
        hasBullishCHOCH: true,
        hasBearishCHOCH: false,
        brokenLevel: previousHigh.price,
        direction: "BULLISH"
      };
    }

    if (currentPrice < previousLow.price) {
      return {
        hasBullishCHOCH: false,
        hasBearishCHOCH: true,
        brokenLevel: previousLow.price,
        direction: "BEARISH"
      };
    }

    return {
      hasBullishCHOCH: false,
      hasBearishCHOCH: false,
      brokenLevel: null,
      direction: "NONE"
    };
  }
}