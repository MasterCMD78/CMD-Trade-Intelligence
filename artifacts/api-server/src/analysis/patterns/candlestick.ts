/**
 * Candlestick Pattern Recognition
 *
 * Detects the following patterns on the most recent 1–3 candles:
 *   Single-candle: Doji, Hammer, Inverted Hammer, Shooting Star, Marubozu
 *   Two-candle:    Bullish/Bearish Engulfing, Harami (inside bar)
 *   Three-candle:  Morning Star, Evening Star, Three White Soldiers, Three Black Crows
 */

import type { CandlestickPattern } from "../types.js";
import type { MarketCandle } from "../../market-data/types.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const bodySize  = (c: MarketCandle) => Math.abs(c.close - c.open);
const totalSize = (c: MarketCandle) => c.high - c.low;
const upperShadow = (c: MarketCandle) => c.high - Math.max(c.open, c.close);
const lowerShadow = (c: MarketCandle) => Math.min(c.open, c.close) - c.low;
const isBullish = (c: MarketCandle) => c.close > c.open;
const isBearish = (c: MarketCandle) => c.close < c.open;
const midpoint  = (c: MarketCandle) => (c.high + c.low) / 2;

// ─── Single-candle patterns ───────────────────────────────────────────────────

function detectDoji(c: MarketCandle): CandlestickPattern | null {
  const body  = bodySize(c);
  const total = totalSize(c);
  if (total === 0 || body / total > 0.1) return null;
  return {
    name: "Doji", type: "neutral", strength: 0.5,
    description: "Open and close nearly equal — indecision between buyers and sellers.",
  };
}

function detectHammer(c: MarketCandle, prevBearish: boolean): CandlestickPattern | null {
  if (!prevBearish) return null;
  const body  = bodySize(c);
  const lower = lowerShadow(c);
  const upper = upperShadow(c);
  const total = totalSize(c);
  if (total === 0 || body === 0) return null;
  // Lower shadow at least 2× the body; upper shadow < body.
  if (lower < 2 * body || upper > body) return null;
  return {
    name: "Hammer", type: "bullish", strength: 0.75,
    description: "Long lower shadow after downtrend signals potential bullish reversal.",
  };
}

function detectShootingStar(c: MarketCandle, prevBullish: boolean): CandlestickPattern | null {
  if (!prevBullish) return null;
  const body  = bodySize(c);
  const upper = upperShadow(c);
  const lower = lowerShadow(c);
  const total = totalSize(c);
  if (total === 0 || body === 0) return null;
  if (upper < 2 * body || lower > body) return null;
  return {
    name: "Shooting Star", type: "bearish", strength: 0.75,
    description: "Long upper shadow after uptrend signals potential bearish reversal.",
  };
}

function detectMarubozu(c: MarketCandle): CandlestickPattern | null {
  const body   = bodySize(c);
  const total  = totalSize(c);
  if (total === 0) return null;
  const shadowRatio = (total - body) / total;
  if (shadowRatio > 0.05) return null; // Less than 5% shadow
  if (isBullish(c)) {
    return { name: "Bullish Marubozu", type: "bullish", strength: 0.8,
      description: "Solid bullish candle with virtually no shadows — strong buyer dominance." };
  }
  return { name: "Bearish Marubozu", type: "bearish", strength: 0.8,
    description: "Solid bearish candle with virtually no shadows — strong seller dominance." };
}

// ─── Two-candle patterns ──────────────────────────────────────────────────────

function detectEngulfing(prev: MarketCandle, curr: MarketCandle): CandlestickPattern | null {
  if (isBullish(curr) && isBearish(prev) &&
      curr.open < prev.close && curr.close > prev.open) {
    return { name: "Bullish Engulfing", type: "bullish", strength: 0.85,
      description: "Current bullish candle completely engulfs previous bearish candle — strong reversal signal." };
  }
  if (isBearish(curr) && isBullish(prev) &&
      curr.open > prev.close && curr.close < prev.open) {
    return { name: "Bearish Engulfing", type: "bearish", strength: 0.85,
      description: "Current bearish candle completely engulfs previous bullish candle — strong reversal signal." };
  }
  return null;
}

function detectHarami(prev: MarketCandle, curr: MarketCandle): CandlestickPattern | null {
  const currBody = bodySize(curr);
  const prevBody = bodySize(prev);
  if (prevBody === 0) return null;
  // Current body inside previous body.
  const currBodyHigh = Math.max(curr.open, curr.close);
  const currBodyLow  = Math.min(curr.open, curr.close);
  const prevBodyHigh = Math.max(prev.open, prev.close);
  const prevBodyLow  = Math.min(prev.open, prev.close);
  if (currBodyHigh > prevBodyHigh || currBodyLow < prevBodyLow) return null;
  if (currBody / prevBody > 0.5) return null; // Current body should be significantly smaller.
  if (isBullish(curr) && isBearish(prev)) {
    return { name: "Bullish Harami", type: "bullish", strength: 0.55,
      description: "Small bullish inside bar after large bearish candle — potential reversal." };
  }
  if (isBearish(curr) && isBullish(prev)) {
    return { name: "Bearish Harami", type: "bearish", strength: 0.55,
      description: "Small bearish inside bar after large bullish candle — potential reversal." };
  }
  return null;
}

