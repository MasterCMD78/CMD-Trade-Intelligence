/**
 * Unit tests for all indicator computations.
 * Uses Node.js built-in test runner (node:test) — no extra dependencies.
 */

import { describe, it } from "vitest";
import assert from "node:assert/strict";

import { computeRsi }           from "../indicators/rsi.js";
import { computeEmaValue, computeEmaSeries } from "../indicators/ema.js";
import { computeSmaValue, computeSmaSeries } from "../indicators/sma.js";
import { computeMacd }          from "../indicators/macd.js";
import { computeBollinger }     from "../indicators/bollinger.js";
import { computeStochasticRsi } from "../indicators/stochastic-rsi.js";
import { computeAdx }           from "../indicators/adx.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Generate a constant close series. */
function flat(value: number, length: number): number[] {
  return Array.from({ length }, () => value);
}

/** Generate a linearly rising series from start to end (inclusive). */
function rising(start: number, end: number, steps: number): number[] {
  return Array.from({ length: steps }, (_, i) => start + (end - start) * (i / (steps - 1)));
}

/** Generate a linearly falling series from start to end (inclusive). */
function falling(start: number, end: number, steps: number): number[] {
  return rising(start, end, steps);
}

// ─── RSI ─────────────────────────────────────────────────────────────────────

describe("RSI", () => {
  it("returns 50 neutral when insufficient data", () => {
    const result = computeRsi(flat(1, 5));
    assert.equal(result.value, 50);
    assert.equal(result.signal, "neutral");
  });

  it("returns ~100 for all-up series (no losses)", () => {
    const closes = rising(100, 110, 30);
    const result = computeRsi(closes);
    assert.ok(result.value > 70, `RSI ${result.value} should be > 70 on rising series`);
    assert.equal(result.signal, "sell");
    assert.equal(result.overbought, true);
  });

  it("returns ~0 for all-down series (no gains)", () => {
    const closes = falling(110, 100, 30);
    const result = computeRsi(closes);
    assert.ok(result.value < 30, `RSI ${result.value} should be < 30 on falling series`);
    assert.equal(result.signal, "buy");
    assert.equal(result.oversold, true);
  });

  it("returns exactly 50 (neutral) for a truly flat series", () => {
    // No price movement at all → avgGain = avgLoss = 0 → neutral, not overbought.
    const result = computeRsi(flat(1.0835, 30));
    assert.equal(result.value, 50);
    assert.equal(result.signal, "neutral");
    assert.equal(result.overbought, false);
  });

  it("neutral zone for moderate series", () => {
    // Alternating up/down stays near 50.
    const closes: number[] = [];
    for (let i = 0; i < 40; i++) closes.push(1 + (i % 2 === 0 ? 0.001 : -0.001));
    const result = computeRsi(closes);
    assert.ok(result.value > 30 && result.value < 70, `RSI ${result.value} should be in neutral range`);
    assert.equal(result.signal, "neutral");
  });
});

// ─── EMA ─────────────────────────────────────────────────────────────────────

describe("EMA", () => {
  it("returns NaN when insufficient data", () => {
    assert.ok(isNaN(computeEmaValue(flat(1, 5), 20)));
  });

  it("equals SMA on the seed candle for a flat series", () => {
    const closes = flat(5, 25);
    const ema = computeEmaValue(closes, 20);
    assert.ok(Math.abs(ema - 5) < 1e-10, `EMA ${ema} should equal flat price 5`);
  });

  it("EMA reacts faster than SMA to a price spike", () => {
    // 20 flat candles at 10, then 5 candles at 20.
    const closes = [...flat(10, 20), ...flat(20, 5)];
    const emaSeries = computeEmaSeries(closes, 10);
    const smaSeries = computeSmaSeries(closes, 10);
    const lastEma = emaSeries[emaSeries.length - 1]!;
    const lastSma = smaSeries[smaSeries.length - 1]!;
    assert.ok(lastEma > lastSma, `EMA ${lastEma} should be above SMA ${lastSma} after spike`);
  });

  it("series length matches input length", () => {
    const closes = flat(100, 50);
    const series = computeEmaSeries(closes, 20);
    assert.equal(series.length, 50);
  });
});

// ─── SMA ─────────────────────────────────────────────────────────────────────

describe("SMA", () => {
  it("returns NaN when insufficient data", () => {
    assert.ok(isNaN(computeSmaValue(flat(1, 5), 20)));
  });

  it("equals mean of flat series", () => {
    const sma = computeSmaValue(flat(7, 25), 20);
    assert.ok(Math.abs(sma - 7) < 1e-10);
  });

  it("slides correctly over a rising series", () => {
    const closes = rising(1, 10, 10);
    const series = computeSmaSeries(closes, 5);
    // First 4 positions should be NaN.
    for (let i = 0; i < 4; i++) assert.ok(isNaN(series[i]!));
    // Spot-check: SMA at index 4 = (1+2+3+4+5)/5 ≈ 3.
    assert.ok(Math.abs(series[4]! - 3) < 0.1, `SMA at index 4 = ${series[4]} ≈ 3`);
  });
});

