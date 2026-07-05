# CMD Trade Intelligence — Project Plan

## Overview

CMD Trade Intelligence is a commercial SaaS platform delivering AI-powered trade analysis and signal generation for Forex and Crypto traders. The platform combines institutional-grade market analysis with an accessible, modern interface.

## Development Phases

### Phase 1 — Foundation (Current) ✅
**Goal:** Production-ready architecture, authentication, and all UI scaffolding.

Deliverables:
- Monorepo project structure (pnpm workspaces)
- PostgreSQL schema: users, user settings, signals
- JWT authentication (register, login, refresh, logout)
- All frontend pages with navigation and placeholder states
- REST API: auth, users, dashboard, markets, signals, risk, admin
- Shared types, constants, and documentation

### Phase 2 — Market Data Integration
**Goal:** Live market data feeds for Forex and Crypto pairs.

Deliverables:
- Market data provider adapters (OANDA, Binance, or equivalent)
- WebSocket feed manager with reconnection logic
- Redis-backed OHLCV cache
- Real-time price display on Markets page
- Symbol search and watchlist management

### Phase 3 — AI Analysis Engine
**Goal:** Pattern detection and signal generation pipeline.

Deliverables:
- Technical analysis engine (trends, patterns, S/R levels)
- Multi-timeframe confluence scoring
- Automated signal creation with rationale
- Confidence engine (0–100 score per signal)
- Signal history and performance tracking

### Phase 4 — Risk Engine
**Goal:** Automated risk calculation and position sizing.

Deliverables:
- Position sizer (fixed fractional, ATR-based)
- Drawdown monitor and alerts
- Portfolio exposure limits
- Per-user risk profile configuration
- Risk report generation

### Phase 5 — Monetization & Subscriptions
**Goal:** Paid plans with usage limits and Stripe billing.

Deliverables:
- Stripe subscription integration
- Plan-based feature gating (free / pro / enterprise)
- Upgrade flow and billing portal
- Plan limit enforcement in API

### Phase 6 — Production Hardening
**Goal:** Security, observability, and scale-readiness.

Deliverables:
- Rate limiting and abuse protection
- Refresh token rotation and blocklist
- Structured logging with alerting
- Performance monitoring
- Load testing and bottleneck resolution

## Team Conventions

- All API changes start with an OpenAPI spec update (`lib/api-spec/openapi.yaml`)
- Run codegen after every spec change: `pnpm --filter @workspace/api-spec run codegen`
- All new DB tables go in `lib/db/src/schema/`, one file per entity
- Push schema changes with: `pnpm --filter @workspace/db run push`
- TypeScript strict mode is enforced across all packages
