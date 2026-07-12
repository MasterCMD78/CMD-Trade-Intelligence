/**
 * Decision Engine — module scoring.
 *
 * Every existing analysis module gets its own scorer here. Each scorer is a
 * pure function of the already-computed `AnalysisResult` (no new I/O, no
 * duplicated detection logic) that returns a `ScoreBreakdown`:
 *
 *   score       — signed directional contribution, range [-1, 1]
 *                 (positive = bullish, negative = bearish)
 *   confidence  — 0-100, how much weight this module's own read deserves
 *   displayScore— 0-100, confidence normalized for the UI breakdown table
 *   weight      — this module's share of the Institutional Score (sums to 1.0
 *                 across all ten modules below)
 *
 * Weight table (must sum to 1.0):
 *   Indicators        0.12
 *   Market Structure   0.12
 *   BOS                0.10
 *   CHOCH              0.08
 *   Liquidity          0.10
 *   Order Block        0.10
 *   Fair Value Gap     0.08
 *   Premium/Discount   0.07
 *   Multi-Timeframe    0.15
 *   Risk               0.08
 */

import type { AnalysisResult } from "../types.js";
import type { ScoreBreakdown } from "./types.js";

function clamp(v: number, min = -1, max = 1): number {
  return Math.max(min, Math.min(max, v));
}

function displayFromConfidence(confidence: number): number {
  return Math.round(clamp(confidence, 0, 100));
}

// ─── 1. Indicators ────────────────────────────────────────────────────────────

export function scoreIndicators(result: AnalysisResult): ScoreBreakdown {
  const { indicators } = result;
  const signals: Array<"buy" | "sell" | "neutral"> = [
    indicators.rsi.signal,
    indicators.macd.signal,
    indicators.ema.signal,
    indicators.bollingerBands.signal,
    indicators.stochasticRsi.signal,
    indicators.volume.signal,
    indicators.trend.signal,
    indicators.adx.signal,
  ];
  const buy = signals.filter((s) => s === "buy").length;
  const sell = signals.filter((s) => s === "sell").length;
  const score = clamp((buy - sell) / signals.length);
  const agreement = Math.abs(buy - sell) / signals.length;
  const confidence = Math.round(45 + agreement * 55);
  const explanation =
    buy === sell
      ? "Technical indicators are split — no dominant consensus."
      : `${buy > sell ? "Bullish" : "Bearish"} indicator consensus: ${Math.max(buy, sell)}/${signals.length} agree.`;
  return { name: "Indicators", score, confidence, explanation, displayScore: displayFromConfidence(confidence), weight: 0.12 };
}

// ─── 2. Market Structure ──────────────────────────────────────────────────────

export function scoreMarketStructure(result: AnalysisResult): ScoreBreakdown {
  const ms = result.marketStructure;
  const dirScore = ms.marketTrend === "bullish" ? 0.7 : ms.marketTrend === "bearish" ? -0.7 : 0;
  const swingScore = ms.structureDirection === "bullish" ? 0.3 : ms.structureDirection === "bearish" ? -0.3 : 0;
  const score = clamp(dirScore + swingScore);
  const confidence =
    ms.marketPhase === "trending" ? 85 : ms.marketPhase === "reversal" ? 55 : 45;
  const explanation = `Market structure is ${ms.marketTrend} (${ms.marketPhase}); latest confirmed swing: ${ms.latestSwing ?? "none yet"}.`;
  return { name: "Market Structure", score, confidence, explanation, displayScore: displayFromConfidence(confidence), weight: 0.12 };
}

// ─── 3. Break of Structure ───────────────────────────────────────────────────

export function scoreBOS(result: AnalysisResult): ScoreBreakdown {
  const { bos } = result.marketStructure;
  if (!bos.detected || bos.direction === null) {
    return { name: "BOS", score: 0, confidence: 30, explanation: "No confirmed Break of Structure in the current window.", displayScore: 30, weight: 0.10 };
  }
  const strength = bos.strength ?? 0.5;
  const score = clamp(bos.direction === "bullish" ? strength : -strength);
  const confidence = bos.confidence ?? Math.round(strength * 100);
  const explanation = `${bos.direction === "bullish" ? "Bullish" : "Bearish"} BOS confirmed at ${bos.price?.toFixed(5) ?? "—"} (strength ${(strength * 100).toFixed(0)}%).`;
  return { name: "BOS", score, confidence, explanation, displayScore: displayFromConfidence(confidence), weight: 0.10 };
}

// ─── 4. Change of Character ──────────────────────────────────────────────────

/**
 * CHoCH has no dedicated field on the single-timeframe `MarketStructureSummary`
 * — it's exposed per-timeframe on the Multi-Timeframe result. When MTF data is
 * available we aggregate CHoCH signals across timeframes (weighted toward the
 * higher tiers); otherwise we fall back to `marketPhase === "reversal"` as a
 * single-timeframe proxy for "the trend just changed character."
 */
