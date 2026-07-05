# CMD Trade Intelligence — Feature Specifications

## Core Features

### Authentication & Accounts

| Feature | Status | Notes |
|---------|--------|-------|
| Email/password registration | Complete | Bcrypt password hashing |
| Email/password login | Complete | JWT access + refresh tokens |
| Token refresh | Complete | Stateless; blocklist planned for Phase 6 |
| Logout | Complete | Client-side token deletion; server-side blocklist in Phase 6 |
| User profile management | Complete | Update name and avatar |
| User settings | Complete | Theme, notifications, default currency/timeframe |

### Dashboard

| Feature | Status | Notes |
|---------|--------|-------|
| Summary metrics | Complete | Signal count, active markets, plan info |
| Recent signals widget | Placeholder | Populated when signals engine is ready |
| Market status widget | Placeholder | Populated when market data is connected |

### Markets

| Feature | Status | Notes |
|---------|--------|-------|
| Markets overview | Placeholder | Market data provider not yet connected |
| Price feeds | Not started | Phase 2 |
| Watchlist | Not started | Phase 2 |
| Symbol search | Not started | Phase 2 |
| Chart display | Not started | Phase 2 |

### Signals

| Feature | Status | Notes |
|---------|--------|-------|
| Signal list view | Complete | Filter by status; paginated |
| Signal detail | Not started | Phase 3 |
| Signal generation | Not started | Phase 3 (AI engine) |
| Signal performance | Not started | Phase 3 |
| Signal alerts | Not started | Phase 3 |

### Analysis

| Feature | Status | Notes |
|---------|--------|-------|
| AI analysis engine | Not started | Phase 3 |
| Pattern detection | Not started | Phase 3 |
| Confidence scoring | Not started | Phase 3 |
| Explainability | Not started | Phase 4 |

### Risk Management

| Feature | Status | Notes |
|---------|--------|-------|
| Risk summary display | Complete | Shows default parameters |
| Risk profile configuration | Not started | Phase 4 |
| Position size calculator | Not started | Phase 4 |
| Drawdown monitor | Not started | Phase 4 |
| Portfolio exposure tracker | Not started | Phase 4 |

### Admin

| Feature | Status | Notes |
|---------|--------|-------|
| User list (paginated) | Complete | Admin role required |
| Platform stats | Complete | Total users, signals, plan breakdown |
| User management actions | Not started | Phase 5 |
| Feature flags | Not started | Phase 5 |

### Subscriptions & Billing

| Feature | Status | Notes |
|---------|--------|-------|
| Stripe integration | Not started | Phase 5 |
| Plan upgrade flow | Not started | Phase 5 |
| Usage limit enforcement | Not started | Phase 5 |
| Billing portal | Not started | Phase 5 |

## User Roles

| Role | Access |
|------|--------|
| `user` | All standard pages, own signals and settings |
| `admin` | All user pages + admin panel, platform stats, user management |

## Subscription Plans

| Plan | Signals/day | Markets | History |
|------|-------------|---------|---------|
| Free | 3 | 5 | 7 days |
| Pro | 50 | 50 | 90 days |
| Enterprise | Unlimited | Unlimited | Unlimited |
