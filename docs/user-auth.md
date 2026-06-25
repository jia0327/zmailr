# User Authentication (zMailR Phase 1)

zMailR uses user accounts for the web Dashboard, scoped API tokens, and mailbox ownership. **Anonymous API access is not supported** — create mailboxes in Dashboard or via `POST /api/lease` with a Bearer token.

## Overview

| Feature | Auth | Notes |
|---------|------|-------|
| Web Dashboard (inbox, outbox, rules) | Session cookie | Login required; demo: `guest` / `guest` on [zmailr.itool.eu.cc](https://zmailr.itool.eu.cc/) |
| `POST /api/mailboxes` | Session or Bearer (`mail`) | Create temp inbox for authenticated user |
| Web send (`POST /api/user/send`) | Session cookie | Requires login |
| Programmatic API (`/api/lease`, `/api/mail`, `/api/send`, …) | Bearer token | User tokens or legacy admin tokens; all require auth |
| Admin panel (`ADMIN_PATH`) | Admin password cookie | URL path from `ADMIN_PATH` env var (UUID recommended). See [admin-guide.md](./admin-guide.md) |

## First-time setup

On first DB migration, if no users exist and `ADMIN_PASSWORD` is set, an **admin** user is created:

- **Username:** `admin`
- **Password:** same as `ADMIN_PASSWORD`
- **Quota:** unlimited (`-1`)

Open `https://your-domain/{ADMIN_PATH}` → **用户** tab to create additional users and set daily send quotas.

## Web login

```http
POST /api/auth/login
Content-Type: application/json

{"username": "admin", "password": "..."}
```

Sets HttpOnly cookie `zmail_user_session` (24h).

- `GET /api/auth/me` — profile + today's usage/quota
- `GET /api/user/quota` — daily send quota only (session or user Bearer token; any scope)
- `POST /api/auth/logout` — clear session

Frontend: `/login`, Dashboard (`/dashboard/usage`, `/dashboard/api-keys`, …).

## User API tokens

Logged-in users create tokens at **Dashboard → API 密钥** (`/dashboard/api-keys`) or via API:

```http
POST /api/user/tokens
Cookie: zmail_user_session=...

{"name": "my-script", "expiresInDays": 30, "scopes": ["lease", "mail", "send"]}
```

Scopes:

- `lease` — `POST /api/lease`
- `mail` — `GET /api/mail`
- `send` — `POST /api/send`

Plaintext token is returned **once** on creation; only SHA-256 hash is stored. The Dashboard may persist the plaintext in `localStorage` (per user) so you can copy a masked preview later; clearing browser data removes this convenience copy.

Token list includes **`last_used_at`** (Unix seconds, updated at most once per hour when the token is used on API requests).

### Check remaining send quota

```http
GET /api/user/quota
Authorization: Bearer <user-token>
```

Response (limited quota):

```json
{
  "dailySendQuota": 50,
  "sentToday": 10,
  "remaining": 40,
  "unlimited": false
}
```

Unlimited users (`daily_send_quota = -1`):

```json
{
  "dailySendQuota": -1,
  "sentToday": 10,
  "remaining": null,
  "unlimited": true
}
```

Also works with the login session cookie (no Bearer header).

## Daily send quota

Each user has `daily_send_quota` (emails per UTC day). `-1` = unlimited.

Enforced on:

- `POST /api/user/send` (session)
- `POST /api/send` (user Bearer tokens)

**Legacy** admin-created `api_tokens` remain unlimited for daily send quota (backward compatible).

## Per-user API rate limits

Each user has optional `rate_limit_per_min` and `rate_limit_burst` (D1 `users` table). Authenticated session or **user Bearer token** requests consume a per-user bucket (1-minute window):

| Plan (admin UI) | Sustained req/min | Burst |
|-----------------|-------------------|-------|
| Free (default) | 60 | — |
| Pro | 600 | 30 |
| Team | 3000 | 200 |
| Custom | manual | optional |

Response headers on `/api/*`: `X-RateLimit-Limit` (sustained rate), `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`. Excess requests return `429` with `{ "error": "rate_limit" }`.

**Legacy** admin API tokens and unauthenticated callers fall back to a **global per-IP** limit (default 60 req/min).

Admins configure plans in the admin panel → **用户** user modal. See [admin-guide.md](./admin-guide.md) for monitoring (429 hits) and audit entries (`user.rate_limit.update`).

## Web send

```http
POST /api/user/send
Cookie: zmail_user_session=...

{"to": "user@example.com", "subject": "Hello", "text": "Body", "from": "optional@your-domain.com"}
```

`from` must be a valid active mailbox on your domain (owned by you, or any active mailbox on the domain).

## OTP extract rules

Users can manage personal extraction rules at **Dashboard → 提取规则** (`/dashboard/extract-rules`).

| Endpoint | Auth | Notes |
|----------|------|-------|
| `GET /api/user/extract-rules` | Session | User rules + built-in rule descriptions (read-only) |
| `POST /api/user/extract-rules` | Session | Create rule `{ domain, regex, priority, enabled }` |
| `PUT /api/user/extract-rules/:id` | Session | Update own rule |
| `DELETE /api/user/extract-rules/:id` | Session | Delete own rule |

**Priority when extracting OTP for a mailbox:**

1. User custom rules (if mailbox has `user_id`)
2. Global admin rules (admin panel → 提取规则, `extract_rules.user_id IS NULL`)
3. Built-in code fallbacks (hard-coded, read-only in UI)

Within each tier: sender domain exact match beats `*`, then higher `priority` wins.

Admin global rules: `GET/POST/PUT/DELETE /{ADMIN_PATH}/api/rules` (global only).

## Admin user management

In the admin panel → **用户**:

- Create users (username, password, role, quota)
- Edit quota, **rate plan** (Free / Pro / Team / custom), reset password, enable/disable
- Delete users

API: `GET/POST/PUT/DELETE /{ADMIN_PATH}/api/users`

## Security notes

- Passwords: PBKDF2-SHA256 (100k iterations) + random salt
- API tokens: SHA-256 hash only
- Sessions: HMAC-signed cookie (same secret as admin, derived from `ADMIN_PASSWORD`); admin cookie scoped to `Path=/{ADMIN_PATH}`
- Admin panel URL is not exposed in the frontend bundle; set `ADMIN_PATH` to a UUID in production

See also: [brevo-setup.md](./brevo-setup.md) for outbound email configuration; [admin-guide.md](./admin-guide.md) for maintenance mode, rate-limit monitoring, and audit logs.
