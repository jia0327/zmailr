# 快速开始

<div class="zmailr-hero">

**zMailR** 提供真实 MX 临时邮箱 + OTP 自动提取，供 **测试脚本、CI、Cursor/Claude Agent** 使用。

**本实例** <SiteOrigin /> · 演示 <SiteLink to="/login">guest / guest</SiteLink> · Token 在 <SiteLink to="/dashboard/api-keys">API 密钥</SiteLink> 创建

</div>

## 文档怎么读

| 页面 | 适合谁 | 你会学到 |
|------|--------|----------|
| **快速开始**（本文） | 第一次接入 | 5 分钟跑通 lease → 收 OTP |
| [API 详解](./api.md) | 写 curl / Python / Node | 每个接口的作用、参数、错误码、完整示例 |
| [MCP 详解](./mcp.md) | Cursor / Claude 用户 | 配置 MCP、工具与 REST 对照 |

---

## 核心概念（3 个接口搞定 OTP）

| 接口 | 做什么 | 什么时候用 |
|------|--------|------------|
| `POST /api/lease` | 分配一个 **24 小时**临时邮箱 | 注册/登录测试的第一步 |
| `GET /api/mailboxes/:address/latest-code` | **立刻**查最新 OTP（无则 404） | 轮询间隔短、自己控制循环 |
| `GET /api/mail?to=...&timeout=60` | **阻塞等待** OTP（最长 ~55s） | 脚本一条命令等验证码，少写循环 |

发信、列邮箱等扩展接口见 [API 详解 · 端点索引](./api.md#端点索引)。MCP 的 `lease_mailbox` / `wait_for_mail` / `get_latest_code` 与上表 **一一对应**，见 [MCP 详解](./mcp.md)。

**鉴权**：所有程序化接口 Header 带 `Authorization: Bearer <token>`。创建 Token 时勾选 **`lease` + `mail`**（收 OTP 必需）。

---

## 5 分钟上手

### 1. 准备 Token

1. <SiteLink to="/login">登录</SiteLink>（演示账号 `guest` / `guest`）
2. 打开 <SiteLink to="/dashboard/api-keys">API 密钥</SiteLink> → 新建 Token
3. Scope 勾选 **`lease`**、**`mail`**，复制明文 Token（**只显示一次**）

### 2. 租用邮箱 → 取 OTP

Base URL：<SiteOrigin />

**curl**

```bash
export BASE="https://your-domain"   # 本实例见上方 SiteOrigin
export TOKEN="your-bearer-token"

# 租用邮箱
curl -s -X POST "$BASE/api/lease" -H "Authorization: Bearer $TOKEN"

# 假设返回 email 为 k7m2x9@your-mail-domain，提取 OTP：
curl -s "$BASE/api/mailboxes/k7m2x9@your-mail-domain/latest-code" \
  -H "Authorization: Bearer $TOKEN"
```

**Python**

```python
import os, requests

BASE = os.environ["ZMAILR_BASE_URL"]  # 例: https://zmailr.example.com
TOKEN = os.environ["ZMAILR_TOKEN"]
H = {"Authorization": f"Bearer {TOKEN}"}

# 1. 租用邮箱
r = requests.post(f"{BASE}/api/lease", headers=H, timeout=30)
r.raise_for_status()
email = r.json()["email"]
print("mailbox:", email)

# 2. 长轮询等待 OTP（单次请求最多约 55s）
r = requests.get(
    f"{BASE}/api/mail",
    headers=H,
    params={"to": email, "timeout": "60", "require_code": "true"},
    timeout=70,
)
r.raise_for_status()
print("otp:", r.json()["code"])
```

**Node.js**

```javascript
const BASE = process.env.ZMAILR_BASE_URL;
const TOKEN = process.env.ZMAILR_TOKEN;
const headers = { Authorization: `Bearer ${TOKEN}` };

const lease = await fetch(`${BASE}/api/lease`, { method: 'POST', headers });
const { email } = await lease.json();

const mail = await fetch(
  `${BASE}/api/mail?to=${encodeURIComponent(email)}&timeout=60&require_code=true`,
  { headers, signal: AbortSignal.timeout(70_000) }
);
const { code } = await mail.json();
console.log('otp:', code);
```

将 `ZMAILR_BASE_URL` 设为 <SiteOrigin />。完整参数与返回字段 → [API 详解](./api.md)。

---

## MCP 快速接入（Cursor / Claude）

无需手写 HTTP：配置后让 Agent 调用 `lease_mailbox` → `wait_for_mail`。

1. 创建 Token（同上，`lease` + `mail`）
2. 在项目或全局添加 MCP 配置（`ZMAILR_BASE_URL` = <SiteOrigin />）：

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

3. 重启 Cursor，在对话中说：「用 zmailr 租一个临时邮箱，等验证码并告诉我」

配置路径、11 个工具说明、Scope 对照 → [MCP 详解](./mcp.md)

---

## 常见错误与限制（必读）

### 错误码速查

失败时响应形如 `{ "success": false, "error": "..." }`。脚本里应检查 **HTTP 状态码** 和 **`error` 字段**。

| HTTP | `error` | 含义 | 处理建议 |
|------|---------|------|----------|
| `401` | 未授权… | Token 无效/缺失 | 检查 Header、Token 是否过期 |
| `403` | `缺少 mail 权限` 等 | Scope 不足 | 重建 Token，勾选对应 scope |
| `403` | `无权访问该邮箱` | 邮箱不属于当前用户 | 用本 Token lease 的地址 |
| `404` | `no_code` | 还没有 OTP | 继续轮询或改用 `GET /api/mail` 长轮询 |
| `404` | `邮箱不存在或已过期` | 超过 24h 或地址错误 | 重新 `POST /api/lease` |
| `408` | `timeout` | 长轮询时间内没收到信 | 增大 `timeout` 或重试 |
| `429` | `rate_limit` | 请求过快或发信配额用尽 | 读 `Retry-After`，降频后重试 |

完整列表 → [API 详解 · 统一错误说明](./api.md#统一错误说明)

### 速率限制

| 对象 | 规则 |
|------|------|
| 已登录 / Bearer 用户 | 按用户 **60 req/min** 起（管理员可调 Pro/Team） |
| 未识别请求 | 按 IP **60 req/min** |
| 发信 | 另有 **日配额**（演示账号默认 50 封/天），`GET /api/user/quota` 查询 |

响应头：`X-RateLimit-Remaining`、`Retry-After`。详情 → [API 详解 · 速率限制](./api.md#速率限制)

### 其他限制

- 临时邮箱 **TTL 24 小时**，过期后无法 Bearer 读信
- **不支持匿名 API**；`POST /api/mailboxes` 已废弃
- 出站 `POST /api/send` 需 **`send` scope** 且实例配置 Brevo

---

## 延伸阅读

- [API 详解](./api.md) — 全部 REST 端点逐条说明 + MCP 工具对照
- [MCP 详解](./mcp.md) — Cursor / Claude Desktop 配置
- OpenAPI：<SiteLink to="/openapi.json">/openapi.json</SiteLink> · 交互式：<SiteLink to="/api-docs">/api-docs</SiteLink>
