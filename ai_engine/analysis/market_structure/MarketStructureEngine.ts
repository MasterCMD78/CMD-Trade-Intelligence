import { Candle, MarketStructureResult } from "../types";
import { SwingDetector } from "./SwingDetector";
import { BOSDetector } from "./BOSDetector";
import { CHOCHDetector } from "./CHOCHDetector";

export class MarketStructureEngine {
  static analyze(candles: Candle[]): MarketStructureResult {

    const swings = SwingDetector.detect(candles);

    const bos = BOSDetector.detect(
      candles,
      swings.highs,
      swings.lows
    );

    const choch = CHOCHDetector.detect(
      candles,
      swings.highs,
      swings.lows
    );

    let trend: MarketStructureResult["trend"] = "RANGING";

    if (bos.hasBullishBOS) {
      trend = "BULLISH";
    } else if (bos.hasBearishBOS) {
      trend = "BEARISH";
    }

    return {
      trend,

      marketState: "TRENDING",

      swingHighs: swings.highs,

      swingLows: swings.lows,

      higherHighs: 0,

      higherLows: 0,

      lowerHighs: 0,

      lowerLows: 0,

      breakOfStructure:
        bos.hasBullishBOS || bos.hasBearishBOS,

      changeOfCharacter:
        choch.hasBullishCHOCH || choch.hasBearishCHOCH,
    };
  }
}