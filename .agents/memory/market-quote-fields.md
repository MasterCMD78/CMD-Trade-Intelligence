---
name: MarketQuote extended fields
description: The /markets/{symbol} endpoint returns more fields than a pure price quote
---

`GET /api/markets/{symbol}` merges `MarketPrice` with `MarketSymbol` metadata:

**Price fields** (from provider): bid, ask, mid, spread, change24h, changePct24h, high24h, low24h, volume24h, timestamp, source

**Symbol metadata fields** (appended in route handler): assetClass, displayName, precision, tradingHours

All 16 fields are declared in the `MarketQuote` OpenAPI schema and in the generated types.

**Why:** The frontend Chart page needs both price and symbol metadata (precision for formatting,
tradingHours for display) in one call. Merging them avoids a second request to `/markets` just to
get formatting hints.
