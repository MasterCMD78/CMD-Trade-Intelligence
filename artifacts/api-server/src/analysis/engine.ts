/**
 * Analysis Engine — main orchestrator.
 *
 * Sequence:
 *   1. Fetch 200 candles (enough for EMA-200 + warmup).
 *   2. Fetch current price.
 *   3. Compute all indicators in parallel (pure functions, no I/O).
 *   4. Detect candlestick patterns.
 *   5. Score all signals → composite score.
 *   6. Derive decision, confidence, risk level, trend.
 *   7. Compute entry / SL / TP / R:R.
 *   8. Generate human-readable reasons.
 *   9. Return AnalysisResult.
 *
 * To add a new indicator:
 *   1. Create it in src/analysis/indicators/<name>.ts.
 *   2. Import and call it in computeIndicators() below.
 *   3. Add its result to IndicatorSet (types.ts).
 *   4. Add a scorer in scoring.ts.
 */

import type { MarketCandle } from "../market-data/types.js";
import { Timeframe }         from "../market-data/types.js";
import type { AnalysisResult, IndicatorSet, CandlestickPattern, MarketStructureSummary, TrendDirection } from "./types.js";
import { analyzeMarketStructure } from "./market-structure/engine.js";
import type { MarketStructureResult } from "./market-structure/types.js";
import { computeRsi }              from "./indicators/rsi.js";
import { computeEma }              from "./indicators/ema.js";
import { computeSma }              from "./indicators/sma.js";
import { computeMacd }             from "./indicators/macd.js";
import { computeBollinger }        from "./indicators/bollinger.js";
import { computeAtr }              from "./indicators/atr.js";
import { computeAdx }              from "./indicators/adx.js";
import { computeStochasticRsi }    from "./indicators/stochastic-rsi.js";
import { computeVolume }           from "./indicators/volume.js";
import { computeTrend }            from "./indicators/trend.js";
import { computeSupportResistance } from "./indicators/support-resistance.js";
import { detectCandlestickPatterns } from "./patterns/candlestick.js";
import {
  computeCompositeScore,
  scoreToDecision,
  scoreToConfidence,
  computeRiskLevel,
  deriveTrend,
} from "./scoring.js";
import { computeRisk } from "./risk.js";

// ─── Candle close-price extraction ───────────────────────────────────────────

function closes(candles: MarketCandle[]): number[] {
  return candles.map((c) => c.close);
}

// ─── Indicator computation ────────────────────────────────────────────────────

function computeIndicators(candles: MarketCandle[], currentPrice: number): IndicatorSet {
  const cl = closes(candles);
  return {
    rsi:               computeRsi(cl),
    macd:              computeMacd(cl),
    ema:               computeEma(cl, currentPrice),
    sma:               computeSma(cl),
    bollingerBands:    computeBollinger(cl),
    atr:               computeAtr(candles),
    adx:               computeAdx(candles),
    stochasticRsi:     computeStochasticRsi(cl),
    volume:            computeVolume(candles),
    trend:             computeTrend(candles),
    supportResistance: computeSupportResistance(candles),
  };
}

// ─── Reason generation ────────────────────────────────────────────────────────

