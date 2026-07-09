/**
 * Premium & Discount Engine — comprehensive test suite.
 *
 * Covers:
 *   - Equilibrium zone detection
 *   - Premium zone detection (price in top 25%)
 *   - Discount zone detection (price in bottom 25%)
 *   - pricePosition calculation (0–100)
 *   - Returns null when no swings available
 *   - Handles degenerate range (high == low)
 */

import { describe, it } from "vitest";
import assert from "node:assert/strict";
import type { SwingPoint } from "../types.js";
import { computePremiumDiscount } from "../premium-discount.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function swing(index: number, price: number, kind: "high" | "low"): SwingPoint {
  return { index, price, timestamp: new Date(2024, 0, 1 + index), kind };
}

// ─── Basic zone detection ─────────────────────────────────────────────────────

describe("computePremiumDiscount — zone detection", () => {
  const swingHighs = [swing(10, 200, "high")]; // rangeHigh = 200
  const swingLows  = [swing(5,  100, "low")];  // rangeLow  = 100
  // Range: 100–200, size=100
  // Equilibrium:       150  (50%)
  // Premium threshold: 175  (75%)
  // Discount threshold:125  (25%)

  it("classifies price in the premium zone (>= 75%)", () => {
    const result = computePremiumDiscount(180, swingHighs, swingLows);
    assert.ok(result !== null);
    assert.equal(result!.currentZone, "premium");
    assert.equal(result!.pricePosition, 80); // (180-100)/100 = 80%
  });

  it("classifies price in the discount zone (<= 25%)", () => {
    const result = computePremiumDiscount(115, swingHighs, swingLows);
    assert.ok(result !== null);
    assert.equal(result!.currentZone, "discount");
    assert.equal(result!.pricePosition, 15); // (115-100)/100 = 15%
  });

  it("classifies price in equilibrium (25%–75%)", () => {
    const result = computePremiumDiscount(150, swingHighs, swingLows);
    assert.ok(result !== null);
    assert.equal(result!.currentZone, "equilibrium");
    assert.equal(result!.pricePosition, 50);
  });

  it("classifies price exactly at premium threshold as premium", () => {
    const result = computePremiumDiscount(175, swingHighs, swingLows);
    assert.ok(result !== null);
    assert.equal(result!.currentZone, "premium");
  });

  it("classifies price exactly at discount threshold as discount", () => {
    const result = computePremiumDiscount(125, swingHighs, swingLows);
    assert.ok(result !== null);
    assert.equal(result!.currentZone, "discount");
  });
});

// ─── Threshold values ─────────────────────────────────────────────────────────

describe("computePremiumDiscount — threshold calculations", () => {
  it("calculates correct equilibrium, premium, and discount thresholds", () => {
    const swingHighs = [swing(10, 200, "high")];
    const swingLows  = [swing(5,  100, "low")];

    const result = computePremiumDiscount(150, swingHighs, swingLows);
    assert.ok(result !== null);
    assert.equal(result!.equilibrium,       150);
    assert.equal(result!.premiumThreshold,  175);
    assert.equal(result!.discountThreshold, 125);
    assert.equal(result!.rangeHigh, 200);
    assert.equal(result!.rangeLow,  100);
  });
});

// ─── distanceFromEquilibrium ──────────────────────────────────────────────────

describe("computePremiumDiscount — distanceFromEquilibrium", () => {
  it("returns positive distance when price is above equilibrium", () => {
    const swingHighs = [swing(10, 200, "high")];
    const swingLows  = [swing(5,  100, "low")];

    const result = computePremiumDiscount(175, swingHighs, swingLows);
    assert.ok(result !== null);
    assert.ok(result!.distanceFromEquilibrium > 0, "above equil → positive distance");
  });

  it("returns negative distance when price is below equilibrium", () => {
    const swingHighs = [swing(10, 200, "high")];
    const swingLows  = [swing(5,  100, "low")];

    const result = computePremiumDiscount(120, swingHighs, swingLows);
    assert.ok(result !== null);
    assert.ok(result!.distanceFromEquilibrium < 0, "below equil → negative distance");
  });

  it("returns ~0 when price is at equilibrium", () => {
    const swingHighs = [swing(10, 200, "high")];
    const swingLows  = [swing(5,  100, "low")];

    const result = computePremiumDiscount(150, swingHighs, swingLows);
    assert.ok(result !== null);
    assert.ok(Math.abs(result!.distanceFromEquilibrium) < 0.01, "at equilibrium → ~0 distance");
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe("computePremiumDiscount — edge cases", () => {
  it("returns null when no swing highs provided", () => {
    const result = computePremiumDiscount(150, [], [swing(5, 100, "low")]);
    assert.equal(result, null);
  });

  it("returns null when no swing lows provided", () => {
    const result = computePremiumDiscount(150, [swing(10, 200, "high")], []);
    assert.equal(result, null);
  });

  it("returns null when rangeHigh <= rangeLow (degenerate range)", () => {
    const swingHighs = [swing(5, 100, "high")];
    const swingLows  = [swing(5, 100, "low")]; // same price
    const result = computePremiumDiscount(100, swingHighs, swingLows);
    assert.equal(result, null, "degenerate range should return null");
  });

  it("handles price above rangeHigh (clamps to 100%)", () => {
    const swingHighs = [swing(10, 200, "high")];
    const swingLows  = [swing(5,  100, "low")];
    const result = computePremiumDiscount(250, swingHighs, swingLows);
    assert.ok(result !== null);
    assert.equal(result!.pricePosition, 100, "price above rangeHigh clamps to 100");
    assert.equal(result!.currentZone, "premium");
  });

  it("handles price below rangeLow (clamps to 0%)", () => {
    const swingHighs = [swing(10, 200, "high")];
    const swingLows  = [swing(5,  100, "low")];
    const result = computePremiumDiscount(50, swingHighs, swingLows);
    assert.ok(result !== null);
    assert.equal(result!.pricePosition, 0, "price below rangeLow clamps to 0");
    assert.equal(result!.currentZone, "discount");
  });

  it("uses the latest swing high and low from multiple swings", () => {
    // Latest swing high is the last element
    const swingHighs = [swing(2, 150, "high"), swing(8, 200, "high")]; // latest = 200
    const swingLows  = [swing(1, 80, "low"),   swing(5, 100, "low")];  // latest = 100
    const result = computePremiumDiscount(150, swingHighs, swingLows);
    assert.ok(result !== null);
    assert.equal(result!.rangeHigh, 200);
    assert.equal(result!.rangeLow, 100);
  });
});
