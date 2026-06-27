# MCP 详解

> [快速开始](./) · [API 详解](./api.md)

**`@zmailr/mcp`** 把 REST API 封装成 MCP 工具，供 **Cursor、Claude Desktop** 等 Agent 直接调用——无需在对话里手写 curl。

---

## 5 分钟接入

### 1. 创建 Token

<SiteLink to="/login">登录</SiteLink> → <SiteLink to="/dashboard/api-keys">API 密钥</SiteLink> → 新建 Token，Scope 勾选 **`lease`** + **`mail`**（收 OTP），发信再加 **`send`**。

### 2. 配置 MCP

**Cursor**：`.cursor/mcp.json` 或 Settings → MCP

**Claude Desktop**：`%APPDATA%\Claude\claude_desktop_config.json`（Windows）

```json
{
  "mcpServers": {
    "zmailr": {
      "command": "npx",
      "args": ["-y", "@zmailr/mcp"],
      "env": {
        "ZMAILR_BASE_URL": "https://your-domain",
        "ZMAILR_TOKEN": "your-bearer-token"
      }
    }
  }
}
```

| 变量 | 值 |
|------|-----|
| `ZMAILR_BASE_URL` | <SiteOrigin />（无尾部 `/`） |
| `ZMAILR_TOKEN` | 上一步复制的 Bearer Token |

保存后 **重启 Cursor / Claude Desktop**。

### 3. 验证

在对话中输入：

> 用 zmailr 调用 `lease_mailbox` 租一个临时邮箱，把完整地址发给我。

若返回 JSON 含 `email` 字段，说明 MCP 已连通。

---

## MCP 还是 REST？

| 方式 | 适合 | 说明 |
|------|------|------|
| **MCP** | Cursor / Claude、自然语言驱动 | Agent 选工具；底层仍调 REST |
| **REST / 脚本** | CI、Python/Node、精确控制 | 见 [快速开始 · 脚本示例](./#5-分钟上手) 与 [API 详解 · 脚本接入](./api.md#脚本接入模板) |

两者共用同一 Token 与 Base URL，**无额外 MCP 端点**。

---

## 典型 Agent 工作流

1. **`lease_mailbox`** — 获取 `email`（24h 有效）
2. 用户在目标网站使用该邮箱注册（或 Agent 通过浏览器工具填写）
3. **`wait_for_mail`**（阻塞等 OTP）或 **`get_latest_code`**（即时查询）
4. 可选：**`get_latest_link`** 取验证链接；**`send_email`** 测出站发信

对话示例：

- 「租临时邮箱并完成某站注册，把 OTP 告诉我」
- 「用 `wait_for_mail` 等 60 秒看有没有验证码」
- 「列出我当前所有邮箱」→ `list_mailboxes`

---

## 工具列表

> 参数表、REST 等价 curl、返回 JSON 见 [API 详解 · MCP 工具参考](./api.md#mcp-工具参考zmailrmcp)。

| MCP 工具 | 对应 API | 做什么 |
|----------|----------|--------|
| `lease_mailbox` | `POST /api/lease` | 创建随机 24h 邮箱 |
| `wait_for_mail` | `GET /api/mail` | 长轮询等 OTP |
| `get_latest_code` | `GET .../latest-code` | 立刻查最新 OTP |
| `get_latest_link` | `GET .../latest-link` | 立刻查验证链接 |
| `list_mailboxes` | `GET /api/mailboxes` | 列出邮箱 |
| `list_emails` | `GET .../emails` | 列出邮件 |
| `delete_mailbox` | `DELETE /api/mailboxes/:address` | 删除邮箱 |
| `get_email` | `GET /api/emails/:id` | 邮件详情 |
| `delete_email` | `DELETE /api/emails/:id` | 删除邮件 |
| `send_email` | `POST /api/send` | 出站发信 |
| `get_quota` | `GET /api/user/quota` | 发信配额 |

---

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `ZMAILR_BASE_URL` | 是 | 实例根 URL |
| `ZMAILR_TOKEN` | 是 | Bearer Token |

---

## Token Scope

| MCP 工具 | 所需 scope |
|----------|------------|
| `lease_mailbox` | `lease` |
| `wait_for_mail`、`get_latest_code`、`get_latest_link`、`list_*`、`get_email`、`delete_*` | `mail` |
| `send_email` | `send` |
| `get_quota` | 任意 |

Scope 不足时 REST 返回 `403` + `缺少 xxx 权限`。详见 [API 详解 · Token Scope](./api.md#token-scope)。

---

## 常见错误（MCP 视角）

MCP 工具失败时返回 `isError: true`，文本含 HTTP 状态与 body。常见情况：

| 现象 | 原因 | 处理 |
|------|------|------|
| `401` / 未授权 | Token 无效 | 重建 Token，检查 `ZMAILR_TOKEN` |
| `403` / 缺少 mail 权限 | Scope 不够 | Token 勾选 `mail` |
| `404` / `no_code` | 邮件未到或未提取 OTP | 改用 `wait_for_mail` 或稍后重试 `get_latest_code` |
| `408` / `timeout` | 长轮询超时 | 增大 `wait_for_mail` 的 `timeout` 参数 |
| `429` / `rate_limit` | 请求过快 | 降频，读 API 响应头 `Retry-After` |

完整错误表 → [API 详解 · 统一错误说明](./api.md#统一错误说明)

---

## Cursor 配置

在 `.cursor/mcp.json` 或 **Cursor Settings → MCP** 中添加。可复制 [mcp.json.example](./mcp.json.example) 到 `.cursor/mcp.json`（已 gitignore）。

`ZMAILR_BASE_URL` 填 <SiteOrigin />：

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

### 本地 monorepo 开发

```bash
pnpm --filter @zmailr/mcp run build
```

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

## Claude Desktop 配置

| 平台 | 配置文件 |
|------|----------|
| **Windows** | `%APPDATA%\Claude\claude_desktop_config.json` |
| **macOS** | `~/Library/Application Support/Claude/claude_desktop_config.json` |

JSON 结构与 Cursor 相同。修改后重启 Claude Desktop。

---

## 安装

```bash
npx -y @zmailr/mcp
```

npm 包：[`@zmailr/mcp`](https://www.npmjs.com/package/@zmailr/mcp) · 英文 README：[packages/mcp](https://github.com/jia0327/zmailr/blob/main/packages/mcp/README.md)
