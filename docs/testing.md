# zMailR 生产环境 E2E 测试报告

> **文档导航** → [文档首页](./)

> 自托管实例的域名与文档链接以当前站点为准（见 [文档首页](./) 顶部的本实例地址）。

**测试站点**：https://zmailr.onlydev.ccwu.cc/  
**测试日期**：2026-06-28  
**测试方式**：Playwright 全页截图脚本（`scripts/capture-screenshots.mjs`）+ API 发信 OTP 回环  
**演示账号**：`guest` / `guest`

## 功能清单（Feature Checklist）

| 区域 | 功能点 | 说明 |
|------|--------|------|
| **Auth** | 产品介绍页 `/` | 未登录展示落地页；已登录重定向 `/dashboard/usage` |
| | 登录 / 登出 | Session Cookie，受保护路由 |
| | 用户注册 / 忘记密码 | `/register`、`/forgot-password`（可选 Turnstile） |
| | API Token | Dashboard → API 密钥，最多 3 个/用户，scope：`lease` / `mail` / `send` |
| | 无匿名 API | 未带 Bearer 时 `POST /api/lease`、`GET /api/mail` 等返回 401 |
| **Inbox** | 新建收件箱 | 24h 临时地址 |
| | 收信 + OTP 高亮 | OtpBox 提取与列表高亮 |
| | 附件列表/预览/下载 | Session 鉴权；需入站含附件邮件 |
| | 邮箱历史 / 分页 | 历史地址切换、批量删除 |
| **Outbox** | 撰写（纯文本 / 富文本） | 正文 Tab 切换；富文本编辑器 |
| | 出站附件 | 多文件上传（Brevo） |
| | 发信记录 / 详情 | 列表分页；点击查看详情弹窗 |
| | 失败重发 | 详情内「重新发送」（需失败记录触发） |
| **API** | `POST /api/lease` | 租用临时邮箱 |
| | `GET /api/mail` | 长轮询收信 / OTP |
| | `POST /api/send` | Brevo 出站（同域回环测试） |
| | `GET /api/user/quota` | 日发信配额与用量 |
| **Dashboard** | 用量统计 | 收件/发件/配额 StatCard |
| | 提取规则 | 系统内置 + 用户自定义 |
| | API 调试 | 浏览器内调用 Bearer API，查看 JSON 与限流头 |
| **Admin** | 系统健康 | D1 / R2 / Brevo 依赖探测（`GET /api/public/status`） |
| | 运营统计 / Brevo | 用户、邮箱、收发信汇总、有效用户 Token |
| | 请求监控 | 近 7 日趋势图、状态码分布、Top 路由、429 Top IP/用户 |
| | 用户 / 公告 / 规则 | CRUD 与启用状态 |
| | 邮箱域名 | 多域名启用、默认域名、Cloudflare / Brevo 确认 |
| | 系统设置 | 维护模式、Turnstile 开关与密钥 |
| | 审计日志 | 按日期筛选 |
| **Docs** | `/docs/` | VitePress 文档站 |
| | `/docs/testing` | 本测试报告 |
| | `/api-docs` | 交互式 API 文档（重定向自 `/docs/api-interactive`） |
| | `/openapi.json` | 机器可读 OpenAPI |
| **MCP** | `@zmailr/mcp` | npm 已发布；单元测试（工具注册、env 校验、mock API）；见 [mcp.md](./mcp.md) |
| **Ops** | `GET /api/health` | 静态 `{ status: "ok" }` |
| | `GET /api/public/status` | D1/R2/Brevo 依赖探测 + 维护模式 |
| | D1 备份 | [backup.md](./backup.md) — `scripts/backup-d1-to-r2.mjs` |

> **截图说明**：用户端、文档站与管理后台均来自当前演示站全页长截图（`fullPage: true`）。重新生成：`ADMIN_PATH` + `ADMIN_PASSWORD` 环境变量 + `node scripts/capture-screenshots.mjs`。

## 测试结果

