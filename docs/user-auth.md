# 用户认证与 API Token

> **API 端点速查** → [api.md](./api.md) · **文档导航** → [文档首页](./)

zMailR 以**用户账户**为基础：Web Dashboard、scoped API Token、邮箱所有权均绑定用户。**不支持匿名 API**——创建邮箱须在 Dashboard 操作，或通过 `POST /api/lease` 携带 Bearer Token。

---

## 概览

| 功能 | 鉴权 | 说明 |
|------|------|------|
| Web Dashboard（收件箱、发件箱、规则等） | Session Cookie | 须登录；演示站 `guest` / `guest` |
| `POST /api/user/mailboxes` | Session 或 Bearer（`mail`） | 为当前用户创建临时收件箱 |
| Web 发信 `POST /api/user/send` | Session Cookie | 须登录 |
| 程序化 API（`/api/lease`、`/api/mail`、`/api/send` 等） | Bearer Token | 用户 Token 或 legacy admin Token；**均需认证** |
| 管理后台（`ADMIN_PATH`） | Admin 密码 Cookie | URL 由 `ADMIN_PATH` 配置（推荐 UUID），见 [admin-guide.md](./admin-guide.md) |
| OpenAPI 规范 | 无 | `GET /openapi.json` 公开；人类可读文档见 `/api-docs` |
| MCP `@zmailr/mcp` | Bearer Token | 通过 `ZMAILR_TOKEN` 环境变量传入，见 [mcp.md](./mcp.md) |

---

## 首次部署

首次 D1 迁移后，若尚无用户且已设置 `ADMIN_PASSWORD`，会自动创建 **admin** 用户：

- **用户名**：`admin`
- **密码**：与 `ADMIN_PASSWORD` 相同
- **配额**：无限（`-1`）

打开 `https://你的域名/{ADMIN_PATH}` → **用户** 标签创建更多用户并设置日发信配额。

---

## Web 登录

```http
POST /api/auth/login
Content-Type: application/json

{"username": "admin", "password": "..."}
```

设置 HttpOnly Cookie `zmail_user_session`（24 小时）。

- `GET /api/auth/me` — 个人资料 + 今日用量/配额
- `GET /api/user/quota` — 仅日发信配额（Session 或用户 Bearer Token，任意 scope）
- `POST /api/auth/logout` — 清除 Session

前端路由：`/login`、Dashboard（`/dashboard/usage`、`/dashboard/api-keys` 等）。

---

## 附件访问

收件箱 **邮件详情** 可列出、预览与下载入站附件（图片/视频/音频/PDF 等）。Dashboard 请求携带 Session Cookie（`credentials: 'include'`），无需 Bearer Token。

程序化访问同一组端点，需 **`mail` scope** Bearer Token，且须对附件所属邮箱有所有权；Bearer 无法访问**已过期**邮箱下的附件（403）。

| 端点 | 鉴权 | 说明 |
|------|------|------|
| `GET /api/emails/:id/attachments` | Session 或 Bearer（`mail`） | 附件元数据列表（文件名、MIME、大小） |
| `GET /api/attachments/:id` | Session 或 Bearer（`mail`） | 附件详情 JSON |
| `GET /api/attachments/:id?download=true` | Session 或 Bearer（`mail`） | 下载二进制；R2 优先，历史 D1 Base64/分块回退 |

