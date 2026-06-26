# @zmailr/mcp

MCP (Model Context Protocol) server for [zMailR](https://github.com/jia0327/zmailr) temporary email automation.

Chinese docs: [docs/mcp.md](../../docs/mcp.md) · [docs/README.md](../../docs/README.md)

## Tools

| Tool | API | Description |
|------|-----|-------------|
| `lease_mailbox` | `POST /api/lease` | Create a random 24h mailbox |
| `wait_for_mail` | `GET /api/mail` | Long-poll for mail / OTP |
| `get_latest_code` | `GET /api/mailboxes/:address/latest-code` | Instant latest OTP |
| `get_latest_link` | `GET /api/mailboxes/:address/latest-link` | Instant latest verification link |
| `list_mailboxes` | `GET /api/mailboxes` | List user mailboxes |
| `list_emails` | `GET /api/mailboxes/:address/emails` | List emails in a mailbox |
| `delete_mailbox` | `DELETE /api/mailboxes/:address` | Delete mailbox and its emails |
| `get_email` | `GET /api/emails/:id` | Single email details |
| `delete_email` | `DELETE /api/emails/:id` | Delete a single email |
| `send_email` | `POST /api/send` | Outbound send (Brevo) |
| `get_quota` | `GET /api/user/quota` | Daily send quota |

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `ZMAILR_BASE_URL` | Yes | Deployment base URL (e.g. `https://zmailr.example.com`) |
| `ZMAILR_TOKEN` | Yes | Bearer API token from Dashboard → API Keys |

Demo site `ZMAILR_BASE_URL`: `https://zmailr.itool.eu.cc`

## Cursor MCP configuration

Add to `.cursor/mcp.json` (or Cursor Settings → MCP). Copy [`.cursor/mcp.json.example`](../../.cursor/mcp.json.example) as a starting point.

```json
{
  "mcpServers": {
    "zmailr": {
      "command": "npx",
      "args": ["-y", "@zmailr/mcp"],
      "env": {
        "ZMAILR_BASE_URL": "https://zmailr.itool.eu.cc",
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

## Claude Desktop

Same `mcpServers` structure as Cursor. Config file locations:

- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

## Token scopes

- `lease_mailbox` → `lease`
- `wait_for_mail`, `get_latest_code`, `get_latest_link`, `list_mailboxes`, `list_emails`, `delete_mailbox`, `get_email`, `delete_email` → `mail`
- `send_email` → `send`
- `get_quota` → any user token scope

## Development

```bash
pnpm --filter @zmailr/mcp run build
pnpm --filter @zmailr/mcp run test
```

## Install

Published on npm: [@zmailr/mcp](https://www.npmjs.com/package/@zmailr/mcp) (`1.0.0`).

Recommended (MCP host starts the stdio server via `npx`):

```bash
npx -y @zmailr/mcp
```

Or install globally:

```bash
npm install -g @zmailr/mcp
```

## License

MIT
