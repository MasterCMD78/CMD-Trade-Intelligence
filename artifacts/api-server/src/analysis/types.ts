/**
 * Analysis Engine — shared types.
 *
 * All indicator results, pattern results, and the top-level AnalysisResult
 * live here so every layer (indicators, scoring, risk, decision) imports
 * from one place.
 */

// ─── Primitives ───────────────────────────────────────────────────────────────

export type Signal = "buy" | "sell" | "neutral";
export type Decision = "BUY" | "SELL" | "HOLD";
export type RiskLevel = "low" | "medium" | "high";
export type TrendDirection = "bullish" | "bearish" | "sideways";

// ─── Indicator Results ─────────────────────────────────────────────────────────

export interface RsiResult {
  value: number;        // 0–100
  signal: Signal;
  overbought: boolean;  // value > 70
  oversold: boolean;    // value < 30
}

export interface MacdResult {
  macdLine: number;
  signalLine: number;
  histogram: number;
  /** Whether the MACD line just crossed the signal line in the last candle. */
  crossover: "bullish" | "bearish" | "none";
  signal: Signal;
}

export interface EmaResult {
  ema20: number;
  ema50: number;
  ema200: number;
  trend: TrendDirection;
  signal: Signal;
  priceAboveEma20: boolean;
  priceAboveEma50: boolean;
  priceAboveEma200: boolean;
}

export interface SmaResult {
  sma20: number;
  sma50: number;
}

export interface BollingerResult {
  upper: number;
  middle: number;
  lower: number;
  /** 0 = at lower band, 0.5 = at middle, 1 = at upper band. */
  pctB: number;
  /** (upper − lower) / middle */
  width: number;
  signal: Signal;
}

export interface AtrResult {
  value: number;
  /** ATR as a fraction of current price (e.g. 0.008 = 0.8%). */
  pctOfPrice: number;
  volatility: "low" | "medium" | "high";
}

export interface AdxResult {
  adx: number;
  plusDI: number;
  minusDI: number;
  /** ADX > 25 indicates a meaningful trend. */
  trending: boolean;
  signal: Signal;
}

export interface StochasticRsiResult {
  k: number;          // 0–100
  d: number;          // 0–100 (signal line)
  signal: Signal;
  overbought: boolean; // k > 80
  oversold: boolean;   // k < 20
}

export interface VolumeResult {
  current: number;
  average: number;
  ratio: number;       // current / average
  spike: boolean;      // ratio > 2.0
  trend: "above_average" | "average" | "below_average";
  signal: Signal;
}

export interface TrendResult {
  shortTerm: TrendDirection;   // last 10 candles
  mediumTerm: TrendDirection;  // last 20 candles
  longTerm: TrendDirection;    // last 50 candles
  overall: TrendDirection;
  signal: Signal;
}

export interface SupportResistanceResult {
  /** Descending list of support levels below current price. */
  supports: number[];
  /** Ascending list of resistance levels above current price. */
  resistances: number[];
  nearestSupport: number | null;
  nearestResistance: number | null;
}

// ─── Pattern Results ───────────────────────────────────────────────────────────

export interface CandlestickPattern {
  name: string;
  type: "bullish" | "bearish" | "neutral";
  /** 0–1 where 1 = highest strength / confidence in pattern identification. */
  strength: number;
  description: string;
}

// ─── Full Indicator Bundle ─────────────────────────────────────────────────────

export interface IndicatorSet {
  rsi: RsiResult;
  macd: MacdResult;
  ema: EmaResult;
  sma: SmaResult;
  bollingerBands: BollingerResult;
  atr: AtrResult;
  adx: AdxResult;
  stochasticRsi: StochasticRsiResult;
  volume: VolumeResult;
  trend: TrendResult;
  supportResistance: SupportResistanceResult;
}

// ─── Final Analysis Result ────────────────────────────────────────────────────

export interface AnalysisResult {
  symbol: string;
  timeframe: string;
  timestamp: string;       // ISO-8601
  candleCount: number;
  decision: Decision;
  confidence: number;      // 0–100
  riskLevel: RiskLevel;
  trend: TrendDirection;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskRewardRatio: number;
  indicators: IndicatorSet;
  patterns: CandlestickPattern[];
  reasons: string[];
}
