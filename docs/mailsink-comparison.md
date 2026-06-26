# zMailR 与 MailSink 功能对照

> 参考：[MailSink 官方文档](https://mailsink.dev/docs/)  
> zMailR 愿景：实现 MailSink 类「收信 + 验证码提取」能力，但以**开源可自托管**为目标，并以**出站发信**作为差异化能力。

---

## 架构概览

```
                    ┌─────────────────────────────────────────┐
                    │           Cloudflare 边缘                │
                    └─────────────────────────────────────────┘
                                          │
    入站                                     │  HTTPS API / Web
    │                                        ▼
    ▼                              ┌──────────────────┐
┌───────────────┐                  │  Workers (Hono)   │
│ Email Routing │── email() ──────►│  routes.ts        │
│ Catch-all     │                  │  email-handler.ts │
└───────────────┘                  └─────────┬─────────┘
                                             │
                         ┌───────────────────┼───────────────────┐
                         ▼                   ▼                   ▼
                    ┌─────────┐        ┌──────────┐       ┌─────────────┐
                    │   D1    │        │  ASSETS  │       │ Brevo API   │
                    │ 邮箱/邮件│        │ React SPA│       │ 出站发信     │
                    │ 附件块  │        │ /admin   │       │ /api/send   │
                    │ Token   │        └──────────┘       └─────────────┘
                    └─────────┘

定时任务 (Cron)：清理过期邮箱、过期/已读邮件
```

**数据流简述**

1. **入站**：域名 Catch-all → Email Routing → Worker `email()` → postal-mime 解析 → D1 入库 → 按规则提取 `extracted_code`。
2. **收信 API**：Bearer Token → `GET /api/mail` 长轮询 → 返回验证码与邮件摘要。
3. **出站**：`POST /api/send` / `POST /api/user/send` → Brevo Transactional API。
4. **附件**：当前存于 **D1**（Base64 + 分块）；**R2 尚未接入**（路线图）。

---

## 端点映射

| MailSink | zMailR 等价/近似 | 说明 |
|----------|------------------|------|
| `POST /v1/inboxes` | `POST /api/lease` | Bearer Token（`lease` scope）；随机地址，24h TTL |
| | `POST /api/user/mailboxes` | Web 会话；可指定 local-part |
| | `POST /api/mailboxes` | **已废弃**（恒 401）；创建邮箱请用上述两路径。**不再支持匿名** |
| `GET /v1/inboxes` | `GET /api/mailboxes` | Bearer Token（`mail`）；用户 Token 按 user_id 过滤，legacy 返回最近活跃邮箱 |
| `DELETE /v1/inboxes/{id}` | `DELETE /api/mailboxes/:address` | 需 Bearer（`mail`）或会话 + 邮箱所有权 |
| `GET /v1/inboxes/{id}/messages` | `GET /api/mailboxes/:address/emails` | 列出邮件（含 `extractedCode` 字段） |
| `GET /v1/inboxes/{id}/latest-code` | `GET /api/mailboxes/:address/latest-code` | 非阻塞即时查询最新 OTP |
| `GET /v1/inboxes/{id}/wait-for-code` | `GET /api/mail` | 长轮询（默认 60s，最大 55s）；带 cursor 防重复 |
| `GET /v1/inboxes/{id}/latest-link` | `GET /api/mailboxes/:address/latest-link` | 从最新邮件提取验证链接 |
| `GET /v1/messages/{id}` | `GET /api/emails/:id` | 完整正文（text/html） |
| `GET /v1/messages/{id}/raw` | `GET /api/emails/:id/raw` | 存储的 raw MIME 或从 DB 重建 |
| `POST /v1/keys` | `POST /api/user/tokens` | Dashboard → API 密钥（Web 会话）；可配置 scope |
| | `POST /{ADMIN_PATH}/api/tokens` | Legacy 全局 Token（admin API，向后兼容；**管理 UI 已无 Token 标签页**） |
| `DELETE /v1/keys/{id}` | `DELETE /api/user/tokens/:id` | 用户 Token 吊销（需 Web 会话） |
| | `DELETE /{ADMIN_PATH}/api/tokens/:id` | Legacy Token 吊销（admin API） |
| — | `POST /api/send` | **zMailR 独有**：API Token 出站发信 |
| — | `POST /api/user/send` | **zMailR 独有**：Web 会话出站发信 |
| — | `GET/POST /api/auth/*` | **zMailR 独有**：用户登录与会话 |
| — | `GET /api/user/quota` | **zMailR 扩展**：日发信配额（会话或用户 Bearer，任意 scope） |
| — | `GET /api/emails/:id/attachments` | **zMailR 扩展**：附件列表与下载 |
| — | `GET /{ADMIN_PATH}/*` | **zMailR 扩展**：管理后台（路径由 `ADMIN_PATH` 配置） |

---

## 功能对照表

| 功能 | MailSink | zMailR | 状态 |
|------|:--------:|:------:|:----:|
| 创建 inbox | ✅ | ✅ | 对等（路径/鉴权不同；需登录或 Token） |
| 列出 inbox | ✅ | ✅ | 对等 |
| 删除 inbox | ✅ | ✅ | 对等（需鉴权 + 所有权） |
| 列出邮件 | ✅ | ✅ | 对等 |
| 最新 OTP（即时查询） | ✅ | ✅ | `/api/mailboxes/:address/latest-code` |
| 等待 OTP（阻塞） | ✅ | ✅ | `/api/mail` |
| 最新验证链接 | ✅ | ✅ | `/api/mailboxes/:address/latest-link` |
| 单封邮件详情 | ✅ | ✅ | 对等 |
| 原始 `.eml` 下载 | ✅ | ✅ | 入站存 raw + `GET /api/emails/:id/raw` |
| API Key 创建/吊销 | ✅ | ✅ | Dashboard 用户 Token；legacy admin API 仍可用 |
| 速率限制 | ✅ 按分钟 + Header | ✅ | 全局 IP 60/min 兜底 + **按用户** `rate_limit_per_min` / burst；`X-RateLimit-*` |
| MCP Server | ✅ `@mailsink/mcp` | ❌ | **缺口**（可选） |
| 出站发信 | ❌ | ✅ | **zMailR 优势** |
| 自定义发件人（已租邮箱） | — | ✅ | **zMailR 优势** |
| 开源 / 自托管 | ❌ SaaS | ✅ | **zMailR 优势** |
| Web UI（简体中文） | ✅ | ✅ | 均有 |
| 用户账户与配额 | 套餐制 | ✅ 自管 | **zMailR 优势** |
| 自定义 OTP 提取规则 | — | ✅ | **zMailR 扩展** |
| 附件 | — | ✅ D1 | D1 存储；R2 待接入（路线图） |
| OpenAPI 规范 | ✅ | ⚠️ | 内置 `/api-docs` 页面，无 `openapi.json` |

图例：✅ 已实现 · ⚠️ 部分实现 · ❌ 未实现

---

## zMailR 差异化优势

1. **开源可自托管**：MIT 许可，Fork 后部署到自己的 Cloudflare 账户与域名，数据与密钥完全自控。
2. **出站发信**：通过 Brevo 集成 `POST /api/send`，支持以已租用临时地址作为 `from`，适合 E2E 测试完整邮件往返。
3. **用户与配额体系**：多用户、按日发信配额（`GET /api/user/quota`）、scoped API Token（`lease` / `mail` / `send`），适合团队内部分配额度。
4. **可定制验证码提取**：管理后台配置按发件人域名的正则规则，内置兜底规则，比固定提取器更灵活。
5. **完整 Web 控制台**：Dashboard 收信/发信、OTP 高亮、API 文档页，无需仅依赖 REST。
6. **密钥路径管理后台**：`ADMIN_PATH` 环境变量配置不可猜测的 URL；错误路径返回 404，不暴露后台存在。详见 [管理后台指南](./admin-guide.md)。
7. **运维与治理能力**（MailSink 无对等项）：
   - **限流监控**：429 事件、Top IP / 用户（D1 `rate_limit_hits`，保留约 7 天）
   - **系统设置 / 维护模式**：可选阻断 lease、发信、创建邮箱；Dashboard 横幅 + API 503
   - **审计日志**：管理员与用户关键操作追溯
   - **Brevo 统计**：仪表盘展示本地发信统计与 Brevo 账户 credits
   - **按用户发信配额与速率方案**：Free / Pro / Team 预设或自定义 `rate_limit_per_min` + burst
   - **系统公告**：面向 Dashboard 用户的 Markdown 公告

---

## 待补齐缺口（优先级建议）

| 优先级 | 缺口 | 建议方向 |
|:------:|------|----------|
| P4 | MCP Server | 可选 npm 包，封装 lease / mail / send 工具 |
| P4 | OpenAPI | 导出 `openapi.json` 便于 SDK 生成 |
| — | R2 附件存储 | 当前 D1 分块；R2 为路线图 |

已补齐（2026-06）：`GET /api/mailboxes`、`latest-code`、`latest-link`、`GET /api/emails/:id/raw`、速率限制 Header、Dashboard UI。

---

## 典型自动化流程对比

**MailSink（3 步）**

```http
POST /v1/inboxes          → 获得 address
# ... 在目标站点使用该地址 ...
GET  /v1/inboxes/{id}/wait-for-code  → 获得 code
```

**zMailR（3 步 + 可选发信）**

```http
POST /api/lease           Authorization: Bearer <token>
# ... 使用返回的 email ...
GET  /api/mail?to=<email>&timeout=60
POST /api/send            （可选）以租用的地址发信
```

参数对照：

| MailSink | zMailR |
|----------|--------|
| `local_part` / `domain` / `ttl` | 随机 local-part；域名由 `VITE_EMAIL_DOMAIN` 决定；固定 24h |
| inbox `id` | mailbox `address`（local-part）或完整 `email` |
| Bearer `msk_*` | Bearer 用户 Token（Dashboard 创建）或 legacy admin Token |

---

## 鉴权差异

| | MailSink | zMailR |
|---|----------|--------|
| 获取 API Key | GitHub 登录 → 控制台 | 用户登录后在 **Dashboard → API 密钥** 创建 scoped Token |
| Legacy 全局 Token | — | Admin API `/{ADMIN_PATH}/api/tokens` 仍可用（向后兼容）；**管理 UI 已无 Token 标签页** |
| Key 权限 | 统一 | `lease` / `mail` / `send` 分 scope |
| 匿名 API | — | **不支持**；所有收信/发信/创建邮箱均需会话或 Bearer Token |
| 创建邮箱 | Bearer | `POST /api/lease`（Bearer `lease`）或 `POST /api/user/mailboxes`（Web 会话） |
| 删除邮箱 | Bearer | `DELETE /api/mailboxes/:address` 需鉴权 + 邮箱所有权 |

---

## 速率限制

| 层级 | 规则 |
|------|------|
| **按用户**（会话或用户 Bearer Token） | 滑动窗口 1 分钟；`rate_limit_per_min` + 可选 `rate_limit_burst` |
| **全局 IP 兜底** | 未识别为用户时（如 legacy Token）默认 **60 req/min** |
| **管理预设** | Admin → 用户弹窗：Free 60/min、Pro 600/min + burst 30、Team 3000/min + burst 200、自定义 |

响应头：`X-RateLimit-Limit`、`X-RateLimit-Remaining`、`X-RateLimit-Reset`、`Retry-After`；超限返回 `429` + `{ "error": "rate_limit" }`。详见 [user-auth.md](./user-auth.md) 与 [admin-guide.md](./admin-guide.md)。

---

## 相关文档

- [管理后台指南](./admin-guide.md)
- [部署指南](./deploy.md)
- [Brevo 发信配置](./brevo-setup.md)
- [用户认证与 Token](./user-auth.md)
- [项目 README](../README.md)
