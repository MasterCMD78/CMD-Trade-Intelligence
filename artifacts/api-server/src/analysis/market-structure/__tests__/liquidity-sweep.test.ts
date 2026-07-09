/**
 * Liquidity Sweep Engine — comprehensive test suite.
 *
 * Covers:
 *   - Buy-side liquidity detection (equal highs)
 *   - Sell-side liquidity detection (equal lows)
 *   - Valid buy-side sweep (wick above, close back below)
 *   - Valid sell-side sweep (wick below, close back above)
 *   - False sweeps (wick + close stays outside → not a valid sweep)
 *   - Weak sweep rejection (below minRejectionStrength)
 *   - Equal high / equal low clustering
 *   - Edge cases: empty data, single candle, no swings
 */

import { describe, it } from "vitest";
import assert from "node:assert/strict";
import type { SwingPoint, StructureCandle } from "../types.js";
import { detectLiquiditySweeps } from "../liquidity-sweep.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function c(high: number, low: number, close: number, i = 0): StructureCandle & { close: number } {
  return { high, low, close, timestamp: new Date(2024, 0, 1 + i) };
}

function swing(index: number, price: number, kind: "high" | "low"): SwingPoint {
  return { index, price, timestamp: new Date(2024, 0, 1 + index), kind };
}

// ─── Buy-side liquidity (equal highs) ────────────────────────────────────────

describe("detectLiquiditySweeps — buy-side liquidity levels", () => {
  it("detects a buy-side level when two swing highs cluster at the same price", () => {
    const swingHighs: SwingPoint[] = [
      swing(2, 110.00, "high"),
      swing(6, 110.05, "high"), // within 0.1% tolerance of 110
    ];
    const candles = [
      c(108, 105, 106, 0), c(109, 106, 107, 1), c(111, 108, 110, 2),
      c(109, 106, 107, 3), c(108, 105, 106, 4), c(109, 106, 107, 5),
      c(111, 108, 110, 6),
    ];

    const result = detectLiquiditySweeps(candles, swingHighs, [], { minClusterSize: 2 });

    assert.ok(result.liquidityLevels.length >= 1, "should detect at least one buy-side level");
    const level = result.liquidityLevels.find((l) => l.kind === "buy-side");
    assert.ok(level !== undefined, "should have a buy-side level");
    assert.equal(level!.clusterSize, 2, "cluster size should be 2");
  });
});

// ─── Sell-side liquidity (equal lows) ────────────────────────────────────────

describe("detectLiquiditySweeps — sell-side liquidity levels", () => {
  it("detects a sell-side level when two swing lows cluster at the same price", () => {
    const swingLows: SwingPoint[] = [
      swing(2, 90.00, "low"),
      swing(6, 90.04, "low"),
    ];
    const candles = [
      c(95, 89, 91, 0), c(94, 90, 92, 1), c(92, 90, 90, 2),
      c(93, 91, 92, 3), c(94, 91, 93, 4), c(93, 90, 91, 5),
      c(92, 90, 90, 6),
    ];

    const result = detectLiquiditySweeps(candles, [], swingLows, { minClusterSize: 2 });

    const level = result.liquidityLevels.find((l) => l.kind === "sell-side");
    assert.ok(level !== undefined, "should have a sell-side level");
    assert.equal(level!.clusterSize, 2);
  });
});

// ─── Valid buy-side sweep ─────────────────────────────────────────────────────

describe("detectLiquiditySweeps — buy-side sweep (wick above, close back below)", () => {
  it("detects a buy-side sweep when price wicks above the level and closes back below", () => {
    const swingHighs: SwingPoint[] = [
      swing(1, 110, "high"),
      swing(4, 110, "high"),
    ];
    const candles = [
      c(108, 105, 106, 0),
      c(111, 108, 110, 1), // swing high 1
      c(109, 106, 107, 2),
      c(108, 105, 106, 3),
      c(111, 108, 110, 4), // swing high 2 — forms equal high cluster
      c(109, 106, 107, 5),
      c(112, 106, 108, 6), // wick = 112 > 110, close = 108 < 110 → valid sweep
    ];

    const result = detectLiquiditySweeps(candles, swingHighs, [], {
      minClusterSize: 2,
      minRejectionStrength: 0.05,
    });

    assert.ok(result.sweeps.length >= 1, "should detect a buy-side sweep");
    const sweep = result.sweeps.find((s) => s.direction === "buy-side");
    assert.ok(sweep !== undefined, "sweep should be buy-side");
    assert.equal(sweep!.sweepIndex, 6, "sweep should be at candle 6");
    assert.ok(sweep!.rejectionStrength > 0, "rejection strength should be positive");
    assert.ok(sweep!.confidence > 0, "confidence should be positive");
  });
});

