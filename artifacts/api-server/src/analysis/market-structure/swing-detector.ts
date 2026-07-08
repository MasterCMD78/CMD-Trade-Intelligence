/**
 * Swing Detection — fractal-style pivot detection.
 *
 * A candle at index `i` is a swing high when its `high` is strictly greater
 * than the `high` of every candle within `swingLength` candles on both
 * sides. A swing low is the mirror (strictly lower `low` on both sides).
 *
 * `swingLength` is configurable: larger values require a wider, more
 * significant pivot (fewer, more major swings); smaller values are more
 * sensitive (more, smaller swings).
 */

import type { StructureCandle, SwingPoint } from "./types.js";

const DEFAULT_SWING_LENGTH = 2;

export interface SwingDetectionResult {
  highs: SwingPoint[];
  lows: SwingPoint[];
}

export function detectSwings(
  candles: StructureCandle[],
  swingLength: number = DEFAULT_SWING_LENGTH,
): SwingDetectionResult {
  const length = Number.isFinite(swingLength) && swingLength >= 1 ? Math.floor(swingLength) : DEFAULT_SWING_LENGTH;

  const highs: SwingPoint[] = [];
  const lows: SwingPoint[] = [];

  // Need at least `length` candles on each side of the pivot candle.
  const minCandles = length * 2 + 1;
  if (!candles || candles.length < minCandles) {
    return { highs, lows };
  }

  for (let i = length; i < candles.length - length; i++) {
    const pivot = candles[i]!;

    let isSwingHigh = true;
    let isSwingLow = true;

    for (let offset = 1; offset <= length; offset++) {
      const left = candles[i - offset]!;
      const right = candles[i + offset]!;

      if (!(pivot.high > left.high && pivot.high > right.high)) {
        isSwingHigh = false;
      }
      if (!(pivot.low < left.low && pivot.low < right.low)) {
        isSwingLow = false;
      }
      if (!isSwingHigh && !isSwingLow) break;
    }

    if (isSwingHigh) {
      highs.push({ index: i, price: pivot.high, timestamp: pivot.timestamp, kind: "high" });
    }
    if (isSwingLow) {
      lows.push({ index: i, price: pivot.low, timestamp: pivot.timestamp, kind: "low" });
    }
  }

  return { highs, lows };
}
