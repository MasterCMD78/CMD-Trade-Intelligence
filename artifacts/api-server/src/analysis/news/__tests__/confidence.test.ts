import { describe, it, expect } from "vitest";
import { computeNewsConfidence, proximityFactor } from "../confidence.js";
import { DEFAULT_NEWS_CONFIG } from "../config.js";
import type { EconomicEvent } from "../types.js";

function makeEvent(overrides: Partial<EconomicEvent>): EconomicEvent {
  return {
    id: "e1",
    name: "Test Event",
    category: "CPI",
    currency: "USD",
    country: "US",
    impact: "high",
    scheduledTime: new Date(),
    forecast: "3.0%",
    previous: "2.9%",
    actual: null,
    ...overrides,
  };
}

describe("proximityFactor", () => {
  it("is 1.0 at the event itself", () => {
    expect(proximityFactor(0, DEFAULT_NEWS_CONFIG)).toBeCloseTo(1);
  });

  it("is 0 at or beyond the warning window edge", () => {
    expect(proximityFactor(DEFAULT_NEWS_CONFIG.warningWindowMinutes, DEFAULT_NEWS_CONFIG)).toBe(0);
    expect(proximityFactor(DEFAULT_NEWS_CONFIG.warningWindowMinutes + 10, DEFAULT_NEWS_CONFIG)).toBe(0);
  });

  it("decays linearly and symmetrically for past/future", () => {
    const future = proximityFactor(30, DEFAULT_NEWS_CONFIG);
    const past = proximityFactor(-30, DEFAULT_NEWS_CONFIG);
    expect(future).toBeCloseTo(past);
    expect(future).toBeCloseTo(0.5);
  });
});

describe("computeNewsConfidence", () => {
  it("returns 0 for a quiet calendar (no active events)", () => {
    expect(computeNewsConfidence([], DEFAULT_NEWS_CONFIG)).toBe(0);
  });

  it("is higher for a high-impact event close in time than a low-impact distant one", () => {
    const highClose = computeNewsConfidence(
      [{ event: makeEvent({ impact: "high" }), minutesUntil: 2, relevanceWeight: 1 }],
      DEFAULT_NEWS_CONFIG,
    );
    const lowFar = computeNewsConfidence(
      [{ event: makeEvent({ impact: "low" }), minutesUntil: 55, relevanceWeight: 1 }],
      DEFAULT_NEWS_CONFIG,
    );
    expect(highClose).toBeGreaterThan(lowFar);
  });

  it("scales with currency relevance weight", () => {
    const full = computeNewsConfidence(
      [{ event: makeEvent({ impact: "high" }), minutesUntil: 0, relevanceWeight: 1 }],
      DEFAULT_NEWS_CONFIG,
    );
    const damped = computeNewsConfidence(
      [{ event: makeEvent({ impact: "high" }), minutesUntil: 0, relevanceWeight: 0.3 }],
      DEFAULT_NEWS_CONFIG,
    );
    expect(damped).toBeLessThan(full);
  });

  it("gives a small bonus for multiple simultaneous active events", () => {
    const single = computeNewsConfidence(
      [{ event: makeEvent({ impact: "medium" }), minutesUntil: 10, relevanceWeight: 1 }],
      DEFAULT_NEWS_CONFIG,
    );
    const multiple = computeNewsConfidence(
      [
        { event: makeEvent({ id: "a", impact: "medium" }), minutesUntil: 10, relevanceWeight: 1 },
        { event: makeEvent({ id: "b", impact: "medium" }), minutesUntil: 12, relevanceWeight: 1 },
      ],
      DEFAULT_NEWS_CONFIG,
    );
    expect(multiple).toBeGreaterThan(single);
  });

  it("clamps within 0-100", () => {
    const value = computeNewsConfidence(
      [
        { event: makeEvent({ id: "a", category: "FOMC", impact: "high" }), minutesUntil: 0, relevanceWeight: 1 },
        { event: makeEvent({ id: "b", category: "NFP", impact: "high" }), minutesUntil: 0, relevanceWeight: 1 },
        { event: makeEvent({ id: "c", category: "CPI", impact: "high" }), minutesUntil: 0, relevanceWeight: 1 },
        { event: makeEvent({ id: "d", category: "GDP", impact: "high" }), minutesUntil: 0, relevanceWeight: 1 },
      ],
      DEFAULT_NEWS_CONFIG,
    );
    expect(value).toBeLessThanOrEqual(100);
    expect(value).toBeGreaterThanOrEqual(0);
  });
});