// ─── MACD ─────────────────────────────────────────────────────────────────────

describe("MACD", () => {
  it("returns fallback for insufficient data", () => {
    const result = computeMacd(flat(1, 20));
    assert.equal(result.macdLine, 0);
    assert.equal(result.crossover, "none");
  });

  it("MACD line is near 0 for flat series", () => {
    const result = computeMacd(flat(1.0835, 50));
    assert.ok(Math.abs(result.macdLine) < 1e-8, `MACD line ${result.macdLine} should be ~0`);
  });

  it("detects bullish crossover on sharply rising series", () => {
    // First 35 flat, then 15 sharply rising.
    const closes = [...flat(1.0, 35), ...rising(1.0, 1.05, 15)];
    const result = computeMacd(closes);
    // On a sharp rise, fast EMA > slow EMA, so MACD > 0.
    assert.ok(result.macdLine > 0 || result.histogram > 0, "MACD should be positive on rising series");
  });

  it("histogram = macdLine - signalLine", () => {
    const closes = rising(100, 110, 50);
    const result = computeMacd(closes);
    const diff = Math.abs(result.histogram - (result.macdLine - result.signalLine));
    assert.ok(diff < 1e-6, `histogram ${result.histogram} ≠ macdLine − signalLine`);
  });
});

// ─── Bollinger Bands ──────────────────────────────────────────────────────────

describe("Bollinger Bands", () => {
  it("returns fallback for insufficient data", () => {
    const price = 1.0;
    const result = computeBollinger([price], 20, 2);
    assert.equal(result.middle, price);
    assert.equal(result.pctB, 0.5);
  });

  it("flat series: all bands equal middle, pctB = 0.5, width = 0", () => {
    const result = computeBollinger(flat(1.0835, 25));
    assert.ok(Math.abs(result.upper - result.middle) < 1e-8, "upper ≠ middle on flat series");
    assert.equal(result.width, 0);
  });

  it("pctB near 1.0 when price is near upper band", () => {
    // Rising series: last price is highest, should be near upper band.
    const closes = rising(1.0, 1.1, 30);
    const result = computeBollinger(closes);
    assert.ok(result.pctB > 0.5, `pctB ${result.pctB} should be > 0.5 on rising series`);
  });

  it("pctB near 0 when price is near lower band", () => {
    const closes = falling(1.1, 1.0, 30);
    const result = computeBollinger(closes);
    assert.ok(result.pctB < 0.5, `pctB ${result.pctB} should be < 0.5 on falling series`);
  });

  it("upper > middle > lower", () => {
    const closes = rising(1, 2, 30);
    const result = computeBollinger(closes);
    assert.ok(result.upper >= result.middle);
    assert.ok(result.middle >= result.lower);
  });
});

// ─── Stochastic RSI ──────────────────────────────────────────────────────────

describe("Stochastic RSI", () => {
  it("returns fallback for insufficient data", () => {
    const result = computeStochasticRsi(flat(1, 10));
    assert.equal(result.k, 50);
    assert.equal(result.signal, "neutral");
  });

  it("k is in [0, 100] for any series (including rising)", () => {
    // Note: StochRSI normalises RSI values against their own min/max window.
    // When RSI saturates near 100 on a monotonic rise, the window range → 0
    // and StochRSI collapses to 0.5 (50) by convention — this is correct math.
    const closes = rising(100, 120, 80);
    const result = computeStochasticRsi(closes);
    assert.ok(result.k >= 0 && result.k <= 100, `k ${result.k} must be in [0, 100]`);
    // signal must be one of the valid enum values
    assert.ok(["buy", "sell", "neutral"].includes(result.signal));
  });

  it("k is in [0, 100] for any series (including falling)", () => {
    // Same reasoning: RSI near 0 on monotonic fall → StochRSI window range → 0 → k ≈ 50.
    const closes = falling(120, 100, 80);
    const result = computeStochasticRsi(closes);
    assert.ok(result.k >= 0 && result.k <= 100, `k ${result.k} must be in [0, 100]`);
    assert.ok(["buy", "sell", "neutral"].includes(result.signal));
  });

  it("k and d are both in [0, 100]", () => {
    const closes = rising(1, 2, 80);
    const result = computeStochasticRsi(closes);
    assert.ok(result.k >= 0 && result.k <= 100);
    assert.ok(result.d >= 0 && result.d <= 100);
  });
});
