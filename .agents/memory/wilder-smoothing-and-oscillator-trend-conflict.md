---
name: Wilder smoothing pitfall and oscillator-vs-trend scoring conflict
description: Two subtle analysis-engine bugs found in CMD Trade — ADX math and composite scoring design — worth checking for in any technical-indicator engine.
---

## Wilder's running-sum vs running-average smoothing (ADX)
Wilder's smoothing method is used in two different ways within the same ADX
calculation, and conflating them silently breaks the 0-100 bound:
- TR / +DM / -DM use a **running-sum** smoothing (`prev - prev/n + current`)
  because their ratio (+DI, -DI = smoothed DM / smoothed TR) is scale-invariant
  — the sum-vs-average distinction cancels out.
- The final **DX → ADX** step is a **true moving average** of DX values, not a
  running sum. Reusing the running-sum smoother here inflates ADX far past 100.

**Why:** this bug produced ADX values like 150+ that passed type/shape checks
and looked plausible in isolated unit tests, but were mathematically wrong —
only caught by asserting `adx <= 100` as an explicit invariant.
**How to apply:** whenever porting/implementing Wilder-smoothed indicators
(ADX, RSI, ATR), keep a written note of which smoothing variant each step
uses, and add a bound assertion test for the final output.

## Composite trading-signal scores: oscillators fight trend during strong trends
A weighted composite score blending momentum indicators (MACD, EMA stack,
ADX-confirmed trend) with mean-reversion oscillators (RSI, Bollinger %B,
Stochastic RSI) will systematically under-signal (stuck at HOLD) during
strong, sustained trends — because the oscillators correctly read
"overbought"/"oversold" *as a normal side effect of the trend itself*, and
their negative contribution cancels the trend-following contribution.

**Why:** this is expected technical-analysis behavior (oscillators are less
reliable in confirmed strongly-trending markets), not a coincidence — but if
untreated it makes a "BUY/SELL" decision engine emit HOLD almost every time a
market actually trends hard, which defeats the point of the signal.
**How to apply:** when ADX confirms a strong trend AND an oscillator's
reading opposes that trend's direction (e.g. RSI overbought during a
confirmed uptrend), dampen (don't zero) its contribution — it may still be a
genuine exhaustion warning, just less reliable than in ranging markets. Don't
dampen when the oscillator's reading actually diverges from/confirms in a
non-trending regime. When writing tests for directional bias, avoid raw
monotonic price series as "obviously bullish" fixtures — they saturate
oscillators to 0/100 extremes and legitimately produce HOLD ("don't chase an
exhausted move"). Use a realistic fixture instead: warm up EMA200 with a flat
base, then a short/fresh breakout (not long enough to saturate RSI/StochRSI),
plus a confirming candlestick pattern and volume spike.
