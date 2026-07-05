---
name: WS channel validation
description: Rules for validating WebSocket subscription channels to prevent DoS
---

## Rules (in websocket.manager.ts `subscribe()`)

Valid channel formats:
- `tick:<SYMBOL>` — e.g. `tick:EURUSD`
- `candle:<SYMBOL>:<TIMEFRAME>` — e.g. `candle:BTCUSDT:1H`

Validation rules:
- SYMBOL: uppercase alphanumeric, 3–12 chars (`/^[A-Z0-9]{3,12}$/`)
- TIMEFRAME: one of `1M | 5M | 15M | 30M | 1H | 4H | 1D | 1W` (VALID_TIMEFRAMES set)
- Channel type must be `tick` or `candle` — nothing else
- Per-client cap: `MAX_SUBS_PER_CLIENT = 50`

## Why

Without validation, authenticated clients can subscribe to arbitrary channel strings,
inflating the `channelSubscribers` Map with unbounded keys — a memory-based DoS vector.

**How to apply:** Keep `VALID_TIMEFRAMES` in sync with the `Timeframe` enum in `types.ts`
whenever new timeframes are added.
