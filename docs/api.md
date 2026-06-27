# API 参考

> [API 概览](./api-overview.md) · [脚本接入](./scripting.md) · [错误码与限流](./errors.md) · [MCP 工具参考](./mcp-tools.md)

逐端点参数、返回字段与 curl 示例。核心接口选型与典型流程 → [API 概览](./api-overview.md)。可运行代码模板 → [脚本接入](./scripting.md)。

---

## 通用约定

| 项 | 说明 |
|----|------|
| **Base URL** | <SiteOrigin />（无尾部 `/`） |
| **鉴权** | `Authorization: Bearer <token>`；创建与 Scope → [认证说明](./user-auth.md) |
| **Content-Type** | 带 Body 的请求使用 `application/json` |
| **响应包络** | 成功：`{ "success": true, ... }`；失败：`{ "success": false, "error": "<code>", "message?": "<human>" }` |

Token Scope 与 Bearer 鉴权 → [认证说明](./user-auth.md#token-scope)。统一错误码与速率限制 → [错误码与限流](./errors.md)。

### 路径参数 `address`

邮箱路径参数 `:address` 支持 **local-part**（如 `k7m2x9`）或 **完整邮箱**（如 `k7m2x9@example.com`，URL 中 `@` 需编码为 `%40`）。

---

## 端点索引 {#端点索引}

### 公开（无需认证）

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/openapi.json` | OpenAPI 3.1 规范 |
| `GET` | `/api/health` | 简单健康检查 |
| `GET` | `/api/public/status` | 维护模式 + D1/R2/Brevo 探活 |
| `GET` | `/api/config` | 前端公开配置（邮箱域名等） |

### Bearer API（程序化）

| 方法 | 路径 | Scope | 详细文档 |
|------|------|-------|----------|
| `POST` | `/api/lease` | `lease` | [↓](#租用临时邮箱-post-apilease) |
| `GET` | `/api/mail` | `mail` | [↓](#长轮询收信-get-apimail) |
| `GET` | `/api/mailboxes` | `mail` | [↓](#列出邮箱-get-apimailboxes) |
| `DELETE` | `/api/mailboxes/:address` | `mail` | [↓](#删除邮箱-delete-apimailboxesaddress) |
| `GET` | `/api/mailboxes/:address` | `mail` | [↓](#邮箱详情-get-apimailboxesaddress) |
| `GET` | `/api/mailboxes/:address/emails` | `mail` | [↓](#列出邮件-get-apimailboxesaddressemails) |
| `GET` | `/api/mailboxes/:address/latest-code` | `mail` | [↓](#即时查询最新-otp-get-apimailboxesaddresslatest-code) |
| `GET` | `/api/mailboxes/:address/latest-link` | `mail` | [↓](#即时查询验证链接-get-apimailboxesaddresslatest-link) |
| `GET` | `/api/emails/:id` | `mail` | [↓](#邮件详情-get-apiemailsid) |
| `DELETE` | `/api/emails/:id` | `mail` | [↓](#删除邮件-delete-apiemailsid) |
| `GET` | `/api/emails/:id/raw` | `mail` | [↓](#原始-mime-get-apiemailsidraw) |
| `GET` | `/api/emails/:id/attachments` | `mail` | [↓](#附件列表-get-apiemailsidattachments) |
| `GET` | `/api/attachments/:id` | `mail` | [↓](#附件详情与下载-get-apiattachmentsid) |
| `POST` | `/api/send` | `send` | [↓](#出站发信-post-apisend) |
| `GET` | `/api/user/quota` | 任意 | [↓](#查询发信配额-get-apiuserquota) |

### MCP 工具（`@zmailr/mcp`）

11 个 MCP 工具与 REST 一一对应，参数与入参示例 → [MCP 工具参考](./mcp-tools.md)。配置见 [MCP 快速接入](./mcp.md)。

> `POST /api/mailboxes`（匿名创建）**已废弃**，恒返回 `401`。

---

## 公开接口

### 公开状态 `GET /api/public/status`

**接口描述**：返回维护模式开关与 D1、R2、Brevo 依赖连通性；部署探活、Dashboard 维护横幅使用。**无需认证**。

#### 请求

| 项 | 值 |
|----|-----|
| **URL** | `{baseUrl}/api/public/status` |
| **Method** | `GET` |
| **鉴权** | 无 |

#### 返回参数

| 字段 | 类型 | 说明 |
|------|------|------|
| `success` | boolean | 固定 `true` |
| `status` | string | `ok` / `degraded` / `error` |
| `maintenance.enabled` | boolean | 是否维护模式 |
| `maintenance.message` | string \| null | 维护说明 |
| `checks.d1.ok` | boolean | D1 可用 |
| `checks.r2.ok` | boolean | R2 可用 |
| `checks.brevo.ok` | boolean | Brevo API 可用或未配置 |
| `checks.brevo.configured` | boolean | 是否配置了 `BREVO_API_KEY` |

#### 返回示例（成功）

```json
{
  "success": true,
  "status": "ok",
  "maintenance": { "enabled": false, "message": null },
  "checks": {
    "d1": { "ok": true },
    "r2": { "ok": true, "optional": false },
    "brevo": { "ok": true, "configured": false, "optional": true }
  }
}
```

#### 完整调用示例

```bash
curl -X GET '{baseUrl}/api/public/status'
```

### 公开配置 `GET /api/config`

**接口描述**：返回前端与公开页面所需的配置（邮箱域名、注册开关、Turnstile、维护模式）。**无需认证**。

#### 请求

| 项 | 值 |
|----|-----|
| **URL** | `{baseUrl}/api/config` |
| **Method** | `GET` |
| **鉴权** | 无 |

#### 返回参数

| 字段 | 类型 | 说明 |
|------|------|------|
| `config.emailDomains` | string[] | 已启用的收信域名 |
| `config.registration.enabled` | boolean | 是否开放自助注册 |
| `config.turnstile.enabled` | boolean | 是否启用人机验证 |
| `config.turnstile.siteKey` | string \| null | Turnstile 站点 Key |
| `config.maintenance` | object | 维护模式状态 |

#### 完整调用示例

```bash
curl -X GET '{baseUrl}/api/config'
```

### 健康检查 `GET /api/health`

**接口描述**：最简存活探测，不含 D1/R2 依赖检查。需依赖探活请用 [`/api/public/status`](#公开状态-get-apipublicstatus)。

#### 请求

| 项 | 值 |
|----|-----|
| **URL** | `{baseUrl}/api/health` |
| **Method** | `GET` |
| **鉴权** | 无 |

#### 返回示例

```json
{ "status": "ok" }
```

---

## Bearer API

以下 `{baseUrl}` 均指 <SiteOrigin />；`{token}` 替换为你的 Bearer Token。

---

### 租用临时邮箱 `POST /api/lease`

**接口描述**：为当前用户随机分配一个 **24 小时**有效期的临时收件箱，用于注册验证、OTP 自动化、CI 测试等。需 `lease` scope。

#### 请求

| 项 | 值 |
|----|-----|
| **URL** | `{baseUrl}/api/lease` |
| **Method** | `POST` |
| **鉴权** | Bearer Token（`lease` scope） |

#### Body 参数（JSON，均可选）

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `domain` | string | 否 | 随机启用域 | 指定邮箱域名，须为管理后台已启用的域名 |

#### 返回参数

| 字段 | 类型 | 说明 |
|------|------|------|
| `success` | boolean | 是否成功 |
| `email` | string | 完整邮箱地址 |
| `address` | string | local-part |
| `mailDomain` | string | 分配的邮箱域名 |
| `expiresAt` | integer | 过期 Unix 时间戳（秒） |

#### 返回示例（成功）

```json
{
  "success": true,
  "email": "k7m2x9@your-mail-domain",
  "address": "k7m2x9",
  "mailDomain": "your-mail-domain",
  "expiresAt": 1751030400
}
```

实际域名以实例配置为准，例如 <ExampleMailbox local="k7m2x9" />。

#### 错误码

| HTTP | `error` | 说明 |
|------|---------|------|
| `401` | 未授权… | Token 无效 |
| `403` | `缺少 lease 权限` | scope 不足 |
| `400` | 域名相关文案 | `domain` 未启用或非法 |
| `429` | `rate_limit` | 速率超限 |

#### 完整调用示例

```bash
curl -X POST '{baseUrl}/api/lease' \
  -H 'Authorization: Bearer {token}' \
  -H 'Content-Type: application/json'
```

指定域名：

```bash
curl -X POST '{baseUrl}/api/lease' \
  -H 'Authorization: Bearer {token}' \
  -H 'Content-Type: application/json' \
  -d '{"domain":"your-mail-domain"}'
```

---

### 长轮询收信 `GET /api/mail`

**接口描述**：阻塞等待指定邮箱的新邮件或 OTP，适合脚本「注册 → 等验证码」流程。服务端每 2s 轮询一次，最长约 55s。需 `mail` scope。

#### 请求

| 项 | 值 |
|----|-----|
| **URL** | `{baseUrl}/api/mail` |
| **Method** | `GET` |
| **鉴权** | Bearer Token（`mail` scope） |

#### Query 参数

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `to` | string | **是** | — | 目标邮箱（完整地址或 local-part） |
| `timeout` | integer | 否 | `60` | 最长等待秒数，实际 capped 为 **1–55** |
| `since` | integer | 否 | 当前时间 | 只匹配 `receivedAt >= since` 的邮件（Unix 秒） |
| `require_code` | string | 否 | `true` | 设为 `false` 时，无 OTP 的新邮件也会返回 |

#### 返回参数

| 字段 | 类型 | 说明 |
|------|------|------|
| `success` | boolean | 是否成功 |
| `code` | string \| null | 提取的 OTP（`require_code=true` 时有值） |
| `email.id` | string | 邮件 ID |
| `email.subject` | string | 主题 |
| `email.from` | string | 发件人 |
| `email.receivedAt` | integer | 收件 Unix 时间戳 |

#### 返回示例（成功）

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

#### 错误码

| HTTP | `error` | 说明 |
|------|---------|------|
| `400` | `缺少 to 参数` | 未传 `to` |
| `404` | `邮箱不存在或已过期` | 邮箱无效 |
| `403` | `无权访问该邮箱` | 非本人邮箱 |
| `408` | `timeout` | 等待超时，可重试 |
| `401` / `403` | 见 [错误码与限流](./errors.md) | 鉴权/scope |

#### 完整调用示例

```bash
curl -G '{baseUrl}/api/mail' \
  -H 'Authorization: Bearer {token}' \
  --data-urlencode 'to=k7m2x9@your-mail-domain' \
  --data-urlencode 'timeout=60' \
  --data-urlencode 'require_code=true'
```

---

### 即时查询最新 OTP `GET /api/mailboxes/:address/latest-code`

**接口描述**：**非阻塞**查询邮箱中最新一封已提取 OTP 的邮件，适合短间隔轮询。需 `mail` scope。

#### 请求

| 项 | 值 |
|----|-----|
| **URL** | `{baseUrl}/api/mailboxes/{address}/latest-code` |
| **Method** | `GET` |
| **鉴权** | Bearer Token（`mail` scope） |

#### 路径参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `address` | string | 是 | local-part 或完整邮箱 |

#### 返回参数

| 字段 | 类型 | 说明 |
|------|------|------|
| `success` | boolean | 是否成功 |
| `code` | string | OTP |
| `email.id` | string | 邮件 ID |
| `email.subject` | string | 主题 |
| `email.from` | string | 发件人 |
| `email.receivedAt` | integer | 收件时间戳 |

#### 返回示例（成功）

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

#### 错误码

| HTTP | `error` | 说明 |
|------|---------|------|
| `404` | `no_code` | 尚无验证码（`message`: 暂无验证码） |
| `404` | `邮箱不存在或已过期` | 邮箱无效 |
| `403` | `无权访问该邮箱` | 非本人邮箱 |

#### 完整调用示例

```bash
curl -X GET '{baseUrl}/api/mailboxes/k7m2x9@your-mail-domain/latest-code' \
  -H 'Authorization: Bearer {token}'
```

---

### 即时查询验证链接 `GET /api/mailboxes/:address/latest-link`

**接口描述**：从最新一封邮件正文中提取验证链接（HTTP/HTTPS URL）。需 `mail` scope。

#### 请求

| 项 | 值 |
|----|-----|
| **URL** | `{baseUrl}/api/mailboxes/{address}/latest-link` |
| **Method** | `GET` |
| **鉴权** | Bearer Token（`mail` scope） |

#### 路径参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `address` | string | 是 | local-part 或完整邮箱 |

#### 返回参数

| 字段 | 类型 | 说明 |
|------|------|------|
| `success` | boolean | 是否成功 |
| `link` | string | 提取到的 URL |
| `email` | object | 同 [latest-code](#即时查询最新-otp-get-apimailboxesaddresslatest-code) |

#### 返回示例（成功）

```json
{
  "success": true,
  "link": "https://example.com/verify?token=abc",
  "email": {
    "id": "em_xyz",
    "subject": "Confirm your email",
    "from": "noreply@example.com",
    "receivedAt": 1751025700
  }
}
```

#### 错误码

| HTTP | `error` | 说明 |
|------|---------|------|
| `404` | `no_email` | 暂无邮件 |
| `404` | `no_link` | 有邮件但未解析到链接 |
| `404` | `邮箱不存在或已过期` | 邮箱无效 |

#### 完整调用示例

```bash
curl -X GET '{baseUrl}/api/mailboxes/k7m2x9/latest-link' \
  -H 'Authorization: Bearer {token}'
```

---

### 列出邮箱 `GET /api/mailboxes`

**接口描述**：列出当前 Bearer Token 所属用户的**未过期**邮箱。需 `mail` scope。

#### 请求

| 项 | 值 |
|----|-----|
| **URL** | `{baseUrl}/api/mailboxes` |
| **Method** | `GET` |
| **鉴权** | Bearer Token（`mail` scope） |

#### Query 参数

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `limit` | integer | 否 | `50` | 返回条数，范围 **1–100** |

#### 返回参数

| 字段 | 类型 | 说明 |
|------|------|------|
| `success` | boolean | 是否成功 |
| `mailboxes[]` | array | 邮箱列表 |
| `mailboxes[].id` | string | 邮箱 ID |
| `mailboxes[].address` | string | local-part |
| `mailboxes[].email` | string | 完整地址 |
| `mailboxes[].expiresAt` | integer | 过期时间戳 |
| `mailboxes[].isExpired` | boolean | 是否已过期 |

#### 返回示例（成功）

```json
{
  "success": true,
  "mailboxes": [
    {
      "id": "mb_abc",
      "address": "k7m2x9",
      "email": "k7m2x9@your-mail-domain",
      "createdAt": 1750944000,
      "expiresAt": 1751030400,
      "isExpired": false
    }
  ]
}
```

#### 完整调用示例

```bash
curl -X GET '{baseUrl}/api/mailboxes?limit=20' \
  -H 'Authorization: Bearer {token}'
```

---

### 删除邮箱 `DELETE /api/mailboxes/:address`

**接口描述**：删除指定邮箱及其中的全部邮件。需 `mail` scope 且为邮箱所有者。

#### 请求

| 项 | 值 |
|----|-----|
| **URL** | `{baseUrl}/api/mailboxes/{address}` |
| **Method** | `DELETE` |
| **鉴权** | Bearer Token（`mail` scope） |

#### 路径参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `address` | string | 是 | local-part 或完整邮箱 |

#### 返回示例（成功）

```json
{ "success": true }
```

#### 错误码

| HTTP | `error` | 说明 |
|------|---------|------|
| `404` | `邮箱不存在` | 邮箱不存在 |
| `403` | `无权访问该邮箱` | 非本人邮箱 |

#### 完整调用示例

```bash
curl -X DELETE '{baseUrl}/api/mailboxes/k7m2x9' \
  -H 'Authorization: Bearer {token}'
```

---

### 列出邮件 `GET /api/mailboxes/:address/emails`

**接口描述**：列出指定邮箱内的邮件摘要。需 `mail` scope。

#### 请求

| 项 | 值 |
|----|-----|
| **URL** | `{baseUrl}/api/mailboxes/{address}/emails` |
| **Method** | `GET` |
| **鉴权** | Bearer Token（`mail` scope） |

#### 路径参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `address` | string | 是 | local-part 或完整邮箱 |

#### Query 参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `domain` | string | 否 | 按发件人域名过滤 |

#### 返回参数

| 字段 | 类型 | 说明 |
|------|------|------|
| `success` | boolean | 是否成功 |
| `emails[]` | array | 邮件摘要列表 |
| `emails[].id` | string | 邮件 ID |
| `emails[].subject` | string | 主题 |
| `emails[].fromAddress` | string | 发件人 |
| `emails[].receivedAt` | integer | 收件时间戳 |
| `emails[].extractedCode` | string \| null | 已提取 OTP |

#### 完整调用示例

```bash
curl -X GET '{baseUrl}/api/mailboxes/k7m2x9/emails' \
  -H 'Authorization: Bearer {token}'
```

---

### 邮件详情 `GET /api/emails/:id`

**接口描述**：获取单封邮件完整内容（含正文、附件元数据等）。需 `mail` scope 且对所属邮箱有访问权。

#### 请求

| 项 | 值 |
|----|-----|
| **URL** | `{baseUrl}/api/emails/{id}` |
| **Method** | `GET` |
| **鉴权** | Bearer Token（`mail` scope） |

#### 路径参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `id` | string | 是 | 邮件 ID（如 `em_abc123`） |

#### 返回示例（成功）

```json
{
  "success": true,
  "email": {
    "id": "em_abc123",
    "subject": "Your verification code",
    "fromAddress": "noreply@example.com",
    "textContent": "Your code is 847291",
    "htmlContent": "<p>Your code is 847291</p>",
    "extractedCode": "847291",
    "receivedAt": 1751025683
  }
}
```

#### 错误码

| HTTP | `error` | 说明 |
|------|---------|------|
| `404` | `邮件不存在` | ID 无效 |
| `403` | `邮箱已过期` | Bearer 访问过期邮箱内邮件 |

#### 完整调用示例

```bash
curl -X GET '{baseUrl}/api/emails/em_abc123' \
  -H 'Authorization: Bearer {token}'
```

---

### 删除邮件 `DELETE /api/emails/:id`

**接口描述**：删除单封邮件。MCP 工具 `delete_email` 调用此接口。需 `mail` scope。

#### 请求

| 项 | 值 |
|----|-----|
| **URL** | `{baseUrl}/api/emails/{id}` |
| **Method** | `DELETE` |
| **鉴权** | Bearer Token（`mail` scope） |

#### 路径参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `id` | string | 是 | 邮件 ID |

#### 返回示例（成功）

```json
{ "success": true }
```

#### 错误码

| HTTP | `error` | 说明 |
|------|---------|------|
| `404` | `邮件不存在` | ID 无效 |
| `403` | `无权访问该邮箱` / `邮箱已过期` | 无权限 |

#### 完整调用示例

```bash
curl -X DELETE '{baseUrl}/api/emails/em_abc123' \
  -H 'Authorization: Bearer {token}'
```

---

### 原始 MIME `GET /api/emails/:id/raw`

**接口描述**：下载邮件原始 RFC822 内容（`.eml`）。需 `mail` scope。**无 MCP 工具**（仅 REST）。

#### 请求

| 项 | 值 |
|----|-----|
| **URL** | `{baseUrl}/api/emails/{id}/raw` |
| **Method** | `GET` |
| **鉴权** | Bearer Token（`mail` scope） |

#### 返回

| 项 | 说明 |
|----|------|
| **Content-Type** | `message/rfc822` |
| **Body** | 原始 MIME 字节流 |

#### 完整调用示例

```bash
curl -X GET '{baseUrl}/api/emails/em_abc123/raw' \
  -H 'Authorization: Bearer {token}' \
  -o em_abc123.eml
```

---

### 附件列表 `GET /api/emails/:id/attachments`

**接口描述**：列出某封邮件的附件元数据。需 `mail` scope。**无 MCP 工具**。

#### 请求

| 项 | 值 |
|----|-----|
| **URL** | `{baseUrl}/api/emails/{id}/attachments` |
| **Method** | `GET` |
| **鉴权** | Bearer Token（`mail` scope） |

#### 返回参数

| 字段 | 类型 | 说明 |
|------|------|------|
| `attachments[].id` | string | 附件 ID |
| `attachments[].filename` | string | 文件名 |
| `attachments[].mimeType` | string | MIME 类型 |
| `attachments[].size` | integer | 字节大小 |

#### 完整调用示例

```bash
curl -X GET '{baseUrl}/api/emails/em_abc123/attachments' \
  -H 'Authorization: Bearer {token}'
```

---

### 附件详情与下载 `GET /api/attachments/:id`

**接口描述**：获取附件元数据，或通过 `?download=true` 下载二进制内容。需 `mail` scope。**无 MCP 工具**。

#### 请求

| 项 | 值 |
|----|-----|
| **URL** | `{baseUrl}/api/attachments/{id}` |
| **Method** | `GET` |
| **鉴权** | Bearer Token（`mail` scope） |

#### Query 参数

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `download` | string | 否 | `false` | 设为 `true` 时返回文件二进制 |

#### 返回示例（元数据）

```json
{
  "success": true,
  "attachment": {
    "id": "att_xyz",
    "emailId": "em_abc123",
    "filename": "invoice.pdf",
    "mimeType": "application/pdf",
    "size": 10240,
    "createdAt": 1751025700,
    "isLarge": false,
    "chunksCount": 1
  }
}
```

#### 完整调用示例

```bash
# 元数据
curl -X GET '{baseUrl}/api/attachments/att_xyz' \
  -H 'Authorization: Bearer {token}'

# 下载文件
curl -X GET '{baseUrl}/api/attachments/att_xyz?download=true' \
  -H 'Authorization: Bearer {token}' \
  -o invoice.pdf
```

---

### 邮箱详情 `GET /api/mailboxes/:address`

**接口描述**：查询单个邮箱的元数据（创建时间、过期时间等）。需 `mail` scope。**无 MCP 工具**（可用 `list_mailboxes` 代替）。

#### 请求

| 项 | 值 |
|----|-----|
| **URL** | `{baseUrl}/api/mailboxes/{address}` |
| **Method** | `GET` |
| **鉴权** | Bearer Token（`mail` scope）或 Session Cookie |

#### 路径参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `address` | string | 是 | local-part 或完整邮箱 |

#### 返回示例（成功）

```json
{
  "success": true,
  "mailbox": {
    "id": "mb_abc",
    "address": "k7m2x9",
    "createdAt": 1750944000,
    "expiresAt": 1751030400,
    "mailDomain": "your-mail-domain"
  }
}
```

#### 完整调用示例

```bash
curl -X GET '{baseUrl}/api/mailboxes/k7m2x9' \
  -H 'Authorization: Bearer {token}'
```

---

### 出站发信 `POST /api/send`

**接口描述**：通过 Brevo 发送出站邮件。`from` 须为当前用户拥有的、未过期的临时邮箱地址。需 `send` scope 且实例已配置 Brevo。

#### 请求

| 项 | 值 |
|----|-----|
| **URL** | `{baseUrl}/api/send` |
| **Method** | `POST` |
| **鉴权** | Bearer Token（`send` scope） |

#### Body 参数（JSON）

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `to` | string | **是** | 收件人邮箱 |
| `subject` | string | **是** | 主题 |
| `text` | string | 二选一 | 纯文本正文 |
| `html` | string | 二选一 | HTML 正文（`text` 与 `html` 至少一项） |
| `from` | string | 否 | 发件人地址；省略时使用名下邮箱或 `no-reply@{默认域}` |
| `address` | string | 否 | 发件邮箱 local-part 提示（与 `from` 配合） |
| `attachments` | array | 否 | `[{ "name": "file.pdf", "content": "<base64>" }]`，总大小 ≤ 5MB |

#### 返回参数

| 字段 | 类型 | 说明 |
|------|------|------|
| `success` | boolean | 是否成功 |
| `sentEmailId` | integer | 发信记录 ID |

#### 返回示例（成功）

```json
{
  "success": true,
  "sentEmailId": 42
}
```

#### 错误码

| HTTP | `error` | 说明 |
|------|---------|------|
| `400` | `缺少 to 或 subject 参数` | 必填缺失 |
| `400` | `缺少 text 或 html 内容` | 正文缺失 |
| `400` | `无效的 to 地址` | 收件人格式非法 |
| `400` | from 相关文案 | 发件人非本人或域名不匹配 |
| `429` | 配额文案 | 日发信配额用尽 |
| `502` | Brevo 错误文案 | 上游发信失败 |

#### 完整调用示例

```bash
curl -X POST '{baseUrl}/api/send' \
  -H 'Authorization: Bearer {token}' \
  -H 'Content-Type: application/json' \
  -d '{
    "to": "user@example.com",
    "subject": "Test",
    "text": "Hello from zMailR",
    "from": "k7m2x9@your-mail-domain"
  }'
