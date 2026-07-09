/**
 * Order Block Engine — Phase 3E.
 *
 * An Order Block (OB) is the last opposing candle before a Break of Structure.
 *
 * - Bullish OB: last BEARISH (down) candle before a bullish BOS.
 *   When price returns into this zone it may react bullishly.
 * - Bearish OB: last BULLISH (up) candle before a bearish BOS.
 *   When price returns into this zone it may react bearishly.
 *
 * Mitigation: an OB is "mitigated" once price trades INTO its range.
 * Invalidation: an OB is "invalid" once price CLOSES beyond its far edge.
 *
 * Design: pure stateless function, no I/O.
 */

import type { StructureCandle } from "./types.js";
import type { BOSResult } from "./types.js";

// ─── Public types ─────────────────────────────────────────────────────────────

export type OrderBlockKind = "bullish" | "bearish";

export interface OrderBlock {
  kind: OrderBlockKind;
  /** High of the order block candle. */
  high: number;
  /** Low of the order block candle. */
  low: number;
  /** Close price of the order block candle. */
  close: number;
  /** Open price of the order block candle (if available). */
  open?: number;
  /** Index of the OB candle in the candle array. */
  creationIndex: number;
  /** Index of the BOS candle that validates this OB. */
  bosIndex: number;
  /** Price of the BOS that validates this OB. */
  bosPrice: number;
  /** Whether price has returned into (touched) the OB zone. */
  mitigated: boolean;
  /** Whether price has CLOSED beyond the far edge — OB is no longer valid. */
  invalidated: boolean;
  /**
   * 0–1 structural strength: based on how cleanly the BOS was (uses BOS
   * strength) and how large the OB candle body is relative to its range.
   */
  strength: number;
  /** 0–100 composite confidence. */
  confidence: number;
}