// ─── Three-candle patterns ────────────────────────────────────────────────────

function detectMorningStar(c1: MarketCandle, c2: MarketCandle, c3: MarketCandle): CandlestickPattern | null {
  if (!isBearish(c1)) return null;
  if (!isBullish(c3)) return null;
  const smallBody = bodySize(c2) < bodySize(c1) * 0.3;
  const c2BelowC1 = Math.max(c2.open, c2.close) < Math.min(c1.open, c1.close);
  const c3ClosesMidC1 = c3.close > midpoint(c1);
  if (smallBody && c2BelowC1 && c3ClosesMidC1) {
    return { name: "Morning Star", type: "bullish", strength: 0.9,
      description: "Three-candle bullish reversal: large bearish, small indecision, strong bullish recovery." };
  }
  return null;
}

function detectEveningStar(c1: MarketCandle, c2: MarketCandle, c3: MarketCandle): CandlestickPattern | null {
  if (!isBullish(c1)) return null;
  if (!isBearish(c3)) return null;
  const smallBody = bodySize(c2) < bodySize(c1) * 0.3;
  const c2AboveC1 = Math.min(c2.open, c2.close) > Math.max(c1.open, c1.close);
  const c3ClosesMidC1 = c3.close < midpoint(c1);
  if (smallBody && c2AboveC1 && c3ClosesMidC1) {
    return { name: "Evening Star", type: "bearish", strength: 0.9,
      description: "Three-candle bearish reversal: large bullish, small indecision, strong bearish decline." };
  }
  return null;
}

function detectThreeWhiteSoldiers(c1: MarketCandle, c2: MarketCandle, c3: MarketCandle): CandlestickPattern | null {
  if (!isBullish(c1) || !isBullish(c2) || !isBullish(c3)) return null;
  if (c2.open <= c1.open || c3.open <= c2.open) return null;
  if (c2.close <= c1.close || c3.close <= c2.close) return null;
  // Small upper shadows.
  if (upperShadow(c1) > bodySize(c1) * 0.3 ||
      upperShadow(c2) > bodySize(c2) * 0.3 ||
      upperShadow(c3) > bodySize(c3) * 0.3) return null;
  return { name: "Three White Soldiers", type: "bullish", strength: 0.95,
    description: "Three consecutive strong bullish candles — powerful continuation/reversal signal." };
}

function detectThreeBlackCrows(c1: MarketCandle, c2: MarketCandle, c3: MarketCandle): CandlestickPattern | null {
  if (!isBearish(c1) || !isBearish(c2) || !isBearish(c3)) return null;
  if (c2.open >= c1.open || c3.open >= c2.open) return null;
  if (c2.close >= c1.close || c3.close >= c2.close) return null;
  if (lowerShadow(c1) > bodySize(c1) * 0.3 ||
      lowerShadow(c2) > bodySize(c2) * 0.3 ||
      lowerShadow(c3) > bodySize(c3) * 0.3) return null;
  return { name: "Three Black Crows", type: "bearish", strength: 0.95,
    description: "Three consecutive strong bearish candles — powerful continuation/reversal signal." };
}

// ─── Detector ─────────────────────────────────────────────────────────────────

export function detectCandlestickPatterns(candles: MarketCandle[]): CandlestickPattern[] {
  if (candles.length < 1) return [];
  const patterns: CandlestickPattern[] = [];

  const c1 = candles[candles.length - 3];
  const c2 = candles[candles.length - 2];
  const c3 = candles[candles.length - 1]!;

  // Single-candle patterns on the latest candle.
  const prevBullish = c2 ? isBullish(c2) : false;
  const prevBearish = c2 ? isBearish(c2) : false;

  const doji   = detectDoji(c3);
  if (doji)   patterns.push(doji);
  const hammer = detectHammer(c3, prevBearish);
  if (hammer) patterns.push(hammer);
  const star   = detectShootingStar(c3, prevBullish);
  if (star)   patterns.push(star);
  const maru   = detectMarubozu(c3);
  if (maru)   patterns.push(maru);

  // Two-candle patterns.
  if (c2) {
    const eng  = detectEngulfing(c2, c3);
    if (eng)   patterns.push(eng);
    const har  = detectHarami(c2, c3);
    if (har)   patterns.push(har);
  }

  // Three-candle patterns.
  if (c1 && c2) {
    const ms  = detectMorningStar(c1, c2, c3);
    if (ms)   patterns.push(ms);
    const es  = detectEveningStar(c1, c2, c3);
    if (es)   patterns.push(es);
    const tws = detectThreeWhiteSoldiers(c1, c2, c3);
    if (tws)  patterns.push(tws);
    const tbc = detectThreeBlackCrows(c1, c2, c3);
    if (tbc)  patterns.push(tbc);
  }

  return patterns;
}
