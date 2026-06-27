# 认证说明

> [创建 API 密钥](./create-api-key.md) · [API 参考](./api.md) · [错误码与限流](./errors.md)

zMailR **不支持匿名 API**。脚本、CI、MCP 均通过 **Bearer Token** 调用程序化接口；Web Dashboard 使用 Session Cookie。

创建 Token 的图文步骤 → [创建 API 密钥](./create-api-key.md)

---

## Bearer 鉴权

所有程序化接口使用：

```http
Authorization: Bearer <your-token>
```

Base URL：<SiteOrigin />（无尾部 `/`）。

---

## Token Scope {#token-scope}

| Scope | 允许调用的 API |
|-------|----------------|
| `lease` | `POST /api/lease` |
| `mail` | `GET /api/mail`、`GET /api/mailboxes/*`、`GET/DELETE /api/emails/*` 等读信接口 |
| `send` | `POST /api/send` |

`GET /api/user/quota` 接受任意用户 Token scope。

### 常见组合

| 用途 | 建议 Scope |
|------|------------|
| 收 OTP / 读信 | `lease` + `mail` |
| 出站发信测试 | 再加 `send` |
| 仅查配额 | 任意已登录 Token |

Scope 不足时返回 `403` + `缺少 xxx 权限` → [错误码与限流](./errors.md)

---

## Token 格式与限制

| 项 | 说明 |
|----|------|
| 格式 | `zmr_` 前缀 + 64 位十六进制（旧版无前缀 Token 过期前仍可用） |
| 存储 | 服务端仅存 SHA-256 哈希；明文仅在创建时返回 |
| 数量 | 每位用户最多 **3 个** Token |
| 用量 | 列表含 `last_used_at`（API 使用时最多每小时更新） |

也可通过 API 创建（需已登录 Session）：

```http
POST /api/user/tokens
Cookie: zmail_user_session=...

{"name": "my-script", "expiresInDays": 30, "scopes": ["lease", "mail", "send"]}
```

---

## 发信配额

每位用户有 `daily_send_quota`（UTC 日计数）。`-1` 表示无限。演示账号默认 50 封/天。

```http
GET /api/user/quota
Authorization: Bearer <user-token>
```

配额与速率限制详情 → [错误码与限流](./errors.md)

---

## Web Session（Dashboard）

Web 操作（收件箱、规则、Web 发信）使用 Session Cookie，非 Bearer：

```http
POST /api/auth/login
Content-Type: application/json

{"username": "guest", "password": "guest"}
```

设置 HttpOnly Cookie `zmail_user_session`（24 小时）。

| 端点 | 说明 |
|------|------|
| `GET /api/auth/me` | 个人资料 + 今日用量 |
| `GET /api/user/quota` | 日发信配额（Session 或 Bearer 均可） |
| `POST /api/auth/logout` | 清除 Session |

前端路由：<SiteLink to="/login">/login</SiteLink>、<SiteLink to="/dashboard/usage">/dashboard/usage</SiteLink>、<SiteLink to="/dashboard/api-keys">/dashboard/api-keys</SiteLink>。

---

## MCP 鉴权

MCP 通过环境变量传入同一 Bearer Token：

| 变量 | 说明 |
|------|------|
| `ZMAILR_BASE_URL` | 实例根 URL |
| `ZMAILR_TOKEN` | Bearer Token |

配置步骤 → [MCP 快速接入](./mcp.md)

---

## 下一步

| 目标 | 文档 |
|------|------|
| 写自动化脚本 | [第一个脚本](./first-script.md) |
| 完整代码模板 | [脚本接入](./scripting.md) |
| 查 REST 端点 | [API 参考](./api.md) |
