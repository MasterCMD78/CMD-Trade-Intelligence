import { Candle } from "./analysis/types";

export interface EntryResult {
  entry: number;
  stopLoss: number;
  takeProfit: number;
  riskReward: number;
}

export class EntryEngine {
  static analyze(candles: Candle[]): EntryResult {
    const last = candles[candles.length - 1];

    const range = last.high - last.low;

    const entry = last.close;

    const stopLoss = last.low - range * 0.25;

    const takeProfit = entry + (entry - stopLoss) * 2;

    const risk = entry - stopLoss;
    const reward = takeProfit - entry;

    return {
      entry,
      stopLoss,
      takeProfit,
      riskReward: reward / risk,
    };
  }
}