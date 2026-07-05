# Market Data Cache

Redis-backed cache layer for OHLCV data, reducing provider API calls and enabling fast historical lookups.

## Planned Components

- `ohlcv_cache.py` — Caches OHLCV candles per symbol and timeframe
- `tick_buffer.py` — Ring buffer for real-time tick aggregation
- `cache_warmer.py` — Pre-loads frequently accessed symbols on startup

## Status

**Phase 2 — Not yet implemented**

Dependencies: Redis instance (not yet provisioned)
