/**
 * Scoring Engine
 *
 * Converts each indicator result and pattern set into a directional score in
 * the range [−1, 1], then produces a weighted composite score.
 *
 * Weight table (must sum to 1.0):
 *   RSI            0.15
 *   MACD           0.20
 *   EMA stack      0.15
 *   Bollinger %B   0.10
 *   Stochastic RSI 0.10
 *   Volume         0.10
 *   Trend          0.05
 *   Patterns       0.15
 *
 * ADX acts as a multiplier (not a weighted contributor):
 *   trending (ADX > 25) → ×1.20
 *   non-trending        → ×0.85
 *
 * Adding a new indicator:
 *   1. Add its scorer function below.
 *   2. Push { value, weight } into `scores` in `computeCompositeScore`.
 *   3. Adjust weights so they still sum to 1.
 */

import type { IndicatorSet, CandlestickPattern, Decision, RiskLevel, TrendDirection } from "./types.js";

// ─── Per-indicator scorers ────────────────────────────────────────────────────

/** RSI: oversold → +1, overbought → −1, linear in between. */
function scoreRsi(rsiValue: number): number {
  if (rsiValue <= 20) return 1.0;
  if (rsiValue <= 30) return 0.7;
  if (rsiValue <= 40) return 0.3;
  if (rsiValue <= 60) return 0.0;
  if (rsiValue <= 70) return -0.3;
  if (rsiValue <= 80) return -0.7;
  return -1.0;
}

/** MACD: crossover is strongest signal; otherwise histogram direction. */
function scoreMacd(indicators: IndicatorSet): number {
  const { crossover, histogram } = indicators.macd;
  if (crossover === "bullish") return 0.9;
  if (crossover === "bearish") return -0.9;
  // No crossover: score by histogram sign and relative magnitude.
  const scale = Math.min(Math.abs(histogram) / (Math.abs(indicators.macd.macdLine) + 1e-10), 1);
  return histogram >= 0 ? scale * 0.5 : -scale * 0.5;
}

/** EMA stack: fully aligned bullish/bearish → ±1, mixed → fraction. */
function scoreEma(indicators: IndicatorSet): number {
  const { priceAboveEma20, priceAboveEma50, priceAboveEma200, ema20, ema50, ema200 } = indicators.ema;
  let score = 0;
  if (priceAboveEma20)  score += 0.25;
  if (priceAboveEma50)  score += 0.25;
  if (priceAboveEma200) score += 0.25;
  if (ema20 > ema50)    score += 0.125;
  if (ema50 > ema200)   score += 0.125;
  return (score - 0.5) * 2; // centre around 0, range [−1, 1]
}

/** Bollinger %B: extremes signal reversal. */
function scoreBollinger(pctB: number): number {
  if (pctB <= 0)    return 1.0;
  if (pctB <= 0.15) return 0.7;
  if (pctB <= 0.30) return 0.3;
  if (pctB <= 0.70) return 0.0;
  if (pctB <= 0.85) return -0.3;
  if (pctB <= 1.0)  return -0.7;
  return -1.0;
}

/** Stochastic RSI: mirror of RSI scorer. */
function scoreStochRsi(k: number): number {
  if (k <= 10) return 1.0;
  if (k <= 20) return 0.7;
  if (k <= 35) return 0.3;
  if (k <= 65) return 0.0;
  if (k <= 80) return -0.3;
  if (k <= 90) return -0.7;
  return -1.0;
}

/** Volume: high volume confirms candle direction; low volume → no signal. */
function scoreVolume(indicators: IndicatorSet): number {
  const { ratio, signal } = indicators.volume;
  if (ratio < 0.75) return 0; // low volume = ignore
  const strength = Math.min((ratio - 0.75) / 1.25, 1); // 0 at 0.75×, 1 at 2×+
  return signal === "buy" ? strength * 0.8 : signal === "sell" ? -strength * 0.8 : 0;
}

/** Trend: structural bias from price action. */
function scoreTrend(indicators: IndicatorSet): number {
  const { overall } = indicators.trend;
  return overall === "bullish" ? 0.6 : overall === "bearish" ? -0.6 : 0;
}

