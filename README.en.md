# <div align="center">zMailR</div>

<div align="center">
  <p>
    <strong>English</strong> | <a href="./README.md">中文</a>
  </p>

  <p><em>Web UI is Chinese (zh-CN) only.</em></p>

  <p>
    <a href="https://zmailr.itool.eu.cc/" target="_blank"><strong>Live Demo</strong></a>
    ·
    <a href="docs/README.md"><strong>Documentation</strong></a>
  </p>
</div>

---

## One-liner

**Open-source, self-hostable 24-hour temporary email and OTP automation — web console plus Bearer API for scripts and CI.**

**Stack**: Cloudflare Workers, D1, R2 (attachments), Email Routing (inbound), Brevo (outbound), React + Vite.

**Demo**: [zmailr.itool.eu.cc](https://zmailr.itool.eu.cc/) · `guest` / `guest`

---

## Features

### Web

- Login/session, dashboard with usage and **API Token reminders** (missing token / expiring within 7 days)
- Inbox/outbox, OTP highlight, **attachment list/preview/download** (session auth), mailbox history, bulk delete
- API keys (1 Bearer token per user, `lease` / `mail` / `send` scopes)
- API debug page, extract rules, announcements, dark/light theme

### Programmatic API

| Endpoint | Purpose |
|----------|---------|
| `POST /api/lease` | Lease temporary mailbox |
| `GET /api/mail` | Long-poll mail / OTP |
| `POST /api/send` | Outbound send (Brevo) |
| `GET /api/user/quota` | Daily send quota |

- **Auth required** — no anonymous API; use Dashboard session or `Authorization: Bearer <token>`
- **OpenAPI**: [`/openapi.json`](https://zmailr.itool.eu.cc/openapi.json) (generated at build → `frontend/public/openapi.json`)
- **Human docs**: [`/api-docs`](https://zmailr.itool.eu.cc/api-docs)
- **MCP**: [`@zmailr/mcp`](packages/mcp) — see [docs/mcp.md](docs/mcp.md)
- Rate limit headers: `x-ratelimit-limit` / `remaining` / `reset`

See [docs/api.md](docs/api.md) for endpoint tables and curl examples; [docs/user-auth.md](docs/user-auth.md) for scopes, per-user rate plans (Free / Pro / Team), and token UX.

### Admin console

Secret URL `https://your-domain/{ADMIN_PATH}` with `ADMIN_PASSWORD`. See [docs/admin-guide.md](docs/admin-guide.md):

- Users, rate plans, announcements, extract rules
- Rate-limit monitoring (429 hits), maintenance mode, audit logs, Brevo stats

### Infrastructure

- GitHub Actions deploy on `main`
- D1 persistence; **R2** `zmailr-attachments` for inbound attachment bytes (D1 metadata + legacy fallback)
- **Health probes**: public `GET /api/public/status` checks D1/R2/Brevo (`ok` / `degraded` / `error`)
- Brevo outbound — [docs/brevo-setup.md](docs/brevo-setup.md)

---

## Quick start (self-host)

1. Fork and configure GitHub Secrets — [docs/deploy.md](docs/deploy.md)
2. Enable Email Routing catch-all → Worker
3. Create R2 bucket `zmailr-attachments` (no bucket ID in secrets; `wrangler.toml` uses `bucket_name` only)
4. Log in, create Bearer token at **Dashboard → API 密钥**
5. Verify: `python scripts/verify_api.py --base-url https://your-domain --token <token>`

---

## Documentation

Full categorized index: **[docs/README.md](docs/README.md)** (Chinese hub).

| Category | Doc | Description |
|----------|-----|-------------|
| Quickstart | [docs/README.md](docs/README.md) | Demo → deploy → verify API |
| API | [docs/api.md](docs/api.md) | Endpoints, auth, rate limits, curl examples |
| | [docs/user-auth.md](docs/user-auth.md) | Session / Bearer, scopes, extract rules, OpenAPI |
| MCP | [docs/mcp.md](docs/mcp.md) | `@zmailr/mcp`, Cursor config |
| Deploy | [docs/deploy.md](docs/deploy.md) | D1, Secrets, R2, Email Routing |
| Admin | [docs/admin-guide.md](docs/admin-guide.md) | Admin console |
| Integration | [docs/brevo-setup.md](docs/brevo-setup.md) | Brevo + DNS |
| Testing | [docs/testing.md](docs/testing.md) | Production E2E report |
| Other | [README.md](README.md) | Full Chinese README with screenshots |

---

## License

[MIT License](./LICENSE)
