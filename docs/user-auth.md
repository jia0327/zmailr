# User Authentication (zMailR Phase 1)

zMailR uses user accounts for the web Dashboard, scoped API tokens, and mailbox ownership. **Anonymous API access is not supported** — create mailboxes in Dashboard or via `POST /api/lease` with a Bearer token.

## Overview

| Feature | Auth | Notes |
|---------|------|-------|
| Web Dashboard (inbox, outbox, rules) | Session cookie | Login required; demo: `guest` / `guest` on [zmailr.itool.eu.cc](https://zmailr.itool.eu.cc/) |
| `POST /api/mailboxes` | Session or Bearer (`mail`) | Create temp inbox for authenticated user |
| Web send (`POST /api/user/send`) | Session cookie | Requires login |
| Programmatic API (`/api/lease`, `/api/mail`, `/api/send`, …) | Bearer token | User tokens or legacy admin tokens; all require auth |
| Admin `/admin` | Admin password cookie | Unchanged |

## First-time setup

On first DB migration, if no users exist and `ADMIN_PASSWORD` is set, an **admin** user is created:

- **Username:** `admin`
- **Password:** same as `ADMIN_PASSWORD`
- **Quota:** unlimited (`-1`)

Use `/admin` → **用户** tab to create additional users and set daily send quotas.

## Web login

```http
POST /api/auth/login
Content-Type: application/json

{"username": "admin", "password": "..."}
```

Sets HttpOnly cookie `zmail_user_session` (24h).

- `GET /api/auth/me` — profile + today's usage/quota
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

Plaintext token is returned **once** on creation; only SHA-256 hash is stored.

## Daily send quota

Each user has `daily_send_quota` (emails per UTC day). `-1` = unlimited.

Enforced on:

- `POST /api/user/send` (session)
- `POST /api/send` (user Bearer tokens)

**Legacy** admin-created `api_tokens` remain unlimited (backward compatible).

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
2. Global admin rules (`/admin` → 提取规则, `extract_rules.user_id IS NULL`)
3. Built-in code fallbacks (hard-coded, read-only in UI)

Within each tier: sender domain exact match beats `*`, then higher `priority` wins.

Admin global rules: `GET/POST/PUT/DELETE /admin/api/rules` (unchanged, global only).

## Admin user management

Under `/admin` → **用户**:

- Create users (username, password, role, quota)
- Edit quota, reset password, enable/disable
- Delete users

API: `GET/POST/PUT/DELETE /admin/api/users`

## Security notes

- Passwords: PBKDF2-SHA256 (100k iterations) + random salt
- API tokens: SHA-256 hash only
- Sessions: HMAC-signed cookie (same secret as admin, derived from `ADMIN_PASSWORD`)

See also: [brevo-setup.md](./brevo-setup.md) for outbound email configuration.
