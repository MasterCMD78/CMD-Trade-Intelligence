import { Candle, SwingPoint, TrendDirection } from "../types";

export interface MarketStructureResult {
  trend: TrendDirection;

  higherHighs: number;

  higherLows: number;

  lowerHighs: number;

  lowerLows: number;

  bullishScore: number;

  bearishScore: number;
}

export class MarketStructureAnalyzer {
  static analyze(
    highs: SwingPoint[],
    lows: SwingPoint[]
  ): MarketStructureResult {

    let higherHighs = 0;
    let higherLows = 0;

    let lowerHighs = 0;
    let lowerLows = 0;

    for (let i = 1; i < highs.length; i++) {

      if (highs[i].price > highs[i - 1].price)
        higherHighs++;

      else
        lowerHighs++;

    }

    for (let i = 1; i < lows.length; i++) {

      if (lows[i].price > lows[i - 1].price)
        higherLows++;

      else
        lowerLows++;

    }

    const bullishScore = higherHighs + higherLows;

    const bearishScore = lowerHighs + lowerLows;

    let trend: TrendDirection = "RANGING";

    if (bullishScore > bearishScore)
      trend = "BULLISH";

    if (bearishScore > bullishScore)
      trend = "BEARISH";

    return {

      trend,

      higherHighs,

      higherLows,

      lowerHighs,

      lowerLows,

      bullishScore,

      bearishScore,

    };

  }
}