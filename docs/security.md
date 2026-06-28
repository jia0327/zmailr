# 安全说明

> **文档导航** → [文档首页](./) · **部署** → [deploy.md](./deploy.md) · **认证** → [user-auth.md](./user-auth.md)

本文档汇总 zMailR Worker 的安全模型、环境变量与运维建议。面向自托管部署者与安全审查。

---

## 鉴权模型

| 入口 | 机制 | 说明 |
|------|------|------|
| Web Dashboard | HttpOnly Cookie `zmail_user_session`（HMAC，24h） | `POST /api/auth/login`；失败次数 IP 限流；可选 Turnstile |
| 用户 API Token | `Authorization: Bearer` + SHA-256 哈希存储 | Scope：`lease` / `mail` / `send`；校验 `expires_at` |
| 管理后台 | `ADMIN_PASSWORD` + Cookie `zmail_admin_session` | URL 由 `ADMIN_PATH`（推荐 UUID）隐藏；登录 IP 限流（无 Turnstile） |
| 公开端点 | 无鉴权 | 见下表 |

**公开 HTTP 端点**（仍受 `/api/*` 全局限流，除非另说明）：

| 端点 | 说明 |
|------|------|
| `GET /api/health` | 存活探测 |
| `GET /api/public/status` | D1/R2/Brevo 健康（固定文案，无堆栈） |
| `GET /api/config` | SPA 启动配置（域名、注册开关、Turnstile 公钥、维护模式） |
| `GET /openapi.json` | OpenAPI 3.1（公开，缓存 1h；**不经** `/api/*` 限流中间件） |
| `POST /api/auth/login` | 用户登录（Turnstile + 登录限流） |
| `POST /api/auth/logout` | 清除 Session Cookie |
| `POST /api/auth/register/send-code` | 注册发码 |
| `POST /api/auth/register/resend` | 注册重发 |
| `POST /api/auth/register/verify` | 注册验码 |
| `POST /api/auth/password-reset/send-code` | 重置密码发码 |
| `POST /api/auth/password-reset/resend` | 重置密码重发 |
| `POST /api/auth/password-reset/verify` | 重置密码验码 |

**不支持匿名 API**：创建邮箱须 Dashboard 登录或 `POST /api/lease`（Bearer）。已废弃的 `POST /api/mailboxes` 固定返回 401。

---

## 环境变量（安全相关）

| 变量 | 必填 | 说明 |
|------|------|------|
| `ADMIN_PASSWORD` | 是 | 管理后台登录密码（生产请使用强随机串） |
| `SESSION_SECRET` | 是 | 用户/管理后台 Session Cookie HMAC 密钥；须与 `ADMIN_PASSWORD` 独立 |
| `ADMIN_PATH` | 生产必填 | 管理后台 URL 段（UUID）；错误路径返回 404 |
| `BREVO_API_KEY` | 否 | Secret，勿写入仓库 |
| `CORS_ALLOWED_ORIGINS` | 否 | 浏览器 SPA 的 Origin 白名单（逗号分隔完整 URL，如 `https://mail.example.com`）；**邮箱域名不会自动加入**；本地 dev 端口始终允许 |

**用户与配额均在管理后台配置**，不通过额外环境变量：

| 配置项 | 管理后台位置 | 说明 |
|--------|--------------|------|
| 演示/普通用户 | **用户** 标签 | 创建用户名、密码、`daily_send_quota`、速率方案 |

---

## 发信安全

- **`from` 域名**：必须与 `MAIL_DOMAIN` 一致（无法伪造外域发件人）。
- **`from` 所有权**：用户 Session / 用户 Bearer 的 `from` 须为**当前用户名下**且未过期的临时邮箱。
- **默认发件人**：未指定 `from` 时使用 `no-reply@{MAIL_DOMAIN}`。
- **`to` 校验**：须为合法邮箱格式。

---

## 发信配额

| 类型 | 配置位置 | 计数维度 | 适用对象 |
|------|----------|----------|----------|
| **用户日发信配额** | 管理后台 → **用户** → 日发信配额 | 按 `user_id` / UTC 日 | Dashboard 发信、`POST /api/user/send`、`POST /api/send`（用户 Bearer Token） |

`-1` 表示无限。配额通过 `GET /api/user/quota` 查询。

---

## 演示账号

- 首次 D1 迁移时，若尚无 `guest` 用户，会自动创建 **guest / guest** 演示账号（日发信配额 50）。
- 已存在的 `guest` 账户不会被部署流程覆盖密码；可在管理后台 **用户** 标签禁用或改密。
- 生产环境若不需要公开演示账号，部署后于 **用户** 标签删除或禁用 `guest`。

---

## 数据库初始化

- D1 迁移在 Worker **首次冷启动**时自动执行（`ensureDatabaseInitialized`）。
- **已移除** HTTP `?init` 公开重初始化端点，防止未授权触发迁移/DoS。

---

## 登录与暴力破解

