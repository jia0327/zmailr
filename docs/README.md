# 快速开始

<div class="zmailr-hero">

开源临时邮箱与 OTP 自动化。**本实例** <SiteOrigin /> · 演示账号 `guest` / `guest` · <SiteLink to="/login">登录</SiteLink>

</div>

## 三步上手

1. 登录 <SiteLink to="/login">/login</SiteLink>，在 <SiteLink to="/dashboard/api-keys">API 密钥</SiteLink> 创建 Bearer Token（勾选 `lease` + `mail`）
2. `POST /api/lease` 租用 24 小时临时邮箱
3. 用返回的 `email` 去目标站点注册，再 `GET /api/mailboxes/{address}/latest-code` 或 `GET /api/mail` 取 OTP

Base URL：<SiteOrigin />

## curl 示例

```bash
# 1. 租用邮箱
curl -X POST '{baseUrl}/api/lease' \
  -H 'Authorization: Bearer {token}'

# 2. 提取 OTP（将 email 换为上一步返回值）
curl '{baseUrl}/api/mailboxes/k7m2x9@your-mail-domain/latest-code' \
  -H 'Authorization: Bearer {token}'
```

将 `{baseUrl}` 换为 <SiteOrigin />，`{token}` 换为你的 API 密钥。

## MCP（Cursor / Claude）

```json
{
  "mcpServers": {
    "zmailr": {
      "command": "npx",
      "args": ["-y", "@zmailr/mcp"],
      "env": {
        "ZMAILR_BASE_URL": "https://your-domain",
        "ZMAILR_TOKEN": "your-bearer-token"
      }
    }
  }
}
```

`ZMAILR_BASE_URL` 填 <SiteOrigin />。详见 [MCP 详解](./mcp.md)。

## 进一步阅读

- [API 详解](./api.md) — 全部 REST 端点、参数、错误码、MCP 工具对照
- [MCP 详解](./mcp.md) — Cursor / Claude Desktop 配置与工具说明
- OpenAPI：<SiteLink to="/openapi.json">/openapi.json</SiteLink> · 交互式文档：<SiteLink to="/api-docs">/api-docs</SiteLink>
