# MCP 集成指南

> **文档导航** → [文档首页](./) · **API 参考** → [API 速通](./api.md)

[zMailR](https://github.com/jia0327/zmailr) 提供 npm 包 **`@zmailr/mcp`**，作为 [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) 服务器，供 Cursor、Claude Desktop 等 AI 助手调用临时邮箱与 OTP 自动化能力。
源码与英文 README 见 [packages/mcp README](https://github.com/jia0327/zmailr/blob/main/packages/mcp/README.md)。

> **npm**：[`@zmailr/mcp`](https://www.npmjs.com/package/@zmailr/mcp) 已发布（当前 `1.0.0`）。推荐在 Cursor / Claude Desktop 中使用 `npx @zmailr/mcp`；克隆本仓库开发时见下方「[本地 monorepo 开发](#本地-monorepo-开发)」或 [mcp.json.example](./mcp.json.example)。

---

## 工具列表

> 每个工具的参数、REST 等价 curl、返回字段见 [API 参考 · MCP 工具](./api.md#mcp-工具参考zmailrmcp)。

| MCP 工具 | 对应 API | 说明 |
|----------|----------|------|
| `lease_mailbox` | `POST /api/lease` | 创建随机 24 小时临时邮箱 |
| `wait_for_mail` | `GET /api/mail` | 长轮询等待收信 / OTP |
| `get_latest_code` | `GET /api/mailboxes/:address/latest-code` | 即时查询最新验证码 |
| `get_latest_link` | `GET /api/mailboxes/:address/latest-link` | 即时查询最新验证链接 |
| `list_mailboxes` | `GET /api/mailboxes` | 列出当前用户的邮箱 |
| `list_emails` | `GET /api/mailboxes/:address/emails` | 列出邮箱内邮件 |
| `delete_mailbox` | `DELETE /api/mailboxes/:address` | 删除邮箱及其中邮件 |
| `get_email` | `GET /api/emails/:id` | 单封邮件详情 |
| `delete_email` | `DELETE /api/emails/:id` | 删除单封邮件 |
| `send_email` | `POST /api/send` | Brevo 出站发信 |
| `get_quota` | `GET /api/user/quota` | 查询日发信配额与用量 |

---

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `ZMAILR_BASE_URL` | 是 | 部署实例根 URL（无尾部 `/`） |
| `ZMAILR_TOKEN` | 是 | Dashboard → **API 密钥** 创建的 Bearer Token |

本实例的 `ZMAILR_BASE_URL` 为 <SiteOrigin />（使用 `guest` / `guest` 登录后，在 Dashboard 创建 API Token）。

---

## Token Scope 对应关系

| MCP 工具 | 所需 scope |
|----------|------------|
| `lease_mailbox` | `lease` |
| `wait_for_mail`、`get_latest_code`、`get_latest_link`、`list_mailboxes`、`list_emails`、`delete_mailbox`、`get_email`、`delete_email` | `mail` |
| `send_email` | `send` |
| `get_quota` | 任意用户 Token scope 均可 |

所有 API 均需认证，**不支持匿名调用**。详见 [用户认证与 Token](./user-auth.md)。

---

## Cursor 配置

在 `.cursor/mcp.json` 或 **Cursor Settings → MCP** 中添加。可复制 [mcp.json.example](./mcp.json.example) 到仓库根目录 `.cursor/mcp.json` 并填入 Token（该文件已 gitignore，勿提交）。

`ZMAILR_BASE_URL` 填当前实例根 URL（本实例为 <SiteOrigin />）：

```json
{
  "mcpServers": {
    "zmailr": {
      "command": "npx",
      "args": ["-y", "@zmailr/mcp"],
      "env": {
        "ZMAILR_BASE_URL": "https://your-domain.example.com",
        "ZMAILR_TOKEN": "your-bearer-token"
      }
    }
  }
}
```

将 `ZMAILR_BASE_URL` 替换为 <SiteOrigin />（本地 Worker 开发可用 `http://localhost:8787`）。

### 本地 monorepo 开发

克隆仓库后，先构建：`pnpm --filter @zmailr/mcp run build`

```json
{
  "mcpServers": {
    "zmailr": {
      "command": "node",
      "args": ["packages/mcp/dist/index.js"],
      "env": {
        "ZMAILR_BASE_URL": "https://your-domain.example.com",
        "ZMAILR_TOKEN": "your-token"
      }
    }
  }
}
```

本地 Worker 开发时可将 `ZMAILR_BASE_URL` 设为 `http://localhost:8787`。

---

## Claude Desktop 配置

Claude Desktop 使用与 Cursor 相同的 `mcpServers` 结构。编辑配置文件：

| 平台 | 路径 |
|------|------|
| **Windows** | `%APPDATA%\Claude\claude_desktop_config.json` |
| **macOS** | `~/Library/Application Support/Claude/claude_desktop_config.json` |

示例：

```json
{
  "mcpServers": {
    "zmailr": {
      "command": "npx",
      "args": ["-y", "@zmailr/mcp"],
      "env": {
        "ZMAILR_BASE_URL": "https://your-domain.example.com",
        "ZMAILR_TOKEN": "your-bearer-token"
      }
    }
  }
}
```

本地 monorepo 开发时将 `command` 改为 `node`，`args` 改为 monorepo 内 `packages/mcp/dist/index.js` 的绝对路径。修改后需重启 Claude Desktop。

---

## 安装方式

推荐通过 npx 由 MCP 宿主启动（stdio）；也可全局安装：

```bash
npx -y @zmailr/mcp
# 或由 MCP 配置中的 command/args 自动启动
# npm install -g @zmailr/mcp
```

---

## 典型自动化流程

1. 在 Dashboard 创建含 `lease`、`mail` scope 的 Bearer Token。
2. 配置 MCP 环境变量后，在 AI 助手中调用 `lease_mailbox` 获取临时地址。
3. 在目标站点使用该地址注册或验证。
4. 调用 `wait_for_mail`、`get_latest_code` 或 `get_latest_link` 获取 OTP 或验证链接。

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
