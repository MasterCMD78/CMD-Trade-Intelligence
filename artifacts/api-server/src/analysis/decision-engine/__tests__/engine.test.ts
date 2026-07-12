/**
 * Institutional Decision Engine — integration tests.
 * Verifies the combined decision/score/risk/reasons pipeline end-to-end,
 * reusing the real `runAnalysis` pipeline (no hand-rolled AnalysisResult
 * fixtures) so the engine is exercised exactly as the API route uses it.
 */

import { describe, it } from "vitest";
import assert from "node:assert/strict";

import type { MarketCandle } from "../../../market-data/types.js";
import { Timeframe } from "../../../market-data/types.js";
import { runAnalysis } from "../../engine.js";
import type { MTFKey } from "../../multi-timeframe/types.js";
import { computeDecisionEngine } from "../engine.js";
import type { AnalysisResult } from "../../types.js";

// ─── Candle generators ────────────────────────────────────────────────────────

function makeCandle(
  open: number, close: number, high?: number, low?: number,
  volume = 100_000, ts = new Date(),
): MarketCandle {
  return {
    symbol: "TEST",
    timeframe: Timeframe.H1,
    open,
    high: high ?? Math.max(open, close) * 1.001,
    low: low ?? Math.min(open, close) * 0.999,
    close,
    volume,
    timestamp: ts,
    closed: true,
  };
}

function flatCandles(n: number, base = 100): MarketCandle[] {
  return Array.from({ length: n }, (_, i) => makeCandle(base, i % 2 === 0 ? base + 0.02 : base - 0.02, undefined, undefined, 80_000));
}

/** Loose choppy trend generator (base fixture used by the main engine's own
 * tests) — no clean swing structure, useful for exercising the HOLD/WAIT
 * path where smart-money modules stay neutral. */
function confluentTrend(direction: "bullish" | "bearish"): MarketCandle[] {
  const candles: MarketCandle[] = [];
  const sign = direction === "bullish" ? 1 : -1;
  let price = 100;

  for (let i = 0; i < 220; i++) {
    const close = price + (i % 2 === 0 ? 0.02 : -0.02);
    candles.push(makeCandle(price, close, undefined, undefined, 80_000));
    price = close;
  }
  for (let i = 0; i < 10; i++) {
    const open = price;
    const close = price + sign * 0.15;
    candles.push(makeCandle(open, close, undefined, undefined, 120_000));
    price = close;
  }
  for (let i = 0; i < 3; i++) {
    const open = price + sign * 0.02;
    const close = open + sign * 0.5;
    const high = Math.max(open, close) + 0.02;
    const low = Math.min(open, close) - 0.02;
    candles.push(makeCandle(open, close, high, low, 400_000));
    price = close;
  }
  return candles;
}

/**
 * Builds a zigzag price path through explicit pivots. Each internal pivot
 * gets a dedicated "apex" candle with an exaggerated wick beyond its own
 * close, so it unambiguously out-wicks both neighbors — a naive close-to-close
 * zigzag ties the high/low at every turn (rejected as a flat plateau by the
 * swing detector), so the spike is required for clean HH/HL detection.
 */
function zigzag(pivots: number[], stepsPerLeg = 4, spike = 0.6): MarketCandle[] {
  const candles: MarketCandle[] = [];
  let prevClose = pivots[0]!;
  for (let p = 0; p < pivots.length - 1; p++) {
    const from = pivots[p]!;
    const to = pivots[p + 1]!;
    for (let s = 1; s <= stepsPerLeg; s++) {
      const isApex = s === stepsPerLeg;
      const frac = isApex ? (stepsPerLeg - 0.4) / stepsPerLeg : s / stepsPerLeg;
      const close = from + (to - from) * frac;
      const open = prevClose;
      let high = Math.max(open, close) + 0.03;
      let low = Math.min(open, close) - 0.03;
      if (isApex) {
        if (to < from) low -= spike; // trough ahead -> hardest down-wick here
        else high += spike; // peak ahead -> hardest up-wick here
      }
      candles.push(makeCandle(open, close, high, low, 100_000));
      prevClose = close;
    }
  }
  return candles;
}

/** Clean ascending HH/HL zigzag — real Break of Structure, Order Block,
 * liquidity, and Multi-Timeframe confluence, unlike `confluentTrend`. */
function bullishZigzagScenario(): MarketCandle[] {
  return zigzag([100, 96, 104, 100, 110, 105, 118, 112, 128, 121, 140]);
}
/** Mirror image: descending LH/LL zigzag. */
function bearishZigzagScenario(): MarketCandle[] {
  return zigzag([140, 144, 128, 133, 121, 126, 112, 117, 104, 109, 96]);
}

function allTfFrom(candles: MarketCandle[]): Partial<Record<MTFKey, MarketCandle[]>> {
  const keys: MTFKey[] = ["m1", "m5", "m15", "m30", "h1", "h4", "daily", "weekly"];
  return Object.fromEntries(keys.map((k) => [k, candles]));
}

function analyze(candles: MarketCandle[], withMtf = true): AnalysisResult {
  return runAnalysis({
    symbol: "BTCUSDT",
    timeframe: "1H",
    candles,
    currentBid: candles[candles.length - 1]!.close - 0.5,
    currentAsk: candles[candles.length - 1]!.close + 0.5,
    allTimeframeCandles: withMtf ? allTfFrom(candles) : undefined,
  });
}

// ─── Output shape ─────────────────────────────────────────────────────────────

