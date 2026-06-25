# zMailR 生产环境 E2E 测试报告

**测试站点**：https://zmailr.itool.eu.cc/  
**测试日期**：2026-06-26  
**测试方式**：YSbrowser MCP 浏览器自动化 + `scripts/verify_api.py`

## 测试结果

| 测试项 | 结果 | 截图 |
|--------|------|------|
| 管理后台 · 创建并启用公告 | Pass | [admin-announcement-create.png](./screenshots/admin-announcement-create.png), [admin-announcements-list.png](./screenshots/admin-announcements-list.png) |
| 用户端 · guest 登录后公告弹窗 | Pass | [announcement-modal.png](./screenshots/announcement-modal.png) |
| 用户端 · 标记公告已读 | Pass | （弹窗关闭，无单独截图） |
| 用户端 · API Token 重新创建 | Pass | [api-keys-create.png](./screenshots/api-keys-create.png) |
| 用户端 · 新建收件箱 | Pass | [inbox-new-mailbox.png](./screenshots/inbox-new-mailbox.png) |
| 用户端 · 收信 + OTP 提取 | Pass | [inbox-received.png](./screenshots/inbox-received.png) |
| 用户端 · 发件箱 UI 发信 | Pass | [outbox-send.png](./screenshots/outbox-send.png), [outbox-sent-list.png](./screenshots/outbox-sent-list.png) |
| 用户端 · 自定义提取规则 | Pass | [extract-rules-custom.png](./screenshots/extract-rules-custom.png) |
| 用户端 · API 调试 GET /api/user/quota | Pass | [api-debug-result.png](./screenshots/api-debug-result.png) |
| 用户端 · 仪表板统计 | Pass | [dashboard.png](./screenshots/dashboard.png) |
| 管理后台 · 仪表盘 | Pass | [admin-dashboard.png](./screenshots/admin-dashboard.png) |

## 收信 / 发信说明

| 路径 | 结果 | 说明 |
|------|------|------|
| `POST /api/send` → 同域临时邮箱 | Pass | HTTP 200，`sentEmailId` 返回；约 1 分钟后 Web 收件箱可见，OTP `847291` 高亮 |
| Web 收件箱实时刷新 | Pass | 邮件列表、OTP 列正常 |
| `GET /api/mail` 长轮询（发送后立即 poll） | Fail | 45s 超时；Brevo 回环入站存在延迟，建议在 UI 确认收信后再 poll，或增加等待 |
| 发件箱 UI → 外部地址 | Pass | `e2e-outbox-test@example.com` 状态 `sent`，配额计数递增 |

**结论**：Brevo 出站发信正常；同域邮箱入站依赖 Email Routing 回环，**UI 收信与 OTP 提取可用**，程序化长轮询需预留投递延迟。

## 截图清单

```
docs/screenshots/admin-announcement-create.png
docs/screenshots/admin-announcements-list.png
docs/screenshots/admin-dashboard.png
docs/screenshots/admin-login.png
docs/screenshots/announcement-modal.png
docs/screenshots/api-debug-result.png
docs/screenshots/api-keys-create.png
docs/screenshots/dashboard.png
docs/screenshots/extract-rules-custom.png
docs/screenshots/inbox-new-mailbox.png
docs/screenshots/inbox-received.png
docs/screenshots/login.png
docs/screenshots/outbox-send.png
docs/screenshots/outbox-sent-list.png
```

（另有历史截图：`admin-users.png`、`admin-rules.png`、`admin-ratelimit.png`、`admin-settings.png`、`admin-audit.png` 等，见 [README](../README.md) 管理后台章节。）
