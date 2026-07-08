/**
 * Support & Resistance Detection
 * Identifies local swing highs and lows, then clusters nearby levels.
 */

import type { SupportResistanceResult } from "../types.js";
import type { MarketCandle } from "../../market-data/types.js";

/**
 * A price level is a swing high (resistance) if the candle's high is higher
 * than its `windowSize` neighbours on each side.
 * A swing low (support) if the low is lower than all neighbours.
 */
function findSwingPoints(
  candles: MarketCandle[],
  windowSize: number,
): { supports: number[]; resistances: number[] } {
  const supports: number[] = [];
  const resistances: number[] = [];

  for (let i = windowSize; i < candles.length - windowSize; i++) {
    const c = candles[i]!;
    let isSwingHigh = true;
    let isSwingLow  = true;

    for (let j = i - windowSize; j <= i + windowSize; j++) {
      if (j === i) continue;
      if (candles[j]!.high >= c.high) isSwingHigh = false;
      if (candles[j]!.low  <= c.low)  isSwingLow  = false;
    }

    if (isSwingHigh) resistances.push(c.high);
    if (isSwingLow)  supports.push(c.low);
  }

  return { supports, resistances };
}

/**
 * Cluster price levels that are within `clusterPct` of each other.
 * Returns the centroid of each cluster, sorted in the given direction.
 */
function clusterLevels(levels: number[], clusterPct = 0.005): number[] {
  if (levels.length === 0) return [];
  const sorted = [...levels].sort((a, b) => a - b);
  const clusters: number[][] = [[sorted[0]!]];

  for (let i = 1; i < sorted.length; i++) {
    const cluster   = clusters[clusters.length - 1]!;
    const centroid  = cluster.reduce((a, b) => a + b, 0) / cluster.length;
    const threshold = centroid * clusterPct;
    if (Math.abs(sorted[i]! - centroid) <= threshold) {
      cluster.push(sorted[i]!);
    } else {
      clusters.push([sorted[i]!]);
    }
  }

  return clusters.map((cl) => +(cl.reduce((a, b) => a + b, 0) / cl.length).toFixed(8));
}

export function computeSupportResistance(
  candles: MarketCandle[],
  windowSize = 3,
): SupportResistanceResult {
  const currentPrice = candles[candles.length - 1]?.close ?? 0;

  const { supports: rawSupports, resistances: rawResistances } = findSwingPoints(candles, windowSize);

  const allSupports    = clusterLevels(rawSupports).filter((l) => l < currentPrice).sort((a, b) => b - a);
  const allResistances = clusterLevels(rawResistances).filter((l) => l > currentPrice).sort((a, b) => a - b);

  return {
    supports:            allSupports.slice(0, 5),
    resistances:         allResistances.slice(0, 5),
    nearestSupport:      allSupports[0] ?? null,
    nearestResistance:   allResistances[0] ?? null,
  };
}
