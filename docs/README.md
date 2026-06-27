# zMailR 文档

<div class="zmailr-hero">

开源、可自托管的 24 小时临时邮箱与 OTP 自动化平台。Web 控制台 + Bearer API + MCP，部署在 Cloudflare Workers 边缘。

**本实例**：<SiteOrigin />（[`/`](/) 产品介绍页）· 演示账号 `guest` / `guest` · 登录 [`/login`](/login)

</div>

## 产品介绍页

未登录访问站点根路径 [`/`](/) 可查看公开落地页，包含：

- **Hero**：测试与 Agent 的临时邮箱；真实 MX 收验证信，24 小时自动销毁
- **Quickstart**：`curl` / Cursor MCP 双 Tab，底部 RESPONSE 示例
- **效果展示**：左侧收件流（OTP / 验证链接）与右侧 REST API + MCP 工具对照
- **能力网格**：收信、发信、规则、API 密钥等 9 项能力

已登录用户访问 `/` 会自动进入控制台 [`/dashboard/usage`](/dashboard/usage)。

## API 速通

> 三次 REST 或一次 MCP — 租用邮箱、收信、提取 OTP

Base URL：<SiteOrigin />

### 快速开始

1. 登录 [`/login`](/login)，在 [API 密钥](/dashboard/api-keys) 创建 Bearer Token（需 `lease` + `mail` scope）
2. `POST /api/lease` 租用临时邮箱
3. 将返回的 `email` 填入目标站点注册/验证流程
4. `GET /api/mailboxes/{address}/latest-code` 提取 OTP；或 `GET /api/mail?to=...&require_code=true` 长轮询

### 认证

```http
Authorization: Bearer <your-token>
```

Scope 与 Session 登录 → [user-auth.md](./user-auth.md)

### 核心端点

| 方法 | 路径 | Scope | 说明 |
|------|------|-------|------|
| `POST` | `/api/lease` | `lease` | 租用随机 24h 临时邮箱 |
| `GET` | `/api/mail` | `mail` | 长轮询收信 / OTP |
| `GET` | `/api/mailboxes/:address/latest-code` | `mail` | 即时查询最新 OTP |
| `GET` | `/api/mailboxes/:address/latest-link` | `mail` | 从最新邮件提取验证链接 |
| `GET` | `/api/mailboxes` | `mail` | 列出邮箱 |
| `GET` | `/api/mailboxes/:address/emails` | `mail` | 列出邮件 |
| `POST` | `/api/send` | `send` | Brevo 出站发信 |
| `GET` | `/api/user/quota` | 任意 | 日发信配额与用量 |

完整端点表与 curl 示例 → [API 参考](./api.md) · MCP 11 工具与 REST 一一对应 → [MCP 集成](./mcp.md)

### 租用临时邮箱

```http
POST /api/lease
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json
```

```json
{
  "success": true,
  "email": "k7m2x9@your-mail-domain",
  "address": "k7m2x9",
  "expiresAt": 1751030400
}
```

返回的 `email` 域名以实例配置为准，例如 <ExampleMailbox local="k7m2x9" />。`expiresAt` 为 Unix 时间戳，邮箱有效期 24 小时。

### 提取验证码

完整邮箱地址示例：<ExampleMailbox local="k7m2x9" />

```http
GET /api/mailboxes/k7m2x9@your-mail-domain/latest-code
Authorization: Bearer YOUR_TOKEN
```

```json
{
  "success": true,
  "code": "847291",
  "email": {
    "id": "em_abc123",
    "subject": "Your verification code",
    "from": "noreply@example.com",
    "receivedAt": 1751025683
  }
}
```

尚无验证码时返回 `404`（`"error": "no_code"`）；可改用 `GET /api/mail` 长轮询阻塞等待。

### MCP

工具：`lease_mailbox`、`wait_for_mail`、`get_latest_code`、`send_email`、`get_quota`。环境变量 `ZMAILR_BASE_URL`（本实例为 <SiteOrigin />）、`ZMAILR_TOKEN` → [MCP 集成指南](./mcp.md)

> 推荐 `npx @zmailr/mcp`；克隆仓库开发见 [mcp.json.example](./mcp.json.example) 与 MCP 文档中的「本地 monorepo 开发」。

### 速率限制

已登录用户按用户限流（固定 1 分钟窗口）；未识别用户按 IP 限流（默认 60 req/min）。响应头 `X-RateLimit-*`；超限 `429`。

| 方案 | sustained (req/min) | 突发 (burst) |
|------|---------------------|--------------|
| Free（默认） | 60 | — |
| Pro | 600 | 30 |
| Team | 3000 | 200 |

### OpenAPI

| 资源 | URL |
|------|-----|
| OpenAPI JSON | [`GET /openapi.json`](/openapi.json) |
| 人类可读文档 | [API 交互文档](./api-interactive.md)（[`/docs/api-interactive`](/docs/api-interactive)） |

---

<div class="zmailr-callout">

**自托管** — Fork 后配置 GitHub Secrets 与 Cloudflare Email Routing，推送 `main` 自动部署 → [部署指南](./deploy.md)

</div>

## 更多文档

| 文档 | 说明 |
|------|------|
| [API 参考](./api.md) | 逐接口说明：参数、返回、错误码、curl 示例 |
| [用户认证与 Token](./user-auth.md) | Session / Bearer、scope、提取规则 |
| [MCP 集成](./mcp.md) | `@zmailr/mcp` 工具与 Cursor 配置 |
| [部署指南](./deploy.md) | D1、Email Routing、R2 附件、本地开发 |
| [管理后台指南](./admin-guide.md) | 用户、速率方案、维护模式、审计 |
| [安全说明](./security.md) | 鉴权模型、部署检查清单 |
| [Brevo 发信配置](./brevo-setup.md) | 出站发信、SPF/DKIM/DMARC |
| [E2E 测试报告](./testing.md) | 演示站 Pass/Fail 与截图 |
| [项目 README](https://github.com/jia0327/zmailr/blob/main/README.md) | 功能概览、效果图、使用指南 |
