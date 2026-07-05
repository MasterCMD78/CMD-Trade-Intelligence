# CMD Trade Intelligence — Database Documentation

## Technology

- **Database:** PostgreSQL (Replit managed)
- **ORM:** Drizzle ORM (`drizzle-orm`)
- **Validation:** Drizzle-Zod for schema-derived Zod types
- **Schema location:** `lib/db/src/schema/`
- **Config:** `lib/db/drizzle.config.ts`

## Running Migrations

Schema changes use Drizzle's push workflow (dev only):

```bash
pnpm --filter @workspace/db run push
```

Production schema changes are applied automatically by Replit's publish flow.

## Tables

### `users`

Stores registered user accounts.

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | Auto-increment |
| `email` | TEXT UNIQUE NOT NULL | Login identifier |
| `password_hash` | TEXT NOT NULL | Bcrypt hash (cost 12) |
| `full_name` | TEXT NOT NULL | Display name |
| `role` | TEXT NOT NULL | `user` or `admin`; default `user` |
| `plan` | TEXT NOT NULL | `free`, `pro`, or `enterprise`; default `free` |
| `avatar_url` | TEXT NULL | Optional profile picture URL |
| `created_at` | TIMESTAMP NOT NULL | Auto-set on insert |
| `updated_at` | TIMESTAMP NOT NULL | Must be updated manually on change |

### `user_settings`

Stores per-user preferences. One row per user (1:1 with `users`).

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | Auto-increment |
| `user_id` | INT NOT NULL UNIQUE FK | References `users.id` |
| `theme` | TEXT NOT NULL | `dark`, `light`, or `system`; default `dark` |
| `notifications` | BOOLEAN NOT NULL | default `true` |
| `default_currency` | TEXT NOT NULL | default `USD` |
| `default_timeframe` | TEXT NOT NULL | default `1H` |
| `updated_at` | TIMESTAMP NOT NULL | Must be updated manually on change |

### `signals`

Stores trade signals. Created manually or by the AI engine (Phase 3).

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | Auto-increment |
| `user_id` | INT NULL FK | References `users.id`; nullable for system-generated signals |
| `symbol` | TEXT NOT NULL | Trading pair, e.g. `EURUSD`, `BTCUSDT` |
| `direction` | TEXT NOT NULL | `buy`, `sell`, or `neutral` |
| `status` | TEXT NOT NULL | `pending`, `active`, or `closed`; default `pending` |
| `timeframe` | TEXT NOT NULL | e.g. `1H`, `4H`, `1D` |
| `notes` | TEXT NULL | Free-form signal notes or rationale |
| `created_at` | TIMESTAMP NOT NULL | Auto-set on insert |
| `updated_at` | TIMESTAMP NOT NULL | Must be updated manually on change |

## Planned Tables (Future Phases)

| Table | Phase | Purpose |
|-------|-------|---------|
| `refresh_tokens` | 6 | Token blocklist for secure logout |
| `market_watchlists` | 2 | Per-user saved symbol watchlists |
| `watchlist_items` | 2 | Individual symbols in a watchlist |
| `signal_performance` | 3 | Historical signal outcome tracking |
| `risk_profiles` | 4 | Per-user risk configuration |
| `subscriptions` | 5 | Stripe subscription records |
| `audit_logs` | 6 | Admin action audit trail |

## Adding a New Table

1. Create `lib/db/src/schema/<entity>.ts` with Drizzle table + Zod insert schema + types
2. Export from `lib/db/src/schema/index.ts`
3. Add the entity to the OpenAPI spec in `lib/api-spec/openapi.yaml`
4. Run codegen: `pnpm --filter @workspace/api-spec run codegen`
5. Push schema: `pnpm --filter @workspace/db run push`
6. Implement route handlers in `artifacts/api-server/src/routes/`