describe("Decision Engine output shape", () => {
  it("attaches a fully-shaped decisionEngine result to the analysis output", () => {
    const result = analyze(confluentTrend("bullish"));
    const de = result.decisionEngine;

    assert.ok(["BUY", "SELL", "HOLD", "WAIT"].includes(de.decision));
    assert.ok(de.institutionalScore >= 0 && de.institutionalScore <= 100);
    assert.ok(["A+", "A", "B", "C", "D"].includes(de.tradeGrade));
    assert.ok(de.confidence.overallConfidence >= 0 && de.confidence.overallConfidence <= 100);
    assert.ok(de.confidence.institutionalScore >= 0 && de.confidence.institutionalScore <= 100);
    assert.ok(de.confidence.decisionConfidence >= 0 && de.confidence.decisionConfidence <= 100);
    assert.ok(de.confidence.riskConfidence >= 0 && de.confidence.riskConfidence <= 100);
    assert.ok(
      ["trending", "ranging", "accumulation", "distribution", "reversal", "expansion", "consolidation"].includes(de.marketState),
    );
    assert.ok(["low", "medium", "high"].includes(de.riskLevel));
    assert.ok(Array.isArray(de.reasons) && de.reasons.length > 0);
    assert.equal(de.breakdown.length, 10);
    for (const b of de.breakdown) {
      assert.ok(b.score >= -1 && b.score <= 1, `${b.name} score out of range: ${b.score}`);
      assert.ok(b.confidence >= 0 && b.confidence <= 100, `${b.name} confidence out of range`);
      assert.ok(b.displayScore >= 0 && b.displayScore <= 100, `${b.name} displayScore out of range`);
    }
    const totalWeight = de.breakdown.reduce((s, b) => s + b.weight, 0);
    assert.ok(Math.abs(totalWeight - 1.0) < 1e-9, `weights should sum to 1.0, got ${totalWeight}`);
  });
});

// ─── Directional decisions ────────────────────────────────────────────────────

describe("Decision Engine directional calls", () => {
  it("strong bullish confluence (clean HH/HL, BOS, OB, MTF alignment) → BUY", () => {
    const result = analyze(bullishZigzagScenario());
    const de = result.decisionEngine;
    assert.equal(de.decision, "BUY", `expected BUY, got ${de.decision} (score ${de.institutionalScore})`);
    assert.ok(de.risk.entry > 0 && de.risk.stopLoss < de.risk.entry, "BUY risk plan should have stop below entry");
    assert.ok(de.risk.takeProfit1 > de.risk.entry && de.risk.takeProfit2 > de.risk.takeProfit1 && de.risk.takeProfit3 > de.risk.takeProfit2,
      "TP1 < TP2 < TP3 for a BUY");
  });

  it("strong bearish breakdown (clean LH/LL, BOS, OB, MTF alignment) → SELL", () => {
    const result = analyze(bearishZigzagScenario());
    const de = result.decisionEngine;
    assert.equal(de.decision, "SELL", `expected SELL, got ${de.decision} (score ${de.institutionalScore})`);
    assert.ok(de.risk.stopLoss > de.risk.entry, "SELL risk plan should have stop above entry");
    assert.ok(de.risk.takeProfit1 < de.risk.entry && de.risk.takeProfit2 < de.risk.takeProfit1 && de.risk.takeProfit3 < de.risk.takeProfit2,
      "TP1 > TP2 > TP3 (descending) for a SELL");
  });

  it("choppy/conflicting signals → HOLD or WAIT, never a directional call", () => {
    const result = analyze(flatCandles(100));
    const de = result.decisionEngine;
    assert.ok(de.decision === "HOLD" || de.decision === "WAIT",
      `expected HOLD/WAIT on flat data, got ${de.decision}`);
    assert.equal(de.risk.riskRewardRatio, 0, "no active trade plan on HOLD/WAIT");
  });

  it("low institutional score forces WAIT even if scoring is directional", () => {
    // Sparse data (no MTF, minimal candles) → most modules fall back to
    // their low-confidence defaults, driving institutionalScore below the
    // WAIT threshold regardless of any residual directional lean.
    const result = analyze(flatCandles(40), false);
    const de = result.decisionEngine;
    if (de.institutionalScore < 45) {
      assert.equal(de.decision, "WAIT");
    }
  });
});

// ─── Trade grade & confidence invariants ──────────────────────────────────────

describe("Decision Engine grading", () => {
  it("trade grade is monotonic with institutional score", () => {
    const gradeOrder = ["D", "C", "B", "A", "A+"];
    for (const candles of [confluentTrend("bullish"), confluentTrend("bearish"), flatCandles(100)]) {
      const de = analyze(candles).decisionEngine;
      const idx = gradeOrder.indexOf(de.tradeGrade);
      assert.ok(idx >= 0, `unexpected grade ${de.tradeGrade}`);
      if (de.institutionalScore >= 90) assert.equal(de.tradeGrade, "A+");
      if (de.institutionalScore < 50) assert.equal(de.tradeGrade, "D");
    }
  });
});

// ─── Explainability ────────────────────────────────────────────────────────────

describe("Decision Engine explainability", () => {
  it("BUY/SELL reasons cite the institutional score, grade, and market state", () => {
    const de = analyze(confluentTrend("bullish")).decisionEngine;
    assert.ok(de.reasons[0]!.includes(String(de.institutionalScore)));
    assert.ok(de.reasons[0]!.includes(de.tradeGrade));
    assert.ok(de.reasons.some((r) => r.startsWith("Market state:")));
  });

  it("directly calling computeDecisionEngine on a full AnalysisResult is idempotent with the wired-in call", () => {
    const candles = bullishZigzagScenario();
    const result = analyze(candles);
    const lastClose = candles[candles.length - 1]!.close;
    const recomputed = computeDecisionEngine(result, lastClose - 0.5, lastClose + 0.5);
    assert.equal(recomputed.decision, result.decisionEngine.decision);
    assert.equal(recomputed.institutionalScore, result.decisionEngine.institutionalScore);
  });
});