| 端点 | 限制 |
|------|------|
| `POST /api/auth/login` | 每 IP 15 分钟内失败 5 次锁定；每分钟尝试次数上限；启用 Turnstile 时须带有效 token |
| `POST /api/auth/register/send-code`、`…/resend` | 同上前缀独立计数 + Turnstile（若启用） |
| `POST /api/auth/password-reset/send-code`、`…/resend` | 同上 |
| `POST /api/auth/register/verify`、`…/password-reset/verify` | 每 pending 记录最多 5 次验码；**无 Turnstile** |
| `POST /{ADMIN_PATH}/login` | 同上（独立计数前缀 `admin-login`）；启用 Turnstile 时须带有效 token |

---

## Turnstile（人机验证）

- 在管理后台 **系统设置** 配置 Site Key / Secret Key，或通过 Worker 环境变量 `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY`（DB 优先）。
- 启用后保护：**用户登录**、**管理后台登录**、**注册/重置发码与重发**；验码步骤不受 Turnstile 保护。
- Secret Key 可存 D1 `system_settings`（管理后台保存）；生产更推荐仅通过 `wrangler secret` 注入。
- 公钥经 `GET /api/config` 下发给 SPA；CSP 已允许 `https://challenges.cloudflare.com`（script + frame）。

---

## 速率限制

- Dashboard Session：per-user `rate_limit_per_min` + 可选 burst。
- Bearer API Token：per-token（`user_tokens.id`）计数，配额仍取自所属用户的 `rate_limit_per_min` / burst；同一用户多密钥互不共享桶。
- 未认证请求：全局 IP 60 req/min（`/api/*`）；客户端 IP **仅**取自 Cloudflare `CF-Connecting-IP`，不信任可伪造的 `X-Forwarded-For`。
- 管理后台 `POST /{ADMIN_PATH}/login`：同样适用全局 IP 60 req/min，并叠加登录失败锁定。
- 响应头：`X-RateLimit-*`、`Retry-After`；超限 `429`。

---

## 邮箱创建

- 随机与自定义地址均计入用户 **日租配额**（`daily_lease_quota`）。
- 自定义 local-part 须为 **8–12 位**小写字母或数字（`[a-z0-9]{8,12}`），不可含 `@`。
- 每用户同时存在的未过期邮箱上限 **50**（`DEFAULT_MAX_USER_MAILBOXES`）。

---

## 注册 / 重置密码发码

- 发码与重发接口在成功时统一 **HTTP 200**，固定文案（注册：「若该邮箱未注册，验证码已发送」；重置：「若该邮箱已注册，验证码已发送」），避免邮箱枚举。
- 已禁用账户的重置密码请求与不存在账户返回相同成功响应，且不会更新 `password_hash`。

---

## Bearer 长轮询 `GET /api/mail`

- 单次最长 **30 秒**，服务端每 **3 秒**查库一次。
- 建议每个 Bearer Token **并发 ≤3** 路长轮询；收到 `408 timeout` 时客户端应退避再试，避免占满 Worker 并发。

---

## 验证码提取

- 收信时写入 `emails.extracted_code`（非查询时临时计算）。
- HTML：去除 script/style 标签，基础 entity 解码后再匹配。
- 优先级：用户规则 → 全局规则 → 内置兜底；域名精确匹配优于 `*`。
- 自定义正则由管理员/用户配置；保存时与执行时均拒绝嵌套量词等高风险模式，单次匹配超过约 **25ms** 则放弃（仍勿添加过于复杂的模式）。

---

## 发信错误脱敏

- Brevo 上游失败时，客户端与 `sent_emails.error_message` 仅见「发信失败，请稍后重试」；完整响应仅写入服务端日志。

---

## 密码与 Token 存储

- 用户密码：PBKDF2-SHA256，10 万次迭代 + 随机 salt（常量时间比较）。**用户改密不会撤销已有 API Token**（与换账号不同；Token 仍有效直至过期或手动删除）。
- 管理后台密码：同样 PBKDF2 哈希存储于 D1 `system_settings`；`ADMIN_PASSWORD` 环境变量仅在启动时同步哈希，改密后 bump `admin_session_version` 使旧 **管理 Cookie** 失效。
- 用户 API Token：仅存 SHA-256 哈希；明文仅在创建时返回一次。
- **Legacy 全局 API Token（`api_tokens` 表）已移除**：启动时一次性清理旧表与 `legacy_token_id` 关联；请使用 Dashboard **API 密钥**（`user_tokens`）。
- **管理后台**仅通过 `ADMIN_PASSWORD` + Session Cookie 认证，不再自动创建 `admin` 数据库用户。

---

## CORS

- API **不反射**任意 `Origin`；浏览器跨域带 Cookie 的请求仅当 Origin 在白名单内才返回 `Access-Control-Allow-Origin`。
- 白名单来源（`worker/src/cors.ts`）：
  - 本地开发：`localhost` / `127.0.0.1` 常见 Vite/Wrangler 端口（8787、5173、4173）
  - 环境变量 **`CORS_ALLOWED_ORIGINS`**：逗号分隔的完整 Origin（须含协议，如 `https://app.example.com`）