function generateReasons(
  indicators: IndicatorSet,
  patterns: CandlestickPattern[],
  score: number,
): string[] {
  const reasons: string[] = [];

  // RSI
  const { rsi } = indicators;
  if (rsi.oversold)   reasons.push(`RSI at ${rsi.value} — deeply oversold, mean-reversion setup likely.`);
  else if (rsi.value < 40) reasons.push(`RSI at ${rsi.value} — approaching oversold, bullish momentum building.`);
  else if (rsi.overbought) reasons.push(`RSI at ${rsi.value} — overbought territory, pullback risk elevated.`);
  else if (rsi.value > 60) reasons.push(`RSI at ${rsi.value} — momentum strong but approaching overbought zone.`);
  else reasons.push(`RSI at ${rsi.value} — neutral momentum, no extreme reading.`);

  // MACD
  const { macd } = indicators;
  if (macd.crossover === "bullish") reasons.push("MACD bullish crossover confirmed — MACD line crossed above signal line.");
  else if (macd.crossover === "bearish") reasons.push("MACD bearish crossover confirmed — MACD line crossed below signal line.");
  else if (macd.histogram > 0) reasons.push(`MACD histogram positive at ${macd.histogram.toFixed(6)} — bullish momentum intact.`);
  else reasons.push(`MACD histogram negative at ${macd.histogram.toFixed(6)} — bearish pressure persists.`);

  // EMA stack
  const { ema } = indicators;
  if (ema.trend === "bullish") reasons.push("EMA stack bullish (20 > 50 > 200, price above all) — strong uptrend alignment.");
  else if (ema.trend === "bearish") reasons.push("EMA stack bearish (20 < 50 < 200, price below all) — strong downtrend alignment.");
  else {
    const aboveCount = [ema.priceAboveEma20, ema.priceAboveEma50, ema.priceAboveEma200].filter(Boolean).length;
    reasons.push(`Price above ${aboveCount}/3 EMAs (20/50/200) — mixed trend, no clear bias.`);
  }

  // Bollinger
  const { bollingerBands: bb } = indicators;
  if (bb.pctB < 0.15) reasons.push(`Price near lower Bollinger Band (%B = ${(bb.pctB * 100).toFixed(0)}%) — oversold relative to recent range.`);
  else if (bb.pctB > 0.85) reasons.push(`Price near upper Bollinger Band (%B = ${(bb.pctB * 100).toFixed(0)}%) — overbought relative to recent range.`);
  else reasons.push(`Bollinger %B at ${(bb.pctB * 100).toFixed(0)}% — price within normal band range.`);

  // ADX
  const { adx } = indicators;
  if (adx.trending) {
    const dir = adx.plusDI > adx.minusDI ? "bullish" : "bearish";
    reasons.push(`ADX at ${adx.adx} — strong ${dir} trend in force (+DI ${adx.plusDI} vs −DI ${adx.minusDI}).`);
  } else {
    reasons.push(`ADX at ${adx.adx} — below 25, market is ranging. Trend signals carry lower weight.`);
  }

  // Volume
  const { volume } = indicators;
  if (volume.spike) reasons.push(`Volume spike: ${volume.ratio.toFixed(1)}× average — significant interest at this level.`);
  else if (volume.trend === "above_average") reasons.push(`Volume ${volume.ratio.toFixed(1)}× average — above-average participation confirms move.`);
  else if (volume.trend === "below_average") reasons.push(`Volume ${volume.ratio.toFixed(1)}× average — light volume, conviction is lower.`);

  // Stochastic RSI
  const { stochasticRsi: srsi } = indicators;
  if (srsi.oversold)   reasons.push(`Stochastic RSI %K at ${srsi.k} — oversold, potential near-term bounce.`);
  else if (srsi.overbought) reasons.push(`Stochastic RSI %K at ${srsi.k} — overbought, short-term pullback risk.`);

  // Support / Resistance
  const { supportResistance: sr } = indicators;
  if (sr.nearestSupport !== null)    reasons.push(`Nearest support at ${sr.nearestSupport.toFixed(5)} — key downside reference.`);
  if (sr.nearestResistance !== null) reasons.push(`Nearest resistance at ${sr.nearestResistance.toFixed(5)} — key upside reference.`);

  // Patterns
  for (const p of patterns) {
    reasons.push(`${p.name} detected — ${p.description}`);
  }

  // Overall summary
  if (Math.abs(score) >= 0.60) {
    reasons.push(`Strong ${score > 0 ? "bullish" : "bearish"} consensus across indicators (composite score ${(score * 100).toFixed(0)}/100).`);
  } else if (Math.abs(score) >= 0.30) {
    reasons.push(`Moderate ${score > 0 ? "bullish" : "bearish"} bias — not all indicators agree.`);
  } else {
    reasons.push("Indicators are mixed — no dominant directional bias at this time.");
  }

  return reasons;
}

