---
name: Synthetic candle fixtures for swing-detection tests
description: How to build candle series that reliably produce swing-detector pivots for trend-engine/MTF tests
---

Swing detection (`detectSwings`) marks a candle a pivot only if it is strictly higher/lower than its neighbors within `swingLength` (default 2) candles on both sides. Trend classification (`classifySwings`) then compares each swing to the *previous swing of the same kind* (high vs. high, low vs. low) — the first swing of each kind gets no label, so you need at least 2-3 labeled highs and lows before a trend (HH+HL or LH+LL) can be confirmed.

**Why:** A monotonic step series (e.g. alternating `+0.8`/`-0.5` per candle) does not reliably produce clean local extrema across a wide enough span, so swing counts stay too low to get any classified swings — `computeTrend` then reports `sideways` for both "bullish" and "bearish" synthetic fixtures, which look identical to the trend engine.

**How to apply:** Build fixtures as a trending sine wave: `price = base + i * slope + amplitude * Math.sin(i / period)`. Tune `period` so several oscillation cycles fit inside the candle count (e.g. period ~1.5–3 for ~30-50 candles) — this guarantees multiple clean pivots with monotonically increasing (bullish) or decreasing (bearish) swing prices. Verify empirically with a throwaway debug test that logs `timeframes[...].trend` and `alignmentScore` before trusting the fixture — small changes to slope/period/amplitude can flip results between `sideways` and a confirmed trend.

For `analysis/market-structure`'s own `detectSwings` (used directly by BOS/order-block/liquidity/premium-discount, not just trend classification), a naive zigzag through explicit pivot values (`from -> to -> from -> to`) ties the high/low at every turn — the candle ending one leg and the candle starting the next both compute `high = max(open, close) + wick` from the *same* pivot value, and equal highs are explicitly rejected as a flat plateau. Fix by giving each internal pivot its own dedicated "apex" candle with an exaggerated wick beyond the approach candles (e.g. approach to `pivot - 0.4 * legStep`, then spike the apex candle's wick `pivot + extra`), so it unambiguously out-wicks both neighbors.
