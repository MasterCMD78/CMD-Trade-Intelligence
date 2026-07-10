/**
 * Multi-Timeframe Engine — integration test suite.
 *
 * Covers:
 *   - Full MTF result shape and fields
 *   - Bullish scenario
 *   - Bearish scenario
 *   - Mixed/partial data
 *   - Missing timeframe data gracefully handled
 *   - AI confidence adjustment reflects confluence
 *   - Reason generation
 */

import { describe, it } from "vitest";
import assert from "node:assert/strict";
import type { MarketCandle } from "../../../market-data/types.js";
import { Timeframe } from "../../../market-data/types.js";
import { buildMultiTimeframeResult } from "../engine.js";
import type { MTFKey } from "../types.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function candle(
  high: number, low: number, close: number, open: number, ts: number,
): MarketCandle {
  return {
    symbol: "TEST",
    high, low, close, open,
    volume: 1000,
    timestamp: new Date(ts),
    timeframe: Timeframe.H1,
    closed: true,
  };
}

/**
 * Build a realistic bullish trend candle series:
 * HH/HL pattern — each swing is higher than the last.
 */
function bullishCandles(n = 50): MarketCandle[] {
  const candles: MarketCandle[] = [];
  for (let i = 0; i < n; i++) {
    // Rising baseline with a slow oscillation so swingLength=2 pivots are
    // clean local extrema — each swing high/low prints higher than the last
    // (HH/HL), producing a confirmed bullish trend.
    const price = 100 + i * 0.6 + 4 * Math.sin(i / 1.5);
    const high  = price + 1;
    const low   = price - 1;
    const open  = price - 0.2;
    const close = price + 0.2;
    candles.push(candle(high, low, close, open, Date.now() + i * 60_000));
  }
  return candles;
}

/**
 * Build a bearish trend: LH/LL pattern.
 */
function bearishCandles(n = 50): MarketCandle[] {
  const candles: MarketCandle[] = [];
  for (let i = 0; i < n; i++) {
    // Falling baseline with a slow oscillation — mirror of bullishCandles —
    // produces confirmed LH/LL swings (bearish trend).
    const price = 200 - i * 0.6 - 4 * Math.sin(i / 1.5);
    const high  = price + 1;
    const low   = price - 1;
    const open  = price + 0.2;
    const close = price - 0.2;
    candles.push(candle(high, low, close, open, Date.now() + i * 60_000));
  }
  return candles;
}

/** Flat/ranging candles. */
function sidewaysCandles(n = 50): MarketCandle[] {
  const candles: MarketCandle[] = [];
  for (let i = 0; i < n; i++) {
    const delta = (i % 2 === 0) ? 0.3 : -0.3;
    candles.push(candle(100.5, 99.5, 100 + delta, 100, Date.now() + i * 60_000));
  }
  return candles;
}

// ─── Result shape ─────────────────────────────────────────────────────────────

describe("buildMultiTimeframeResult — result shape", () => {
  it("returns all required top-level fields", () => {
    const candlesByKey: Partial<Record<MTFKey, MarketCandle[]>> = {
      h1:    bullishCandles(),
      h4:    bullishCandles(),
      daily: bullishCandles(),
    };
    const result = buildMultiTimeframeResult(candlesByKey, 125);

    assert.ok("timeframes" in result,           "timeframes should exist");
    assert.ok("alignmentType" in result,        "alignmentType should exist");
    assert.ok("alignmentScore" in result,       "alignmentScore should exist");
    assert.ok("overallBias" in result,          "overallBias should exist");
    assert.ok("institutionalBias" in result,    "institutionalBias should exist");
    assert.ok("higherTimeframeBias" in result,  "higherTimeframeBias should exist");
    assert.ok("intermediateBias" in result,     "intermediateBias should exist");
    assert.ok("lowerTimeframeBias" in result,   "lowerTimeframeBias should exist");
    assert.ok("confluenceScore" in result,      "confluenceScore should exist");
    assert.ok("confidenceAdjustment" in result, "confidenceAdjustment should exist");
    assert.ok("reasons" in result,              "reasons should exist");
    assert.ok("availableCount" in result,       "availableCount should exist");
  });

  it("timeframes map has entries for provided TF keys", () => {
    const candlesByKey: Partial<Record<MTFKey, MarketCandle[]>> = {
      h1: bullishCandles(20),
      h4: bullishCandles(20),
    };
    const result = buildMultiTimeframeResult(candlesByKey, 125);

    assert.ok(result.timeframes["h1"] !== undefined, "h1 should be in timeframes");
    assert.ok(result.timeframes["h4"] !== undefined, "h4 should be in timeframes");
    assert.equal(result.availableCount, 2);
  });

  it("each TimeframeSnapshot has all required fields", () => {
    const result = buildMultiTimeframeResult({ h1: bullishCandles(20) }, 125);
    const snap = result.timeframes["h1"];
    assert.ok(snap !== undefined);
    assert.ok("trend" in snap!);
    assert.ok("marketPhase" in snap!);
    assert.ok("bos" in snap!);
    assert.ok("choch" in snap!);
    assert.ok("liquidity" in snap!);
    assert.ok("orderBlocks" in snap!);
    assert.ok("fairValueGaps" in snap!);
    assert.ok("premiumDiscount" in snap!);
    assert.ok("candleCount" in snap!);
  });
});

