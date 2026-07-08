---
name: Market structure trend/phase derivation
description: Pitfall when deriving trend-transition phases (trending/ranging/reversal) from swing-label sequences.
---

When deriving a "trend changed" signal purely from a sequence of swing labels (HH/HL/LH/LL), don't compare the current
confirmed trend against the *raw immediately-prior timeline entry*. Because only one side (a high or a low) updates
at a time, the entry right before a real reversal confirms is often a transient "sideways" blip (e.g. an LH prints
after a bullish HH+HL, momentarily reading sideways, before the following LL confirms bearish) — comparing against
that raw entry misclassifies genuine reversals as "first-time trend confirmations" and vice versa.

**Why:** caught by architect code review during Phase 3A Market Structure Engine — the naive
`previousTrend = timeline[len-2]` approach produced false negatives on true bullish<->bearish flips that passed
through a one-sided sideways print.

**How to apply:** track "the last *directional* (non-sideways) trend value seen before the current one," skipping
over transient sideways entries entirely, and default it to "sideways" only when no directional trend has ever been
confirmed. Use that filtered value (not the raw previous timeline entry) to distinguish "trending" (continuation or
first-ever confirmation out of a virgin range) from "reversal" (genuine flip between opposite directional biases).