| # | 测试项 | 结果 | 截图 |
|---|--------|------|------|
| 1 | 用户端 · 产品介绍页 `/` | Pass | ![落地页](./screenshots/landing.png) |
| 2 | 用户端 · 登录页 | Pass | ![登录页](./screenshots/login.png) |
| 3 | 用户端 · 注册页 | Pass | ![注册页](./screenshots/register.png) |
| 4 | 用户端 · 忘记密码页 | Pass | ![忘记密码](./screenshots/forgot-password.png) |
| 5 | 用户端 · guest 登录后仪表板 | Pass | ![仪表板](./screenshots/dashboard.png) |
| 6 | 用户端 · API Token 创建 | Pass | ![Token 创建](./screenshots/api-keys-create.png) |
| 7 | 用户端 · 新建收件箱 | Pass | ![新建收件箱](./screenshots/inbox-new-mailbox.png) |
| 8 | 用户端 · 收信 + OTP 高亮 | Pass | ![收信与 OTP 高亮](./screenshots/inbox-with-otp.png) |
| 9 | 用户端 · 邮箱历史列表 | Pass | ![收件箱历史列表](./screenshots/inbox.png) |
| 10 | 用户端 · 发件箱 UI 发信 | Pass | ![发件箱撰写](./screenshots/outbox-send.png)<br>![发信记录](./screenshots/outbox-sent.png) |
| 11 | 用户端 · 发件箱富文本 Tab | Pass | ![富文本撰写](./screenshots/outbox-rich-text.png) |
| 12 | 用户端 · 发信详情弹窗 | Pass | ![发信详情](./screenshots/outbox-sent-detail.png) |
| 13 | 用户端 · 自定义提取规则 | Pass | ![自定义提取规则](./screenshots/extract-rules-custom.png) |
| 14 | 用户端 · API 调试 GET /api/user/quota | Pass | ![API 调试响应](./screenshots/api-debug-response.png) |
| 15 | 公开 API · `GET /api/public/status` 依赖探测 | Pass | HTTP 200；`checks.d1` / `checks.r2.ok: true` |
| 16 | 用户端 · 收件箱附件列表与下载 | 待测 | 需 Email Routing 投递带附件邮件后复测 |
| 17 | 用户端 · 失败发信重发 | 待测 | 需 Brevo 失败记录触发 |
| 18 | 匿名 API · 无 Token 拒绝 | Pass | `POST /api/lease`、`GET /api/mail` → HTTP 401 |
| 19 | OpenAPI · `GET /openapi.json` | Pass | HTTP 200 |
| 20 | 文档 · `/docs/` 首页 | Pass | ![文档首页](./screenshots/docs-home.png) |
| 21 | 文档 · `/api-docs` | Pass | ![API 交互文档](./screenshots/api-interactive.png) |
| 22 | 管理后台 · 登录 | Pass | ![管理后台登录](./screenshots/admin-login.png) |
| 23 | 管理后台 · 仪表盘 | Pass | ![管理后台仪表盘](./screenshots/admin-dashboard.png) |
| 24 | 管理后台 · 创建公告 | Pass | ![创建公告表单](./screenshots/admin-announcement-create.png) |
| 25 | 管理后台 · 公告列表 | Pass | ![公告列表](./screenshots/admin-announcements-list.png) |
| 26 | 管理后台 · 用户管理 | Pass | ![用户](./screenshots/admin-users.png) |
| 27 | 管理后台 · 提取规则 | Pass | ![规则](./screenshots/admin-rules.png) |
| 28 | 管理后台 · 请求监控 | Pass | ![请求监控](./screenshots/admin-request-monitor.png) |
| 29 | 管理后台 · 邮箱域名 | Pass | ![域名管理](./screenshots/admin-domains.png) |
| 30 | 管理后台 · 系统设置 | Pass | ![系统设置](./screenshots/admin-settings.png) |
| 31 | 管理后台 · 审计日志 | Pass | ![审计](./screenshots/admin-audit.png) |
| 32 | Ops · `GET /api/health` | Pass | `{"status":"ok"}` |
| 33 | MCP · `@zmailr/mcp` | Pass | `pnpm --filter @zmailr/mcp test` — 11 工具注册、env 校验、mock fetch |
| 34 | Ops · D1 备份脚本 | 文档就绪 | 见 [backup.md](./backup.md) |

## API 脚本验证

```bash
python scripts/verify_api.py \
  --base-url https://zmailr.onlydev.ccwu.cc \
  --token "<guest Bearer Token>" \
  --send-test --test-code 847291
```

| 步骤 | 结果 | 说明 |
|------|------|------|
| `POST /api/lease` | Pass | 租约邮箱 |
| `POST /api/send` 同域回环 | Pass | 测试邮件含 OTP `847291` |
| `GET /api/mail` 长轮询 | Pass | 返回 `extractedCode` |
| Web 收件箱 OTP 列 | Pass | UI 高亮与 API 一致 |

## 截图清单（2026-06-28 全量更新）

```
docs/screenshots/landing.png
docs/screenshots/login-empty.png
docs/screenshots/login.png
docs/screenshots/register.png
docs/screenshots/forgot-password.png
docs/screenshots/dashboard.png
docs/screenshots/inbox-new-mailbox.png
docs/screenshots/inbox-with-otp.png
docs/screenshots/inbox.png
docs/screenshots/api-keys-create.png
docs/screenshots/outbox-send.png
docs/screenshots/outbox-rich-text.png
docs/screenshots/outbox-sent.png
docs/screenshots/outbox-sent-detail.png
docs/screenshots/api-debug-response.png
docs/screenshots/extract-rules-custom.png
docs/screenshots/docs-home.png
docs/screenshots/api-interactive.png
docs/screenshots/admin-login-empty.png
docs/screenshots/admin-login.png
docs/screenshots/admin-dashboard.png
docs/screenshots/admin-announcement-create.png
docs/screenshots/admin-announcements-list.png
docs/screenshots/admin-users.png
docs/screenshots/admin-rules.png
docs/screenshots/admin-request-monitor.png
docs/screenshots/admin-domains.png
docs/screenshots/admin-settings.png
docs/screenshots/admin-audit.png
```

## 相关文档

- [文档首页](./)
- [API 快速参考](./api.md)
- [部署指南](./deploy.md)
- [用户认证与 API Token](./user-auth.md)
- [MCP 集成](./mcp.md)
- [D1 备份](./backup.md)
- [项目 README](https://github.com/jia0327/zmailr/blob/main/README.md)
