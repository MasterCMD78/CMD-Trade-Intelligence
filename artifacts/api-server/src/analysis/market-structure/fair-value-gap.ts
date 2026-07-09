/**
 * Fair Value Gap (FVG) Engine — Phase 3F.
 *
 * A Fair Value Gap is a three-candle imbalance where candle[i-1] and
 * candle[i+1] have no price overlap — institutional orders were filled
 * so fast that price left a "gap" in the order book.
 *
 * Bullish FVG: candle[i-1].high < candle[i+1].low  (gap above candle i-1)
 * Bearish FVG: candle[i-1].low  > candle[i+1].high (gap below candle i-1)
 *
 * Tracking:
 *   - "active"   : gap not yet touched by subsequent price action.
 *   - "partial"  : price has traded into the gap but not closed through it.
 *   - "mitigated": price has closed fully through the gap (filled).
 *
 * Design: pure stateless function, no I/O.
 */

import type { StructureCandle } from "./types.js";

// ─── Public types ─────────────────────────────────────────────────────────────

export type FVGKind = "bullish" | "bearish";
export type FVGStatus = "active" | "partial" | "mitigated";

export interface FairValueGap {
  kind: FVGKind;
  /** Top of the gap (higher price boundary). */
  gapHigh: number;
  /** Bottom of the gap (lower price boundary). */
  gapLow: number;
  /** Raw gap size in price units. */
  gapSize: number;
  /** Index of the middle candle (candle[i] in the three-candle pattern). */
  midIndex: number;
  status: FVGStatus;
  /**
   * 0–100: how much of the gap has been filled.
   * 0 = untouched, 100 = fully mitigated.
   */
  fillPct: number;
  /**
   * Quality score 0–1.
   * Higher when the gap is large relative to recent ATR and the middle candle
   * has a strong impulsive body.
   */
  quality: number;
  /** 0–100 composite confidence. */
  confidence: number;
}