export function scoreCHOCH(result: AnalysisResult): ScoreBreakdown {
  const mtf = result.multiTimeframe;
  if (!mtf) {
    const reversal = result.marketStructure.marketPhase === "reversal";
    if (!reversal) {
      return { name: "CHOCH", score: 0, confidence: 35, explanation: "No Change of Character detected.", displayScore: 35, weight: 0.08 };
    }
    const dir = result.marketStructure.structureDirection;
    const score = clamp(dir === "bullish" ? 0.5 : dir === "bearish" ? -0.5 : 0);
    return { name: "CHOCH", score, confidence: 55, explanation: "Single-timeframe market phase just reversed — potential Change of Character.", displayScore: 55, weight: 0.08 };
  }

  const entries = Object.values(mtf.timeframes).filter((tf) => tf !== undefined);
  const detected = entries.filter((tf) => tf!.choch.detected);
  if (detected.length === 0) {
    return { name: "CHOCH", score: 0, confidence: 35, explanation: "No Change of Character detected across any timeframe.", displayScore: 35, weight: 0.08 };
  }
  const bullish = detected.filter((tf) => tf!.choch.direction === "bullish").length;
  const bearish = detected.filter((tf) => tf!.choch.direction === "bearish").length;
  const score = clamp((bullish - bearish) / entries.length);
  const avgConfidence = detected.reduce((sum, tf) => sum + (tf!.choch.confidence ?? 50), 0) / detected.length;
  const confidence = Math.round(avgConfidence);
  const explanation = `CHoCH detected on ${detected.length}/${entries.length} timeframes (${bullish} bullish, ${bearish} bearish).`;
  return { name: "CHOCH", score, confidence, explanation, displayScore: displayFromConfidence(confidence), weight: 0.08 };
}

// ─── 5. Liquidity ─────────────────────────────────────────────────────────────

export function scoreLiquidity(result: AnalysisResult): ScoreBreakdown {
  const liq = result.marketStructure.liquidity;
  if (liq.sweepCount === 0 || liq.lastSweepDirection === null) {
    return { name: "Liquidity", score: 0, confidence: 30, explanation: `${liq.levelCount} liquidity pool(s) tracked; no confirmed sweep yet.`, displayScore: 30, weight: 0.10 };
  }
  // Buy-side sweep (wick above, close back inside) = bearish rejection.
  // Sell-side sweep (wick below, close back inside) = bullish rejection.
  const rejection = liq.lastSweepRejection ?? 0.5;
  const score = clamp(liq.lastSweepDirection === "sell-side" ? rejection : -rejection);
  const confidence = liq.lastSweepConfidence ?? Math.round(rejection * 100);
  const explanation = `${liq.lastSweepDirection === "buy-side" ? "Buy-side" : "Sell-side"} liquidity sweep confirmed (rejection ${(rejection * 100).toFixed(0)}%); ${liq.levelCount} pools tracked.`;
  return { name: "Liquidity", score, confidence, explanation, displayScore: displayFromConfidence(confidence), weight: 0.10 };
}

// ─── 6. Order Blocks ──────────────────────────────────────────────────────────

export function scoreOrderBlock(result: AnalysisResult): ScoreBreakdown {
  const ob = result.marketStructure.orderBlocks;
  const bullActive = ob.lastBullishHigh !== null && !ob.lastBullishMitigated;
  const bearActive = ob.lastBearishHigh !== null && !ob.lastBearishMitigated;
  if (!bullActive && !bearActive) {
    return { name: "Order Block", score: 0, confidence: 30, explanation: "No active (unmitigated) order blocks.", displayScore: 30, weight: 0.10 };
  }
  const bullConf = bullActive ? ob.lastBullishConfidence ?? 60 : 0;
  const bearConf = bearActive ? ob.lastBearishConfidence ?? 60 : 0;
  const score = clamp(((bullActive ? bullConf : 0) - (bearActive ? bearConf : 0)) / 100);
  const confidence = Math.round(Math.max(bullConf, bearConf));
  const parts: string[] = [];
  if (bullActive) parts.push(`bullish OB ${ob.lastBullishLow?.toFixed(5)}–${ob.lastBullishHigh?.toFixed(5)}`);
  if (bearActive) parts.push(`bearish OB ${ob.lastBearishLow?.toFixed(5)}–${ob.lastBearishHigh?.toFixed(5)}`);
  return { name: "Order Block", score, confidence, explanation: `Active ${parts.join(" and ")}. ${ob.activeCount} zone(s) tracked.`, displayScore: displayFromConfidence(confidence), weight: 0.10 };
}

// ─── 7. Fair Value Gaps ───────────────────────────────────────────────────────

