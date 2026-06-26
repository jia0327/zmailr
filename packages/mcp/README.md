# @zmailr/mcp

MCP (Model Context Protocol) server for [zMailR](https://github.com/jia0327/zmailr) temporary email automation.

## Tools

| Tool | API | Description |
|------|-----|-------------|
| `lease_mailbox` | `POST /api/lease` | Create a random 24h mailbox |
| `wait_for_mail` | `GET /api/mail` | Long-poll for mail / OTP |
| `get_latest_code` | `GET /api/mailboxes/:address/latest-code` | Instant latest OTP |
| `send_email` | `POST /api/send` | Outbound send (Brevo) |
| `get_quota` | `GET /api/user/quota` | Daily send quota |

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `ZMAILR_BASE_URL` | Yes | Deployment base URL (e.g. `https://zmailr.example.com`) |
| `ZMAILR_TOKEN` | Yes | Bearer API token from Dashboard → API Keys |

## Cursor MCP configuration

Add to `.cursor/mcp.json` (or Cursor Settings → MCP):

```json
{
  "mcpServers": {
    "zmailr": {
      "command": "npx",
      "args": ["-y", "@zmailr/mcp"],
      "env": {
        "ZMAILR_BASE_URL": "https://your-zmailr-domain.com",
        "ZMAILR_TOKEN": "your-bearer-token"
      }
    }
  }
}
```

### Local monorepo development

```json
{
  "mcpServers": {
    "zmailr": {
      "command": "node",
      "args": ["packages/mcp/dist/index.js"],
      "env": {
        "ZMAILR_BASE_URL": "http://localhost:8787",
        "ZMAILR_TOKEN": "your-token"
      }
    }
  }
}
```

Build first: `pnpm --filter @zmailr/mcp run build`

## Token scopes

- `lease_mailbox` → `lease`
- `wait_for_mail`, `get_latest_code` → `mail`
- `send_email` → `send`
- `get_quota` → any user token scope

## Install

```bash
npm install -g @zmailr/mcp
# or use npx @zmailr/mcp (stdio server — started by MCP host)
```

## License

MIT
