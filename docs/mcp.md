# MCP 集成指南

> **文档导航** → [README.md](./README.md) · **API 参考** → [api.md](./api.md)

[zMailR](https://github.com/jia0327/zmailr) 提供 npm 包 **`@zmailr/mcp`**，作为 [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) 服务器，供 Cursor、Claude Desktop 等 AI 助手调用临时邮箱与 OTP 自动化能力。
源码与英文 README 见 [`packages/mcp`](../packages/mcp/README.md)。

---

## 工具列表

| MCP 工具 | 对应 API | 说明 |
|----------|----------|------|
| `lease_mailbox` | `POST /api/lease` | 创建随机 24 小时临时邮箱 |
| `wait_for_mail` | `GET /api/mail` | 长轮询等待收信 / OTP |
| `get_latest_code` | `GET /api/mailboxes/:address/latest-code` | 即时查询最新验证码 |
| `send_email` | `POST /api/send` | Brevo 出站发信 |
| `get_quota` | `GET /api/user/quota` | 查询日发信配额与用量 |

---

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `ZMAILR_BASE_URL` | 是 | 部署实例根 URL（如 `https://zmailr.example.com`，无尾部 `/`） |
| `ZMAILR_TOKEN` | 是 | Dashboard → **API 密钥** 创建的 Bearer Token |

---

## Token Scope 对应关系

| MCP 工具 | 所需 scope |
|----------|------------|
| `lease_mailbox` | `lease` |
| `wait_for_mail`、`get_latest_code` | `mail` |
| `send_email` | `send` |
| `get_quota` | 任意用户 Token scope 均可 |

所有 API 均需认证，**不支持匿名调用**。详见 [user-auth.md](./user-auth.md)。

---

## Cursor 配置

在 `.cursor/mcp.json` 或 **Cursor Settings → MCP** 中添加：

```json
{
  "mcpServers": {
    "zmailr": {
      "command": "npx",
      "args": ["-y", "@zmailr/mcp"],
      "env": {
        "ZMAILR_BASE_URL": "https://your-zmailr-domain.com",
        "ZMAILR_TOKEN": "your-bearer-token"
      }
    }
  }
}
```

### 本地 monorepo 开发

先构建：`pnpm --filter @zmailr/mcp run build`

```json
{
  "mcpServers": {
    "zmailr": {
      "command": "node",
      "args": ["packages/mcp/dist/index.js"],
      "env": {
        "ZMAILR_BASE_URL": "http://localhost:8787",
        "ZMAILR_TOKEN": "your-token"
      }
    }
  }
}
```

---

## 安装方式

```bash
npm install -g @zmailr/mcp
# 或由 MCP 宿主通过 npx @zmailr/mcp 启动（stdio 模式）
```

---

## 典型自动化流程

1. 在 Dashboard 创建含 `lease`、`mail` scope 的 Bearer Token。
2. 配置 MCP 环境变量后，在 AI 助手中调用 `lease_mailbox` 获取临时地址。
3. 在目标站点使用该地址注册或验证。
4. 调用 `wait_for_mail` 或 `get_latest_code` 获取 OTP。

与 MailSink MCP 的对照见 [mailsink-comparison.md](./mailsink-comparison.md)。

---

## 相关文档

| 文档 | 说明 |
|------|------|
| [README.md](./README.md) | 文档分类导航 |
| [api.md](./api.md) | API 端点速查 |
| [user-auth.md](./user-auth.md) | 用户认证、Token scope、速率限制 |
| [deploy.md](./deploy.md) | 自托管部署 |
| [mailsink-comparison.md](./mailsink-comparison.md) | 与 MailSink MCP 对照 |
| [../README.md](../README.md) | 项目简介 |
| [../packages/mcp/README.md](../packages/mcp/README.md) | 包 README（英文） |