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
 *   8. Run full market structure analysis (BOS, Liquidity, OBs, FVGs, P&D).
 *   9. Adjust confidence using Smart Money signals.
 *  10. Generate human-readable reasons.
 *  11. Return AnalysisResult.
 */

import type { MarketCandle } from "../market-data/types.js";
import { Timeframe }         from "../market-data/types.js";
import type {
  AnalysisResult,
  BosSummary,
  IndicatorSet,
  CandlestickPattern,
  MarketStructureSummary,
  TrendDirection,
  LiquiditySummary,
  OrderBlockSummary,
  FairValueGapSummary,
  PremiumDiscountSummary,
} from "./types.js";
import { analyzeMarketStructureFull } from "./market-structure/engine.js";
import type { FullMarketStructureResult } from "./market-structure/engine.js";
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

// ─── Market Structure summary builders ───────────────────────────────────────

function structureDirectionFromSwing(latestSwingType: MarketStructureResult["latestSwingType"]): TrendDirection {
  if (latestSwingType === "HH" || latestSwingType === "HL") return "bullish";
  if (latestSwingType === "LH" || latestSwingType === "LL") return "bearish";
  return "sideways";
}

function buildBosSummary(structure: MarketStructureResult): BosSummary {
  const { lastBullishBOS: bull, lastBearishBOS: bear } = structure;
  let active = null;
  if (bull && bear) {
    active = bull.breakIndex >= bear.breakIndex ? bull : bear;
  } else {
    active = bull ?? bear ?? null;
  }
  if (active === null) {
    return { detected: false, direction: null, price: null, strength: null, confidence: null };
  }
  return {
    detected:   true,
    direction:  active.direction,
    price:      active.breakPrice,
    strength:   active.strength,
    confidence: active.confidence,
  };
}

function buildLiquiditySummary(structure: FullMarketStructureResult): LiquiditySummary {
  const { liquidity } = structure;
  const last = liquidity.lastSweep;
  return {
    levelCount:           liquidity.liquidityLevels.length,
    sweepCount:           liquidity.sweeps.length,
    lastSweepDirection:   last?.direction ?? null,
    lastSweepRejection:   last?.rejectionStrength ?? null,
    lastSweepConfidence:  last?.confidence ?? null,
    lastSweepPrice:       last?.sweepPrice ?? null,
  };
}

function buildOrderBlockSummary(structure: FullMarketStructureResult): OrderBlockSummary {
  const { orderBlocks } = structure;
  const bull = orderBlocks.lastBullishOB;
  const bear = orderBlocks.lastBearishOB;
  return {
    activeCount:            orderBlocks.activeOrderBlocks.length,
    lastBullishHigh:        bull?.high ?? null,
    lastBullishLow:         bull?.low ?? null,
    lastBullishConfidence:  bull?.confidence ?? null,
    lastBullishMitigated:   bull?.mitigated ?? false,
    lastBearishHigh:        bear?.high ?? null,
    lastBearishLow:         bear?.low ?? null,
    lastBearishConfidence:  bear?.confidence ?? null,
    lastBearishMitigated:   bear?.mitigated ?? false,
  };
}

function buildFairValueGapSummary(structure: FullMarketStructureResult): FairValueGapSummary {
  const { fairValueGaps } = structure;
  const bull = fairValueGaps.lastBullishFvg;
  const bear = fairValueGaps.lastBearishFvg;
  return {
    activeCount:          fairValueGaps.activeFvgs.length,
    lastBullishGapHigh:   bull?.gapHigh ?? null,
    lastBullishGapLow:    bull?.gapLow ?? null,
    lastBullishStatus:    bull?.status ?? null,
    lastBullishFillPct:   bull?.fillPct ?? null,
    lastBearishGapHigh:   bear?.gapHigh ?? null,
    lastBearishGapLow:    bear?.gapLow ?? null,
    lastBearishStatus:    bear?.status ?? null,
    lastBearishFillPct:   bear?.fillPct ?? null,
  };
}

function buildPremiumDiscountSummary(structure: FullMarketStructureResult): PremiumDiscountSummary {
  const pd = structure.premiumDiscount;
  if (!pd) {
    return { available: false, currentZone: null, pricePosition: null, equilibrium: null, rangeHigh: null, rangeLow: null };
  }
  return {
    available:     true,
    currentZone:   pd.currentZone,
    pricePosition: pd.pricePosition,
    equilibrium:   pd.equilibrium,
    rangeHigh:     pd.rangeHigh,
    rangeLow:      pd.rangeLow,
  };
}

