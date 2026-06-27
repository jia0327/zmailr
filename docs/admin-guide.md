# 管理后台指南

> **文档导航** → [文档首页](./)

zMailR 管理后台用于运维与用户治理，**不在前端 bundle 中暴露入口**，仅通过环境变量 `ADMIN_PATH` 配置的密钥路径访问。

---

## 访问方式

| 项目 | 说明 |
|------|------|
| URL | `https://你的域名/{ADMIN_PATH}` |
| 路径配置 | GitHub Secret / Worker 环境变量 **`ADMIN_PATH`**（推荐 UUID，无 `/` 前缀） |
| 本地默认 | 未设置时开发环境默认为 `admin` |
| 鉴权 | `ADMIN_PASSWORD` 对应密码；登录后 HttpOnly Cookie，作用域为 `Path=/{ADMIN_PATH}` |
| 安全 | 访问错误路径返回 **404**，不暴露后台是否存在 |

**生产部署必须在 GitHub Actions Secret 中设置 `ADMIN_PATH`**，勿使用可猜测的路径。

---

## 功能标签页

| 标签 | 功能 |
|------|------|
| **仪表盘** | **系统健康**（D1 / R2 / Brevo）；今日收信/发信、活跃用户、有效用户 Token；Brevo 套餐信息（已配置 `BREVO_API_KEY` 时） |
| **用户** | 创建/编辑/禁用/删除用户，日发信配额，**速率方案**（Free / Pro / Team / 自定义） |
| **公告** | 面向 Dashboard 用户的系统公告（Markdown/纯文本） |
| **提取规则** | 全局规则 + 汇总所有用户自定义规则 |
| **请求监控** | 近 7 日折线趋势、今日状态码分布、429 Top IP / 用户 |
| **域名** | 多邮箱域名管理：添加 / 启用 / 禁用 / 设默认；须先完成 Cloudflare Email Routing 与 Brevo 域名认证 |
| **系统设置** | **维护模式**（可选阻断 lease / 发信 / 创建邮箱）；**Turnstile** 人机验证开关与密钥 |
| **审计日志** | 管理员与用户关键操作记录，按日期筛选 |

![管理后台仪表盘](./screenshots/admin-dashboard.png)

![管理后台域名管理](./screenshots/admin-domains.png)

![管理后台系统设置](./screenshots/admin-settings.png)

程序化 API 请使用 Dashboard → **API 密钥**（用户 Bearer Token + scope + 日配额）。详见 [user-auth.md](./user-auth.md)。

---

## 用户与速率限制

### 日发信配额

| 配置位置 | 适用对象 | 计数维度 | 存储 |
|----------|----------|----------|------|
| **用户** 标签 → 日发信配额 | Dashboard 用户 Token、`POST /api/user/send`、Web 发件箱、`POST /api/send` | 按 **用户 ID** / UTC 日 | `users.daily_send_quota` + `daily_usage` |

每位用户除 **日发信配额**（`daily_send_quota`，`-1` 为无限）外，还有 **API 速率限制**（按用户 ID 计数，固定 1 分钟窗口）：

| 方案 |  sustained (req/min) | 突发 (burst) | 说明 |
|------|---------------------|--------------|------|
| **Free** | 60 | — | 默认 |
| **Pro** | 600 | 30 | 短时允许额外 30 次 |
| **Team** | 3000 | 200 | 高并发脚本 |
| **自定义** | 手动填写 | 可选 | 覆盖上述预设 |

- 响应头：`X-RateLimit-Limit`（sustained 速率，不含 burst）、`X-RateLimit-Remaining`（含 burst 剩余额度）、`X-RateLimit-Reset`、`Retry-After`
- 未识别为登录用户/用户 Token 的请求走 **全局 IP 限流**（默认 60 req/min）
- 在用户弹窗中选择方案会自动填充数值；保存后写入 D1 `users.rate_limit_per_min` / `rate_limit_burst`

---

## 请求监控

**请求监控** 标签展示：

### 近 7 日请求趋势（折线图）

- 多条折线：2xx / 4xx / 5xx 汇总，以及 401、403、404、429、500
- 图例可点击隐藏/显示单条折线
- 支持手动刷新

### API 请求概览（全部状态码）

- 今日总请求、2xx / 4xx / 5xx 汇总
- 各状态码分布（200、401、403、404、429、500 等）
- Top 10 路由（按请求量，路径中的 ID/邮箱地址已归一化）

数据来自 D1 表 `api_request_stats`，在 `/api/*` 与管理后台 API 响应后异步写入；按 UTC 日聚合；**保留 7 天**（每小时 Cron 清理）。

### 429 限流详情

- 今日触发 **429** 的总次数
- 今日 Top 10 IP（按 429 次数）
- 今日 Top 10 用户（按 429 次数）

数据来自 D1 表 `rate_limit_hits`，每次 API 返回 429 时写入；**保留约 7 天**后自动清理。

管理 API：`GET {ADMIN_PATH}/api/request-stats`、`GET {ADMIN_PATH}/api/rate-limit-stats`

---

## 维护模式

在 **系统设置** 中可开启维护模式：

| 选项 | 效果 |
|------|------|
| 启用维护模式 | 总开关 |
| 维护提示信息 | 用户 Dashboard 顶部横幅文案；API 503 响应中的 `message` |
| 阻断 `POST /api/lease` | 禁止程序化租用邮箱 |
| 阻断发信 | 禁止 `POST /api/send` 与 `POST /api/user/send` |
| 阻断创建邮箱 | 含 lease 与 `POST /api/user/mailboxes` |

