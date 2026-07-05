/**
 * CMD Trade Intelligence
 * Market Structure Types
 */

export type TrendDirection =
  | "BULLISH"
  | "BEARISH"
  | "RANGING"
  | "TRANSITION";

export type MarketState =
  | "TRENDING"
  | "PULLBACK"
  | "CONSOLIDATION"
  | "REVERSAL";

export interface Candle {
  time: number;

  open: number;

  high: number;

  low: number;

  close: number;

  volume: number;
}

export interface SwingPoint {
  index: number;

  price: number;

  time: number;

  type: "HIGH" | "LOW";
}

export interface MarketStructureResult {
  trend: TrendDirection;

  marketState: MarketState;

  swingHighs: SwingPoint[];

  swingLows: SwingPoint[];

  higherHighs: number;

  higherLows: number;

  lowerHighs: number;

  lowerLows: number;

  breakOfStructure: boolean;

  changeOfCharacter: boolean;
}