- **`MAIL_DOMAIN` / `VITE_EMAIL_DOMAIN` 不会自动加入 CORS**（邮箱域名 ≠ 前端 SPA 域名）。前后端不同域时必须在 `CORS_ALLOWED_ORIGINS` 中显式配置前端 Origin。
- 未知 Origin 不返回 `Access-Control-Allow-Origin`（浏览器跨域失败；curl / 同源不受影响）。

---

## 安全响应头与 CSP

由 `worker/src/security-headers.ts` 统一设置；**HSTS 建议在 Cloudflare 控制台配置**（SSL/TLS → 边缘证书 → 始终使用 HTTPS + HSTS），Worker 内不重复发送。

| 响应头 | 说明 |
|--------|------|
| `X-Content-Type-Options: nosniff` | 全响应 |
| `X-Frame-Options: DENY` | 全响应 |
| `Referrer-Policy: strict-origin-when-cross-origin` | 全响应 |
| `Permissions-Policy` | 禁用 camera / microphone / geolocation |
| `Content-Security-Policy` | 按场景 profile，见下表 |

| CSP Profile | 适用 | 要点 |
|-------------|------|------|
| **api** | `/api/*`、`/openapi.json` | `default-src 'none'` |
| **spa** | Dashboard 等 HTML（**不含** `/docs/*`） | `script-src 'self'` + Turnstile；`style-src 'unsafe-inline'` |
| **admin** | 管理后台 HTML | `script-src 'self'` + Turnstile；`style-src 'unsafe-inline'`（外置 `admin.js`，无 inline script） |
| **none** | 静态 JS/CSS、VitePress `/docs/` | 仅基础头，无 CSP（文档站内联脚本） |

管理后台脚本通过 `/{ADMIN_PATH}/admin.js` 加载；勿在 HTML 中恢复 inline `onclick` / `<script>`，否则 CSP 会拦截。

---

## 已知限制与运维注意

| 项 | 说明 |
|----|------|
| 改密 / 重置密码 | 会 bump `session_version` 使用户 Session 失效；**不会**自动删除已有 API Token，需手动删密钥或等过期 |
| 前端 Token 缓存 | Dashboard 为「复制一次」将 Bearer 明文暂存于 `sessionStorage`；XSS 可读取，勿在不可信环境长期保留 |
| 邮件 localStorage 缓存 | 前端可能缓存邮件正文与 `extractedCode`；共享设备存在泄露风险 |
| 入站附件 | 入站 MIME 附件写入 R2/D1 前**无**与出站相同的 5MB 总量上限；恶意大附件可消耗存储 |
| 维护模式 | `blockSend` 拦截 `POST /api/send`、`POST /api/user/send` 与 `POST /api/user/sent/:id/resend`；仅 `blockLease` 时 Session 仍可通过 `POST /api/user/mailboxes` 创建邮箱 |
| 6 位邮箱 OTP | 注册/重置验码为 6 位数字 + 3 分钟 TTL；依赖 IP 限流与每 pending 5 次尝试 |
| IP 限流 | 依赖 Cloudflare `CF-Connecting-IP`；非 CF 代理时未认证流量可能共用一个 unknown 桶 |
| 演示账号 | 首次迁移自动创建 `guest/guest`；生产应删除或禁用 |

---

## 错误响应脱敏

- `routes.ts` 中 500 响应统一经 `apiInternalError()`：服务端 `console.error`，客户端仅 `{ success: false, error: "…" }`。
- 顶层 `index.ts` fetch 与 `app.onError` 同样不返回堆栈或驱动错误文本。
- 公开 `GET /api/public/status` 健康探测：D1/R2/Brevo 失败时仅返回固定文案（如「D1 不可用」「Brevo API 不可用」），不暴露 SQL/API 原始错误。

---

## 部署检查清单

- [ ] `ADMIN_PATH` 为 UUID，非 `admin`（生产环境未配置将拒绝启动；本地 dev 设 `LOCAL_DEV=1`）
- [ ] `ADMIN_PASSWORD` 强随机，未提交仓库
- [ ] `SESSION_SECRET` 强随机，已通过 `wrangler secret` / GitHub Actions 注入，未提交仓库
- [ ] `BREVO_API_KEY` 仅通过 `wrangler secret` / Actions Secret
- [ ] Email Routing Catch-all 指向本 Worker
- [ ] Cloudflare：**始终使用 HTTPS** + **HSTS**（边缘证书页；子域未全 HTTPS 时不要开 includeSubDomains）
- [ ] 演示账号：生产删除或禁用 `guest`（若不需要公开演示）
- [ ] 前后端不同域：在 `CORS_ALLOWED_ORIGINS` 中配置**完整前端 Origin**（非邮箱域名变量）
- [ ] 部署后抽查：HTML 响应含 `Content-Security-Policy`；管理后台各功能正常；Turnstile（若启用）可用

---

## 相关文档

- [deploy.md](./deploy.md) — Secrets、部署验证
- [user-auth.md](./user-auth.md) — Session、Scope、配额
- [admin-guide.md](./admin-guide.md) — 审计日志、维护模式、请求监控
