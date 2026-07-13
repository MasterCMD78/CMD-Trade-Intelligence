import { describe, it, expect } from "vitest";
import { computeNewsAnalysis } from "../engine.js";
import { withNewsConfig } from "../config.js";
import type { EconomicEvent } from "../types.js";

const NOW = new Date("2026-07-13T12:00:00Z");

function makeEvent(overrides: Partial<EconomicEvent>): EconomicEvent {
  return {
    id: "e1",
    name: "Test Event",
    category: "CPI",
    currency: "USD",
    country: "US",
    impact: "high",
    scheduledTime: NOW,
    forecast: "3.0%",
    previous: "2.9%",
    actual: null,
    ...overrides,
  };
}

describe("computeNewsAnalysis — no data", () => {
  it("falls back to a neutral 'no data' state with an empty event list", () => {
    const result = computeNewsAnalysis({ symbol: "EURUSD", now: NOW, events: [] });
    expect(result.currentEvent).toBeNull();
    expect(result.nextEvent).toBeNull();
    expect(result.severity).toBeNull();
    expect(result.tradingRestriction).toBe("SAFE");
    expect(result.recommendation).toBe("PROCEED");
    expect(result.fundamentalBias).toBe("unknown");
    expect(result.newsConfidence).toBe(0);
    expect(result.riskLevel).toBe("low");
    expect(result.activeEvents).toEqual([]);
  });

  it("returns an empty affectedCurrencies list for an unrecognized symbol", () => {
    const result = computeNewsAnalysis({ symbol: "ZZZXYZ", now: NOW, events: [] });
    expect(result.affectedCurrencies).toEqual([]);
  });
});

describe("computeNewsAnalysis — single relevant event", () => {
  it("picks up a high-impact event inside the lock window and locks trading", () => {
    const scheduledTime = new Date(NOW.getTime() + 10 * 60_000);
    const events = [makeEvent({ currency: "USD", impact: "high", scheduledTime })];
    const result = computeNewsAnalysis({ symbol: "EURUSD", now: NOW, events });

    expect(result.currentEvent?.id).toBe("e1");
    expect(result.minutesRemaining).toBeCloseTo(10, 0);
    expect(result.tradingRestriction).toBe("LOCK_TRADING");
    expect(result.recommendation).toBe("AVOID");
    expect(result.window.isLocked).toBe(true);
    expect(result.window.isWarning).toBe(true);
  });

  it("ignores events for currencies the symbol isn't exposed to", () => {
    const events = [makeEvent({ currency: "JPY", scheduledTime: new Date(NOW.getTime() + 5 * 60_000) })];
    const result = computeNewsAnalysis({ symbol: "EURUSD", now: NOW, events });
    expect(result.currentEvent).toBeNull();
    expect(result.tradingRestriction).toBe("SAFE");
  });

  it("ignores events far outside the warning window", () => {
    const events = [makeEvent({ scheduledTime: new Date(NOW.getTime() + 5 * 3_600_000) })];
    const result = computeNewsAnalysis({ symbol: "EURUSD", now: NOW, events });
    expect(result.currentEvent).toBeNull();
    expect(result.nextEvent?.id).toBe("e1");
  });

  it("keeps a just-released event active during the post-event cooldown", () => {
    const events = [makeEvent({ scheduledTime: new Date(NOW.getTime() - 10 * 60_000), actual: "3.4%" })];
    const result = computeNewsAnalysis({ symbol: "EURUSD", now: NOW, events });
    expect(result.currentEvent?.id).toBe("e1");
    expect(result.activeEvents).toHaveLength(1);
  });
});

describe("computeNewsAnalysis — multiple/overlapping events", () => {
  it("selects the most urgent (closest in time) event as current", () => {
    const events = [
      makeEvent({ id: "far", scheduledTime: new Date(NOW.getTime() + 50 * 60_000) }),
      makeEvent({ id: "near", scheduledTime: new Date(NOW.getTime() + 5 * 60_000) }),
    ];
    const result = computeNewsAnalysis({ symbol: "EURUSD", now: NOW, events });
    expect(result.currentEvent?.id).toBe("near");
    expect(result.nextEvent?.id).toBe("far");
  });

  it("includes every currency-relevant event inside the window in activeEvents", () => {
    const events = [
      makeEvent({ id: "usd1", currency: "USD", scheduledTime: new Date(NOW.getTime() + 5 * 60_000) }),
      makeEvent({ id: "eur1", currency: "EUR", scheduledTime: new Date(NOW.getTime() + 20 * 60_000) }),
    ];
    const result = computeNewsAnalysis({ symbol: "EURUSD", now: NOW, events });
    expect(result.activeEvents.map((e) => e.id).sort()).toEqual(["eur1", "usd1"]);
  });

  it("combines per-currency bias into a pair bias", () => {
    const events = [
      makeEvent({ id: "usd-cpi", currency: "USD", category: "CPI", forecast: "3.0%", actual: "2.5%", scheduledTime: new Date(NOW.getTime() - 60_000) }),
      makeEvent({ id: "eur-cpi", currency: "EUR", category: "CPI", forecast: "2.5%", actual: "3.1%", scheduledTime: new Date(NOW.getTime() - 60_000) }),
    ];
    // USD miss (bearish USD) + EUR beat (bullish EUR) => bullish EURUSD.
    const result = computeNewsAnalysis({ symbol: "EURUSD", now: NOW, events });
    expect(result.fundamentalBias).toBe("bullish");
  });
});

describe("computeNewsAnalysis — config overrides", () => {
  it("respects a widened lock window", () => {
    const config = withNewsConfig({ lockWindowMinutes: 30 });
    const events = [makeEvent({ scheduledTime: new Date(NOW.getTime() + 25 * 60_000) })];
    const result = computeNewsAnalysis({ symbol: "EURUSD", now: NOW, events, config });
    expect(result.tradingRestriction).toBe("LOCK_TRADING");
  });
});

describe("computeNewsAnalysis — timezone/DST edge cases", () => {
  it("computes minutesUntil correctly across a UTC date boundary", () => {
    const now = new Date("2026-07-13T23:55:00Z");
    const events = [makeEvent({ scheduledTime: new Date("2026-07-14T00:05:00Z") })];
    const result = computeNewsAnalysis({ symbol: "EURUSD", now, events });
    expect(result.minutesRemaining).toBeCloseTo(10, 0);
  });

  it("computes minutesUntil correctly across a US DST spring-forward boundary (2026-03-08)", () => {
    // 2026-03-08 is the US DST transition date; all engine math is UTC-millisecond based,
    // so it must be unaffected regardless of any local-timezone DST rules.
    const now = new Date("2026-03-08T06:50:00Z");
    const events = [makeEvent({ scheduledTime: new Date("2026-03-08T07:00:00Z") })];
    const result = computeNewsAnalysis({ symbol: "EURUSD", now, events });
    expect(result.minutesRemaining).toBeCloseTo(10, 0);
    expect(result.tradingRestriction).toBe("LOCK_TRADING");
  });

  it("computes minutesUntil correctly across a US DST fall-back boundary (2026-11-01)", () => {
    const now = new Date("2026-11-01T05:50:00Z");
    const events = [makeEvent({ scheduledTime: new Date("2026-11-01T06:00:00Z") })];
    const result = computeNewsAnalysis({ symbol: "EURUSD", now, events });
    expect(result.minutesRemaining).toBeCloseTo(10, 0);
  });
});
