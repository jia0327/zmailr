# 脚本接入

> [第一个脚本](./first-script.md) · [API 概览](./api-overview.md) · [错误码与限流](./errors.md)

Python、Node.js、curl **可复用模板**与环境变量约定。若尚未跑通首次调用，请先完成 [第一个脚本](./first-script.md)。

接口语义见 [API 参考](./api.md)。

---

## 环境变量

与 MCP 相同：

```bash
export ZMAILR_BASE_URL="https://your-domain"   # 本实例：<SiteOrigin />
export ZMAILR_TOKEN="your-bearer-token"
```

Token 创建与 Scope → [创建 API 密钥](./create-api-key.md)。

---

## 5 分钟 curl

```bash
export BASE="$ZMAILR_BASE_URL"
export TOKEN="$ZMAILR_TOKEN"

# 租用邮箱
curl -s -X POST "$BASE/api/lease" -H "Authorization: Bearer $TOKEN"

# 假设返回 email 为 k7m2x9@your-mail-domain，长轮询 OTP：
curl -s -G "$BASE/api/mail" \
  -H "Authorization: Bearer $TOKEN" \
  --data-urlencode 'to=k7m2x9@your-mail-domain' \
  --data-urlencode 'timeout=60' \
  --data-urlencode 'require_code=true'

# 或即时查询（无 OTP 时 404 no_code）：
curl -s "$BASE/api/mailboxes/k7m2x9@your-mail-domain/latest-code" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Python（requests）

### 最小示例

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

### 可复用函数

```python
import os, time, requests

BASE = os.environ["ZMAILR_BASE_URL"].rstrip("/")
TOKEN = os.environ["ZMAILR_TOKEN"]
H = {"Authorization": f"Bearer {TOKEN}"}

def lease():
    r = requests.post(f"{BASE}/api/lease", headers=H, timeout=30)
    r.raise_for_status()
    return r.json()["email"]

def wait_otp(email, timeout=60):
    r = requests.get(
        f"{BASE}/api/mail",
        headers=H,
        params={"to": email, "timeout": str(timeout), "require_code": "true"},
        timeout=timeout + 15,
    )
    if r.status_code == 408:
        raise TimeoutError(r.json().get("message", "timeout"))
    r.raise_for_status()
    return r.json()["code"]

def poll_otp(email, attempts=30, interval=2):
    for _ in range(attempts):
        r = requests.get(
            f"{BASE}/api/mailboxes/{email}/latest-code",
            headers=H,
            timeout=30,
        )
        if r.status_code == 200:
            return r.json()["code"]
        if r.status_code != 404 or r.json().get("error") != "no_code":
            r.raise_for_status()
        time.sleep(interval)
    raise TimeoutError("no_code")

if __name__ == "__main__":
    email = lease()
    print("leased", email)
    # 在目标站点使用该 email 触发验证邮件后：
    print("otp (long poll):", wait_otp(email))
```

---

## Node.js（fetch）

### 最小示例

```javascript
const BASE = process.env.ZMAILR_BASE_URL.replace(/\/$/, '');
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

### 可复用函数

```javascript
const BASE = process.env.ZMAILR_BASE_URL.replace(/\/$/, '');
const headers = { Authorization: `Bearer ${process.env.ZMAILR_TOKEN}` };

async function lease() {
  const r = await fetch(`${BASE}/api/lease`, { method: 'POST', headers });
  if (!r.ok) throw new Error(await r.text());
  return (await r.json()).email;
}

async function waitOtp(email, timeout = 60) {
  const url = new URL(`${BASE}/api/mail`);
  url.searchParams.set('to', email);
  url.searchParams.set('timeout', String(timeout));
  url.searchParams.set('require_code', 'true');
  const r = await fetch(url, { headers, signal: AbortSignal.timeout(timeout * 1000 + 15000) });
  const body = await r.json();
  if (!r.ok) throw new Error(body.error || r.statusText);
  return body.code;
}
```

---

## 错误处理 {#错误处理}

```python
r = requests.get(f"{BASE}/api/mailboxes/{email}/latest-code", headers=H)
if r.status_code == 404 and r.json().get("error") == "no_code":
    pass  # 尚无验证码，继续轮询
elif r.status_code == 429:
    retry_after = int(r.headers.get("Retry-After", "60"))
    time.sleep(retry_after)
elif not r.ok:
    raise RuntimeError(r.json())
```

完整错误表与限流规则 → [错误码与限流](./errors.md)。

---

## 下一步

| 目标 | 文档 |
|------|------|
| 查全部端点 | [API 参考](./api.md) |
| 401 / 429 处理 | [错误码与限流](./errors.md) |
| Cursor 免手写 HTTP | [MCP 快速接入](./mcp.md) |