```

Brevo 出站发信需在 Worker 环境配置 `BREVO_API_KEY`。

---

### 查询发信配额 `GET /api/user/quota`

**接口描述**：查询当前用户的日发信配额与今日已用量。任意用户 Token scope 均可；也支持 Web Session Cookie。

#### 请求

| 项 | 值 |
|----|-----|
| **URL** | `{baseUrl}/api/user/quota` |
| **Method** | `GET` |
| **鉴权** | Bearer Token 或 Session Cookie |

#### 返回参数

| 字段 | 类型 | 说明 |
|------|------|------|
| `success` | boolean | 固定 `true` |
| `dailySendQuota` | integer | 日配额；`-1` 表示无限 |
| `sentToday` | integer | 今日已发数量 |
| `remaining` | integer \| null | 剩余配额；无限时为 `null` |
| `unlimited` | boolean | 是否无限配额 |

#### 返回示例（成功）

```json
{
  "success": true,
  "dailySendQuota": 50,
  "sentToday": 3,
  "remaining": 47,
  "unlimited": false
}
```

#### 完整调用示例

```bash
curl -X GET '{baseUrl}/api/user/quota' \
  -H 'Authorization: Bearer {token}'
```


---

典型调用流程 → [API 概览 · 典型调用流程](./api-overview.md#典型调用流程)。错误码与速率限制 → [错误码与限流](./errors.md)。MCP 工具参数 → [MCP 工具参考](./mcp-tools.md)。

## OpenAPI

| 资源 | URL |
|------|-----|
| OpenAPI JSON | <SiteLink to="/openapi.json">GET /openapi.json</SiteLink> |
| 交互式文档 | <SiteLink to="/api-docs">/api-docs</SiteLink> |

构建时由 `scripts/generate-openapi.ts` 生成；字段 Schema 以 OpenAPI 为准。