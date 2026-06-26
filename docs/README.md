# zMailR 文档

> **文档站点**：本目录 Markdown 同时作为 [VitePress](https://vitepress.dev/) 源文件，构建后静态发布于 `/docs/`（配置见 `docs/.vitepress/`，构建脚本 `@zmail/docs-site`）。不重复维护正文，仅通过侧边栏与导航组织阅读路径。

开源、可自托管的 24 小时临时邮箱与 OTP 自动化平台。Web 控制台 + Bearer API + MCP，部署在 Cloudflare Workers。

**在线演示**：[zmailr.itool.eu.cc](https://zmailr.itool.eu.cc/) · 账号 `guest` / `guest`

---

## API 速通

> 三次 REST 或一次 MCP，拿到邮箱、收信、提 OTP。

演示站 Base URL：`https://zmailr.itool.eu.cc`

### 快速开始

1. **登录并创建 Token** — 登录 [演示站](https://zmailr.itool.eu.cc/login)（`guest` / `guest` 或注册），在 [API 密钥](https://zmailr.itool.eu.cc/dashboard/api-keys) 创建 Bearer Token（明文仅显示一次，需含 `lease` 与 `mail` scope）。
2. **租用邮箱** — `POST /api/lease`，请求头携带 `Authorization: Bearer <token>`。
3. **用于注册/验证** — 将返回的 `email` 填入目标站点注册或验证流程。
4. **提取 OTP** — `GET /api/mailboxes/{address}/latest-code`（非阻塞）；或长轮询 `GET /api/mail?to=...&require_code=true`。详见 [API 快速参考](./api.md#示例)。

### 认证

所有 `/api/*` 程序化接口均需 Bearer Token，**不支持匿名调用**：

```http
Authorization: Bearer <your-token>
```

Token 在 Dashboard → **API 密钥**（`/dashboard/api-keys`）创建。Scope、`Session` 登录等详见 [user-auth.md](./user-auth.md)。

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

完整端点表、公开路由与 Web Dashboard 路由 → [API 快速参考](./api.md#端点一览)。

### 租用临时邮箱

```http
POST /api/lease
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json
```

响应：

```json
{
  "success": true,
  "email": "k7m2x9@zmailr.itool.eu.cc",
  "address": "k7m2x9",
  "expiresAt": 1751030400
}
```

`expiresAt` 为 Unix 时间戳，邮箱有效期 24 小时。curl 示例见 [api.md § 示例](./api.md#1-租用临时邮箱)。

### 提取验证码

```http
GET /api/mailboxes/k7m2x9@zmailr.itool.eu.cc/latest-code
Authorization: Bearer YOUR_TOKEN
```

响应：

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

尚无验证码时返回 `404`，body 含 `"error": "no_code"`。可改用 `GET /api/mail` 长轮询阻塞等待。

### MCP

```bash
npx -y @zmailr/mcp
```

暴露 5 个工具：`lease_mailbox`、`wait_for_mail`、`get_latest_code`、`send_email`、`get_quota`。

环境变量：`ZMAILR_BASE_URL`、`ZMAILR_TOKEN`。Cursor 配置与 scope 对照 → [MCP 集成指南](./mcp.md)。

### 速率限制

按用户分桶（1 分钟滑动窗口），响应头含 `X-RateLimit-Limit`、`X-RateLimit-Remaining`、`X-RateLimit-Reset`；超限返回 `429`。

| 方案 | sustained (req/min) | 突发 (burst) |
|------|---------------------|--------------|
| Free（默认） | 60 | — |
| Pro | 600 | 30 |
| Team | 3000 | 200 |

详情与自定义方案 → [api.md § 速率限制](./api.md#速率限制)。

### OpenAPI

| 资源 | URL |
|------|-----|
| OpenAPI JSON | [`GET /openapi.json`](https://zmailr.itool.eu.cc/openapi.json) |
| 人类可读文档 | [`/api-docs`](https://zmailr.itool.eu.cc/api-docs) |

---

## 自托管部署

1. **Fork 并部署** — 配置 GitHub Secrets 与 D1，推送 `main` 自动部署。详见 [部署指南](./deploy.md)。
2. **配置收信** — Cloudflare Email Routing Catch-all → Worker。见 [部署指南 §4](./deploy.md#4-入站邮件email-routing)。
3. **（可选）配置发信** — Brevo Transactional API + DNS。见 [Brevo 集成](./brevo-setup.md)。
4. **验证 API** — `python scripts/verify_api.py --base-url https://你的域名 --token <token>`。
5. **（可选）MCP** — 配置 `@zmailr/mcp`。见 [MCP 集成](./mcp.md)。

---

## API 参考

| 文档 | 说明 |
|------|------|
| [**API 快速参考**](./api.md) | 端点一览、认证、速率限制、curl 示例 |
| [用户认证与 API Token](./user-auth.md) | Session / Bearer、Token scope、配额、提取规则、OpenAPI |
| 在线文档 | 部署实例 [`/api-docs`](https://zmailr.itool.eu.cc/api-docs) · [`/openapi.json`](https://zmailr.itool.eu.cc/openapi.json) |

**要点**：所有程序化 API 均需 `Authorization: Bearer <token>`，**不支持匿名调用**。Token 在 Dashboard → **API 密钥** 创建，可选 `lease` / `mail` / `send` scope。

---

## MCP 集成

| 文档 | 说明 |
|------|------|
| [MCP 集成指南](./mcp.md) | `@zmailr/mcp` 工具列表、环境变量、Cursor 配置 |
| [packages/mcp/README.md](../packages/mcp/README.md) | npm 包 README（英文） |

---

## 部署与运维

| 文档 | 说明 |
|------|------|
| [部署指南](./deploy.md) | D1、GitHub Secrets、Email Routing、R2 附件、本地开发 |
| [管理后台指南](./admin-guide.md) | `ADMIN_PATH`、用户、速率方案、维护模式、审计日志 |

---

## 集成

| 文档 | 说明 |
|------|------|
| [Brevo 发信配置](./brevo-setup.md) | 出站发信、SPF/DKIM/DMARC、API Key、GitHub Secret |

---

## 测试

| 文档 | 说明 |
|------|------|
| [生产 E2E 测试报告](./testing.md) | 演示站 Pass/Fail 与截图索引 |

---

## 对比与其他

| 文档 | 说明 |
|------|------|
| [与 MailSink 功能对照](./mailsink-comparison.md) | 端点映射、架构、差异化能力 |
| [项目 README](../README.md) | 功能概览、效果图、使用指南 |
| [English README](../README.en.md) | English project overview |

---

## 文档结构

```
docs/
├── README.md                 ← 本页（文档导航）
├── api.md                    API 快速参考
├── deploy.md                 部署指南
├── user-auth.md              用户认证与 API Token
├── mcp.md                    MCP 集成
├── admin-guide.md            管理后台
├── brevo-setup.md            Brevo 出站发信
├── testing.md                E2E 测试报告
└── mailsink-comparison.md    与 MailSink 对照
```
