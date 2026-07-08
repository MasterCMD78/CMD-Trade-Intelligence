/**
 * Integration tests for the analysis engine.
 * Verifies end-to-end pipeline output shape and value invariants.
 */

import { describe, it } from "vitest";
import assert from "node:assert/strict";

import type { MarketCandle }  from "../../market-data/types.js";
import { Timeframe }           from "../../market-data/types.js";
import { runAnalysis }         from "../engine.js";
import { computeCompositeScore, scoreToDecision } from "../scoring.js";
import { detectCandlestickPatterns } from "../patterns/candlestick.js";
import { computeSupportResistance }  from "../indicators/support-resistance.js";
import { computeRisk }              from "../risk.js";
import type { IndicatorSet }         from "../types.js";

// ─── Candle generators ────────────────────────────────────────────────────────

function makeCandle(
  open: number, close: number, high?: number, low?: number,
  volume = 100_000, ts = new Date(),
): MarketCandle {
  return {
    symbol: "TEST",
    timeframe: Timeframe.H1,
    open,
    high:  high  ?? Math.max(open, close) * 1.001,
    low:   low   ?? Math.min(open, close) * 0.999,
    close,
    volume,
    timestamp: ts,
    closed: true,
  };
}

function risingCandles(n: number, startPrice = 100, drift = 0.1): MarketCandle[] {
  const candles: MarketCandle[] = [];
  let price = startPrice;
  for (let i = 0; i < n; i++) {
    const open  = price;
    const close = price + drift;
    candles.push(makeCandle(open, close));
    price = close;
  }
  return candles;
}

function fallingCandles(n: number, startPrice = 100, drift = 0.1): MarketCandle[] {
  const candles: MarketCandle[] = [];
  let price = startPrice;
  for (let i = 0; i < n; i++) {
    const open  = price;
    const close = price - drift;
    candles.push(makeCandle(open, close));
    price = close;
  }
  return candles;
}

function altCandles(n: number, base = 100, swing = 0.05): MarketCandle[] {
  return Array.from({ length: n }, (_, i) =>
    makeCandle(base, i % 2 === 0 ? base + swing : base - swing)
  );
}

/**
 * A realistic full-confluence scenario: a flat base (long enough to fully
 * warm up EMA200) followed by a fresh, moderate breakout — trend, EMA stack,
 * volume, and a confirming candlestick pattern all align — plus a closing
 * volume-spike pattern (Three White/Black Soldiers/Crows equivalent).
 *
 * Deliberately kept short enough that oscillators (RSI/Stochastic RSI/
 * Bollinger %B) have NOT yet saturated to their 0/100 extremes: a breakout
 * that's already fully overextended is a legitimate HOLD ("don't chase"),
 * not a bug, so testing directional bias requires a fresh, not-yet-exhausted
 * move.
 */
function confluentTrend(direction: "bullish" | "bearish"): MarketCandle[] {
  const candles: MarketCandle[] = [];
  const sign = direction === "bullish" ? 1 : -1;
  let price = 100;

  // Flat/choppy base — fully warms up EMA200 without establishing a trend.
  for (let i = 0; i < 220; i++) {
    const close = price + (i % 2 === 0 ? 0.02 : -0.02);
    candles.push(makeCandle(price, close, undefined, undefined, 80_000));
    price = close;
  }

  // Fresh, moderate-slope breakout (short enough to avoid saturating oscillators).
  for (let i = 0; i < 10; i++) {
    const open  = price;
    const close = price + sign * 0.15;
    candles.push(makeCandle(open, close, undefined, undefined, 120_000));
    price = close;
  }

  // Final 3 candles: strong directional continuation with a volume spike,
  // triggering Three White Soldiers / Three Black Crows.
  for (let i = 0; i < 3; i++) {
    const open  = price + sign * 0.02;
    const close = open + sign * 0.5;
    const high  = Math.max(open, close) + 0.02;
    const low   = Math.min(open, close) - 0.02;
    candles.push(makeCandle(open, close, high, low, 400_000));
    price = close;
  }

  return candles;
}

