# 📨 zMailR

**zMailR** 是基于 Cloudflare Workers + D1 + Email Routing 的**自托管临时邮箱与 OTP 自动化平台**，专为 **CI/E2E、AI Agent (MCP) 与小圈子私用** 设计。

> 受 [mailsink](https://mailsink.dev) 启发，专注**自托管与自定义域名**——解决 GitHub、银行、AI 平台对共享临时域名的拦截。  
> **Receive-Only Mode**：只收验证码？**跳过 Brevo** 即可部署，收信 / OTP / MCP 均不受影响。

<p align="center">
  <a href="https://zmailr.onlydev.ccwu.cc/" target="_blank"><strong>🚀 在线体验</strong></a> ·
  <a href="./docs/screenshots/README.md"><strong>📸 效果图</strong></a> ·
  <a href="./README.en.md">English</a>
  <br>
  <a href="https://github.com/cf-fork-div/zmailr/stargazers"><img src="https://img.shields.io/github/stars/cf-fork-div/zmailr?style=social"></a>
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg">
  <img src="https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white">
</p>

---

## 🧪 在线体验

👉 **[https://zmailr.onlydev.ccwu.cc](https://zmailr.onlydev.ccwu.cc)** · 演示账号 `guest` / `guest`

- 演示站使用共享域名，**适合体验 UI 与 Admin 逻辑**
- 主流平台会拦截共享域验证码，**实际收码请自部署并使用自有域名**
- 演示数据定期清理，请勿用于生产

---

## 解决什么痛点

| 痛点 | zMailR 怎么做 |
| :--- | :--- |
| 公共临时域被拦 | **自有域名**收信，通过率更高 |
| CI/Agent 无法自动收码 | Bearer API + **11 个 MCP 工具** |
| 有信无码 | 内置规则 + **按发件人域名自定义正则** |
| SaaS 数据不可控 | 自托管 Cloudflare，密钥与数据自控 |
| 想分享给朋友 | Admin：多用户、配额、审计 |
| 发信配置门槛高 | 纯收验证码**无需 Brevo** |

---

## ✨ 核心特性

**自动化** — REST API + [`@zmailr/mcp`](https://www.npmjs.com/package/@zmailr/mcp)，Bearer Token（`lease` / `mail` / `send` scope）；长轮询收码、即时查 OTP

**OTP 提取** — 收信自动提取验证码；按域名配置正则，优先级：用户规则 → Admin 全局 → 内置兜底

**收信** — Email Routing Catch-all 入站；24h 邮箱生命周期；D1 存邮件，R2 存附件

**小圈子 Admin** — `ADMIN_PATH` 隐藏入口；Free/Pro/Team 速率方案；维护模式、审计日志、系统公告

**发信（可选）** — Brevo 出站；纯收信场景可完全不配

---

## 🆚 对比差异

| | **zMailR** | **[zmail](https://github.com/zaunist/zmail)** | **[mailsink](https://mailsink.dev)** | **传统临时邮箱** |
| :--- | :---: | :---: | :---: | :---: |
| 定位 | 自托管 + 自动化 + 小圈子 | 极简自托管收信 | SaaS Agent 收码 | 公共一次性浏览 |
| 自定义域名 | ✅ | ✅ | ❌ 共享域 | ❌ 黑名单域 |
| REST API | ✅ Bearer + scope | ❌ | ✅ | ❌ |
| MCP | ✅ 11 工具 | ❌ | ✅ | ❌ |
| OTP | ✅ 按域名自定义 | ❌ | ✅ 预设 | ❌ 手动 |
| 多用户 / 配额 | ✅ Admin + 审计 | ❌ | ❌ 单人 | ❌ |
| 发信 | 🟡 可选 Brevo | ❌ | ❌ | ❌ |

- **zMailR** — 自定义域名 + CI/Agent + 分享给朋友
- **zmail** — 最简自托管收信，无需 API/MCP/Admin
- **mailsink** — 零部署 Solo Agent
- **传统临时邮箱** — 手动复制验证码

---

## 📸 效果图

| 产品介绍 | 收件箱 OTP | 管理后台 |
| :---: | :---: | :---: |
| [![产品介绍](./docs/screenshots/landing.png)](./docs/screenshots/README.md) | [![OTP 高亮](./docs/screenshots/inbox-with-otp.png)](./docs/screenshots/README.md) | [![Admin 仪表盘](./docs/screenshots/admin-dashboard.png)](./docs/screenshots/README.md) |

👉 **[查看完整效果图（30+ 张）](./docs/screenshots/README.md)** — 含登录、发件箱、API 密钥、提取规则、Admin 全模块

---

## 🚀 快速开始

**仅接收验证码（推荐）** — 无需 Brevo，约 30～45 分钟：

1. Fork [cf-fork-div/zmailr](https://github.com/cf-fork-div/zmailr)，创建 D1 数据库
2. 配置 GitHub Secrets：`CF_*`、`D1_*`、`VITE_EMAIL_DOMAIN`、`ADMIN_PASSWORD`、`SESSION_SECRET`、`ADMIN_PATH`（**`BREVO_API_KEY` 可跳过**）
3. 推送 `main` → Actions 自动部署 Worker（**含前端 SPA，无需单独 Pages**）
4. Email Routing：**Catch-all** → Worker `zmailr`（每个收信域名单独配置）
5. 绑定自定义域名 → 登录 → 创建 API 密钥 → `POST /api/lease` / `GET /api/mail`

需出站发信可配置 Brevo（`BREVO_API_KEY`），详见仓库 `docs/` 目录。

---

## 🤖 MCP

```json
{
  "mcpServers": {
    "zmailr": {
      "command": "npx",
      "args": ["-y", "@zmailr/mcp"],
      "env": {
        "ZMAILR_BASE_URL": "https://mail.example.com",
        "ZMAILR_TOKEN": "zmr_xxx"
      }
    }
  }
}
```

常用工具：`lease_mailbox` · `wait_for_mail` · `get_latest_code` · `list_emails`

新站点须先在 Dashboard 配好提取规则（MCP 无写规则工具）。

---

## ❤️ 致谢 & License

基于 [zaunist/zmail](https://github.com/zaunist/zmail) · MCP 设计受 [mailsink](https://mailsink.dev) 启发 · [MIT](./LICENSE)
