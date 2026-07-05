# CMD Trade Intelligence

A commercial SaaS platform delivering AI-powered trade signal analysis and risk management for Forex and Crypto traders.

## Status

**Phase 1 — Foundation** ✅ — Architecture, authentication, and all UI scaffolding are complete. Market data integration and the AI engine are planned for subsequent phases.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, Tailwind CSS, TanStack Query, Wouter |
| Backend | Node.js, Express 5, TypeScript |
| Database | PostgreSQL + Drizzle ORM |
| Auth | JWT (access + refresh tokens, bcrypt password hashing) |
| Monorepo | pnpm workspaces |

## Project Structure

```
cmd-trade-intelligence/
├── artifacts/
│   ├── api-server/          # Express REST API
│   │   └── src/
│   │       ├── config/      # JWT config
│   │       ├── middlewares/ # Auth middleware
│   │       ├── routes/      # Route handlers (auth, users, signals, etc.)
│   │       └── utils/       # Token utilities
│   └── cmd-trade/           # React + Vite frontend
│       └── src/
│           ├── assets/
│           ├── components/
│           ├── context/     # AuthContext
│           ├── hooks/
│           ├── layouts/     # AppLayout (sidebar + header)
│           ├── pages/       # Login, Register, Dashboard, Markets, ...
│           └── services/
├── lib/
│   ├── api-client-react/    # Generated React Query hooks
│   ├── api-spec/            # OpenAPI spec (source of truth)
│   ├── api-zod/             # Generated Zod schemas (used by API server)
│   └── db/                  # Drizzle ORM schema + database client
├── shared/
│   ├── constants/           # Shared constants (pairs, timeframes, plan limits)
│   └── types/               # Shared TypeScript interfaces
├── ai_engine/               # Future: AI analysis modules (Python)
│   ├── analysis/
│   ├── confidence_engine/
│   ├── decision_engine/
│   └── explainability/
├── market_data/             # Future: Market data provider adapters
│   ├── cache/
│   ├── providers/
│   └── websocket/
├── risk_engine/             # Future: Risk calculation modules
│   ├── calculators/
│   └── position_sizing/
└── docs/                    # Project documentation
```

## Getting Started

### Prerequisites
- Node.js 24+
- pnpm 10+
- PostgreSQL (provisioned automatically by Replit)

### Run the API server
```bash
pnpm --filter @workspace/api-server run dev
```

### Run the frontend
```bash
pnpm --filter @workspace/cmd-trade run dev
```

### Type-check all packages
```bash
pnpm run typecheck
```

### Push DB schema changes
```bash
pnpm --filter @workspace/db run push
```

### Regenerate API client after spec changes
```bash
pnpm --filter @workspace/api-spec run codegen
```

## Pages

| Page | Route | Status |
|------|-------|--------|
| Login | `/login` | Complete |
| Register | `/register` | Complete |
| Dashboard | `/dashboard` | Complete (placeholder data) |
| Markets | `/markets` | Placeholder (Phase 2) |
| Analysis | `/analysis` | Placeholder (Phase 3) |
| Signals | `/signals` | Complete (list view) |
| Risk Management | `/risk` | Complete (default params) |
| Profile | `/profile` | Complete |
| Settings | `/settings` | Complete |
| Admin | `/admin` | Complete (users + stats) |

## API Endpoints

See [`docs/api.md`](docs/api.md) for the full API reference.

## Documentation

| Document | Description |
|----------|-------------|
| [`docs/project-plan.md`](docs/project-plan.md) | Development phases and team conventions |
| [`docs/features.md`](docs/features.md) | Feature specifications and status table |
| [`docs/database.md`](docs/database.md) | Schema documentation |
| [`docs/api.md`](docs/api.md) | API endpoint reference |
| [`docs/roadmap.md`](docs/roadmap.md) | Product roadmap by milestone |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Recommended | Access token signing secret |
| `JWT_REFRESH_SECRET` | Recommended | Refresh token signing secret |
| `PORT` | Auto-set | Service port (set by workflow) |
| `BASE_PATH` | Auto-set | URL base path (set by workflow) |

> In development, JWT secrets default to placeholder values. Set real secrets before deploying to production.
