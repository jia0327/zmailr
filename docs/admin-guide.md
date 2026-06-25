# 管理后台指南

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
| **仪表盘** | 今日收信/发信、活跃用户、有效用户 Token、本地发信统计；Brevo 套餐信息（已配置 `BREVO_API_KEY` 时） |
| **用户** | 创建/编辑/禁用/删除用户，日发信配额，**速率方案**（Free / Pro / Team / 自定义） |
| **公告** | 面向 Dashboard 用户的系统公告（Markdown/纯文本） |
| **提取规则** | 全局规则 + 汇总所有用户自定义规则 |
| **限流监控** | 今日 429 总数、Top IP / Top 用户 |
| **系统设置** | **维护模式**（可选阻断 lease / 发信 / 创建邮箱） |
| **审计日志** | 管理员与用户关键操作记录，按日期筛选 |

Legacy **无配额 API Token** 仍可通过管理 API（`GET/POST/DELETE /{ADMIN_PATH}/api/tokens`）管理，供向后兼容；新用户请使用 Dashboard → API 密钥。

---

## 用户与速率限制

每位用户除 **日发信配额**（`daily_send_quota`，`-1` 为无限）外，还有 **API 速率限制**（按用户 ID 分桶，滑动窗口 1 分钟）：

| 方案 |  sustained (req/min) | 突发 (burst) | 说明 |
|------|---------------------|--------------|------|
| **Free** | 60 | — | 默认 |
| **Pro** | 600 | 30 | 短时允许额外 30 次 |
| **Team** | 3000 | 200 | 高并发脚本 |
| **自定义** | 手动填写 | 可选 | 覆盖上述预设 |

- 响应头：`X-RateLimit-Limit`（ sustained 速率）、`X-RateLimit-Remaining`、`X-RateLimit-Reset`、`Retry-After`
- 未识别为登录用户/用户 Token 的请求（如 legacy Token）走 **全局 IP 限流**（默认 60 req/min）
- 在用户弹窗中选择方案会自动填充数值；保存后写入 D1 `users.rate_limit_per_min` / `rate_limit_burst`

---

## 限流监控

**限流监控** 标签展示：

- 今日触发 **429** 的总次数
- 今日 Top 10 IP（按 429 次数）
- 今日 Top 10 用户（按 429 次数）

数据来自 D1 表 `rate_limit_hits`，每次 API 返回 429 时写入；**保留约 7 天**后自动清理。

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

- [用户认证与 API Token](./user-auth.md)
- [Brevo 发信配置](./brevo-setup.md)
- [README 快速部署](../README.md)
