# CMD Trade Intelligence — Product Roadmap

## Vision

CMD Trade Intelligence is a commercial SaaS platform that gives retail and semi-professional Forex and Crypto traders institutional-quality market intelligence — actionable signals with transparent reasoning, risk-aware position guidance, and a professional dashboard they can trust.

## Milestone Overview

```
Phase 1  [✅ Complete]   Foundation & Architecture
Phase 2  [ ] Q3 2025    Market Data Integration
Phase 3  [ ] Q4 2025    AI Analysis & Signal Engine
Phase 4  [ ] Q1 2026    Risk Engine
Phase 5  [ ] Q2 2026    Monetization
Phase 6  [ ] Q3 2026    Production Hardening
```

---

## Phase 1 — Foundation ✅

**Target:** Project start  
**Status:** Complete

- [x] Monorepo architecture (pnpm workspaces)
- [x] PostgreSQL database with Drizzle ORM
- [x] JWT authentication (register, login, refresh, logout)
- [x] REST API: auth, users, dashboard, markets, signals, risk, admin
- [x] React frontend with all placeholder pages
- [x] Dark theme, responsive layout, sidebar navigation
- [x] Shared types, constants, and documentation
- [x] Module scaffolding: ai_engine, market_data, risk_engine

---

## Phase 2 — Market Data

**Target:** Q3 2025  
**Status:** Not started

- [ ] Select and integrate market data provider (OANDA / Binance)
- [ ] WebSocket feed manager for real-time prices
- [ ] OHLCV cache layer (Redis)
- [ ] Markets page: live price display for Forex + Crypto pairs
- [ ] Symbol watchlist management (create, edit, delete)
- [ ] Price chart component (lightweight-charts or TradingView widget)

---

## Phase 3 — AI Analysis & Signal Engine

**Target:** Q4 2025  
**Status:** Not started

Dependencies: Phase 2

- [ ] Technical indicator computation (EMA, RSI, ATR, MACD, Bollinger Bands)
- [ ] Pattern detection (candlestick patterns, S/R levels, trend lines)
- [ ] Multi-timeframe confluence engine
- [ ] Automated signal generation with rationale
- [ ] Confidence scoring (0–100 per signal)
- [ ] Signal detail page with explanation breakdown
- [ ] Signal performance tracking (win rate, avg R:R)
- [ ] Analysis page: live engine status and recent detections

---

## Phase 4 — Risk Engine

**Target:** Q1 2026  
**Status:** Not started

Dependencies: Phase 3

- [ ] Per-user risk profile (max drawdown, risk per trade, max position size)
- [ ] Position size calculator (fixed fractional, ATR-normalized)
- [ ] Forex lot size computation (standard, mini, micro)
- [ ] Drawdown monitor with threshold alerts
- [ ] Portfolio exposure checker
- [ ] Risk page: live risk metrics and position suggestions
- [ ] Risk report export (PDF)

---

## Phase 5 — Monetization

**Target:** Q2 2026  
**Status:** Not started

Dependencies: Phase 4

- [ ] Stripe subscription integration (free, pro, enterprise plans)
- [ ] Plan upgrade / downgrade flow
- [ ] Stripe billing portal
- [ ] Usage limit enforcement in API (signal counts, market watches)
- [ ] In-app upgrade prompts at limit boundaries
- [ ] Admin: subscription management and override tools

---

## Phase 6 — Production Hardening

**Target:** Q3 2026  
**Status:** Not started

Dependencies: Phase 5

- [ ] Refresh token rotation and server-side blocklist
- [ ] Rate limiting per IP and per user
- [ ] Structured logging with Datadog or Logtail
- [ ] Error alerting (PagerDuty or similar)
- [ ] Load testing (k6 or Locust)
- [ ] Security audit (OWASP Top 10 review)
- [ ] GDPR compliance (data export, account deletion)
- [ ] Email notifications (Resend or SendGrid)
- [ ] Two-factor authentication (TOTP)

---

## Post-Launch Considerations

- Mobile app (Expo React Native) for signal alerts and quick risk checks
- Webhook integrations (send signals to Discord, Telegram, Slack)
- White-label licensing for brokers
- Multi-language support (ES, PT, AR)
