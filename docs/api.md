# CMD Trade Intelligence — API Documentation

## Base URL

All API endpoints are prefixed with `/api`.

## Authentication

The API uses JWT Bearer tokens. Include the access token in the `Authorization` header:

```
Authorization: Bearer <accessToken>
```

Access tokens expire after 15 minutes. Use the refresh endpoint to obtain a new one.

## Endpoints

### Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/healthz` | None | Server health check |

---

### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | None | Register a new account |
| POST | `/api/auth/login` | None | Login and receive tokens |
| POST | `/api/auth/logout` | None | Logout (client discards tokens) |
| POST | `/api/auth/refresh` | None | Refresh access token |

**Register** — `POST /api/auth/register`
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "fullName": "John Trader"
}
```

**Login** — `POST /api/auth/login`
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response (both):**
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "fullName": "John Trader",
    "role": "user",
    "plan": "free",
    "avatarUrl": null,
    "createdAt": "2025-07-04T00:00:00.000Z"
  }
}
```

---

### Users

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/users/me` | Required | Get current user profile |
| PATCH | `/api/users/me` | Required | Update profile |
| GET | `/api/users/me/settings` | Required | Get user settings |
| PATCH | `/api/users/me/settings` | Required | Update settings |

---

### Dashboard

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/dashboard/summary` | Required | Get dashboard summary metrics |

---

### Markets

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/markets/overview` | Required | Markets overview (placeholder) |

---

### Signals

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/signals` | Required | List signals |

**Query Parameters:**
- `status` — Filter by `active`, `closed`, or `pending`
- `limit` — Number of results (default 20, max 100)

---

### Risk

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/risk/summary` | Required | Risk management summary |

---

### Admin (Admin role required)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/users` | Admin | List all users (paginated) |
| GET | `/api/admin/stats` | Admin | Platform statistics |

**Query Parameters for `/api/admin/users`:**
- `page` — Page number (default 1)
- `limit` — Results per page (default 20, max 100)

---

## Error Responses

All errors return a JSON body with an `error` field:

```json
{ "error": "Description of the error" }
```

| Status | Meaning |
|--------|---------|
| 400 | Bad request — validation failed |
| 401 | Unauthorized — missing or invalid token |
| 403 | Forbidden — insufficient role |
| 404 | Not found |
| 409 | Conflict — e.g. email already registered |
| 500 | Internal server error |

## OpenAPI Spec

The machine-readable spec lives at `lib/api-spec/openapi.yaml`. All API changes must update the spec first, then regenerate typed clients:

```bash
pnpm --filter @workspace/api-spec run codegen
```