export function scoreFairValueGap(result: AnalysisResult): ScoreBreakdown {
  const fvg = result.marketStructure.fairValueGaps;
  const bullActive = fvg.lastBullishStatus !== null && fvg.lastBullishStatus !== "mitigated";
  const bearActive = fvg.lastBearishStatus !== null && fvg.lastBearishStatus !== "mitigated";
  if (!bullActive && !bearActive) {
    return { name: "Fair Value Gap", score: 0, confidence: 30, explanation: "No unfilled Fair Value Gaps.", displayScore: 30, weight: 0.08 };
  }
  const bullFill = fvg.lastBullishFillPct ?? 0;
  const bearFill = fvg.lastBearishFillPct ?? 0;
  const bullWeight = bullActive ? 1 - bullFill / 100 : 0;
  const bearWeight = bearActive ? 1 - bearFill / 100 : 0;
  const score = clamp(bullWeight - bearWeight);
  const confidence = Math.round(Math.max(bullWeight, bearWeight) * 100);
  const parts: string[] = [];
  if (bullActive) parts.push(`bullish FVG [${fvg.lastBullishStatus}, ${bullFill}% filled]`);
  if (bearActive) parts.push(`bearish FVG [${fvg.lastBearishStatus}, ${bearFill}% filled]`);
  return { name: "Fair Value Gap", score, confidence, explanation: `${fvg.activeCount} active gap(s) — ${parts.join(", ")}.`, displayScore: displayFromConfidence(confidence), weight: 0.08 };
}

// ─── 8. Premium / Discount ────────────────────────────────────────────────────

export function scorePremiumDiscount(result: AnalysisResult): ScoreBreakdown {
  const pd = result.marketStructure.premiumDiscount;
  if (!pd.available || pd.currentZone === null) {
    return { name: "Premium/Discount", score: 0, confidence: 25, explanation: "Not enough swing range to compute a premium/discount zone.", displayScore: 25, weight: 0.07 };
  }
  const distance = Math.abs((pd.pricePosition ?? 50) - 50);
  const magnitude = clamp(distance / 50, 0, 1);
  const score = clamp(pd.currentZone === "discount" ? magnitude : pd.currentZone === "premium" ? -magnitude : 0);
  const confidence = Math.round(40 + magnitude * 55);
  const zoneLabel = pd.currentZone === "discount" ? "Discount (favours buys)" : pd.currentZone === "premium" ? "Premium (favours sells)" : "Equilibrium (fair value)";
  return {
    name: "Premium/Discount",
    score,
    confidence,
    explanation: `Price sits in the ${zoneLabel} zone at ${pd.pricePosition?.toFixed(0) ?? "50"}% of the swing range.`,
    displayScore: displayFromConfidence(confidence),
    weight: 0.07,
  };
}

// ─── 9. Multi-Timeframe ───────────────────────────────────────────────────────

export function scoreMultiTimeframe(result: AnalysisResult): ScoreBreakdown {
  const mtf = result.multiTimeframe;
  if (!mtf) {
    return { name: "Multi-Timeframe", score: 0, confidence: 20, explanation: "Multi-timeframe data unavailable for this request.", displayScore: 20, weight: 0.15 };
  }
  const biasScore =
    mtf.overallBias === "strong_bullish" ? 1 :
    mtf.overallBias === "bullish" ? 0.5 :
    mtf.overallBias === "bearish" ? -0.5 :
    mtf.overallBias === "strong_bearish" ? -1 : 0;
  const alignmentPull = clamp((mtf.alignmentScore - 50) / 50);
  const score = clamp(biasScore * 0.7 + alignmentPull * 0.3);
  const confidence = Math.round(clamp(mtf.confluenceScore, 0, 100));
  const explanation = `${mtf.availableCount} timeframes analyzed — ${mtf.alignmentType.replace(/_/g, " ")} alignment, institutional bias ${mtf.institutionalBias.replace(/_/g, " ")} (confluence ${mtf.confluenceScore}%).`;
  return { name: "Multi-Timeframe", score, confidence, explanation, displayScore: displayFromConfidence(confidence), weight: 0.15 };
}

// ─── 10. Risk ──────────────────────────────────────────────────────────────────

export function scoreRisk(result: AnalysisResult): ScoreBreakdown {
  const { riskLevel, riskRewardRatio, trend } = result;
  const rrBonus = clamp((riskRewardRatio - 1.5) / 2, -0.4, 0.6);
  const riskPenalty = riskLevel === "high" ? -0.3 : riskLevel === "medium" ? 0 : 0.2;
  const magnitude = clamp(rrBonus + riskPenalty, -1, 1);
  const score = clamp(trend === "bearish" ? -Math.abs(magnitude) : Math.abs(magnitude));
  const confidence = Math.round(clamp(55 + magnitude * 40, 0, 100));
  const explanation = `${riskLevel[0]!.toUpperCase()}${riskLevel.slice(1)} volatility risk; risk:reward at ${riskRewardRatio.toFixed(2)}:1.`;
  return { name: "Risk", score, confidence, explanation, displayScore: displayFromConfidence(confidence), weight: 0.08 };
}

// ─── All scorers ──────────────────────────────────────────────────────────────

export function computeAllScores(result: AnalysisResult): ScoreBreakdown[] {
  return [
    scoreIndicators(result),
    scoreMarketStructure(result),
    scoreBOS(result),
    scoreCHOCH(result),
    scoreLiquidity(result),
    scoreOrderBlock(result),
    scoreFairValueGap(result),
    scorePremiumDiscount(result),
    scoreMultiTimeframe(result),
    scoreRisk(result),
  ];
}
