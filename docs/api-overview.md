# API 概览

> [产品概述](./overview.md) · [API 参考](./api.md) · [第一个脚本](./first-script.md)

面向 **脚本与自动化**：说明核心接口做什么、何时用哪个、REST 长轮询 vs 即时查询的区别。逐条参数与返回字段见 [API 参考](./api.md)。

---

## 核心接口速览

| 接口 | 作用 | Scope | MCP 等价 |
|------|------|-------|----------|
| `POST /api/lease` | 随机分配 24h 临时邮箱 | `lease` | `lease_mailbox` |
| `GET /api/mail` | 长轮询等待邮件/OTP | `mail` | `wait_for_mail` |
| `GET .../latest-code` | 非阻塞查最新 OTP | `mail` | `get_latest_code` |
| `GET .../latest-link` | 非阻塞查验证链接 | `mail` | `get_latest_link` |
| `GET /api/mailboxes` | 列出我的邮箱 | `mail` | `list_mailboxes` |
| `GET .../emails` | 列出邮箱内邮件 | `mail` | `list_emails` |
| `GET /api/emails/:id` | 单封邮件详情 | `mail` | `get_email` |
| `DELETE /api/emails/:id` | 删除单封邮件 | `mail` | `delete_email` |
| `DELETE /api/mailboxes/:address` | 删除邮箱 | `mail` | `delete_mailbox` |
| `POST /api/send` | Brevo 出站发信 | `send` | `send_email` |
| `GET /api/user/quota` | 日发信配额 | 任意 | `get_quota` |

完整端点索引（含公开探活、附件、原始 MIME）→ [API 参考 · 端点索引](./api.md#端点索引)。

---

## 选型建议

### OTP 自动化（最常见）

```
POST /api/lease  →  目标站点填写 email  →  GET /api/mail 或循环 latest-code
```

| 场景 | 推荐接口 | 原因 |
|------|----------|------|
| CI / 一次性脚本 | `GET /api/mail` 长轮询 | 一条请求等 OTP，少写循环 |
| 高频短间隔轮询 | `GET .../latest-code` + `sleep` | 非阻塞；`404 no_code` 时继续 |
| Cursor / Claude Agent | MCP `wait_for_mail` | 与 `GET /api/mail` 等价，见 [MCP 工具参考](./mcp-tools.md) |

### REST vs 长轮询 vs MCP

| 方式 | 适合 | 说明 |
|------|------|------|
| **长轮询** `GET /api/mail` | 脚本「注册后等验证码」 | 服务端每 2s 查一次，单次最长约 55s |
| **即时查询** `latest-code` | 自己控制轮询节奏 | 无 OTP 时 `404 no_code`，非错误 |
| **MCP** | Agent 自然语言驱动 | 底层仍调 REST；配置见 [MCP 快速接入](./mcp.md) |

### 扩展能力

| 需求 | 接口 |
|------|------|
| 验证链接（非 OTP） | `GET .../latest-link` |
| 读完整正文 / 附件 | `GET /api/emails/:id`、`/raw`、`/attachments` |
| 出站测试邮件 | `POST /api/send`（需 `send` + Brevo） |
| 查剩余发信次数 | `GET /api/user/quota` |

---

## 通用约定

| 项 | 说明 |
|----|------|
| **Base URL** | <SiteOrigin />（无尾部 `/`） |
| **鉴权** | `Authorization: Bearer <token>`；创建方式 → [认证说明](./user-auth.md) |
| **Content-Type** | 带 Body 的请求使用 `application/json` |
| **响应包络** | 成功：`{ "success": true, ... }`；失败见 [错误码与限流](./errors.md) |

### Token Scope 速查

| Scope | 可调用的接口 |
|-------|-------------|
| `lease` | `POST /api/lease` |
| `mail` | 读信、邮箱列表/删除、`GET /api/mail` 等 |
| `send` | `POST /api/send` |

收 OTP 至少勾选 **`lease` + `mail`**。详情 → [认证说明 · Token Scope](./user-auth.md#token-scope)。

### 路径参数 `address`

邮箱路径参数 `:address` 支持 **local-part**（如 `k7m2x9`）或 **完整邮箱**（URL 中 `@` 编码为 `%40`）。

---

## 典型调用流程

```bash
# 1. 租用邮箱
curl -X POST '{baseUrl}/api/lease' \
  -H 'Authorization: Bearer {token}'

# 2. 将返回的 email 填入目标站点

# 3. 长轮询等待 OTP
curl -G '{baseUrl}/api/mail' \
  -H 'Authorization: Bearer {token}' \
  --data-urlencode 'to=k7m2x9@your-mail-domain' \
  --data-urlencode 'timeout=60' \
  --data-urlencode 'require_code=true'
```

可运行模板（Python / Node / curl）→ [脚本接入](./scripting.md)。

---

## OpenAPI

| 资源 | URL |
|------|-----|
| OpenAPI JSON | <SiteLink to="/openapi.json">GET /openapi.json</SiteLink> |
| 交互式文档 | <SiteLink to="/api-docs">/api-docs</SiteLink> |

构建时由 `scripts/generate-openapi.ts` 生成；字段 Schema 以 OpenAPI 为准。

---

## 下一步

| 目标 | 文档 |
|------|------|
| 写第一个脚本 | [第一个脚本](./first-script.md) |
| 逐端点参数 | [API 参考](./api.md) |
| Agent 接入 | [MCP 快速接入](./mcp.md) |