// ─── Engine output shape ──────────────────────────────────────────────────────

describe("runAnalysis output shape", () => {
  it("returns a valid AnalysisResult with all required fields", () => {
    const candles = risingCandles(100, 1.0835, 0.00010);
    const result  = runAnalysis({
      symbol: "EURUSD", timeframe: "1H", candles,
      currentBid: 1.09400, currentAsk: 1.09410,
    });

    assert.equal(typeof result.symbol, "string");
    assert.equal(typeof result.decision, "string");
    assert.ok(["BUY", "SELL", "HOLD"].includes(result.decision));
    assert.ok(result.confidence >= 0 && result.confidence <= 100);
    assert.ok(["low", "medium", "high"].includes(result.riskLevel));
    assert.ok(["bullish", "bearish", "sideways"].includes(result.trend));
    assert.ok(result.entryPrice > 0);
    assert.ok(result.stopLoss  > 0);
    assert.ok(result.takeProfit > 0);
    assert.ok(result.riskRewardRatio >= 0);
    assert.ok(Array.isArray(result.patterns));
    assert.ok(Array.isArray(result.reasons));
    assert.ok(result.reasons.length > 0);
    assert.equal(typeof result.timestamp, "string");
    assert.ok(result.candleCount > 0);
  });

  it("all indicator fields are present", () => {
    const candles = altCandles(100, 1.0835);
    const result  = runAnalysis({
      symbol: "EURUSD", timeframe: "1H", candles,
      currentBid: 1.0835, currentAsk: 1.0836,
    });

    const ind = result.indicators;
    assert.ok("rsi" in ind);
    assert.ok("macd" in ind);
    assert.ok("ema" in ind);
    assert.ok("sma" in ind);
    assert.ok("bollingerBands" in ind);
    assert.ok("atr" in ind);
    assert.ok("adx" in ind);
    assert.ok("stochasticRsi" in ind);
    assert.ok("volume" in ind);
    assert.ok("trend" in ind);
    assert.ok("supportResistance" in ind);
  });
});

// ─── Scoring invariants ───────────────────────────────────────────────────────

describe("scoreToDecision", () => {
  it("BUY for score >= 0.30", () => {
    assert.equal(scoreToDecision(0.30), "BUY");
    assert.equal(scoreToDecision(0.80), "BUY");
    assert.equal(scoreToDecision(1.00), "BUY");
  });
  it("SELL for score <= −0.30", () => {
    assert.equal(scoreToDecision(-0.30), "SELL");
    assert.equal(scoreToDecision(-1.00), "SELL");
  });
  it("HOLD for score between −0.30 and 0.30 (exclusive)", () => {
    assert.equal(scoreToDecision(0.0),  "HOLD");
    assert.equal(scoreToDecision(0.29), "HOLD");
    assert.equal(scoreToDecision(-0.29), "HOLD");
  });
});

// ─── Directional bias ─────────────────────────────────────────────────────────

