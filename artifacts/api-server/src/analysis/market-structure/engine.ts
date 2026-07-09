/**
 * Market Structure Engine — orchestrator.
 *
 * Sequence: detect swings → classify HH/HL/LH/LL → derive trend purely from
 * that classification → package everything into a reusable Structure State.
 *
 * Phase 3B: Break of Structure detection.
 * Phase 3D: Liquidity Sweep detection.
 * Phase 3E: Order Block detection.
 * Phase 3F: Fair Value Gap detection.
 * Phase 3G: Premium & Discount zone computation.
 */

import type { BOSDirection, MarketPhase, MarketStructureOptions, MarketStructureResult, StructureCandle } from "./types.js";
import type { TrendDirection } from "../types.js";
import { detectSwings } from "./swing-detector.js";
import { classifySwings } from "./classifier.js";
import { computeTrend } from "./trend-engine.js";
import { detectBOS } from "./bos-detector.js";
import { detectLiquiditySweeps } from "./liquidity-sweep.js";
import { detectOrderBlocks } from "./order-block.js";
import { detectFairValueGaps } from "./fair-value-gap.js";
import { computePremiumDiscount } from "./premium-discount.js";
import type { LiquiditySweepResult } from "./liquidity-sweep.js";
import type { OrderBlockResult } from "./order-block.js";
import type { FairValueGapResult } from "./fair-value-gap.js";
import type { PremiumDiscountResult } from "./premium-discount.js";

const DEFAULT_SWING_LENGTH = 2;

function computeMarketPhase(currentTrend: TrendDirection, previousTrend: TrendDirection): MarketPhase {
  if (currentTrend === "sideways") return "ranging";
  if (currentTrend === previousTrend) return "trending";
  if (previousTrend === "sideways") {
    return "trending";
  }
  return "reversal";
}

// ─── Extended result including Phase 3D-3G ────────────────────────────────────

export interface FullMarketStructureResult extends MarketStructureResult {
  liquidity: LiquiditySweepResult;
  orderBlocks: OrderBlockResult;
  fairValueGaps: FairValueGapResult;
  premiumDiscount: PremiumDiscountResult | null;
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

  const { bullishBOS, bearishBOS, lastBullishBOS, lastBearishBOS } =
    detectBOS(candles, classifiedHighs, classifiedLows, options.bos ?? {});

  let currentStructureBias: BOSDirection | null = null;
  if (lastBullishBOS !== null && lastBearishBOS !== null) {
    currentStructureBias =
      lastBullishBOS.breakIndex >= lastBearishBOS.breakIndex ? "bullish" : "bearish";
  } else if (lastBullishBOS !== null) {
    currentStructureBias = "bullish";
  } else if (lastBearishBOS !== null) {
    currentStructureBias = "bearish";
  }

  return {
    currentTrend,
    previousTrend,
    latestSwingHigh,
    latestSwingLow,
    latestSwingType,
    marketPhase,
    swingHighs: classifiedHighs,
    swingLows: classifiedLows,
    lastBullishBOS,
    lastBearishBOS,
    currentStructureBias,
    allBullishBOS: bullishBOS,
    allBearishBOS: bearishBOS,
  };
}

/**
 * Full analysis including all Phase 3D-3G Smart Money modules.
 */
export function analyzeMarketStructureFull(
  candles: StructureCandle[],
  currentPrice: number,
  options: MarketStructureOptions = {},
): FullMarketStructureResult {
  const base = analyzeMarketStructure(candles, options);

  const liquidity = detectLiquiditySweeps(
    candles,
    base.swingHighs,
    base.swingLows,
  );

  const orderBlocks = detectOrderBlocks(
    candles,
    base.allBullishBOS,
    base.allBearishBOS,
  );

  const fairValueGaps = detectFairValueGaps(candles);

  const premiumDiscount = computePremiumDiscount(
    currentPrice,
    base.swingHighs,
    base.swingLows,
  );

  return {
    ...base,
    liquidity,
    orderBlocks,
    fairValueGaps,
    premiumDiscount,
  };
}

export * from "./types.js";
export { detectSwings } from "./swing-detector.js";
export { classifySwings } from "./classifier.js";
export { computeTrend } from "./trend-engine.js";
export { detectBOS } from "./bos-detector.js";
export { detectLiquiditySweeps } from "./liquidity-sweep.js";
export { detectOrderBlocks } from "./order-block.js";
export { detectFairValueGaps } from "./fair-value-gap.js";
export { computePremiumDiscount } from "./premium-discount.js";
