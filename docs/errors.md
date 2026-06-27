# 错误码与限流

> [认证说明](./user-auth.md) · [API 参考](./api.md) · [脚本接入](./scripting.md)

程序化调用 zMailR 时，应同时检查 **HTTP 状态码** 与响应体中的 **`error` 字段**（失败时通常为 `{ "success": false, "error": "...", "message?": "..." }`）。

---

## 统一错误说明

zMailR 使用 **HTTP 状态码 + `error` 字符串**（非数字业务码）。

| HTTP | `error` | 说明 |
|------|---------|------|
| `200` | — | 成功（`success: true`） |
| `400` | 各类校验文案 | 参数缺失或非法（见 [API 参考](./api.md) 各接口） |
| `401` | `未授权，请提供有效的 Bearer Token` | Token 缺失/无效/过期 |
| `403` | `缺少 lease 权限` 等 | Token scope 不足 → [认证说明](./user-auth.md) |
| `403` | `无权访问该邮箱` | 邮箱不属于当前用户 |
| `403` | `邮箱已过期` | Bearer 访问已过期邮箱 |
| `404` | `邮箱不存在或已过期` | 邮箱不存在或 TTL 已过 |
| `404` | `no_code` | **尚无已提取 OTP**（`latest-code`）；可能是邮件未到，也可能是 **有信但规则未匹配** |
| `404` | `no_email` / `no_link` | 无邮件 / 无验证链接 |
| `408` | `timeout` | 长轮询超时（`GET /api/mail`） |
| `429` | `rate_limit` | 速率或发信配额超限 |
| `500` / `502` | 服务端文案 | 内部错误或 Brevo 发信失败 |

### 脚本处理建议

| HTTP | `error` | 处理建议 |
|------|---------|----------|
| `401` | 未授权… | 检查 Header、Token 是否过期 |
| `403` | `缺少 mail 权限` 等 | 重建 Token，勾选对应 scope |
| `403` | `无权访问该邮箱` | 使用本 Token `lease` 得到的地址 |
| `404` | `no_code` | 先 `GET .../emails`：无邮件则继续轮询；**有邮件但 `extractedCode` 为空** → [自定义提取规则](./extract-rules.md) |
| `408` | `timeout` | 长轮询超时；若收件箱已有邮件无 OTP，同样是规则问题 → [验证码完整流程](./otp-workflow.md) |
| `404` | `邮箱不存在或已过期` | 重新 `POST /api/lease` |
| `429` | `rate_limit` | 读 `Retry-After`，降频后重试 |

错误处理代码示例 → [脚本接入 · 错误处理](./scripting.md#错误处理)。

### `no_code` vs `no_email` vs `timeout`

| 现象 | 含义 | 处理 |
|------|------|------|
| `404 no_email` | 邮箱内 **没有任何邮件** | 继续轮询 / 确认目标站点已发信 |
| `404 no_code` + 列表 **有邮件** | 邮件已到，**提取规则未匹配** | [自定义提取规则](./extract-rules.md) → `re-extract` |
| `408 timeout` + 列表 **有邮件无 OTP** | 长轮询只认 **已提取 OTP** 的信 | 同上；或目标站点 **重发验证邮件** |

完整排查路径 → [验证码完整流程](./otp-workflow.md)

### MCP 视角

MCP 工具失败时返回 `isError: true`，文本含 HTTP 状态与 body。常见情况与上表相同；详见 [MCP 快速接入](./mcp.md#常见错误)。

---

## 速率限制

`/api/*` 对已识别用户（Session 或 Bearer）按 **用户** 限流：1 分钟窗口，`rate_limit_per_min` + 可选 `rate_limit_burst`。未识别请求按 **IP** 限流（默认 60 req/min）。

| 方案 | sustained (req/min) | burst |
|------|---------------------|-------|
| Free（默认） | 60 | — |
| Pro | 600 | 30 |
| Team | 3000 | 200 |

超限：`429`，`{ "success": false, "error": "rate_limit" }`。

响应头：

| 头 | 说明 |
|----|------|
| `X-RateLimit-Limit` | sustained 速率（不含 burst） |
| `X-RateLimit-Remaining` | 剩余额度（含 burst） |
| `X-RateLimit-Reset` | 窗口重置时间 |
| `Retry-After` | 建议等待秒数（429 时） |

---

## 发信配额

出站 `POST /api/send` 另有 **日配额**（演示账号默认 50 封/天）。查询：`GET /api/user/quota`。

| 字段 | 说明 |
|------|------|
| `dailySendQuota` | 日配额；`-1` 表示无限 |
| `sentToday` | 今日已发 |
| `remaining` | 剩余；无限时为 `null` |
| `unlimited` | 是否无限配额 |

配额用尽时发信接口返回 `429` 及配额相关文案。

---

## 其他限制

| 限制 | 说明 |
|------|------|
| 邮箱 TTL | 临时邮箱 **24 小时**有效，过期后 Bearer 无法读信 |
| 匿名 API | **不支持**；`POST /api/mailboxes` 已废弃，恒 `401` |
| 出站发信 | 需 **`send` scope** 且实例配置 Brevo |
| Token 数量 | 每位用户最多 **3 个** API Token |
| MCP | 无独立 HTTP 端点，工具通过 stdio 调用 REST |

---

## 相关文档

- [认证说明](./user-auth.md) — Scope 与创建方式
- [API 概览](./api-overview.md) — 选型与核心接口
- [API 参考](./api.md) — 各接口专属错误码

---

## 下一步

| 目标 | 文档 |
|------|------|
| 调整脚本重试逻辑 | [脚本接入 · 错误处理](./scripting.md#错误处理) |
| MCP 报错排查 | [MCP 快速接入 · 常见错误](./mcp.md#常见错误) |
| 创建/更换 Token | [创建 API 密钥](./create-api-key.md) |
