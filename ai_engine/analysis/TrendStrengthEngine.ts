import { Candle } from "./types";

export interface TrendStrengthResult {
  trend: "BULLISH" | "BEARISH" | "SIDEWAYS";
  strength: number;
  momentum: "WEAK" | "MEDIUM" | "STRONG";
}

export class TrendStrengthEngine {
  static analyze(candles: Candle[]): TrendStrengthResult {
    if (candles.length < 20) {
      return {
        trend: "SIDEWAYS",
        strength: 0,
        momentum: "WEAK",
      };
    }

    const first = candles[candles.length - 20].close;
    const last = candles[candles.length - 1].close;

    const change = ((last - first) / first) * 100;

    let trend: "BULLISH" | "BEARISH" | "SIDEWAYS";

    if (change > 1) {
      trend = "BULLISH";
    } else if (change < -1) {
      trend = "BEARISH";
    } else {
      trend = "SIDEWAYS";
    }

    const strength = Math.min(Math.abs(change) * 10, 100);

    let momentum: "WEAK" | "MEDIUM" | "STRONG";

    if (strength >= 70) {
      momentum = "STRONG";
    } else if (strength >= 40) {
      momentum = "MEDIUM";
    } else {
      momentum = "WEAK";
    }

    return {
      trend,
      strength,
      momentum,
    };
  }
}