# MCP 集成指南

> **文档导航** → [文档首页](./) · **API 参考** → [API 速通](./api.md)

[zMailR](https://github.com/jia0327/zmailr) 提供 npm 包 **`@zmailr/mcp`**，作为 [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) 服务器，供 Cursor、Claude Desktop 等 AI 助手调用临时邮箱与 OTP 自动化能力。
源码与英文 README 见 [packages/mcp README](https://github.com/jia0327/zmailr/blob/main/packages/mcp/README.md)。

> **npm 发布状态**：截至 2026-06，`@zmailr/mcp` **尚未发布**到 [npm registry](https://www.npmjs.com/package/@zmailr/mcp)。发布前请使用下方「[本地 monorepo 开发](#本地-monorepo-开发)」配置；`npx @zmailr/mcp` 与 `npm install -g @zmailr/mcp` 暂不可用。

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

[演示站](https://zmailr.itool.eu.cc/) 的 `ZMAILR_BASE_URL` 为 `https://zmailr.itool.eu.cc`（账号 `guest` / `guest`，需在 Dashboard 创建 API Token）。

---

## Token Scope 对应关系

| MCP 工具 | 所需 scope |
|----------|------------|
| `lease_mailbox` | `lease` |
| `wait_for_mail`、`get_latest_code` | `mail` |
| `send_email` | `send` |
| `get_quota` | 任意用户 Token scope 均可 |

所有 API 均需认证，**不支持匿名调用**。详见 [用户认证与 Token](./user-auth.md)。

---

## Cursor 配置

在 `.cursor/mcp.json` 或 **Cursor Settings → MCP** 中添加。`ZMAILR_BASE_URL` 填你的实例地址；使用 [演示站](https://zmailr.itool.eu.cc/) 时可填 `https://zmailr.itool.eu.cc`：

```json
{
  "mcpServers": {
    "zmailr": {
      "command": "npx",
      "args": ["-y", "@zmailr/mcp"],
      "env": {
        "ZMAILR_BASE_URL": "https://zmailr.itool.eu.cc",
        "ZMAILR_TOKEN": "your-bearer-token"
      }
    }
  }
}
```

> 上例 `command`/`args` 在 npm 包发布后生效；发布前请改用下方「本地 monorepo 开发」配置。

### 本地 monorepo 开发

克隆仓库后，先构建：`pnpm --filter @zmailr/mcp run build`

```json
{
  "mcpServers": {
    "zmailr": {
      "command": "node",
      "args": ["packages/mcp/dist/index.js"],
      "env": {
        "ZMAILR_BASE_URL": "https://zmailr.itool.eu.cc",
        "ZMAILR_TOKEN": "your-token"
      }
    }
  }
}
```

本地 Worker 开发时可将 `ZMAILR_BASE_URL` 设为 `http://localhost:8787`。

---

## 安装方式

npm 包发布后可用：

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

---

## 相关文档

| 文档 | 说明 |
|------|------|
| [文档首页](./) | 文档分类导航 |
| [API 速通](./api.md) | API 端点速查 |
| [用户认证与 Token](./user-auth.md) | 用户认证、Token scope、速率限制 |
| [自托管部署](./deploy.md) | 自托管部署 |
| [项目 README](https://github.com/jia0327/zmailr/blob/main/README.md) | 项目简介 |
| [packages/mcp README](https://github.com/jia0327/zmailr/blob/main/packages/mcp/README.md) | 包 README（英文） |