// ─── Alignment score boundaries ───────────────────────────────────────────────

describe("buildMultiTimeframeResult — alignment score", () => {
  it("alignmentScore is 0–100", () => {
    const result1 = buildMultiTimeframeResult({ h1: bullishCandles(), h4: bullishCandles() }, 125);
    const result2 = buildMultiTimeframeResult({ h1: bearishCandles(), h4: bearishCandles() }, 125);

    assert.ok(result1.alignmentScore >= 0 && result1.alignmentScore <= 100);
    assert.ok(result2.alignmentScore >= 0 && result2.alignmentScore <= 100);
  });

  it("bearish TF scenarios produce lower alignmentScore than bullish", () => {
    const bullResult = buildMultiTimeframeResult({
      weekly: bullishCandles(30), daily: bullishCandles(30),
      h4: bullishCandles(30), h1: bullishCandles(30),
    }, 125);
    const bearResult = buildMultiTimeframeResult({
      weekly: bearishCandles(30), daily: bearishCandles(30),
      h4: bearishCandles(30), h1: bearishCandles(30),
    }, 125);

    assert.ok(bullResult.alignmentScore > bearResult.alignmentScore,
      "all-bullish scenario must score higher than all-bearish");
  });
});

// ─── Confluence score ─────────────────────────────────────────────────────────

describe("buildMultiTimeframeResult — confluenceScore", () => {
  it("confluenceScore is 0–100", () => {
    const result = buildMultiTimeframeResult({ h1: bullishCandles(), h4: bullishCandles() }, 125);
    assert.ok(result.confluenceScore >= 0 && result.confluenceScore <= 100);
  });

  it("confidenceAdjustment is in [-20, +20]", () => {
    const result = buildMultiTimeframeResult({
      weekly: bullishCandles(30), daily: bullishCandles(30), h4: bullishCandles(30),
    }, 125);
    assert.ok(result.confidenceAdjustment >= -20 && result.confidenceAdjustment <= 20);
  });
});

// ─── Graceful handling of missing data ────────────────────────────────────────

describe("buildMultiTimeframeResult — missing/partial data", () => {
  it("does not crash with empty candle map", () => {
    assert.doesNotThrow(() => {
      buildMultiTimeframeResult({}, 100);
    });
  });

  it("skips TFs with fewer than 10 candles", () => {
    const result = buildMultiTimeframeResult({
      h1: bullishCandles(5),   // too few → should be skipped
      h4: bullishCandles(30),  // enough → should be included
    }, 125);

    assert.equal(result.timeframes["h1"], undefined, "h1 with 5 candles should be skipped");
    assert.ok(result.timeframes["h4"] !== undefined, "h4 with 30 candles should be included");
    assert.equal(result.availableCount, 1);
  });

  it("reasons is an array even with empty data", () => {
    const result = buildMultiTimeframeResult({}, 100);
    assert.ok(Array.isArray(result.reasons));
  });

  it("institutionalBias equals overallBias", () => {
    const result = buildMultiTimeframeResult({ h1: bullishCandles(30) }, 125);
    assert.equal(result.institutionalBias, result.overallBias);
  });
});

// ─── Reasons generation ───────────────────────────────────────────────────────

describe("buildMultiTimeframeResult — reasons", () => {
  it("generates at least one reason when data is available", () => {
    const result = buildMultiTimeframeResult({
      daily: bullishCandles(30),
      h4:    bullishCandles(30),
    }, 125);
    assert.ok(result.reasons.length >= 1, "should generate at least one reason");
  });

  it("includes institutional bias reason", () => {
    const result = buildMultiTimeframeResult({
      weekly: bullishCandles(30), daily: bullishCandles(30),
    }, 125);
    const hasbiasReason = result.reasons.some((r) => r.toLowerCase().includes("institutional bias"));
    assert.ok(hasbiasReason, "should include an institutional bias reason");
  });
});
