# 第一个脚本

> 用 curl 或 Python 完成 **租邮箱 → 等 OTP**，约 10 分钟。

## 前提条件

- 已创建 API 密钥，Scope 含 **`lease` + `mail`** → [创建 API 密钥](./create-api-key.md)
- 本机已安装 `curl`，或 Python 3 + `requests`

Base URL：<SiteOrigin />

---

## 步骤 1：设置环境变量

```bash
export ZMAILR_BASE_URL="<SiteOrigin />"
export ZMAILR_TOKEN="zmr_你的Token"
```

Windows PowerShell：

```powershell
$env:ZMAILR_BASE_URL = "https://your-domain"
$env:ZMAILR_TOKEN = "zmr_你的Token"
```

---

## 步骤 2：租用临时邮箱

```bash
curl -s -X POST "$ZMAILR_BASE_URL/api/lease" \
  -H "Authorization: Bearer $ZMAILR_TOKEN"
```

成功响应示例：

```json
{
  "success": true,
  "email": "k7m2x9@your-mail-domain",
  "address": "k7m2x9",
  "expiresAt": 1751030400
}
```

记下 **`email`** 字段，后续步骤会用到。

---

## 步骤 3：在目标站点触发验证邮件

将 `email` 填入你要测试的网站的注册/登录表单，提交以触发验证邮件。

::: tip 没有现成测试站点？
可在控制台 **收件箱** 手动新建邮箱，用另一邮箱向该地址发一封含 6 位数字的测试邮件，效果相同。
:::

---

## 步骤 4：长轮询收取 OTP

一条命令阻塞等待（最长约 55 秒）：

```bash
curl -s -G "$ZMAILR_BASE_URL/api/mail" \
  -H "Authorization: Bearer $ZMAILR_TOKEN" \
  --data-urlencode "to=上一步的email" \
  --data-urlencode "timeout=60" \
  --data-urlencode "require_code=true"
```

成功时 `code` 字段即为 OTP：

```json
{
  "success": true,
  "code": "847291",
  "email": { "id": "em_abc123", "subject": "..." }
}
```

超时返回 `408 timeout` — 可增大 `timeout` 或重试 → [错误码与限流](./errors.md)

---

## 步骤 5：Python 完整示例（可选）

将以下保存为 `zmailr_otp.py`：

```python
import os, requests

BASE = os.environ["ZMAILR_BASE_URL"].rstrip("/")
TOKEN = os.environ["ZMAILR_TOKEN"]
H = {"Authorization": f"Bearer {TOKEN}"}

# 1. 租用邮箱
r = requests.post(f"{BASE}/api/lease", headers=H, timeout=30)
r.raise_for_status()
email = r.json()["email"]
print("mailbox:", email)

input("在目标站点使用该邮箱触发验证邮件后，按 Enter 继续…")

# 2. 长轮询 OTP
r = requests.get(
    f"{BASE}/api/mail",
    headers=H,
    params={"to": email, "timeout": "60", "require_code": "true"},
    timeout=70,
)
r.raise_for_status()
print("otp:", r.json()["code"])
```

运行：

```bash
python zmailr_otp.py
```

---

## 步骤 6：在 Dashboard 核对（可选）

API 租用的邮箱也会出现在 **收件箱** 列表。打开邮件可看到与 API 返回一致的 OTP 高亮：

![收件箱 OTP 高亮](./screenshots/inbox-with-otp.png)

---

## 进阶：轮询 vs 长轮询

| 方式 | 接口 | 适用 |
|------|------|------|
| **长轮询** | `GET /api/mail` | 脚本一次请求等 OTP |
| **短轮询** | `GET .../latest-code` + `sleep` | 需精细控制间隔 |

`404 no_code` 可能表示 **邮件尚未到达**（继续轮询），也可能表示 **有信但规则未匹配**（需配置提取规则）。区分方法 → [验证码完整流程 · 步骤 3](./otp-workflow.md#步骤-3收到邮件但未获取到验证码)。

可复用函数、Node.js 模板、错误处理 → [脚本接入](./scripting.md)

---

## 下一步

| 目标 | 文档 |
|------|------|
| 有信无 OTP / 接 CI 全流程 | [验证码完整流程](./otp-workflow.md) |
| 全部端点与参数 | [API 参考](./api.md) |
| 接口选型速查 | [API 概览](./api-overview.md) |
| Cursor Agent（不写 HTTP） | [MCP 快速接入](./mcp.md) |
| 401 / 429 处理 | [错误码与限流](./errors.md) |