function buildMarketStructureSummary(structure: FullMarketStructureResult): MarketStructureSummary {
  return {
    marketTrend:        structure.currentTrend,
    structureDirection: structureDirectionFromSwing(structure.latestSwingType),
    latestSwing:        structure.latestSwingType,
    swingHigh:          structure.latestSwingHigh?.price ?? null,
    swingLow:           structure.latestSwingLow?.price ?? null,
    marketPhase:        structure.marketPhase,
    bos:                buildBosSummary(structure),
    liquidity:          buildLiquiditySummary(structure),
    orderBlocks:        buildOrderBlockSummary(structure),
    fairValueGaps:      buildFairValueGapSummary(structure),
    premiumDiscount:    buildPremiumDiscountSummary(structure),
  };
}

// ─── Reason generators for Smart Money modules ───────────────────────────────

function generateStructureReason(structure: MarketStructureSummary): string {
  const { marketTrend, latestSwing, marketPhase } = structure;
  if (latestSwing === null) {
    return "Market structure: not enough swing points yet to establish a trend.";
  }
  const trendLabel = marketTrend === "bullish" ? "bullish" : marketTrend === "bearish" ? "bearish" : "sideways";
  const phaseLabel = marketPhase === "trending" ? "confirmed" : marketPhase === "reversal" ? "reversing" : "ranging";
  return `Market structure ${trendLabel} (${phaseLabel}) — latest swing is a ${latestSwing}.`;
}

function generateBOSReason(bos: BosSummary): string | null {
  if (!bos.detected || bos.direction === null) return null;
  const dir = bos.direction === "bullish" ? "Bullish" : "Bearish";
  const side = bos.direction === "bullish" ? "above prior swing high" : "below prior swing low";
  const price = bos.price !== null ? ` at ${bos.price.toFixed(5)}` : "";
  const strengthPct = bos.strength !== null ? ` (strength ${(bos.strength * 100).toFixed(0)}%` : "";
  const confPct = bos.confidence !== null ? `, confidence ${bos.confidence}%)` : strengthPct ? ")" : "";
  return `${dir} BOS confirmed — price closed ${side}${price}${strengthPct}${confPct}.`;
}

function generateLiquidityReason(liq: LiquiditySummary): string | null {
  if (liq.sweepCount === 0) return null;
  const dir = liq.lastSweepDirection === "buy-side" ? "Buy-side" : "Sell-side";
  const rej = liq.lastSweepRejection !== null ? ` (rejection ${(liq.lastSweepRejection * 100).toFixed(0)}%` : "";
  const conf = liq.lastSweepConfidence !== null ? `, confidence ${liq.lastSweepConfidence})` : rej ? ")" : "";
  return `${dir} liquidity sweep confirmed — wick pierced level and closed back inside${rej}${conf}. ${liq.levelCount} liquidity pools tracked.`;
}

function generateOrderBlockReason(ob: OrderBlockSummary): string | null {
  if (ob.activeCount === 0) return null;
  const parts: string[] = [];
  if (ob.lastBullishHigh !== null && ob.lastBullishLow !== null) {
    const tag = ob.lastBullishMitigated ? " [mitigated]" : " [active]";
    parts.push(`Bullish OB: ${ob.lastBullishLow.toFixed(5)}–${ob.lastBullishHigh.toFixed(5)}${tag}`);
  }
  if (ob.lastBearishHigh !== null && ob.lastBearishLow !== null) {
    const tag = ob.lastBearishMitigated ? " [mitigated]" : " [active]";
    parts.push(`Bearish OB: ${ob.lastBearishLow.toFixed(5)}–${ob.lastBearishHigh.toFixed(5)}${tag}`);
  }
  if (parts.length === 0) return null;
  return `Order Blocks — ${parts.join("; ")}. ${ob.activeCount} active zone(s).`;
}

function generateFvgReason(fvg: FairValueGapSummary): string | null {
  if (fvg.activeCount === 0) return null;
  const parts: string[] = [];
  if (fvg.lastBullishGapHigh !== null && fvg.lastBullishStatus !== null) {
    parts.push(`Bullish FVG ${fvg.lastBullishGapLow?.toFixed(5)}–${fvg.lastBullishGapHigh.toFixed(5)} [${fvg.lastBullishStatus}, ${fvg.lastBullishFillPct ?? 0}% filled]`);
  }
  if (fvg.lastBearishGapHigh !== null && fvg.lastBearishStatus !== null) {
    parts.push(`Bearish FVG ${fvg.lastBearishGapLow?.toFixed(5)}–${fvg.lastBearishGapHigh.toFixed(5)} [${fvg.lastBearishStatus}, ${fvg.lastBearishFillPct ?? 0}% filled]`);
  }
  if (parts.length === 0) return null;
  return `Fair Value Gaps — ${parts.join("; ")}. ${fvg.activeCount} unfilled.`;
}

