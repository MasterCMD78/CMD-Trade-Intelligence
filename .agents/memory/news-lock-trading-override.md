---
name: News engine LOCK_TRADING vs forced-WAIT split
description: Why proximity-based trading restrictions and the forced-WAIT decision override are two separate tiers, not one.
---

The economic-news engine's `tradingRestriction` (SAFE/CAUTION/NO_TRADE/LOCK_TRADING) is a continuous proximity signal used to scale confidence/risk. It must NOT be treated as equivalent to forcing the institutional decision engine's output to WAIT — ordinary `LOCK_TRADING` proximity only penalizes confidence/score.

A separate, stricter override forces the decision to WAIT only when `LOCK_TRADING` is active AND either: the event category is a "mega-event" (FOMC/INTEREST_RATE), OR minutes-to-event is inside a short hard-lock window (tighter than the general lock window).

**Why:** the spec's illustrative examples conflicted when read as one rule — some implied any LOCK_TRADING should block trading outright, others implied only imminent/major events should. Splitting into a soft (score-penalty) tier and a hard (decision-override) tier satisfies both without contradiction, and keeps minor scheduled releases from needlessly killing otherwise-strong technical setups.

**How to apply:** when extending the news/decision-engine integration (e.g. new event categories, new override conditions), keep this two-tier shape — don't collapse proximity penalties and forced overrides into a single threshold.