- 用户端通过 `GET /api/public/status` 读取维护状态并显示横幅
- 被阻断的 API 返回 `503`，body：`{ "success": false, "error": "maintenance", "message": "..." }`
- 读信、查询配额等未勾选阻断的功能仍可用

配置持久化在 D1 `system_settings` 表，保存时写入审计日志 `maintenance.update`。

---

## 邮箱域名管理

**域名** 标签用于管理多邮箱后缀（如 `itellme.eu.cc`、`onlyme.qzz.io` 等）。域名列表持久化在 D1 `mail_domains` 表；前端 `GET /api/config` 的 `emailDomains` 仅返回 **已启用** 的域名。

### 添加前必读

每新增一个域名，须 **先** 完成：

1. **Cloudflare**：域名已接入本账户，**Email Routing** 已启用，Catch-all 指向本 zMailR Worker（参见 [deploy.md](./deploy.md) §4）。
2. **Brevo**：该域名已在 Brevo 完成发信认证（SPF / DKIM / DMARC），且 Worker 已配置 `BREVO_API_KEY`（参见 [brevo-setup.md](./brevo-setup.md)）。

后台 **添加域名** 时须勾选上述两项确认；未配置 `BREVO_API_KEY` 时无法添加新域名。

从环境变量 `VITE_EMAIL_DOMAIN` 首次导入的域名会标记为「未确认」，可在列表中点击 **确认已配置** 后再启用。

### 操作说明

| 操作 | 说明 |
|------|------|
| **添加** | 填写根域名并勾选 Cloudflare / Brevo 确认 |
| **启用 / 禁用** | 禁用后前端下拉与发信 API 不再接受该域名 |
| **设为默认** | 租用邮箱、`from` 未指定时的默认后缀 |
| **删除** | 至少保留一个已启用域名 |

管理 API：`GET/POST {ADMIN_PATH}/api/domains`、`PUT/DELETE {ADMIN_PATH}/api/domains/:id`

### 收信、发信与界面切换域名

邮箱在 D1 中保存 **local part**（如 `oilg5toc0`）。界面域名下拉会改变显示/复制的完整地址后缀，并写入 `mailboxes.mail_domain`（用于**发信**时校验 `from`）。

| 场景 | 说明 |
|------|------|
| **收信** | 邮件须发到 **完整地址**（含域名）。Worker 按 local part 匹配邮箱；收件域名须在后台 **已启用**，且该域名已在 Cloudflare 单独配置 **Email Routing → Worker**。 |
| **界面切域名** | 仅改变复制/展示的后缀（如 `oilg5toc0@rando.cc.cd` → `oilg5toc0@onlyme.qzz.io`）。若目标域名未配 Email Routing，发往新地址的验证码**不会到达**。 |
| **发信** | `from` 域名须与邮箱绑定的 `mail_domain` 一致，且该域名已在 Brevo 完成认证。出站**仅支持 Brevo**（`BREVO_API_KEY`）。 |

同一 local part 可在多个已配置入站的域名下收信（邮件进同一收件箱）。注册或收验证码时，请使用界面**当前显示**的完整地址，并确认该域名已在 Cloudflare 与后台均就绪。

---

## 依赖健康检查

公开端点 `GET /api/public/status`（无需认证）同时返回 **D1 / R2 / Brevo** 连通性与聚合 `status`（`ok` / `degraded` / `error`）。管理后台 **仪表盘** 顶部 **系统健康** 区块调用同一接口展示。

管理员可用于：

- 部署后确认 D1 与 R2 附件 bucket 可用（见 [deploy.md §9](./deploy.md#9-部署后验证)）
- 排查 Brevo 发信异常：已配置但 `checks.brevo.ok: false` 时整体为 `degraded`

响应字段与示例见 [api.md § 公开状态](./api.md#public-status)。

---

## Brevo 发信监控（仪表盘）

仪表盘 **Brevo / 发信** 区域包含：

1. **本地统计**（D1 `sent_emails`）：今日发信、今日失败、累计失败、用户日配额合计
2. **Brevo 账户**（需配置 `BREVO_API_KEY`）：调用 Brevo `GET /v3/account` 展示套餐类型与 credits；未配置或 API 失败时在页面提示原因

详细发信配置见 [brevo-setup.md](./brevo-setup.md)。

---

## 审计日志

**审计日志** 记录关键操作，便于安全与变更追溯：

| 动作示例 | 说明 |
|----------|------|
| `admin.login` | 管理员登录 |
| `user.create` / `user.update` / `user.delete` | 用户生命周期 |
| `user.rate_limit.update` | 速率方案变更 |
| `user.token.create` / `user.token.delete` | 用户 API Token |
| `rule.*` / `announcement.*` | 规则与公告 |
| `maintenance.update` | 维护模式保存 |

支持按 **起始/结束日期** 筛选与分页。字段：时间、操作者、动作、详情（JSON）、来源 IP。

---

## 相关文档

- [文档首页](./) — 文档分类导航
- [api.md](./api.md) — API 端点速查与速率限制
- [用户认证与 API Token](./user-auth.md)
- [MCP 集成](./mcp.md)
- [Brevo 发信配置](./brevo-setup.md)
- [部署指南](./deploy.md)
- [安全说明](./security.md)
