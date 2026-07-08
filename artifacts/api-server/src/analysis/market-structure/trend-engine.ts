/**
 * Market Trend Engine — derives trend PURELY from swing structure
 * (HH/HL/LH/LL). No RSI, MACD, EMA, or any other indicator is consulted.
 *
 * Rule:
 *   - Bullish  → the most recently confirmed swing high is a Higher High
 *                AND the most recently confirmed swing low is a Higher Low.
 *   - Bearish  → the most recently confirmed swing high is a Lower High
 *                AND the most recently confirmed swing low is a Lower Low.
 *   - Sideways → anything else: not enough swings yet, or a mixed/
 *                conflicting read (e.g. HH paired with LL) that signals a
 *                transition rather than a confirmed trend.
 *
 * The engine walks the swings in chronological order so it can also report
 * the trend that was in force immediately before the current one — this is
 * `previousTrend`, used to detect trend transitions (continuation vs.
 * reversal vs. still-ranging).
 */

import type { SwingLabel, SwingPoint } from "./types.js";
import type { TrendDirection } from "../types.js";

function trendFromLabels(highLabel: SwingLabel | undefined, lowLabel: SwingLabel | undefined): TrendDirection {
  if (highLabel === "HH" && lowLabel === "HL") return "bullish";
  if (highLabel === "LH" && lowLabel === "LL") return "bearish";
  return "sideways";
}

export interface TrendComputation {
  currentTrend: TrendDirection;
  /**
   * The last *directional* trend (bullish/bearish) confirmed before the
   * current one, ignoring transient "sideways" readings that occur while
   * only one side (high or low) has updated. Defaults to "sideways" when
   * no directional trend has ever been confirmed yet.
   *
   * This intentionally does not report the raw immediately-prior timeline
   * entry — a single LH print right before an LL confirms a reversal is
   * still transitioning out of a real prior bullish trend, not out of a
   * fresh, trend-less range. Consumers deriving "reversal vs. first-time
   * trending" (see `marketPhase` in `engine.ts`) need that distinction.
   */
  previousTrend: TrendDirection;
}

interface TimelineEntry {
  index: number;
  trend: TrendDirection;
}

export function computeTrend(highs: SwingPoint[], lows: SwingPoint[]): TrendComputation {
  // Merge classified highs + lows into one chronological stream so we can
  // track "most recently known label of each kind" as of any given point.
  const merged = [...highs, ...lows]
    .filter((p) => p.label !== undefined)
    .sort((a, b) => a.index - b.index);

  if (merged.length === 0) {
    return { currentTrend: "sideways", previousTrend: "sideways" };
  }

  let lastHighLabel: SwingLabel | undefined;
  let lastLowLabel: SwingLabel | undefined;
  const timeline: TimelineEntry[] = [];

  for (const point of merged) {
    if (point.kind === "high") lastHighLabel = point.label;
    else lastLowLabel = point.label;

    timeline.push({ index: point.index, trend: trendFromLabels(lastHighLabel, lastLowLabel) });
  }

  const currentTrend = timeline[timeline.length - 1]!.trend;

  // Walk backward (skipping the final entry itself) for the most recent
  // *directional* trend that differs from a plain "sideways" blip.
  let previousTrend: TrendDirection = "sideways";
  for (let i = timeline.length - 2; i >= 0; i--) {
    const trend = timeline[i]!.trend;
    if (trend !== "sideways") {
      previousTrend = trend;
      break;
    }
  }

  return { currentTrend, previousTrend };
}
