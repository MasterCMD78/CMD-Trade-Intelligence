/**
 * Premium & Discount Engine — Phase 3G.
 *
 * Using the most recent confirmed swing high and swing low as the range:
 *
 *   Equilibrium  = midpoint of the range (50%)
 *   Premium Zone = upper 25% of the range (75%–100%) — expensive; look to sell.
 *   Discount Zone= lower 25% of the range (0%–25%) — cheap; look to buy.
 *
 * Returns where current price sits: "premium", "discount", or "equilibrium".
 *
 * Design: pure stateless function, no I/O.
 */

import type { SwingPoint } from "./types.js";

// ─── Public types ─────────────────────────────────────────────────────────────

export type PremiumDiscountZone = "premium" | "equilibrium" | "discount";

export interface PremiumDiscountResult {
  /** Top of the reference range (latest confirmed swing high). */
  rangeHigh: number;
  /** Bottom of the reference range (latest confirmed swing low). */
  rangeLow: number;
  /** Midpoint of the range. */
  equilibrium: number;
  /** Upper 75% level — anything above is premium. */
  premiumThreshold: number;
  /** Lower 25% level — anything below is discount. */
  discountThreshold: number;
  /** Where the current price sits. */
  currentZone: PremiumDiscountZone;
  /**
   * 0–100 normalized position of the current price within the range.
   * 0 = at swing low, 100 = at swing high.
   */
  pricePosition: number;
  /**
   * Distance from equilibrium as a fraction of the range half-width.
   * Positive = above equil (premium side), negative = below (discount side).
   */
  distanceFromEquilibrium: number;
}

// ─── Main calculator ──────────────────────────────────────────────────────────

export function computePremiumDiscount(
  currentPrice: number,
  swingHighs: SwingPoint[],
  swingLows: SwingPoint[],
): PremiumDiscountResult | null {
  if (swingHighs.length === 0 || swingLows.length === 0) return null;

  // Use the latest confirmed swing high and low as the structural range.
  const latestHigh = swingHighs[swingHighs.length - 1]!;
  const latestLow  = swingLows[swingLows.length - 1]!;

  const rangeHigh = latestHigh.price;
  const rangeLow  = latestLow.price;

  if (rangeHigh <= rangeLow) return null; // degenerate range

  const rangeSize          = rangeHigh - rangeLow;
  const equilibrium        = rangeLow + rangeSize * 0.50;
  const premiumThreshold   = rangeLow + rangeSize * 0.75;
  const discountThreshold  = rangeLow + rangeSize * 0.25;

  // Clamp price to range for position calculation
  const clamped     = Math.max(rangeLow, Math.min(rangeHigh, currentPrice));
  const pricePosition = Math.round(((clamped - rangeLow) / rangeSize) * 100);

  const halfRange = rangeSize / 2;
  const distanceFromEquilibrium =
    halfRange > 0 ? (currentPrice - equilibrium) / halfRange : 0;

  let currentZone: PremiumDiscountZone;
  if (currentPrice >= premiumThreshold) {
    currentZone = "premium";
  } else if (currentPrice <= discountThreshold) {
    currentZone = "discount";
  } else {
    currentZone = "equilibrium";
  }

  return {
    rangeHigh,
    rangeLow,
    equilibrium,
    premiumThreshold,
    discountThreshold,
    currentZone,
    pricePosition,
    distanceFromEquilibrium,
  };
}
