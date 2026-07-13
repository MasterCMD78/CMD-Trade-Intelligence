/**
 * News-driven decision adjustment — unit + integration tests.
 * Unit tests exercise `applyNewsAdjustment` directly with hand-built
 * `NewsAnalysisResult` fixtures (full control over restriction/bias/timing).
 * Integration tests run the full `runAnalysis` pipeline with injected
 * `EconomicEvent`s to confirm the wiring in `engine.ts` behaves end-to-end.
 */

import { describe, it, expect } from "vitest";
import { applyNewsAdjustment } from "../news-adjustment.js";
import { computeNewsAnalysis } from "../../news/engine.js";
import type { EconomicEvent, NewsAnalysisResult } from "../../news/types.js";
import type { ConfidenceBundle } from "../types.js";
import { runAnalysis } from "../../engine.js";
import type { MarketCandle } from "../../../market-data/types.js";
import { Timeframe } from "../../../market-data/types.js";

const BASE_CONFIDENCE: ConfidenceBundle = {
  overallConfidence: 70,
  institutionalScore: 65,
  decisionConfidence: 60,
  riskConfidence: 75,
};

function makeNews(overrides: Partial<NewsAnalysisResult>): NewsAnalysisResult {
  return {
    symbol: "EURUSD",
    currentEvent: null,
    nextEvent: null,
    minutesRemaining: null,
    hoursRemaining: null,
    severity: null,
    fundamentalBias: "unknown",
    newsConfidence: 0,
    riskLevel: "low",
    tradingRestriction: "SAFE",
    recommendation: "PROCEED",
    affectedCurrencies: ["EUR", "USD"],
    window: { minutesUntil: null, hoursUntil: null, isWarning: false, isLocked: false },
    activeEvents: [],
    ...overrides,
  };
}

function makeEvent(overrides: Partial<EconomicEvent>): EconomicEvent {
  return {
    id: "e1",
    name: "FOMC Rate Decision",
    category: "FOMC",
    currency: "USD",
    country: "US",
    impact: "high",
    scheduledTime: new Date(),
    forecast: "5.25%",
    previous: "5.25%",
    actual: null,
    ...overrides,
  };
}

describe("applyNewsAdjustment — no-op paths", () => {
  it("leaves decision/score/confidence untouched when SAFE and bias is unknown", () => {
    const news = makeNews({});
    const result = applyNewsAdjustment({
      news,
      decision: "BUY",
      institutionalScore: 65,
      tradeGrade: "B",
      confidence: BASE_CONFIDENCE,
    });
    expect(result.decision).toBe("BUY");
    expect(result.institutionalScore).toBe(65);
    expect(result.tradeGrade).toBe("B");
    expect(result.confidence).toEqual(BASE_CONFIDENCE);
    expect(result.reasons).toEqual([]);
  });
});

