/**
 * Break of Structure (BOS) Detector.
 *
 * A BOS is confirmed only when price CLOSES beyond a previously confirmed
 * swing level — wick-only breaks are explicitly ignored. An optional
 * `minCandleClosePct` filter further rejects indecisive closes (dojis,
 * spinning tops) that barely breach the level.
 *
 * Bullish BOS : close strictly above a prior confirmed swing HIGH.
 * Bearish BOS : close strictly below a prior confirmed swing LOW.
 *
 * Design principles (so CHOCH, Liquidity Sweeps, OBs, and FVGs can reuse
 * this contract cleanly):
 *   - Stateless pure function — takes candles + classified swings, returns events.
 *   - No coupling to the trend engine or indicator layer.
 *   - Configurable distance and candle-body filters (sane defaults = no filter).
 *   - Returns ALL detected events so callers can track history or filter.
 */

import type { StructureCandle, SwingPoint, BOSResult, BOSOptions, BOSDirection } from "./types.js";

const DEFAULT_CONFIRMATION_DISTANCE = 0;
const DEFAULT_MIN_CANDLE_CLOSE_PCT = 0;

/** 0.5 % breach → strength 1.0; smaller breaches score proportionally lower. */
const BASE_BREACH_PCT = 0.005;

export interface BOSDetectionResult {
  bullishBOS: BOSResult[];
  bearishBOS: BOSResult[];
  lastBullishBOS: BOSResult | null;
  lastBearishBOS: BOSResult | null;
}

// ─── Scoring helpers ──────────────────────────────────────────────────────────

/**
 * How decisively did price close beyond the swing level?
 * Returns a value in [0, 1] proportional to breach size relative to price.
 */
function computeStrength(
  closePrice: number,
  swingLevel: number,
  direction: BOSDirection,
): number {
  if (swingLevel === 0) return 0;
  const breach =
    direction === "bullish" ? closePrice - swingLevel : swingLevel - closePrice;
  if (breach <= 0) return 0;
  return Math.min(1, breach / swingLevel / BASE_BREACH_PCT);
}

/**
 * Composite confidence (0–100) from three components:
 *   - Strength of the breach            (0–50, weight 50 %)
 *   - Structure maturity (swing count)  (0–30, weight 30 %)
 *   - Candle body quality               (0–20, weight 20 %)
 *
 * @param swingIndex  0-based index of this swing in its series (0 = first swing).
 * @param candleClosePct  (close − low) / (high − low); 1 = closed at the high.
 */
function computeConfidence(
  strength: number,
  swingIndex: number,
  candleClosePct: number,
  direction: BOSDirection,
): number {
  const strengthScore = strength * 50;
  // Each additional prior swing that formed structure adds 15 points (cap 30).
  const maturityScore = Math.min(30, swingIndex * 15);
  // Bullish wants close near the high; bearish wants close near the low.
  const bodyScore =
    direction === "bullish" ? candleClosePct * 20 : (1 - candleClosePct) * 20;
  return Math.min(100, Math.round(strengthScore + maturityScore + bodyScore));
}

// ─── Main detector ────────────────────────────────────────────────────────────

/**
 * Scan candles for confirmed Break of Structure events against each
 * classified swing high (bullish BOS) and swing low (bearish BOS).
 *
 * Only the FIRST candle that closes beyond a given swing level is registered —
 * subsequent closes of the same level are continuations, not new BOS events.
 */
export function detectBOS(
  candles: StructureCandle[],
  swingHighs: SwingPoint[],
  swingLows: SwingPoint[],
  options: BOSOptions = {},
): BOSDetectionResult {
  if (!candles || candles.length === 0) {
    return { bullishBOS: [], bearishBOS: [], lastBullishBOS: null, lastBearishBOS: null };
  }

  const confirmationDistance =
    options.confirmationDistance ?? DEFAULT_CONFIRMATION_DISTANCE;
  const minCandleClosePct =
    options.minCandleClosePct ?? DEFAULT_MIN_CANDLE_CLOSE_PCT;

  const bullishBOS: BOSResult[] = [];
  const bearishBOS: BOSResult[] = [];

  // ── Bullish BOS: close above a confirmed swing high ────────────────────────
  for (let si = 0; si < swingHighs.length; si++) {
    const swing = swingHighs[si]!;
    const levelToBreak = swing.price + confirmationDistance;

    for (let ci = swing.index + 1; ci < candles.length; ci++) {
      const candle = candles[ci]!;
      const closePrice = candle.close;

      // Candles without a closing price cannot confirm a BOS.
      if (closePrice === undefined) continue;

      // Fast-exit: even the wick doesn't reach — skip this candle entirely.
      if (candle.high <= swing.price) continue;

      // Wick filter: CLOSE must be above the required level (not just the wick).
      if (closePrice <= levelToBreak) continue;

      // Candle-body quality filter.
      const candleRange = candle.high - candle.low;
      const candleClosePct =
        candleRange > 0 ? (closePrice - candle.low) / candleRange : 0.5;
      if (candleClosePct < minCandleClosePct) continue;

      const strength = computeStrength(closePrice, swing.price, "bullish");
      const confidence = computeConfidence(strength, si, candleClosePct, "bullish");

      bullishBOS.push({
        direction: "bullish",
        brokenSwing: swing,
        breakPrice: closePrice,
        breakIndex: ci,
        confirmationCandle: candle,
        strength,
        confidence,
      });

      // Only the first confirming candle per swing level.
      break;
    }
  }

  // ── Bearish BOS: close below a confirmed swing low ─────────────────────────
  for (let si = 0; si < swingLows.length; si++) {
    const swing = swingLows[si]!;
    const levelToBreak = swing.price - confirmationDistance;

    for (let ci = swing.index + 1; ci < candles.length; ci++) {
      const candle = candles[ci]!;
      const closePrice = candle.close;

      // Candles without a closing price cannot confirm a BOS.
      if (closePrice === undefined) continue;

      // Fast-exit: wick doesn't reach — skip.
      if (candle.low >= swing.price) continue;

      // Wick filter: CLOSE must be below the required level.
      if (closePrice >= levelToBreak) continue;

      // Candle-body quality filter.
      const candleRange = candle.high - candle.low;
      const candleClosePct =
        candleRange > 0 ? (closePrice - candle.low) / candleRange : 0.5;
      if ((1 - candleClosePct) < minCandleClosePct) continue;

      const strength = computeStrength(closePrice, swing.price, "bearish");
      const confidence = computeConfidence(strength, si, candleClosePct, "bearish");

      bearishBOS.push({
        direction: "bearish",
        brokenSwing: swing,
        breakPrice: closePrice,
        breakIndex: ci,
        confirmationCandle: candle,
        strength,
        confidence,
      });

      break;
    }
  }

  // Sort by breakIndex ascending so that `last*BOS` is always the truly most
  // recent break. Iteration order is by swing index (oldest swing first), but
  // an older swing can be broken LATER than a newer swing (e.g. a deep LH
  // that only gets cleared several candles after a shallower LH was cleared).
  // Without sorting, the array tail would incorrectly reflect swing order
  // rather than break-candle order.
  bullishBOS.sort((a, b) => a.breakIndex - b.breakIndex);
  bearishBOS.sort((a, b) => a.breakIndex - b.breakIndex);

  return {
    bullishBOS,
    bearishBOS,
    lastBullishBOS: bullishBOS.length > 0 ? bullishBOS[bullishBOS.length - 1]! : null,
    lastBearishBOS: bearishBOS.length > 0 ? bearishBOS[bearishBOS.length - 1]! : null,
  };
}