邮件列表中带 📎 图标表示 `hasAttachments: true`。R2 存储配置见 [deploy.md §6](./deploy.md#6-r2-附件存储推荐)。

---

## 用户 API Token

登录用户在 **Dashboard → API 密钥**（`/dashboard/api-keys`）或通过 API 创建 Token：

```http
POST /api/user/tokens
Cookie: zmail_user_session=...

{"name": "my-script", "expiresInDays": 30, "scopes": ["lease", "mail", "send"]}
```

**Scope 说明**：

| Scope | 允许调用的 API |
|-------|----------------|
| `lease` | `POST /api/lease` |
| `mail` | `GET /api/mail`、`GET /api/mailboxes/*` 等读信接口 |
| `send` | `POST /api/send` |

- 明文 Token **仅在创建时返回一次**；服务端仅存 SHA-256 哈希。
- Dashboard 可将明文保存在浏览器 `localStorage`（按用户隔离），便于后续复制脱敏预览；清除浏览器数据会丢失该便利副本。
- Token 列表含 **`last_used_at`**（Unix 秒，API 使用时最多每小时更新一次）。

### Dashboard 提醒

**仪表板**（`/dashboard/usage`）会在以下情况显示横幅提醒：

| 条件 | 行为 |
|------|------|
| 尚无 API Token | 提示「请先创建 API Token」，引导至 API 密钥页 |
| Token 将在 7 天内过期 | 提示续期或重新创建 |

**API 调试**页在无 Token 时也会引导至 API 密钥页。

### 查询剩余发信配额

```http
GET /api/user/quota
Authorization: Bearer <user-token>
```

有限配额响应示例：

```json
{
  "dailySendQuota": 50,
  "sentToday": 10,
  "remaining": 40,
  "unlimited": false
}
```

无限配额用户（`daily_send_quota = -1`）：

```json
{
  "dailySendQuota": -1,
  "sentToday": 10,
  "remaining": null,
  "unlimited": true
}
```

也可使用登录 Session Cookie（无需 Bearer 头）。

---

## 日发信配额

每位用户有 `daily_send_quota`（UTC 日计数）。`-1` 表示无限。

在以下接口强制执行：

- `POST /api/user/send`（Session）
- `POST /api/send`（用户 Bearer Token）

**Legacy** 管理后台创建的 `api_tokens` 仍不受日发信配额限制（向后兼容）。

---

## 按用户 API 速率限制

每位用户可选 `rate_limit_per_min` 与 `rate_limit_burst`（D1 `users` 表）。Session 或**用户 Bearer Token** 请求按用户限流（固定 1 分钟窗口）：

| 方案（管理后台） |  sustained (req/min) | 突发 (burst) |
|-----------------|---------------------|--------------|
| Free（默认） | 60 | — |
| Pro | 600 | 30 |
| Team | 3000 | 200 |
| 自定义 | 手动填写 | 可选 |

`/api/*` 响应头：`X-RateLimit-Limit`（sustained 速率，不含 burst）、`X-RateLimit-Remaining`（含 burst 剩余额度）、`X-RateLimit-Reset`、`Retry-After`。超限返回 `429` + `{ "error": "rate_limit" }`。

**Legacy** admin API Token 与未识别为用户的请求回退到**全局 IP 限流**（默认 60 req/min）。

管理员在 **用户** 弹窗配置方案。429 监控与审计见 [admin-guide.md](./admin-guide.md)（`user.rate_limit.update`）。

---

## Web 发信

```http
POST /api/user/send
Cookie: zmail_user_session=...

{"to": "user@example.com", "subject": "Hello", "text": "Body", "from": "optional@your-domain.com"}
```

`from` 须为你域名下有效且未过期的临时邮箱（归你所有，或该域名下任意有效邮箱）。

---

## OTP 提取规则

用户在 **Dashboard → 提取规则**（`/dashboard/extract-rules`）管理个人规则。

| 端点 | 鉴权 | 说明 |
|------|------|------|
| `GET /api/user/extract-rules` | Session | 用户规则 + 内置规则描述（只读） |
| `POST /api/user/extract-rules` | Session | 创建 `{ domain, regex, priority, enabled }` |
| `PUT /api/user/extract-rules/:id` | Session | 更新自有规则 |
| `DELETE /api/user/extract-rules/:id` | Session | 删除自有规则 |

**OTP 提取优先级**（针对某邮箱）：

1. 用户自定义规则（邮箱有 `user_id` 时）
2. 管理后台全局规则（`extract_rules.user_id IS NULL`）
3. 内置兜底规则（硬编码，UI 只读）

同层级内：发件人域名精确匹配优于 `*`，再按 `priority` 降序。

管理后台全局规则：`GET/POST/PUT/DELETE /{ADMIN_PATH}/api/rules`。

---

## 管理后台用户管理

管理后台 → **用户**：

- 创建用户（用户名、密码、角色、配额）
- 编辑配额、**速率方案**（Free / Pro / Team / 自定义）、重置密码、启用/禁用
- 删除用户

API：`GET/POST/PUT/DELETE /{ADMIN_PATH}/api/users`

---

## OpenAPI 与 API 文档

| 资源 | URL | 说明 |
|------|-----|------|
| OpenAPI 3.1 JSON | `GET /openapi.json` | 机器可读规范；构建时生成 `frontend/public/openapi.json` |
| 人类可读文档 | `/api-docs` | 含 curl 示例、参数表、OpenAPI 链接 |

构建命令 `pnpm run build` 会先执行 `scripts/generate-openapi.ts` 再打包前端。

---

## 安全说明

- 密码：PBKDF2-SHA256（10 万次迭代）+ 随机 salt
- API Token：仅存 SHA-256 哈希
- Session：HMAC 签名 Cookie（与 admin 共用密钥，派生自 `ADMIN_PASSWORD`）；admin Cookie 作用域 `Path=/{ADMIN_PATH}`
- 管理后台 URL 不在前端 bundle 中暴露；生产环境 `ADMIN_PATH` 请使用 UUID

---

## 相关文档

- [api.md](./api.md) — API 端点速查与 curl 示例
- [admin-guide.md](./admin-guide.md) — 维护模式、限流监控、审计日志
- [brevo-setup.md](./brevo-setup.md) — 出站发信配置
- [mcp.md](./mcp.md) — MCP 集成
- [deploy.md](./deploy.md) — 部署指南
- [文档首页](./) — 文档分类导航