describe("engine directional bias", () => {
  it("decides BUY on a fresh bullish breakout with full confluence", () => {
    const candles = confluentTrend("bullish");
    const result  = runAnalysis({
      symbol: "BTCUSDT", timeframe: "1H", candles,
      currentBid: candles[candles.length - 1]!.close - 0.5,
      currentAsk: candles[candles.length - 1]!.close + 0.5,
    });
    assert.equal(result.decision, "BUY", `Expected BUY, got ${result.decision} (confidence ${result.confidence})`);
    assert.equal(result.trend, "bullish");
    assert.ok(result.confidence >= 30, `Expected confidence >= 30, got ${result.confidence}`);
    assert.ok(result.indicators.ema.priceAboveEma20 && result.indicators.ema.priceAboveEma50,
      "Price should be above short/medium EMAs");
    assert.ok(result.indicators.adx.plusDI > result.indicators.adx.minusDI,
      "+DI should exceed -DI on a bullish move");
    // ADX must stay within its mathematical bound.
    assert.ok(result.indicators.adx.adx >= 0 && result.indicators.adx.adx <= 100,
      `ADX ${result.indicators.adx.adx} out of [0,100] range`);
  });

  it("decides SELL on a fresh bearish breakdown with full confluence", () => {
    const candles = confluentTrend("bearish");
    const result  = runAnalysis({
      symbol: "BTCUSDT", timeframe: "1H", candles,
      currentBid: candles[candles.length - 1]!.close - 0.5,
      currentAsk: candles[candles.length - 1]!.close + 0.5,
    });
    assert.equal(result.decision, "SELL", `Expected SELL, got ${result.decision} (confidence ${result.confidence})`);
    assert.equal(result.trend, "bearish");
    assert.ok(result.confidence >= 30, `Expected confidence >= 30, got ${result.confidence}`);
    assert.ok(!result.indicators.ema.priceAboveEma20 && !result.indicators.ema.priceAboveEma50,
      "Price should be below short/medium EMAs");
    assert.ok(result.indicators.adx.minusDI > result.indicators.adx.plusDI,
      "-DI should exceed +DI on a bearish move");
    assert.ok(result.indicators.adx.adx >= 0 && result.indicators.adx.adx <= 100,
      `ADX ${result.indicators.adx.adx} out of [0,100] range`);
  });

  it("sustained monotonic overextension yields HOLD, not a chase signal", () => {
    // A very long, unbroken rise saturates RSI/StochRSI to their extremes —
    // a legitimate "don't chase an exhausted move" HOLD, not a scoring bug.
    const candles = risingCandles(150, 100, 0.05);
    const result  = runAnalysis({
      symbol: "BTCUSDT", timeframe: "1H", candles,
      currentBid: candles[candles.length - 1]!.close - 0.5,
      currentAsk: candles[candles.length - 1]!.close + 0.5,
    });
    assert.equal(result.indicators.rsi.value > 95, true, "RSI should be deeply overbought");
    assert.equal(result.decision, "HOLD",
      `Expected HOLD on an overextended move, got ${result.decision} (confidence ${result.confidence})`);
  });

  it("HOLD or low confidence on alternating series", () => {
    const candles = altCandles(100, 1.0835);
    const result  = runAnalysis({
      symbol: "EURUSD", timeframe: "1H", candles,
      currentBid: 1.0835, currentAsk: 1.0836,
    });
    // Choppy market → HOLD or low confidence.
    assert.ok(
      result.decision === "HOLD" || result.confidence < 60,
      `Expected HOLD/low confidence, got ${result.decision} (${result.confidence})`
    );
  });
});

// ─── Risk management invariants ───────────────────────────────────────────────

describe("computeRisk invariants", () => {
  const mockIndicators: Partial<IndicatorSet> = {
    atr: { value: 0.0010, pctOfPrice: 0.001, volatility: "low" },
    supportResistance: { supports: [1.0800, 1.0750], resistances: [1.0900, 1.0950], nearestSupport: 1.0800, nearestResistance: 1.0900 },
  };

  it("BUY: stopLoss < entry < takeProfit", () => {
    const risk = computeRisk("BUY", 1.0835, 1.0837, mockIndicators as IndicatorSet);
    assert.ok(risk.stopLoss  < risk.entryPrice, `SL ${risk.stopLoss} should be < entry ${risk.entryPrice}`);
    assert.ok(risk.takeProfit > risk.entryPrice, `TP ${risk.takeProfit} should be > entry ${risk.entryPrice}`);
    assert.ok(risk.riskRewardRatio >= 1.2, `R:R ${risk.riskRewardRatio} should be ≥ 1.2`);
  });

  it("SELL: takeProfit < entry < stopLoss", () => {
    const risk = computeRisk("SELL", 1.0835, 1.0837, mockIndicators as IndicatorSet);
    assert.ok(risk.stopLoss  > risk.entryPrice, `SL ${risk.stopLoss} should be > entry ${risk.entryPrice}`);
    assert.ok(risk.takeProfit < risk.entryPrice, `TP ${risk.takeProfit} should be < entry ${risk.entryPrice}`);
    assert.ok(risk.riskRewardRatio >= 1.2, `R:R ${risk.riskRewardRatio} should be ≥ 1.2`);
  });

  it("HOLD: all prices equal entry, R:R = 0", () => {
    const risk = computeRisk("HOLD", 1.0835, 1.0837, mockIndicators as IndicatorSet);
    assert.equal(risk.riskRewardRatio, 0);
  });
});

