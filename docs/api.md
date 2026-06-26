# API 快速参考

zMailR 程序化接口通过 **Bearer Token** 鉴权。**不支持匿名 API**。

- 完整鉴权、Token scope、Web Session 说明 → [user-auth.md](./user-auth.md)
- 参数详情与 Schema → 部署实例 [`/api-docs`](https://zmailr.itool.eu.cc/api-docs) 或 [`GET /openapi.json`](https://zmailr.itool.eu.cc/openapi.json)
- AI 助手集成 → [mcp.md](./mcp.md)

---

## 认证

所有 `/api/*` 程序化接口（除公开路由）需在请求头携带：

```http
Authorization: Bearer <your-token>
```

在 Dashboard → **API 密钥**（`/dashboard/api-keys`）创建 Token。明文 **仅在创建时返回一次**。

| Scope | 允许调用的 API |
|-------|----------------|
| `lease` | `POST /api/lease` |
| `mail` | 读信、邮箱列表/删除、`GET /api/mail` 等 |
| `send` | `POST /api/send` |

`GET /api/user/quota` 接受任意用户 Token scope，或 Web Session Cookie。

---

## 端点一览

### 公开（无需认证）

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/openapi.json` | OpenAPI 3.1 规范 |
| `GET` | `/api/health` | 健康检查 |
| `GET` | `/api/public/status` | 维护模式状态与依赖连通性（D1、R2、Brevo） |
| `GET` | `/api/config` | 前端公开配置（域名等） |

### Bearer API（程序化）

| 方法 | 路径 | Scope | 说明 |
|------|------|-------|------|
| `POST` | `/api/lease` | `lease` | 租用随机 24h 临时邮箱 |
| `GET` | `/api/mail` | `mail` | 长轮询收信 / OTP（query: `to`, `timeout`, `since`, `require_code`） |
| `GET` | `/api/mailboxes` | `mail` | 列出邮箱 |
| `DELETE` | `/api/mailboxes/:address` | `mail` | 删除邮箱 |
| `GET` | `/api/mailboxes/:address/emails` | `mail` | 列出邮件 |
| `GET` | `/api/mailboxes/:address/latest-code` | `mail` | 即时查询最新 OTP |
| `GET` | `/api/mailboxes/:address/latest-link` | `mail` | 从最新邮件提取验证链接 |
| `GET` | `/api/emails/:id` | `mail` | 单封邮件详情 |
| `GET` | `/api/emails/:id/raw` | `mail` | 原始 MIME |
| `GET` | `/api/emails/:id/attachments` | `mail` | 附件列表 |
| `GET` | `/api/attachments/:id` | `mail` | 下载附件（R2 或 D1 回退） |
| `DELETE` | `/api/emails/:id` | `mail` | 删除邮件 |
| `POST` | `/api/send` | `send` | Brevo 出站发信 |
| `GET` | `/api/user/quota` | 任意 | 日发信配额与用量 |

> `POST /api/mailboxes`（匿名创建）**已废弃**，恒返回 401。请使用 `POST /api/lease` 或 Dashboard / `POST /api/user/mailboxes`。

Web Dashboard 专用路由（Session Cookie）见 [user-auth.md](./user-auth.md)。

### 公开状态 `GET /api/public/status` {#public-status}

无需认证。返回**维护模式**与**依赖连通性**；Dashboard 用于顶部维护横幅，运维可用于部署后探活。

**聚合状态 `status`**：

| 值 | 含义 |
|----|------|
| `ok` | D1 与 R2 正常；Brevo 未配置或 API 可用 |
| `degraded` | D1/R2 正常，但已配置 Brevo 且账户 API 调用失败 |
| `error` | D1 或 R2 不可用 |

**响应示例**：

```json
{
  "success": true,
  "status": "ok",
  "maintenance": {
    "enabled": false,
    "message": null
  },
  "checks": {
    "d1": { "ok": true },
    "r2": { "ok": true, "optional": false },
    "brevo": { "ok": true, "configured": false, "optional": true }
  }
}
```

**`checks` 对象**（各检查项均为 `{ ok: boolean, ... }`）：

| 键 | 探测方式 | 附加字段 |
|----|----------|----------|
| `d1` | `SELECT 1` | 失败时 `message` |
| `r2` | 附件 bucket `list({ limit: 1 })` | `optional: false`；失败时 `message` |
| `brevo` | 已配置时调用 Brevo 账户 API | `configured`（是否设置 `BREVO_API_KEY`）、`optional: true`；未配置时 `ok: true, configured: false` |

`GET /api/health` 仅返回静态 `{ "status": "ok" }`，**不含**依赖探测。部署验证见 [deploy.md §9](./deploy.md#9-部署后验证)。

---

## 速率限制

按**用户**分桶（1 分钟滑动窗口）。响应头：

| 头 | 说明 |
|----|------|
| `X-RateLimit-Limit` |  sustained 速率（req/min） |
| `X-RateLimit-Remaining` | 剩余请求数 |
| `X-RateLimit-Reset` | 窗口重置 Unix 时间戳 |
| `Retry-After` | 超限时建议等待秒数 |

超限返回 `429`，body：`{ "error": "rate_limit" }`。

| 方案（管理后台） | sustained (req/min) | 突发 (burst) |
|-----------------|---------------------|--------------|
| Free（默认） | 60 | — |
| Pro | 600 | 30 |
| Team | 3000 | 200 |
| 自定义 | 手动填写 | 可选 |

Legacy admin Token 与未识别用户的请求回退到**全局 IP 限流**（默认 60 req/min）。管理员配置与 429 监控见 [admin-guide.md](./admin-guide.md)。

---

## 示例

### 1. 租用临时邮箱

```bash
curl -X POST "https://你的域名/api/lease" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

响应含 `address`（如 `abc123@example.com`），有效期 24 小时。

### 2. 长轮询等待 OTP

```bash
curl -G "https://你的域名/api/mail" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  --data-urlencode "to=abc123@example.com" \
  --data-urlencode "timeout=60" \
  --data-urlencode "require_code=true"
```

默认最长等待约 60s；返回 `extractedCode` 或完整邮件摘要。

### 3. 即时查询最新验证码

```bash
curl "https://你的域名/api/mailboxes/abc123@example.com/latest-code" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

非阻塞；适合轮询间隔较短的脚本。

### 4. 出站发信（需 Brevo）

```bash
curl -X POST "https://你的域名/api/send" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"to":"user@example.com","subject":"Test","text":"Hello","from":"abc123@example.com"}'
```

`from` 须为已租用且未过期的临时地址。Brevo 配置见 [brevo-setup.md](./brevo-setup.md)。

### 5. 查询发信配额

```bash
curl "https://你的域名/api/user/quota" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## OpenAPI

| 资源 | URL |
|------|-----|
| OpenAPI JSON | `GET /openapi.json` |
| 人类可读文档 | `/api-docs` |

构建时由 `scripts/generate-openapi.ts` 生成 `frontend/public/openapi.json`（`pnpm run build`）。

---

## 相关文档

| 文档 | 说明 |
|------|------|
| [user-auth.md](./user-auth.md) | Session 登录、Token 创建、附件访问、提取规则、安全说明 |
| [mcp.md](./mcp.md) | `@zmailr/mcp` 工具与 Cursor 配置 |
| [deploy.md](./deploy.md) | 部署与部署后验证 |
| [文档首页](./) | 全部文档分类导航 |
