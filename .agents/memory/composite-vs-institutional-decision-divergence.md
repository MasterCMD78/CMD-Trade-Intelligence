---
name: Composite decision vs. institutional decision-engine divergence
description: Why a stricter downstream decision layer must not reuse the base engine's entry/stop/target fields
---

When a stricter/more-conservative decision layer sits on top of an existing composite scoring engine, the two can legitimately reach different calls (e.g. base composite engine says BUY at a lower confidence bar, institutional layer says HOLD/WAIT because it demands multi-factor confluence). Reusing the base engine's `entryPrice/stopLoss/takeProfit` unconditionally in the new layer silently attaches a flat/HOLD risk plan to what should be an active trade, or attaches the wrong-direction stop/target.

**Why:** Those fields are computed by the base engine using *its own* decision, not the new layer's decision. Only reusing them when the two decisions happen to agree "by luck" of the test fixture masks the bug until real (disagreeing) data hits it.

**How to apply:** When a new decision layer's own directional call can diverge from an existing decision, recompute entry/stop/target directly for the new layer's decision (reusing the same underlying levels/ATR-based risk function, called again with the new decision), rather than passing through the base result's risk fields.