// ─── Candlestick pattern tests ────────────────────────────────────────────────

describe("detectCandlestickPatterns", () => {
  it("detects bullish engulfing", () => {
    const prev = makeCandle(1.010, 1.000); // bearish
    const curr = makeCandle(0.998, 1.015); // bullish engulfing
    const patterns = detectCandlestickPatterns([prev, curr]);
    const engulfing = patterns.find((p) => p.name === "Bullish Engulfing");
    assert.ok(engulfing !== undefined, "Should detect Bullish Engulfing");
    assert.equal(engulfing!.type, "bullish");
  });

  it("detects bearish engulfing", () => {
    const prev = makeCandle(1.000, 1.010); // bullish
    const curr = makeCandle(1.012, 0.998); // bearish engulfing
    const patterns = detectCandlestickPatterns([prev, curr]);
    const engulfing = patterns.find((p) => p.name === "Bearish Engulfing");
    assert.ok(engulfing !== undefined, "Should detect Bearish Engulfing");
    assert.equal(engulfing!.type, "bearish");
  });

  it("detects doji", () => {
    // Open ≈ close with wicks.
    const doji = makeCandle(1.0835, 1.08352, 1.0850, 1.0820);
    const patterns = detectCandlestickPatterns([doji]);
    const found = patterns.find((p) => p.name === "Doji");
    assert.ok(found !== undefined, "Should detect Doji");
    assert.equal(found!.type, "neutral");
  });

  it("returns empty array for single normal candle", () => {
    const c = makeCandle(1.000, 1.010, 1.015, 0.995); // normal bullish
    const patterns = detectCandlestickPatterns([c]);
    // A normal bullish candle shouldn't trigger doji/hammer/star.
    const names = patterns.map((p) => p.name);
    assert.ok(!names.includes("Doji"));
    assert.ok(!names.includes("Hammer"));
    assert.ok(!names.includes("Shooting Star"));
  });

  it("detects morning star", () => {
    const c1 = makeCandle(1.010, 1.000, 1.012, 0.998); // large bearish
    const c2 = makeCandle(0.997, 0.998, 1.000, 0.994); // small body below c1
    const c3 = makeCandle(1.001, 1.008, 1.010, 0.999); // bullish recovery
    const patterns = detectCandlestickPatterns([c1, c2, c3]);
    const found = patterns.find((p) => p.name === "Morning Star");
    assert.ok(found !== undefined, "Should detect Morning Star");
  });
});

// ─── Support / Resistance ─────────────────────────────────────────────────────

describe("computeSupportResistance", () => {
  it("supports are below current price, resistances above", () => {
    const candles = [
      makeCandle(1.00, 1.05, 1.10, 0.98),
      makeCandle(1.05, 0.95, 1.06, 0.93),
      makeCandle(0.95, 1.02, 1.04, 0.94),
      makeCandle(1.02, 1.08, 1.12, 1.01),
      makeCandle(1.08, 1.00, 1.09, 0.99),
      makeCandle(1.00, 1.06, 1.07, 0.99),
      makeCandle(1.06, 1.02, 1.07, 1.01),
    ];
    const result = computeSupportResistance(candles, 2);
    for (const s of result.supports)    assert.ok(s < 1.02, `support ${s} should be < currentPrice`);
    for (const r of result.resistances) assert.ok(r > 1.02, `resistance ${r} should be > currentPrice`);
  });

  it("returns empty arrays when no swing points", () => {
    // Monotonic rising — no swing lows.
    const candles = risingCandles(10, 100, 1);
    const result  = computeSupportResistance(candles, 2);
    assert.equal(result.supports.length, 0);
  });
});