export interface OrderBlockResult {
  /** All order blocks detected (including mitigated and invalidated). */
  orderBlocks: OrderBlock[];
  /** Currently active (non-invalidated) order blocks. */
  activeOrderBlocks: OrderBlock[];
  /** Most recent bullish OB. */
  lastBullishOB: OrderBlock | null;
  /** Most recent bearish OB. */
  lastBearishOB: OrderBlock | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isBullishCandle(c: StructureCandle): boolean {
  if (c.close !== undefined && "open" in c) {
    const open = (c as StructureCandle & { open?: number }).open;
    if (open !== undefined) return c.close > open;
  }
  // Fallback: use close vs mid of high/low
  if (c.close !== undefined) return c.close > (c.high + c.low) / 2;
  return false;
}

function isBearishCandle(c: StructureCandle): boolean {
  if (c.close !== undefined && "open" in c) {
    const open = (c as StructureCandle & { open?: number }).open;
    if (open !== undefined) return c.close < open;
  }
  if (c.close !== undefined) return c.close < (c.high + c.low) / 2;
  return false;
}

/** Body as a fraction of total range (0 = doji, 1 = full marubozu). */
function bodyQuality(c: StructureCandle): number {
  const range = c.high - c.low;
  if (range === 0) return 0.5;
  if (c.close === undefined) return 0.5;
  const open = (c as StructureCandle & { open?: number }).open;
  if (open === undefined) return 0.5;
  return Math.min(1, Math.abs(c.close - open) / range);
}

function computeOBStrength(bosStrength: number, ob: StructureCandle): number {
  const bq = bodyQuality(ob);
  return Math.min(1, (bosStrength * 0.6 + bq * 0.4));
}

function computeOBConfidence(
  strength: number,
  bosConfidence: number,
): number {
  return Math.min(100, Math.round(strength * 50 + bosConfidence * 0.5));
}

/**
 * Determine if an OB has been mitigated or invalidated by subsequent candles.
 * Mitigation: price trades INTO the OB zone (high/low range).
 * Invalidation: price closes BEYOND the far edge (bullish OB: close < low; bearish OB: close > high).
 */
function applyPostCreation(
  ob: OrderBlock,
  candles: StructureCandle[],
): OrderBlock {
  let mitigated = false;
  let invalidated = false;

  for (let ci = ob.bosIndex + 1; ci < candles.length; ci++) {
    const c = candles[ci]!;

    if (ob.kind === "bullish") {
      // Price trades into zone (low of candle < OB high, high of candle > OB low)
      if (!mitigated && c.low <= ob.high && c.high >= ob.low) {
        mitigated = true;
      }
      // Close below OB low → invalidated
      if (c.close !== undefined && c.close < ob.low) {
        invalidated = true;
        break;
      }
    } else {
      // Bearish OB: price trades into zone
      if (!mitigated && c.high >= ob.low && c.low <= ob.high) {
        mitigated = true;
      }
      // Close above OB high → invalidated
      if (c.close !== undefined && c.close > ob.high) {
        invalidated = true;
        break;
      }
    }
  }

  return { ...ob, mitigated, invalidated };
}

// ─── Main detector ────────────────────────────────────────────────────────────

/**
 * Detect Order Blocks from the BOS events produced by the market structure engine.
 *
 * For each bullish BOS: scan backwards from the BOS confirmation candle to find
 * the last BEARISH candle before the impulse — that is the bullish OB.
 * For each bearish BOS: find the last BULLISH candle before the impulse.
 */
export function detectOrderBlocks(
  candles: StructureCandle[],
  bullishBOS: BOSResult[],
  bearishBOS: BOSResult[],
): OrderBlockResult {
  if (!candles || candles.length === 0) {
    return {
      orderBlocks: [],
      activeOrderBlocks: [],
      lastBullishOB: null,
      lastBearishOB: null,
    };
  }

  const orderBlocks: OrderBlock[] = [];

  // ── Bullish OBs: last bearish candle before each bullish BOS ────────────────
  for (const bos of bullishBOS) {
    // Search backwards from just before the BOS confirmation candle.
    // The OB is the last opposing candle in the impulse move that produced the BOS.
    let obIdx = -1;
    for (let ci = bos.breakIndex - 1; ci >= 0; ci--) {
      const c = candles[ci]!;
      if (isBearishCandle(c)) {
        obIdx = ci;
        break;
      }
    }
    if (obIdx === -1) continue;

    const obCandle = candles[obIdx]!;
    if (obCandle.close === undefined) continue;

    const strength = computeOBStrength(bos.strength, obCandle);
    const confidence = computeOBConfidence(strength, bos.confidence);

    const ob: OrderBlock = {
      kind: "bullish",
      high: obCandle.high,
      low: obCandle.low,
      close: obCandle.close,
      open: (obCandle as StructureCandle & { open?: number }).open,
      creationIndex: obIdx,
      bosIndex: bos.breakIndex,
      bosPrice: bos.breakPrice,
      mitigated: false,
      invalidated: false,
      strength,
      confidence,
    };

    orderBlocks.push(applyPostCreation(ob, candles));
  }

  // ── Bearish OBs: last bullish candle before each bearish BOS ────────────────
  for (const bos of bearishBOS) {
    let obIdx = -1;
    for (let ci = bos.breakIndex - 1; ci >= 0; ci--) {
      const c = candles[ci]!;
      if (isBullishCandle(c)) {
        obIdx = ci;
        break;
      }
    }
    if (obIdx === -1) continue;

    const obCandle = candles[obIdx]!;
    if (obCandle.close === undefined) continue;

    const strength = computeOBStrength(bos.strength, obCandle);
    const confidence = computeOBConfidence(strength, bos.confidence);

    const ob: OrderBlock = {
      kind: "bearish",
      high: obCandle.high,
      low: obCandle.low,
      close: obCandle.close,
      open: (obCandle as StructureCandle & { open?: number }).open,
      creationIndex: obIdx,
      bosIndex: bos.breakIndex,
      bosPrice: bos.breakPrice,
      mitigated: false,
      invalidated: false,
      strength,
      confidence,
    };

    orderBlocks.push(applyPostCreation(ob, candles));
  }

  // Sort chronologically by creation
  orderBlocks.sort((a, b) => a.creationIndex - b.creationIndex);

  const activeOrderBlocks = orderBlocks.filter((ob) => !ob.invalidated);

  const lastBullishOB =
    [...orderBlocks].filter((ob) => ob.kind === "bullish").pop() ?? null;
  const lastBearishOB =
    [...orderBlocks].filter((ob) => ob.kind === "bearish").pop() ?? null;

  return { orderBlocks, activeOrderBlocks, lastBullishOB, lastBearishOB };
}