// ─── Valid sell-side sweep ────────────────────────────────────────────────────

describe("detectLiquiditySweeps — sell-side sweep (wick below, close back above)", () => {
  it("detects a sell-side sweep when price wicks below and closes back above", () => {
    const swingLows: SwingPoint[] = [
      swing(1, 90, "low"),
      swing(4, 90, "low"),
    ];
    const candles = [
      c(95, 91, 93, 0),
      c(93, 89, 90, 1), // swing low 1
      c(94, 91, 92, 2),
      c(95, 91, 93, 3),
      c(93, 89, 90, 4), // swing low 2 — equal low cluster
      c(94, 91, 93, 5),
      c(95, 88, 93, 6), // wick = 88 < 90, close = 93 > 90 → valid sell-side sweep
    ];

    const result = detectLiquiditySweeps(candles, [], swingLows, {
      minClusterSize: 2,
      minRejectionStrength: 0.05,
    });

    const sweep = result.sweeps.find((s) => s.direction === "sell-side");
    assert.ok(sweep !== undefined, "should detect a sell-side sweep");
    assert.ok(sweep!.rejectionStrength > 0);
  });
});

// ─── False sweep (close does not return inside) ───────────────────────────────

describe("detectLiquiditySweeps — false sweep rejection", () => {
  it("does NOT detect a sweep when wick pierces but close stays above level (buy-side)", () => {
    const swingHighs: SwingPoint[] = [
      swing(1, 110, "high"),
      swing(4, 110, "high"),
    ];
    const candles = [
      c(108, 105, 106, 0),
      c(111, 108, 110, 1),
      c(109, 106, 107, 2),
      c(108, 105, 106, 3),
      c(111, 108, 110, 4),
      c(112, 106, 111, 5), // wick = 112 > 110, but close = 111 > 110 → NOT a valid sweep (close stays outside)
    ];

    const result = detectLiquiditySweeps(candles, swingHighs, [], {
      minClusterSize: 2,
      minRejectionStrength: 0.05,
    });

    assert.equal(result.sweeps.length, 0, "close stays outside — should not be a valid sweep");
  });
});

// ─── Weak sweep rejection ─────────────────────────────────────────────────────

describe("detectLiquiditySweeps — weak sweep rejection", () => {
  it("rejects sweeps where the rejection wick is too small relative to candle range", () => {
    const swingHighs: SwingPoint[] = [
      swing(1, 100, "high"),
      swing(3, 100, "high"),
    ];
    const candles = [
      c(99, 95, 97, 0),
      c(101, 98, 100, 1),
      c(100, 97, 99, 2),
      c(101, 98, 100, 3),
      // Wick = 100.01 barely above 100, close = 99.99; range = 100.01 - 98 = 2.01
      // rejection = (100.01 - 100) / 2.01 ≈ 0.005 → below 30% threshold
      c(100.01, 98, 99.99, 4),
    ];

    const result = detectLiquiditySweeps(candles, swingHighs, [], {
      minClusterSize: 2,
      minRejectionStrength: 0.30,
    });

    assert.equal(result.sweeps.length, 0, "weak wick should be rejected");
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe("detectLiquiditySweeps — edge cases", () => {
  it("returns empty result for empty candle array", () => {
    const result = detectLiquiditySweeps([], [swing(0, 100, "high")], []);
    assert.equal(result.sweeps.length, 0);
    assert.equal(result.liquidityLevels.length, 0);
    assert.equal(result.lastSweep, null);
  });

  it("returns empty result when no swings provided", () => {
    const candles = [c(100, 98, 99, 0), c(101, 99, 100, 1), c(102, 100, 101, 2)];
    const result = detectLiquiditySweeps(candles, [], []);
    assert.equal(result.liquidityLevels.length, 0);
    assert.equal(result.sweeps.length, 0);
  });

  it("does not form a cluster when only one swing is at a price", () => {
    const swingHighs: SwingPoint[] = [swing(2, 110, "high")];
    const candles = [c(108, 105, 106, 0), c(109, 106, 107, 1), c(111, 108, 110, 2)];

    const result = detectLiquiditySweeps(candles, swingHighs, [], { minClusterSize: 2 });
    assert.equal(result.liquidityLevels.filter((l) => l.kind === "buy-side").length, 0,
      "single swing should not form a cluster with minClusterSize=2");
  });
});
