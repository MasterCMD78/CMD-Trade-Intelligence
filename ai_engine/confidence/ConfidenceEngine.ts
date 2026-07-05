import { SmartMoneyAnalysis } from "../analysis/smart_money/SmartMoneyEngine";
import { IndicatorResult } from "../analysis/indicators/IndicatorsEngine";

export interface ConfidenceResult {
  score: number;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  reasons: string[];
}

export class ConfidenceEngine {

  static calculate(
    smartMoney: SmartMoneyAnalysis,
    indicators: IndicatorResult
  ): ConfidenceResult {

    let score = 0;
    const reasons: string[] = [];

    // Smart Money
    if (smartMoney.orderBlocks.length > 0) {
      score += 20;
      reasons.push("Order Block detected");
    }

    if (smartMoney.liquidity.length > 0) {
      score += 20;
      reasons.push("Liquidity detected");
    }

    if (smartMoney.fairValueGaps.length > 0) {
      score += 20;
      reasons.push("Fair Value Gap detected");
    }

    // Indicators
    if (indicators.ema20 > indicators.ema50) {
      score += 15;
      reasons.push("EMA20 above EMA50");
    }

    if (indicators.rsi > 50 && indicators.rsi < 70) {
      score += 15;
      reasons.push("RSI confirms bullish momentum");
    }

    if (score > 100) {
      score = 100;
    }

    let confidence: "LOW" | "MEDIUM" | "HIGH";

    if (score >= 70) {
      confidence = "HIGH";
    } else if (score >= 40) {
      confidence = "MEDIUM";
    } else {
      confidence = "LOW";
    }

    return {
      score,
      confidence,
      reasons,
    };
  }

}