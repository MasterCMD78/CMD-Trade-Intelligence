import { describe, it, expect } from "vitest";
import {
  classifyRisk,
  computeRawRiskScore,
  computeTradingRestriction,
  recommendationForRestriction,
} from "../restrictions.js";
import { DEFAULT_NEWS_CONFIG } from "../config.js";

describe("computeTradingRestriction", () => {
  it("is SAFE when there is no relevant event", () => {
    expect(computeTradingRestriction(null, null, DEFAULT_NEWS_CONFIG)).toBe("SAFE");
  });

  it("is SAFE when the event is outside the warning window", () => {
    expect(computeTradingRestriction("high", 120, DEFAULT_NEWS_CONFIG)).toBe("SAFE");
  });

  it("is LOCK_TRADING for a high-impact event inside the lock window (the spec's literal example)", () => {
    expect(computeTradingRestriction("high", 10, DEFAULT_NEWS_CONFIG)).toBe("LOCK_TRADING");
  });

  it("is NO_TRADE for a high-impact event inside the warning but outside the lock window", () => {
    expect(computeTradingRestriction("high", 45, DEFAULT_NEWS_CONFIG)).toBe("NO_TRADE");
  });

  it("is NO_TRADE for a medium-impact event inside the lock window", () => {
    expect(computeTradingRestriction("medium", 10, DEFAULT_NEWS_CONFIG)).toBe("NO_TRADE");
  });

  it("is CAUTION for a medium-impact event inside the warning but outside the lock window", () => {
    expect(computeTradingRestriction("medium", 45, DEFAULT_NEWS_CONFIG)).toBe("CAUTION");
  });

  it("is CAUTION for a low-impact event anywhere inside the warning window", () => {
    expect(computeTradingRestriction("low", 5, DEFAULT_NEWS_CONFIG)).toBe("CAUTION");
    expect(computeTradingRestriction("low", 55, DEFAULT_NEWS_CONFIG)).toBe("CAUTION");
  });

  it("treats past events symmetrically via absolute distance", () => {
    expect(computeTradingRestriction("high", -10, DEFAULT_NEWS_CONFIG)).toBe("LOCK_TRADING");
  });
});

describe("recommendationForRestriction", () => {
  it("maps every restriction tier to its recommendation", () => {
    expect(recommendationForRestriction("SAFE")).toBe("PROCEED");
    expect(recommendationForRestriction("CAUTION")).toBe("CAUTION");
    expect(recommendationForRestriction("NO_TRADE")).toBe("WAIT");
    expect(recommendationForRestriction("LOCK_TRADING")).toBe("AVOID");
  });
});

describe("computeRawRiskScore + classifyRisk", () => {
  it("returns 0 when there is no relevant event", () => {
    expect(computeRawRiskScore(null, null, DEFAULT_NEWS_CONFIG)).toBe(0);
  });

  it("is higher for a high-impact imminent event than a low-impact distant one", () => {
    const high = computeRawRiskScore("high", 0, DEFAULT_NEWS_CONFIG);
    const low = computeRawRiskScore("low", 55, DEFAULT_NEWS_CONFIG);
    expect(high).toBeGreaterThan(low);
  });

  it("classifies raw scores against configured thresholds", () => {
    expect(classifyRisk(90, DEFAULT_NEWS_CONFIG)).toBe("extreme");
    expect(classifyRisk(60, DEFAULT_NEWS_CONFIG)).toBe("high");
    expect(classifyRisk(35, DEFAULT_NEWS_CONFIG)).toBe("medium");
    expect(classifyRisk(10, DEFAULT_NEWS_CONFIG)).toBe("low");
  });
});
