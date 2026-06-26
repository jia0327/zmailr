# zMailR 文档

开源、可自托管的 24 小时临时邮箱与 OTP 自动化平台。Web 控制台 + Bearer API + MCP，部署在 Cloudflare Workers。

**在线演示**：[zmailr.itool.eu.cc](https://zmailr.itool.eu.cc/) · 账号 `guest` / `guest`

---

## 快速开始

1. **体验演示站** — 登录 [演示站](https://zmailr.itool.eu.cc/login)，在 **API 密钥** 创建 Bearer Token（明文仅显示一次）。
2. **自托管部署** — Fork 仓库，配置 GitHub Secrets 与 D1，推送 `main` 自动部署。详见 [部署指南](./deploy.md)。
3. **配置收信** — Cloudflare Email Routing Catch-all → Worker。见 [部署指南 §4](./deploy.md#4-入站邮件email-routing)。
4. **（可选）配置发信** — Brevo Transactional API + DNS。见 [Brevo 集成](./brevo-setup.md)。
5. **验证 API** — 运行 `python scripts/verify_api.py --base-url https://你的域名 --token <token>`。
6. **（可选）MCP** — 在 Cursor 配置 `@zmailr/mcp`。见 [MCP 集成](./mcp.md)。

---

## API 参考

| 文档 | 说明 |
|------|------|
| [**API 快速参考**](./api.md) | 端点一览、认证、速率限制、curl 示例 |
| [用户认证与 API Token](./user-auth.md) | Session / Bearer、Token scope、配额、提取规则、OpenAPI |
| 在线文档 | 部署实例 [`/api-docs`](https://zmailr.itool.eu.cc/api-docs) · [`/openapi.json`](https://zmailr.itool.eu.cc/openapi.json) |

**要点**：所有程序化 API 均需 `Authorization: Bearer <token>`，**不支持匿名调用**。Token 在 Dashboard → **API 密钥** 创建，可选 `lease` / `mail` / `send` scope。

---

## MCP 集成

| 文档 | 说明 |
|------|------|
| [MCP 集成指南](./mcp.md) | `@zmailr/mcp` 工具列表、环境变量、Cursor 配置 |
| [packages/mcp/README.md](../packages/mcp/README.md) | npm 包 README（英文） |

---

## 部署与运维

| 文档 | 说明 |
|------|------|
| [部署指南](./deploy.md) | D1、GitHub Secrets、Email Routing、R2 附件、本地开发 |
| [管理后台指南](./admin-guide.md) | `ADMIN_PATH`、用户、速率方案、维护模式、审计日志 |

---

## 集成

| 文档 | 说明 |
|------|------|
| [Brevo 发信配置](./brevo-setup.md) | 出站发信、SPF/DKIM/DMARC、API Key、GitHub Secret |

---

## 测试

| 文档 | 说明 |
|------|------|
| [生产 E2E 测试报告](./testing.md) | 演示站 Pass/Fail 与截图索引 |

---

## 对比与其他

| 文档 | 说明 |
|------|------|
| [与 MailSink 功能对照](./mailsink-comparison.md) | 端点映射、架构、差异化能力 |
| [项目 README](../README.md) | 功能概览、效果图、使用指南 |
| [English README](../README.en.md) | English project overview |

---

## 文档结构

```
docs/
├── README.md                 ← 本页（文档导航）
├── api.md                    API 快速参考
├── deploy.md                 部署指南
├── user-auth.md              用户认证与 API Token
├── mcp.md                    MCP 集成
├── admin-guide.md            管理后台
├── brevo-setup.md            Brevo 出站发信
├── testing.md                E2E 测试报告
└── mailsink-comparison.md    与 MailSink 对照
```