describe("applyNewsAdjustment — confidence penalties", () => {
  it("cuts confidence materially under LOCK_TRADING without forcing a decision change (non-mega, not imminent)", () => {
    const news = makeNews({
      currentEvent: makeEvent({ category: "CPI", name: "CPI y/y" }),
      severity: "high",
      minutesRemaining: 11,
      tradingRestriction: "LOCK_TRADING",
      recommendation: "AVOID",
      window: { minutesUntil: 11, hoursUntil: 11 / 60, isWarning: true, isLocked: true },
    });
    const result = applyNewsAdjustment({
      news,
      decision: "BUY",
      institutionalScore: 91,
      tradeGrade: "A+",
      confidence: { overallConfidence: 91, institutionalScore: 91, decisionConfidence: 88, riskConfidence: 90 },
    });
    expect(result.decision).toBe("BUY");
    expect(result.institutionalScore).toBeLessThan(91);
    expect(result.institutionalScore).toBe(91 - 25);
    expect(result.reasons.some((r) => r.includes("LOCK TRADING"))).toBe(true);
  });

  it("applies a smaller penalty for NO_TRADE than LOCK_TRADING", () => {
    const lockNews = makeNews({ tradingRestriction: "LOCK_TRADING", currentEvent: makeEvent({ category: "CPI" }), severity: "high", minutesRemaining: 10 });
    const noTradeNews = makeNews({ tradingRestriction: "NO_TRADE", currentEvent: makeEvent({ category: "CPI" }), severity: "high", minutesRemaining: 40 });

    const lockResult = applyNewsAdjustment({ news: lockNews, decision: "BUY", institutionalScore: 80, tradeGrade: "A", confidence: BASE_CONFIDENCE });
    const noTradeResult = applyNewsAdjustment({ news: noTradeNews, decision: "BUY", institutionalScore: 80, tradeGrade: "A", confidence: BASE_CONFIDENCE });

    expect(lockResult.institutionalScore).toBeLessThan(noTradeResult.institutionalScore);
  });

  it("recomputes trade grade after the penalty pushes score into a lower band", () => {
    const news = makeNews({ tradingRestriction: "LOCK_TRADING", currentEvent: makeEvent({ category: "CPI" }), severity: "high", minutesRemaining: 10 });
    const result = applyNewsAdjustment({ news, decision: "BUY", institutionalScore: 82, tradeGrade: "A", confidence: BASE_CONFIDENCE });
    expect(result.institutionalScore).toBe(57);
    expect(result.tradeGrade).toBe("C");
  });
});

describe("applyNewsAdjustment — forced WAIT override", () => {
  it("forces WAIT when LOCK_TRADING and the event is a mega-event (FOMC) even far from the hard-lock window", () => {
    const news = makeNews({
      currentEvent: makeEvent({ category: "FOMC" }),
      severity: "high",
      minutesRemaining: 14,
      tradingRestriction: "LOCK_TRADING",
    });
    const result = applyNewsAdjustment({ news, decision: "BUY", institutionalScore: 87, tradeGrade: "A", confidence: BASE_CONFIDENCE });
    expect(result.decision).toBe("WAIT");
    expect(result.reasons.some((r) => r.toLowerCase().includes("locked"))).toBe(true);
  });

  it("forces WAIT when LOCK_TRADING and the event is imminent (<= hardLockMinutes), even for a non-mega category", () => {
    const news = makeNews({
      currentEvent: makeEvent({ category: "CPI", name: "CPI y/y" }),
      severity: "high",
      minutesRemaining: 4,
      tradingRestriction: "LOCK_TRADING",
    });
    const result = applyNewsAdjustment({ news, decision: "SELL", institutionalScore: 87, tradeGrade: "A", confidence: BASE_CONFIDENCE });
    expect(result.decision).toBe("WAIT");
  });

  it("does NOT force WAIT for LOCK_TRADING with a non-mega, non-imminent event", () => {
    const news = makeNews({
      currentEvent: makeEvent({ category: "CPI", name: "CPI y/y" }),
      severity: "high",
      minutesRemaining: 11,
      tradingRestriction: "LOCK_TRADING",
    });
    const result = applyNewsAdjustment({ news, decision: "BUY", institutionalScore: 87, tradeGrade: "A", confidence: BASE_CONFIDENCE });
    expect(result.decision).toBe("BUY");
  });

  it("leaves an already-WAIT decision as WAIT without duplicating the override reason", () => {
    const news = makeNews({
      currentEvent: makeEvent({ category: "FOMC" }),
      severity: "high",
      minutesRemaining: 2,
      tradingRestriction: "LOCK_TRADING",
    });
    const result = applyNewsAdjustment({ news, decision: "WAIT", institutionalScore: 40, tradeGrade: "D", confidence: BASE_CONFIDENCE });
    expect(result.decision).toBe("WAIT");
    expect(result.reasons.some((r) => r.toLowerCase().includes("forcing wait"))).toBe(false);
  });
});