/** Patterns: bullish patterns → positive, bearish → negative. */
function scorePatterns(patterns: CandlestickPattern[]): number {
  if (patterns.length === 0) return 0;
  const total = patterns.reduce((sum, p) => {
    const dir = p.type === "bullish" ? 1 : p.type === "bearish" ? -1 : 0;
    return sum + dir * p.strength;
  }, 0);
  return Math.max(-1, Math.min(1, total / patterns.length));
}

// ─── Composite score ──────────────────────────────────────────────────────────

/**
 * Produce a composite score in [−1, 1].
 * Positive → bullish pressure, negative → bearish pressure.
 */
export function computeCompositeScore(
  indicators: IndicatorSet,
  patterns: CandlestickPattern[],
): number {
  // RSI, Bollinger %B, and Stochastic RSI are mean-reversion oscillators:
  // they read "overbought"/"oversold" during strong, healthy trends, which
  // is expected market behaviour rather than a genuine reversal warning.
  // When ADX confirms a strong trend AND the oscillator's reading agrees
  // with the trend direction (i.e. it's flagging "overbought" *because* of
  // the very trend that's underway, not a divergence against it), dampen
  // its contrarian pull instead of letting it cancel out confirmed momentum.
  const trending = indicators.adx.trending;
  const trendBullish = indicators.trend.overall === "bullish" || indicators.ema.trend === "bullish";
  const trendBearish = indicators.trend.overall === "bearish" || indicators.ema.trend === "bearish";

  function dampen(rawScore: number): number {
    if (!trending) return rawScore;
    // A bearish oscillator reading during a confirmed bullish trend (or a
    // bullish reading during a confirmed bearish trend) usually just means
    // "overbought/oversold because the trend is strong" — not a genuine
    // reversal warning. Halve its pull so it can't single-handedly cancel
    // out confirmed trend-following signals.
    const fightsBullishTrend = rawScore < 0 && trendBullish;
    const fightsBearishTrend = rawScore > 0 && trendBearish;
    return (fightsBullishTrend || fightsBearishTrend) ? rawScore * 0.5 : rawScore;
  }

  const scores: { value: number; weight: number }[] = [
    { value: dampen(scoreRsi(indicators.rsi.value)), weight: 0.15 },
    { value: scoreMacd(indicators),              weight: 0.20 },
    { value: scoreEma(indicators),               weight: 0.15 },
    { value: dampen(scoreBollinger(indicators.bollingerBands.pctB)), weight: 0.10 },
    { value: dampen(scoreStochRsi(indicators.stochasticRsi.k)),      weight: 0.10 },
    { value: scoreVolume(indicators),            weight: 0.10 },
    { value: scoreTrend(indicators),             weight: 0.05 },
    { value: scorePatterns(patterns),            weight: 0.15 },
  ];

  const weighted = scores.reduce((sum, s) => sum + s.value * s.weight, 0);

  // ADX acts as a confidence/noise multiplier — not a directional contributor.
  const adxMultiplier = trending ? 1.20 : 0.85;

  return Math.max(-1, Math.min(1, weighted * adxMultiplier));
}

// ─── Decision + confidence + risk ────────────────────────────────────────────

/** Minimum absolute score required to emit a BUY or SELL decision. */
const DECISION_THRESHOLD = 0.30;

export function scoreToDecision(score: number): Decision {
  if (score >= DECISION_THRESHOLD)  return "BUY";
  if (score <= -DECISION_THRESHOLD) return "SELL";
  return "HOLD";
}

/** Map score → 0–100 confidence value. */
export function scoreToConfidence(score: number): number {
  return Math.round(Math.min(100, Math.abs(score) * 100));
}

export function computeRiskLevel(indicators: IndicatorSet): RiskLevel {
  const { pctOfPrice } = indicators.atr;
  const { adx }        = indicators.adx;

  if (pctOfPrice > 0.015 || adx > 40)  return "high";
  if (pctOfPrice < 0.005 && adx < 25)  return "low";
  return "medium";
}

export function deriveTrend(indicators: IndicatorSet): TrendDirection {
  // Prefer the structural trend; fall back to EMA-based.
  const t = indicators.trend.overall;
  if (t !== "sideways") return t;
  return indicators.ema.trend;
}
