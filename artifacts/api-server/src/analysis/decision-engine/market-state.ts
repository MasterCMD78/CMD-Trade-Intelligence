/**
 * Decision Engine — Market State classifier.
 *
 * Derives one of seven states purely from data the existing engines already
 * compute: no new detection logic, just a deterministic mapping.
 *
 *   trending        — confirmed directional phase, normal volatility.
 *   expansion       — confirmed directional phase + high ATR + ADX trending
 *                      (a trend that's actively accelerating).
 *   reversal        — market structure phase just flipped.
 *   accumulation    — ranging + price sitting in the discount zone.
 *   distribution    — ranging + price sitting in the premium zone.
 *   consolidation   — ranging + low ATR (tight range, no zone read).
 *   ranging         — ranging, none of the above conditions apply.
 */

import type { AnalysisResult } from "../types.js";
import type { MarketState } from "./types.js";

export function deriveMarketState(result: AnalysisResult): MarketState {
  const { marketPhase, premiumDiscount } = result.marketStructure;
  const { volatility } = result.indicators.atr;
  const { trending } = result.indicators.adx;

  if (marketPhase === "reversal") return "reversal";

  if (marketPhase === "trending") {
    return volatility === "high" && trending ? "expansion" : "trending";
  }

  // Ranging.
  if (premiumDiscount.available && premiumDiscount.currentZone === "discount") return "accumulation";
  if (premiumDiscount.available && premiumDiscount.currentZone === "premium") return "distribution";
  if (volatility === "low") return "consolidation";
  return "ranging";
}