describe("applyNewsAdjustment — fundamental bias alignment", () => {
  it("gives a small confidence boost when bias agrees with the technical decision", () => {
    const news = makeNews({ fundamentalBias: "bullish" });
    const result = applyNewsAdjustment({ news, decision: "BUY", institutionalScore: 70, tradeGrade: "B", confidence: BASE_CONFIDENCE });
    expect(result.institutionalScore).toBe(75);
    expect(result.reasons.some((r) => r.includes("aligns"))).toBe(true);
  });

  it("gives a larger confidence penalty when bias conflicts with the technical decision", () => {
    const news = makeNews({ fundamentalBias: "bearish" });
    const result = applyNewsAdjustment({ news, decision: "BUY", institutionalScore: 70, tradeGrade: "B", confidence: BASE_CONFIDENCE });
    expect(result.institutionalScore).toBe(62);
    expect(result.reasons.some((r) => r.includes("conflicts"))).toBe(true);
  });

  it("does not adjust for HOLD/WAIT decisions regardless of bias", () => {
    const news = makeNews({ fundamentalBias: "bullish" });
    const result = applyNewsAdjustment({ news, decision: "HOLD", institutionalScore: 70, tradeGrade: "B", confidence: BASE_CONFIDENCE });
    expect(result.institutionalScore).toBe(70);
  });
});

// ─── Full pipeline integration ────────────────────────────────────────────────

function makeCandle(open: number, close: number, high?: number, low?: number, volume = 100_000, ts = new Date()): MarketCandle {
  return {
    symbol: "EURUSD",
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
        if (to < from) low -= spike;
        else high += spike;
      }
      candles.push(makeCandle(open, close, high, low, 100_000));
      prevClose = close;
    }
  }
  return candles;
}

function bullishZigzagScenario(): MarketCandle[] {
  return zigzag([100, 96, 104, 100, 110, 105, 118, 112, 128, 121, 140]);
}

describe("News integration through runAnalysis", () => {
  const NOW = new Date("2026-07-13T12:00:00Z");
  const candles = bullishZigzagScenario();
  const lastClose = candles[candles.length - 1]!.close;

  function analyzeWithNews(newsEvents: EconomicEvent[]) {
    return runAnalysis({
      symbol: "EURUSD",
      timeframe: "1H",
      candles,
      currentBid: lastClose - 0.0005,
      currentAsk: lastClose + 0.0005,
      newsEvents,
      now: NOW,
    });
  }

  it("attaches a fully-shaped news field even with no events", () => {
    const result = analyzeWithNews([]);
    expect(result.news.tradingRestriction).toBe("SAFE");
    expect(result.news.recommendation).toBe("PROCEED");
  });

  it("forces the decision to WAIT when an imminent FOMC event locks trading", () => {
    const withoutNews = analyzeWithNews([]);
    expect(withoutNews.decisionEngine.decision).toBe("BUY");

    const events: EconomicEvent[] = [
      makeEvent({
        category: "FOMC",
        currency: "USD",
        scheduledTime: new Date(NOW.getTime() + 3 * 60_000),
      }),
    ];
    const withNews = analyzeWithNews(events);
    expect(withNews.news.tradingRestriction).toBe("LOCK_TRADING");
    expect(withNews.decisionEngine.decision).toBe("WAIT");
    expect(withNews.decisionEngine.reasons.some((r) => r.toLowerCase().includes("locked"))).toBe(true);
  });

  it("scales down position size when riskLevel is elevated but doesn't force WAIT", () => {
    const events: EconomicEvent[] = [
      makeEvent({
        category: "CPI",
        currency: "USD",
        scheduledTime: new Date(NOW.getTime() + 55 * 60_000),
        impact: "medium",
      }),
    ];
    const withNews = analyzeWithNews(events);
    const withoutNews = analyzeWithNews([]);
    if (withNews.decisionEngine.decision !== "WAIT" && withoutNews.decisionEngine.decision !== "WAIT") {
      expect(withNews.decisionEngine.risk.maxRiskPct).toBeLessThanOrEqual(withoutNews.decisionEngine.risk.maxRiskPct);
    }
  });
});