// ─── Market Structure summary ────────────────────────────────────────────────

/** HH/HL → bullish bias, LH/LL → bearish bias, no swing yet → sideways. */
function structureDirectionFromSwing(latestSwingType: MarketStructureResult["latestSwingType"]): TrendDirection {
  if (latestSwingType === "HH" || latestSwingType === "HL") return "bullish";
  if (latestSwingType === "LH" || latestSwingType === "LL") return "bearish";
  return "sideways";
}

function buildMarketStructureSummary(structure: MarketStructureResult): MarketStructureSummary {
  return {
    marketTrend:        structure.currentTrend,
    structureDirection: structureDirectionFromSwing(structure.latestSwingType),
    latestSwing:        structure.latestSwingType,
    swingHigh:          structure.latestSwingHigh?.price ?? null,
    swingLow:           structure.latestSwingLow?.price ?? null,
    marketPhase:        structure.marketPhase,
  };
}

function generateStructureReason(structure: MarketStructureSummary): string {
  const { marketTrend, latestSwing, marketPhase } = structure;
  if (latestSwing === null) {
    return "Market structure: not enough swing points yet to establish a trend.";
  }
  const trendLabel = marketTrend === "bullish" ? "bullish" : marketTrend === "bearish" ? "bearish" : "sideways";
  const phaseLabel = marketPhase === "trending" ? "confirmed" : marketPhase === "reversal" ? "reversing" : "ranging";
  return `Market structure ${trendLabel} (${phaseLabel}) — latest swing is a ${latestSwing}.`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface EngineInput {
  symbol:    string;
  timeframe: string;
  candles:   MarketCandle[];
  currentBid: number;
  currentAsk: number;
}

/**
 * Run the full analysis pipeline.
 * All computation is synchronous (pure functions) — no I/O inside this function.
 */
export function runAnalysis(input: EngineInput): AnalysisResult {
  const { symbol, timeframe, candles, currentBid, currentAsk } = input;
  const currentPrice = (currentBid + currentAsk) / 2;

  const indicators = computeIndicators(candles, currentPrice);
  const patterns   = detectCandlestickPatterns(candles);
  const score      = computeCompositeScore(indicators, patterns);
  const decision   = scoreToDecision(score);
  const confidence = scoreToConfidence(score);
  const riskLevel  = computeRiskLevel(indicators);
  const trend      = deriveTrend(indicators);
  const risk       = computeRisk(decision, currentBid, currentAsk, indicators);
  const structure  = analyzeMarketStructure(candles, { swingLength: 2 });
  const marketStructure = buildMarketStructureSummary(structure);
  const reasons    = [...generateReasons(indicators, patterns, score), generateStructureReason(marketStructure)];

  return {
    symbol,
    timeframe,
    timestamp:      new Date().toISOString(),
    candleCount:    candles.length,
    decision,
    confidence,
    riskLevel,
    trend,
    entryPrice:      risk.entryPrice,
    stopLoss:        risk.stopLoss,
    takeProfit:      risk.takeProfit,
    riskRewardRatio: risk.riskRewardRatio,
    indicators,
    patterns,
    reasons,
    marketStructure,
  };
}

/** Parse a timeframe string to Timeframe enum. Returns H1 as default. */
export function parseTimeframe(tf: string): Timeframe {
  const map: Record<string, Timeframe> = {
    "1M": Timeframe.M1, "5M": Timeframe.M5, "15M": Timeframe.M15,
    "30M": Timeframe.M30, "1H": Timeframe.H1, "4H": Timeframe.H4,
    "1D": Timeframe.D1, "1W": Timeframe.W1,
  };
  return map[tf] ?? Timeframe.H1;
}
