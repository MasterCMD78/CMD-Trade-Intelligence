/**
 * Swing Classification — labels each swing HH/HL/LH/LL relative to the
 * previous swing of the *same kind* (high vs. high, low vs. low).
 *
 * Tie-break rule: a swing that merely *equals* the prior swing's price has
 * failed to make genuine progress in the "higher" direction, so ties
 * classify as the "lower" label (LH for highs, LL for lows). This mirrors
 * how a double-top/double-bottom is read as structure failing to extend,
 * not confirming, the prior direction.
 */

import type { SwingPoint } from "./types.js";

function classifySeries(points: SwingPoint[]): SwingPoint[] {
  const result: SwingPoint[] = [];

  for (let i = 0; i < points.length; i++) {
    const point = points[i]!;
    if (i === 0) {
      // First swing of its kind — nothing to compare against.
      result.push({ ...point });
      continue;
    }

    const previous = points[i - 1]!;
    const isHigherPrice = point.price > previous.price;

    const label = point.kind === "high"
      ? (isHigherPrice ? "HH" : "LH")
      : (isHigherPrice ? "HL" : "LL");

    result.push({ ...point, label });
  }

  return result;
}

export interface ClassifiedSwings {
  highs: SwingPoint[];
  lows: SwingPoint[];
}

export function classifySwings(highs: SwingPoint[], lows: SwingPoint[]): ClassifiedSwings {
  return {
    highs: classifySeries(highs),
    lows: classifySeries(lows),
  };
}
