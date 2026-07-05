# Decision Engine

The decision engine synthesizes inputs from the analysis module to produce actionable trade decisions.

## Planned Components

- `signal_generator.py` — Combines analysis outputs into trade signals
- `entry_exit_optimizer.py` — Calculates optimal entry, stop-loss, and take-profit levels
- `filter_engine.py` — Filters signals by user-defined criteria
- `session_filter.py` — Market session awareness (London, New York, Tokyo, Sydney)

## Status

**Phase 3 — Not yet implemented**

Dependencies: Analysis Engine (Phase 2)
