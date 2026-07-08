/**
 * Market Structure Engine — orchestrator.
 *
 * Sequence: detect swings → classify HH/HL/LH/LL → derive trend purely from
 * that classification → package everything into a reusable Structure State.
 *
 * To add a new structure concept later (BOS, CHOCH, liquidity sweeps, order
 * blocks, FVGs, premium/discount zones — Phase 3B+), build it as its own
 * detector consuming `swingHighs`/`swingLows` from this module's output,
 * the same way `classifier.ts` and `trend-engine.ts` do.
 */

import type { MarketPhase, MarketStructureOptions, MarketStructureResult, StructureCandle } from "./types.js";
import type { TrendDirection } from "../types.js";
import { detectSwings } from "./swing-detector.js";
import { classifySwings } from "./classifier.js";
import { computeTrend } from "./trend-engine.js";

const DEFAULT_SWING_LENGTH = 2;

function computeMarketPhase(currentTrend: TrendDirection, previousTrend: TrendDirection): MarketPhase {
  if (currentTrend === "sideways") return "ranging";
  if (currentTrend === previousTrend) return "trending";
  if (previousTrend === "sideways") {
    // First time a directional trend confirms out of a range — that's the
    // trend establishing itself, not flipping from one direction to another.
    return "trending";
  }
  // previousTrend was the opposite directional bias — a genuine flip.
  return "reversal";
}

export function analyzeMarketStructure(
  candles: StructureCandle[],
  options: MarketStructureOptions = {},
): MarketStructureResult {
  const swingLength = options.swingLength ?? DEFAULT_SWING_LENGTH;

  const { highs, lows } = detectSwings(candles, swingLength);
  const { highs: classifiedHighs, lows: classifiedLows } = classifySwings(highs, lows);
  const { currentTrend, previousTrend } = computeTrend(classifiedHighs, classifiedLows);

  const latestSwingHigh = classifiedHighs.length > 0 ? classifiedHighs[classifiedHighs.length - 1]! : null;
  const latestSwingLow = classifiedLows.length > 0 ? classifiedLows[classifiedLows.length - 1]! : null;

  let latestSwingType = null as MarketStructureResult["latestSwingType"];
  if (latestSwingHigh && latestSwingLow) {
    latestSwingType = (latestSwingHigh.index >= latestSwingLow.index ? latestSwingHigh.label : latestSwingLow.label) ?? null;
  } else if (latestSwingHigh) {
    latestSwingType = latestSwingHigh.label ?? null;
  } else if (latestSwingLow) {
    latestSwingType = latestSwingLow.label ?? null;
  }

  const marketPhase = computeMarketPhase(currentTrend, previousTrend);

  return {
    currentTrend,
    previousTrend,
    latestSwingHigh,
    latestSwingLow,
    latestSwingType,
    marketPhase,
    swingHighs: classifiedHighs,
    swingLows: classifiedLows,
  };
}

export * from "./types.js";
export { detectSwings } from "./swing-detector.js";
export { classifySwings } from "./classifier.js";
export { computeTrend } from "./trend-engine.js";
