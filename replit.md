# CMD Trade Intelligence

A commercial SaaS platform delivering AI-powered trade signal analysis and risk management for Forex and Crypto traders.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — Run the API server (port set by workflow)
- `pnpm --filter @workspace/cmd-trade run dev` — Run the React frontend (port set by workflow)
- `pnpm run typecheck` — Full typecheck across all packages
- `pnpm run build` — Typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — Regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — Push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string (auto-provisioned by Replit)
- Optional env: `JWT_SECRET`, `JWT_REFRESH_SECRET` — JWT signing secrets (have development fallbacks; set real values in production)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19, Vite, Tailwind CSS, TanStack Query, Wouter
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Auth: JWT (bcryptjs password hashing, jsonwebtoken)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec in `lib/api-spec/openapi.yaml`)

## Where things live

- `lib/api-spec/openapi.yaml` — Single source of truth for all API contracts
- `lib/db/src/schema/` — Drizzle ORM table definitions (users, user_settings, signals)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/middlewares/auth.ts` — JWT auth middleware (`requireAuth`, `requireAdmin`)
- `artifacts/api-server/src/utils/tokens.ts` — JWT sign/verify utilities
- `artifacts/cmd-trade/src/` — React frontend (pages, layouts, context, hooks)
- `shared/types/index.ts` — Shared TypeScript interfaces across all modules
- `shared/constants/index.ts` — Trading pairs, timeframes, plan limits
- `ai_engine/` — Future AI analysis modules (Phase 3)
- `market_data/` — Future market data providers (Phase 2)
- `risk_engine/` — Future risk calculators (Phase 4)
- `docs/` — Project documentation

## Architecture decisions

- **Contract-first API:** All endpoints are defined in `openapi.yaml` first; client hooks and Zod schemas are generated from it. Never hand-write what codegen produces.
- **JWT stateless auth:** Access tokens (15m) + refresh tokens (7d). No server-side session storage in Phase 1. Refresh token blocklist planned for Phase 6.
- **Monorepo with shared libs:** `lib/api-client-react` and `lib/api-zod` are generated packages; `lib/db` is the database client shared by the API server.
- **Dark-first theme:** The frontend forces dark mode as the default; users can change to light or system in settings.
- **Placeholder modules:** `ai_engine/`, `market_data/`, `risk_engine/` are scaffolded with README files. They will be implemented in Phases 2–4.

## Product

CMD Trade Intelligence is a SaaS platform for Forex and Crypto traders. Core features: user authentication, trade signal display, markets overview, risk management dashboard, and an admin panel. AI analysis and real market data feeds are planned for Phase 2–3.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After any change to `lib/api-spec/openapi.yaml`, run `pnpm --filter @workspace/api-spec run codegen` before building or typechecking.
- `pnpm run typecheck` runs `typecheck:libs` first, then leaf packages — trust it over the editor when they disagree.
- Do NOT run `pnpm dev` at the workspace root — apps run via workflows with injected PORT and BASE_PATH env vars.
- Do NOT call `configureWorkflow` for artifact services — their managed workflows already provide routing and env configuration.
- JWT secrets have development fallbacks — always set real secrets before deploying to production.
