# WebSocket Feed Manager

Manages persistent WebSocket connections to market data providers for real-time price streaming.

## Planned Components

- `feed_manager.py` — Multiplexes multiple symbol subscriptions across connections
- `reconnect_handler.py` — Exponential backoff reconnection with jitter
- `event_bus.py` — Internal pub/sub for distributing tick data to consumers

## Status

**Phase 2 — Not yet implemented**
