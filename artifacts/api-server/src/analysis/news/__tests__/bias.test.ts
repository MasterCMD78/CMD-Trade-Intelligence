import { describe, it, expect } from "vitest";
import { combinePairBias, deriveFundamentalBias } from "../bias.js";
import type { EconomicEvent } from "../types.js";

function makeEvent(overrides: Partial<EconomicEvent>): EconomicEvent {
  return {
    id: "e1",
    name: "Test Event",
    category: "CPI",
    currency: "USD",
    country: "US",
    impact: "high",
    scheduledTime: new Date("2026-07-10T13:30:00Z"),
    forecast: "3.0%",
    previous: "2.9%",
    actual: null,
    ...overrides,
  };
}

describe("deriveFundamentalBias", () => {
  it("returns unknown when no events exist for the currency", () => {
    expect(deriveFundamentalBias([], "USD")).toBe("unknown");
  });

  it("returns unknown when events exist but none have been released", () => {
    const events = [makeEvent({ actual: null })];
    expect(deriveFundamentalBias(events, "USD")).toBe("unknown");
  });

  it("returns bullish when a beat is released for a positive-direction category", () => {
    const events = [makeEvent({ category: "CPI", forecast: "3.0%", actual: "3.5%" })];
    expect(deriveFundamentalBias(events, "USD")).toBe("bullish");
  });

  it("returns bearish when a miss is released for a positive-direction category", () => {
    const events = [makeEvent({ category: "NFP", forecast: "200K", actual: "120K" })];
    expect(deriveFundamentalBias(events, "USD")).toBe("bearish");
  });

  it("inverts direction for unemployment (higher = bearish for currency)", () => {
    const events = [makeEvent({ category: "UNEMPLOYMENT", forecast: "3.9%", actual: "4.5%" })];
    expect(deriveFundamentalBias(events, "USD")).toBe("bearish");
  });

  it("returns neutral for a surprise within the neutral band", () => {
    const events = [makeEvent({ category: "CPI", forecast: "3.00%", actual: "3.01%" })];
    expect(deriveFundamentalBias(events, "USD")).toBe("neutral");
  });

  it("excludes central bank speeches (no numeric direction)", () => {
    const events = [makeEvent({ category: "CENTRAL_BANK_SPEECH", forecast: null, actual: null })];
    expect(deriveFundamentalBias(events, "USD")).toBe("unknown");
  });

  it("weights multiple events by impact", () => {
    const events = [
      makeEvent({ id: "a", category: "CPI", impact: "high", forecast: "3.0%", actual: "3.6%" }),
      makeEvent({ id: "b", category: "PMI", impact: "low", forecast: "50", actual: "40" }),
    ];
    // High-impact bullish beat should dominate the low-impact miss.
    expect(deriveFundamentalBias(events, "USD")).toBe("bullish");
  });

  it("ignores events for other currencies", () => {
    const events = [makeEvent({ currency: "EUR", category: "CPI", forecast: "3.0%", actual: "3.6%" })];
    expect(deriveFundamentalBias(events, "USD")).toBe("unknown");
  });
});

describe("combinePairBias", () => {
  it("returns base directly when there is no quote currency", () => {
    expect(combinePairBias("bullish")).toBe("bullish");
  });

  it("returns unknown only when both legs are unknown", () => {
    expect(combinePairBias("unknown", "unknown")).toBe("unknown");
  });

  it("combines bullish base + bearish quote into bullish pair bias", () => {
    expect(combinePairBias("bullish", "bearish")).toBe("bullish");
  });

  it("combines bearish base + bullish quote into bearish pair bias", () => {
    expect(combinePairBias("bearish", "bullish")).toBe("bearish");
  });

  it("returns neutral when both legs agree in direction", () => {
    expect(combinePairBias("bullish", "bullish")).toBe("neutral");
  });

  it("treats an unknown leg as neutral (sign 0)", () => {
    expect(combinePairBias("bullish", "unknown")).toBe("bullish");
    expect(combinePairBias("unknown", "bearish")).toBe("bullish");
  });
});
