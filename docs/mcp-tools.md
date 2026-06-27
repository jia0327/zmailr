# MCP 工具参考

> [MCP 快速接入](./mcp.md) · [API 参考](./api.md)

[`@zmailr/mcp`](https://www.npmjs.com/package/@zmailr/mcp) 通过 MCP stdio 暴露 11 个工具，**与 REST 一一对应**，无额外 HTTP 端点。环境变量与配置见 [MCP 快速接入](./mcp.md)。

MCP 返回值为 REST 响应 JSON 的 **text 内容**；HTTP ≥400 时工具标记 `isError: true` 并附带状态码与 body。

---

## 工具总览

| MCP 工具 | 对应 REST | Scope | REST 文档 |
|----------|-----------|-------|-----------|
| `lease_mailbox` | `POST /api/lease` | `lease` | [租用临时邮箱](./api.md#租用临时邮箱-post-apilease) |
| `wait_for_mail` | `GET /api/mail` | `mail` | [长轮询收信](./api.md#长轮询收信-get-apimail) |
| `get_latest_code` | `GET .../latest-code` | `mail` | [即时查询 OTP](./api.md#即时查询最新-otp-get-apimailboxesaddresslatest-code) |
| `get_latest_link` | `GET .../latest-link` | `mail` | [即时查询链接](./api.md#即时查询验证链接-get-apimailboxesaddresslatest-link) |
| `list_mailboxes` | `GET /api/mailboxes` | `mail` | [列出邮箱](./api.md#列出邮箱-get-apimailboxes) |
| `list_emails` | `GET .../emails` | `mail` | [列出邮件](./api.md#列出邮件-get-apimailboxesaddressemails) |
| `delete_mailbox` | `DELETE /api/mailboxes/:address` | `mail` | [删除邮箱](./api.md#删除邮箱-delete-apimailboxesaddress) |
| `get_email` | `GET /api/emails/:id` | `mail` | [邮件详情](./api.md#邮件详情-get-apiemailsid) |
| `delete_email` | `DELETE /api/emails/:id` | `mail` | [删除邮件](./api.md#删除邮件-delete-apiemailsid) |
| `send_email` | `POST /api/send` | `send` | [出站发信](./api.md#出站发信-post-apisend) |
| `get_quota` | `GET /api/user/quota` | 任意 | [查询配额](./api.md#查询发信配额-get-apiuserquota) |

以下 REST 端点 **无 MCP 工具**：`GET /api/emails/:id/raw`、`/attachments`、`GET /api/attachments/:id`、`GET /api/mailboxes/:address`。

---

## `lease_mailbox`

创建随机 24h 临时邮箱。对应 `POST /api/lease`。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| — | — | — | 无参数（REST Body 可选 `domain` 当前 MCP 未暴露） |

**入参示例**

```json
{}
```

**REST 等价**

```bash
curl -X POST '{baseUrl}/api/lease' \
  -H 'Authorization: Bearer {token}' \
  -H 'Content-Type: application/json'
```

---

## `wait_for_mail`

长轮询等待 OTP。对应 `GET /api/mail`。

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `to` | string | **是** | — | 目标邮箱 |
| `timeout` | number | 否 | `60` | 等待秒数（1–55） |
| `since` | number | 否 | 当前时间 | Unix 秒，只匹配更新邮件 |
| `require_code` | boolean | 否 | `true` | 是否必须有 OTP |

**入参示例**

```json
{
  "to": "k7m2x9@your-mail-domain",
  "timeout": 60,
  "require_code": true
}
```

---

## `get_latest_code`

非阻塞查询最新 OTP。对应 `GET /api/mailboxes/{address}/latest-code`。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `address` | string | **是** | local-part 或完整邮箱 |

**入参示例**

```json
{ "address": "k7m2x9@your-mail-domain" }
```

---

## `get_latest_link`

非阻塞查询最新验证链接。对应 `GET /api/mailboxes/{address}/latest-link`。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `address` | string | **是** | local-part 或完整邮箱 |

**入参示例**

```json
{ "address": "k7m2x9" }
```

---

## `list_mailboxes`

列出当前用户邮箱。对应 `GET /api/mailboxes`。

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `limit` | number | 否 | `50` | 1–100 |

**入参示例**

```json
{ "limit": 20 }
```

---

## `list_emails`

列出邮箱内邮件。对应 `GET /api/mailboxes/{address}/emails`。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `address` | string | **是** | local-part 或完整邮箱 |

**入参示例**

```json
{ "address": "k7m2x9" }
```

---

## `delete_mailbox`

删除邮箱及全部邮件。对应 `DELETE /api/mailboxes/{address}`。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `address` | string | **是** | local-part 或完整邮箱 |

**入参示例**

```json
{ "address": "k7m2x9" }
```

---

## `get_email`

获取单封邮件详情。对应 `GET /api/emails/{id}`。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | **是** | 邮件 ID |

**入参示例**

```json
{ "id": "em_abc123" }
```

---

## `delete_email`

删除单封邮件。对应 `DELETE /api/emails/{id}`。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | **是** | 邮件 ID |

**入参示例**

```json
{ "id": "em_abc123" }
```

---

## `send_email`

Brevo 出站发信。对应 `POST /api/send`。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `to` | string | **是** | 收件人 |
| `subject` | string | **是** | 主题 |
| `text` | string | 二选一 | 纯文本正文 |
| `html` | string | 二选一 | HTML 正文 |
| `from` | string | 否 | 发件人邮箱 |

**入参示例**

```json
{
  "to": "user@example.com",
  "subject": "Test",
  "text": "Hello from MCP",
  "from": "k7m2x9@your-mail-domain"
}
```

---

## `get_quota`

查询日发信配额。对应 `GET /api/user/quota`。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| — | — | — | 无参数 |

**入参示例**

```json
{}
```

---

## Token Scope

| MCP 工具 | 所需 scope |
|----------|------------|
| `lease_mailbox` | `lease` |
| `wait_for_mail`、`get_latest_code`、`get_latest_link`、`list_*`、`get_email`、`delete_*` | `mail` |
| `send_email` | `send` |
| `get_quota` | 任意 |

Scope 不足时 REST 返回 `403` + `缺少 xxx 权限`。详见 [认证说明](./user-auth.md#token-scope)。

---

## 下一步

| 目标 | 文档 |
|------|------|
| 配置 Cursor | [MCP 快速接入](./mcp.md) |
| REST 端点详情 | [API 参考](./api.md) |
