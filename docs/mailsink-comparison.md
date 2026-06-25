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
4. **附件**：当前存于 **D1**（Base64 + 分块）；**R2 尚未接入**（路线图组件）。

---

## 端点映射

| MailSink | zMailR 等价/近似 | 说明 |
|----------|------------------|------|
| `POST /v1/inboxes` | `POST /api/lease` | 需 Bearer Token（`lease` scope）；随机地址，24h TTL |
| | `POST /api/mailboxes` | 匿名 Web 创建，可指定 local-part |
| `GET /v1/inboxes` | — | **缺失**：无程序化「列出活跃 inbox」API |
| `DELETE /v1/inboxes/{id}` | `DELETE /api/mailboxes/:address` | 按 local-part 删除；Web 路由，无 Token 鉴权 |
| `GET /v1/inboxes/{id}/messages` | `GET /api/mailboxes/:address/emails` | 列出邮件（含 `extractedCode` 字段） |
| `GET /v1/inboxes/{id}/latest-code` | 部分等价 | 无独立端点；可通过邮件列表最新一封的 `extractedCode`，或 `GET /api/mail?require_code=false` 取最近邮件 |
| `GET /v1/inboxes/{id}/wait-for-code` | `GET /api/mail` | 长轮询（默认 60s，最大 55s）；带 cursor 防重复 |
| `GET /v1/inboxes/{id}/latest-link` | — | **缺失**：未实现验证链接提取 |
| `GET /v1/messages/{id}` | `GET /api/emails/:id` | 完整正文（text/html） |
| `GET /v1/messages/{id}/raw` | — | **缺失**：未存储原始 `.eml` |
| `POST /v1/keys` | `POST /admin/api/tokens` | Legacy 全局 Token（admin 会话） |
| | `POST /api/user/tokens` | 用户 Token，可配置 scope |
| `DELETE /v1/keys/{id}` | `DELETE /admin/api/tokens/:id` | Legacy Token 吊销 |
| | `DELETE /api/user/tokens/:id` | 用户 Token 吊销（需 Web 会话） |
| — | `POST /api/send` | **zMailR 独有**：API Token 出站发信 |
| — | `POST /api/user/send` | **zMailR 独有**：Web 会话出站发信 |
| — | `GET/POST /api/auth/*` | **zMailR 独有**：用户登录与会话 |
| — | `GET /api/emails/:id/attachments` | **zMailR 扩展**：附件列表与下载 |
| — | `GET /admin/*` | **zMailR 扩展**：管理后台、提取规则、用户配额 |

---

## 功能对照表

| 功能 | MailSink | zMailR | 状态 |
|------|:--------:|:------:|:----:|
| 创建 inbox | ✅ | ✅ | 对等（路径/鉴权不同） |
| 列出 inbox | ✅ | ❌ | **缺口** |
| 删除 inbox | ✅ | ✅ | 对等（Web 路由） |
| 列出邮件 | ✅ | ✅ | 对等 |
| 最新 OTP（即时查询） | ✅ | ⚠️ | 无专用端点，需列表或轮询 |
| 等待 OTP（阻塞） | ✅ | ✅ | `/api/mail` |
| 最新验证链接 | ✅ | ❌ | **缺口** |
| 单封邮件详情 | ✅ | ✅ | 对等 |
| 原始 `.eml` 下载 | ✅ | ❌ | **缺口**（未存 raw） |
| API Key 创建/吊销 | ✅ | ✅ | 对等（admin + 用户双轨） |
| 速率限制 | ✅ 按分钟 + Header | ⚠️ | 仅有**日发信配额**（429），无 `X-RateLimit-*` |
| MCP Server | ✅ `@mailsink/mcp` | ❌ | **缺口**（可选） |
| 出站发信 | ❌ | ✅ | **zMailR 优势** |
| 自定义发件人（已租邮箱） | — | ✅ | **zMailR 优势** |
| 开源 / 自托管 | ❌ SaaS | ✅ | **zMailR 优势** |
| Web UI + 多语言 | ✅ | ✅ | 均有 |
| 用户账户与配额 | 套餐制 | ✅ 自管 | **zMailR 优势** |
| 自定义 OTP 提取规则 | — | ✅ | **zMailR 扩展** |
| 附件 | — | ✅ D1 | D1 存储；R2 待接入 |
| OpenAPI 规范 | ✅ | ⚠️ | 内置 `/api-docs` 页面，无 openapi.json |

图例：✅ 已实现 · ⚠️ 部分实现 · ❌ 未实现

---

## zMailR 差异化优势

1. **开源可自托管**：MIT 许可，Fork 后部署到自己的 Cloudflare 账户与域名，数据与密钥完全自控。
2. **出站发信**：通过 Brevo 集成 `POST /api/send`，支持以已租用临时地址作为 `from`，适合 E2E 测试完整邮件往返。
3. **用户与配额体系**：多用户、按日发信配额、scoped API Token（`lease` / `mail` / `send`），适合团队内部分配额度。
4. **可定制验证码提取**：管理后台配置按发件人域名的正则规则，内置兜底规则，比固定提取器更灵活。
5. **完整 Web 控制台**：Dashboard 收信/发信、OTP 高亮、API 文档页，无需仅依赖 REST。

---

## 待补齐缺口（优先级建议）

| 优先级 | 缺口 | 建议方向 |
|:------:|------|----------|
| P1 | `latest-link` 端点 | 在 `extractor` 中增加 URL 提取，新增 `GET /api/mailboxes/:address/latest-link` 或 query 参数 |
| P1 | `latest-code` 即时端点 | `GET /api/mailboxes/:address/latest-code`，对齐 MailSink 非阻塞查询 |
| P2 | 列出 inbox API | `GET /api/inboxes`（Token 鉴权，返回当前用户/Token 创建的邮箱） |
| P2 | 速率限制 Header | 中间件计数 + `X-RateLimit-Limit` / `X-RateLimit-Remaining` |
| P3 | 原始 `.eml` | 入站时存 R2 或 D1 blob，暴露 `GET /api/emails/:id/raw` |
| P3 | R2 大附件 | 大附件迁 R2，D1 仅存元数据（与愿景栈对齐） |
| P4 | MCP Server | 可选 npm 包，封装 lease / mail / send 工具 |
| P4 | OpenAPI | 导出 `openapi.json` 便于 SDK 生成 |

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
| Bearer `msk_*` | Bearer 用户 Token 或 admin legacy Token |

---

## 鉴权差异

| | MailSink | zMailR |
|---|----------|--------|
| 获取 API Key | GitHub 登录 → 控制台 | `/admin` 创建 legacy Token，或用户登录后在 `/account` 创建 scoped Token |
| Key 权限 | 统一 | `lease` / `mail` / `send` 分 scope |
| Web 匿名收信 | — | `POST /api/mailboxes` 无需登录 |

---

## 相关文档

- [Brevo 发信配置](./brevo-setup.md)
- [用户认证与 Token](./user-auth.md)
- [项目 README](../README.md)
