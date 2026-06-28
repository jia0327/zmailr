# 文档首页

<div class="zmailr-hero">

**zMailR 文档中心** — 临时邮箱与 OTP 自动化，面向测试脚本、CI 与 AI Agent。

**本实例** <SiteOrigin /> · 演示 <SiteLink to="/login">guest / guest</SiteLink>

</div>

## 快速入门

按顺序阅读，约 **15 分钟** 完成首次接入：

| 序号 | 教程 | 说明 |
|:----:|------|------|
| 1 | [产品概述](./overview.md) | zMailR 是什么、REST / MCP 怎么选 |
| 2 | [5 分钟体验](./quickstart-5min.md) | 控制台登录 → Token → 收 OTP（**含截图**） |
| 3 | [创建 API 密钥](./create-api-key.md) | Dashboard 创建 Bearer Token（**含截图**） |
| 4 | [第一个脚本](./first-script.md) | curl / Python 租邮箱等 OTP |
| 5 | [验证码完整流程](./otp-workflow.md) | 六步：租邮箱 → 收 OTP → 规则 → 自动化 |
| 6 | [自定义提取规则](./extract-rules.md) | 收到信但无 OTP 时配置正则 |

---

## 文档目录

### 快速入门

| 文档 | 用途 |
|------|------|
| [产品概述](./overview.md) | 概念、工作流、接入方式 |
| [5 分钟体验](./quickstart-5min.md) | 控制台图文教程 |
| [创建 API 密钥](./create-api-key.md) | Token 与 Scope |
| [第一个脚本](./first-script.md) | 最小可运行脚本 |
| [验证码完整流程](./otp-workflow.md) | 含「有信无码」排查与自动化 |
| [自定义提取规则](./extract-rules.md) | 按发件人域名配置 OTP 正则 |

### API 文档

| 文档 | 用途 |
|------|------|
| [API 概览](./api-overview.md) | 端点地图、选型 |
| [认证说明](./user-auth.md) | Bearer、Scope、Session |
| [脚本接入](./scripting.md) | Python / Node / curl 模板 |
| [API 参考](./api.md) | 逐端点参数与 curl |
| [错误码与限流](./errors.md) | 统一错误、速率限制 |

### MCP 文档

| 文档 | 用途 |
|------|------|
| [MCP 快速接入](./mcp.md) | Cursor / Claude 配置 |
| [MCP 工具参考](./mcp-tools.md) | 11 个工具参数 |

### 自托管部署

| 文档 | 用途 |
|------|------|
| [部署指南](./deploy.md) | Cloudflare Workers 完整部署流程 |
| [Brevo 发信配置](./brevo-setup.md) | 出站发信 DNS 与 API Key |
| [安全说明](./security.md) | 生产环境安全与检查清单 |
| [管理后台](./admin-guide.md) | 运维与用户管理 |

### 参考

| 资源 | 链接 |
|------|------|
| OpenAPI | <SiteLink to="/openapi.json">/openapi.json</SiteLink> |
| 控制台 | <SiteLink to="/dashboard/usage">Dashboard</SiteLink> |
| 截图清单 | [docs/testing.md](https://github.com/jia0327/zmailr/blob/main/docs/testing.md)（仓库内 E2E 报告，含全页 UI 截图） |

---

## 我该从哪开始？

| 你是… | 推荐路径 |
|-------|----------|
| 第一次接触 | [产品概述](./overview.md) → [5 分钟体验](./quickstart-5min.md) |
| 写 Python/CI | [创建 API 密钥](./create-api-key.md) → [验证码完整流程](./otp-workflow.md) |
| 收信但无 OTP | [验证码完整流程 · 步骤 3–5](./otp-workflow.md#步骤-3收到邮件但未获取到验证码) → [自定义提取规则](./extract-rules.md) |
| Cursor 用户 | [创建 API 密钥](./create-api-key.md) → [MCP 快速接入](./mcp.md) |
| 查某个接口 | [API 参考](./api.md) |
| **自托管部署** | [部署指南](./deploy.md) → [Brevo 发信](./brevo-setup.md) → [安全说明](./security.md) |

---

## 自托管部署

将 zMailR 部署到你自己的 Cloudflare 账户（Workers + D1 + R2）：

| 文档 | 用途 |
|------|------|
| [部署指南](./deploy.md) | Fork、GitHub Secrets、CI 部署、Email Routing、验证清单 |
| [Brevo 发信配置](./brevo-setup.md) | 出站 `/api/send` 的 DNS 与 API Key |
| [安全说明](./security.md) | 鉴权模型、限流、生产检查清单 |
| [管理后台](./admin-guide.md) | 用户/域名/维护模式/审计日志 |

预计首次部署 **30～60 分钟**（含 DNS 生效等待）。

---

## 下一步

尚未体验控制台？从 **[5 分钟体验](./quickstart-5min.md)** 开始。