function generatePremiumDiscountReason(pd: PremiumDiscountSummary): string | null {
  if (!pd.available || pd.currentZone === null) return null;
  const zoneLabel =
    pd.currentZone === "premium" ? "Premium (expensive)" :
    pd.currentZone === "discount" ? "Discount (cheap)" : "Equilibrium (fair value)";
  const pos = pd.pricePosition !== null ? ` at ${pd.pricePosition}% of the swing range` : "";
  const equil = pd.equilibrium !== null ? ` (equilibrium: ${pd.equilibrium.toFixed(5)})` : "";
  return `Price in ${zoneLabel}${pos}${equil} — ${pd.currentZone === "premium" ? "favour sell setups" : pd.currentZone === "discount" ? "favour buy setups" : "no premium/discount bias"}.`;
}

// ─── Confidence adjustment from Smart Money signals ───────────────────────────

/**
 * Nudge confidence based on whether Smart Money signals align with decision.
 *
 * BOS alignment:          ±8 pts (strength-weighted)
 * Liquidity sweep:        ±6 pts (rejection-weighted)
 * Order block alignment:  ±5 pts (flat)
 * Premium/Discount:       ±5 pts (flat, direction-weighted)
 */
function applySmartMoneyConfidenceAdjustment(
  baseConfidence: number,
  decision: AnalysisResult["decision"],
  ms: MarketStructureSummary,
): number {
  let delta = 0;

  // ── BOS adjustment ────────────────────────────────────────────────────────
  const { bos } = ms;
  if (bos.detected && bos.direction !== null && bos.strength !== null) {
    const bosAligns =
      (decision === "BUY"  && bos.direction === "bullish") ||
      (decision === "SELL" && bos.direction === "bearish");
    delta += bosAligns ? bos.strength * 8 : -(bos.strength * 5);
  }

  // ── Liquidity sweep adjustment ────────────────────────────────────────────
  const { liquidity } = ms;
  if (liquidity.sweepCount > 0 && liquidity.lastSweepDirection !== null && liquidity.lastSweepRejection !== null) {
    // A buy-side sweep (wick above, closes below) signals bearish rejection → SELL
    // A sell-side sweep (wick below, closes above) signals bullish rejection → BUY
    const sweepAligns =
      (decision === "SELL" && liquidity.lastSweepDirection === "buy-side") ||
      (decision === "BUY"  && liquidity.lastSweepDirection === "sell-side");
    delta += sweepAligns ? liquidity.lastSweepRejection * 6 : -(liquidity.lastSweepRejection * 3);
  }

  // ── Order Block adjustment ────────────────────────────────────────────────
  const { orderBlocks } = ms;
  if (orderBlocks.activeCount > 0) {
    const bullishOBActive = orderBlocks.lastBullishHigh !== null && !orderBlocks.lastBullishMitigated;
    const bearishOBActive = orderBlocks.lastBearishHigh !== null && !orderBlocks.lastBearishMitigated;
    if (decision === "BUY"  && bullishOBActive) delta += 5;
    if (decision === "SELL" && bearishOBActive) delta += 5;
    if (decision === "BUY"  && bearishOBActive) delta -= 3;
    if (decision === "SELL" && bullishOBActive) delta -= 3;
  }

  // ── Premium/Discount adjustment ───────────────────────────────────────────
  const { premiumDiscount } = ms;
  if (premiumDiscount.available && premiumDiscount.currentZone !== null) {
    const pdAligns =
      (decision === "BUY"  && premiumDiscount.currentZone === "discount") ||
      (decision === "SELL" && premiumDiscount.currentZone === "premium");
    const pdContra =
      (decision === "BUY"  && premiumDiscount.currentZone === "premium") ||
      (decision === "SELL" && premiumDiscount.currentZone === "discount");
    if (pdAligns) delta += 5;
    if (pdContra) delta -= 5;
  }

  return Math.min(100, Math.max(0, Math.round(baseConfidence + delta)));
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

  // Full Smart Money analysis (Phase 3A–3G)
  const fullStructure   = analyzeMarketStructureFull(candles, currentPrice, { swingLength: 2 });
  const marketStructure = buildMarketStructureSummary(fullStructure);

  const adjustedConfidence = applySmartMoneyConfidenceAdjustment(confidence, decision, marketStructure);

  const bosReason  = generateBOSReason(marketStructure.bos);
  const liqReason  = generateLiquidityReason(marketStructure.liquidity);
  const obReason   = generateOrderBlockReason(marketStructure.orderBlocks);
  const fvgReason  = generateFvgReason(marketStructure.fairValueGaps);
  const pdReason   = generatePremiumDiscountReason(marketStructure.premiumDiscount);

  const reasons = [
    ...generateReasons(indicators, patterns, score),
    generateStructureReason(marketStructure),
    ...(bosReason  !== null ? [bosReason]  : []),
    ...(liqReason  !== null ? [liqReason]  : []),
    ...(obReason   !== null ? [obReason]   : []),
    ...(fvgReason  !== null ? [fvgReason]  : []),
    ...(pdReason   !== null ? [pdReason]   : []),
  ];

  return {
    symbol,
    timeframe,
    timestamp:      new Date().toISOString(),
    candleCount:    candles.length,
    decision,
    confidence:     adjustedConfidence,
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
