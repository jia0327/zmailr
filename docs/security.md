# 安全说明

> **文档导航** → [文档首页](./) · **部署** → [deploy.md](./deploy.md) · **认证** → [user-auth.md](./user-auth.md)

本文档汇总 zMailR Worker 的安全模型、环境变量与运维建议。面向自托管部署者与安全审查。

---

## 鉴权模型

| 入口 | 机制 | 说明 |
|------|------|------|
| Web Dashboard | HttpOnly Session Cookie（HMAC，24h） | `POST /api/auth/login`；失败次数 IP 限流 |
| 用户 API Token | `Authorization: Bearer` + SHA-256 哈希存储 | Scope：`lease` / `mail` / `send`；校验 `expires_at` |
| 管理后台 | `ADMIN_PASSWORD` + Admin Session Cookie | URL 由 `ADMIN_PATH`（推荐 UUID）隐藏；登录 IP 限流 |
| 公开端点 | 无鉴权 | `GET /api/health`、`/api/public/status`、`/api/config`、`/openapi.json` |

**不支持匿名 API**：创建邮箱须 Dashboard 登录或 `POST /api/lease`（Bearer）。

---

## 环境变量（安全相关）

| 变量 | 必填 | 说明 |
|------|------|------|
| `ADMIN_PASSWORD` | 是 | 管理后台密码；同时作为 Session HMAC 密钥（生产请使用强随机串） |
| `ADMIN_PATH` | 生产必填 | 管理后台 URL 段（UUID）；错误路径返回 404 |
| `BREVO_API_KEY` | 否 | Secret，勿写入仓库 |
| `CORS_ALLOWED_ORIGINS` | 否 | 额外浏览器 Origin 白名单（逗号分隔完整 URL）；本地 dev 端口始终允许 |

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
| `POST /api/auth/login` | 每 IP 15 分钟内失败 5 次锁定；每分钟尝试次数上限 |
| `POST /{ADMIN_PATH}/login` | 同上（独立计数前缀 `admin-login`） |

---

## 速率限制

- 已登录用户 / 用户 Bearer：per-user `rate_limit_per_min` + 可选 burst。
- 未识别为用户的请求：全局 IP 60 req/min（`/api/*`）。
- 响应头：`X-RateLimit-*`、`Retry-After`；超限 `429`。

---

## 验证码提取

- 收信时写入 `emails.extracted_code`（非查询时临时计算）。
- HTML：去除 script/style 标签，基础 entity 解码后再匹配。
- 优先级：用户规则 → 全局规则 → 内置兜底；域名精确匹配优于 `*`。
- 自定义正则由管理员/用户配置，存在 ReDoS 风险——勿添加过于复杂的模式。

---

## 密码与 Token 存储

- 用户密码：PBKDF2-SHA256，10 万次迭代 + 随机 salt。
- 用户 API Token：仅存 SHA-256 哈希；明文仅在创建时返回一次。

---

## CORS

- API 不再反射任意 `Origin`；仅允许：
  - 本地开发源（`localhost` / `127.0.0.1` 常见 Vite/Wrangler 端口）
  - `https://` / `http://` + `MAIL_DOMAIN` / `VITE_EMAIL_DOMAIN` 中的每个域名
  - 可选 `CORS_ALLOWED_ORIGINS` 中的完整 Origin URL
- 未知 Origin 不返回 `Access-Control-Allow-Origin`（浏览器跨域请求失败，curl 等同源调用不受影响）。

---

## 错误响应脱敏

- `routes.ts` 中 500 响应统一经 `apiInternalError()`：服务端 `console.error`，客户端仅 `{ success: false, error: "…" }`。
- 顶层 `index.ts` fetch 与 `app.onError` 同样不返回堆栈或驱动错误文本。
- 公开 `GET /api/public/status` 健康探测：D1/R2/Brevo 失败时仅返回固定文案（如「D1 不可用」「Brevo API 不可用」），不暴露 SQL/API 原始错误。

---

## 部署检查清单

- [ ] `ADMIN_PATH` 为 UUID，非 `admin`
- [ ] `ADMIN_PASSWORD` 强随机，未提交仓库
- [ ] `BREVO_API_KEY` 仅通过 `wrangler secret` / Actions Secret
- [ ] Email Routing Catch-all 指向本 Worker
- [ ] 演示账号（若需要）在管理后台 **用户** 中创建，勿依赖硬编码默认密码
- [ ] 若前端与 API 不同域，已在 `CORS_ALLOWED_ORIGINS` 或域名变量中配置 Origin

---

## 相关文档

- [deploy.md](./deploy.md) — Secrets、部署验证
- [user-auth.md](./user-auth.md) — Session、Scope、配额
- [admin-guide.md](./admin-guide.md) — 审计日志、维护模式、请求监控