export interface FairValueGapResult {
  /** All detected FVGs (including mitigated ones). */
  fvgs: FairValueGap[];
  /** Only active or partially-filled FVGs. */
  activeFvgs: FairValueGap[];
  /** Most recent bullish FVG. */
  lastBullishFvg: FairValueGap | null;
  /** Most recent bearish FVG. */
  lastBearishFvg: FairValueGap | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Approximate ATR over the last N candles for relative gap sizing.
 */
function approxAtr(candles: StructureCandle[], upTo: number, period = 14): number {
  const start = Math.max(0, upTo - period);
  let sum = 0;
  let count = 0;
  for (let i = start; i <= upTo && i < candles.length; i++) {
    sum += candles[i]!.high - candles[i]!.low;
    count++;
  }
  return count > 0 ? sum / count : 1;
}

/** Body quality of the middle impulse candle (0 = doji, 1 = marubozu). */
function midBodyQuality(c: StructureCandle): number {
  const range = c.high - c.low;
  if (range === 0) return 0;
  if (c.close === undefined) return 0.5;
  const open = (c as StructureCandle & { open?: number }).open;
  if (open === undefined) return 0.5;
  return Math.min(1, Math.abs(c.close - open) / range);
}

function computeQuality(gapSize: number, atr: number, midCandle: StructureCandle): number {
  const sizeScore = Math.min(1, gapSize / (atr * 0.5)); // 50% of ATR = max score
  const bodyScore = midBodyQuality(midCandle);
  return Math.min(1, sizeScore * 0.6 + bodyScore * 0.4);
}

function computeConfidence(quality: number, fillPct: number): number {
  // Higher quality + less filled → more confident in trading back to the gap.
  const unfilled = 1 - fillPct / 100;
  return Math.min(100, Math.round(quality * 70 + unfilled * 30));
}

/**
 * Update gap status and fillPct based on subsequent candles.
 */
function updateFvgStatus(fvg: FairValueGap, candles: StructureCandle[]): FairValueGap {
  let fillPct = 0;
  let status: FVGStatus = "active";

  for (let ci = fvg.midIndex + 2; ci < candles.length; ci++) {
    const c = candles[ci]!;

    if (fvg.kind === "bullish") {
      // Gap is below price (between candle[i-1].high and candle[i+1].low).
      // Price fills from above (moving down).
      if (c.low > fvg.gapHigh) continue; // not reached yet
      if (c.close !== undefined && c.close < fvg.gapLow) {
        fillPct = 100;
        status = "mitigated";
        break;
      }
      if (c.low <= fvg.gapHigh && c.low >= fvg.gapLow) {
        const penetration = fvg.gapHigh - c.low;
        fillPct = Math.min(99, Math.round((penetration / fvg.gapSize) * 100));
        status = "partial";
      } else if (c.low < fvg.gapLow) {
        fillPct = 100;
        status = "mitigated";
        break;
      }
    } else {
      // Bearish FVG: gap is above price. Price fills from below (moving up).
      if (c.high < fvg.gapLow) continue;
      if (c.close !== undefined && c.close > fvg.gapHigh) {
        fillPct = 100;
        status = "mitigated";
        break;
      }
      if (c.high >= fvg.gapLow && c.high <= fvg.gapHigh) {
        const penetration = c.high - fvg.gapLow;
        fillPct = Math.min(99, Math.round((penetration / fvg.gapSize) * 100));
        status = "partial";
      } else if (c.high > fvg.gapHigh) {
        fillPct = 100;
        status = "mitigated";
        break;
      }
    }
  }

  const confidence = computeConfidence(fvg.quality, fillPct);
  return { ...fvg, fillPct, status, confidence };
}

// ─── Main detector ────────────────────────────────────────────────────────────

export function detectFairValueGaps(candles: StructureCandle[]): FairValueGapResult {
  if (!candles || candles.length < 3) {
    return {
      fvgs: [],
      activeFvgs: [],
      lastBullishFvg: null,
      lastBearishFvg: null,
    };
  }

  const rawFvgs: FairValueGap[] = [];

  // Three-candle scan: i is the middle candle
  for (let i = 1; i < candles.length - 1; i++) {
    const prev = candles[i - 1]!; // candle[i-1]
    const mid  = candles[i]!;     // candle[i]
    const next = candles[i + 1]!; // candle[i+1]

    const atr = approxAtr(candles, i);

    // Bullish FVG: gap between prev.high and next.low (no overlap above prev)
    if (next.low > prev.high) {
      const gapHigh = next.low;
      const gapLow  = prev.high;
      const gapSize = gapHigh - gapLow;
      const quality = computeQuality(gapSize, atr, mid);

      rawFvgs.push({
        kind: "bullish",
        gapHigh,
        gapLow,
        gapSize,
        midIndex: i,
        status: "active",
        fillPct: 0,
        quality,
        confidence: computeConfidence(quality, 0),
      });
    }

    // Bearish FVG: gap between next.high and prev.low (no overlap below prev)
    if (next.high < prev.low) {
      const gapHigh = prev.low;
      const gapLow  = next.high;
      const gapSize = gapHigh - gapLow;
      const quality = computeQuality(gapSize, atr, mid);

      rawFvgs.push({
        kind: "bearish",
        gapHigh,
        gapLow,
        gapSize,
        midIndex: i,
        status: "active",
        fillPct: 0,
        quality,
        confidence: computeConfidence(quality, 0),
      });
    }
  }

  // Apply post-creation status update for each FVG
  const fvgs = rawFvgs.map((fvg) => updateFvgStatus(fvg, candles));

  // Sort chronologically
  fvgs.sort((a, b) => a.midIndex - b.midIndex);

  const activeFvgs = fvgs.filter((f) => f.status !== "mitigated");
  const lastBullishFvg = [...fvgs].filter((f) => f.kind === "bullish").pop() ?? null;
  const lastBearishFvg = [...fvgs].filter((f) => f.kind === "bearish").pop() ?? null;

  return { fvgs, activeFvgs, lastBullishFvg, lastBearishFvg };
}
