# Brevo 发信配置指南

`/api/send` 默认通过 [Brevo](https://www.brevo.com/)（原 Sendinblue）Transactional Email API 发信。默认发件地址为 `no-reply@你的域名`，发件人显示名 `zMailR`。传入 JSON 字段 `from`（须为 D1 中已租用且未过期的临时邮箱完整地址，如 `abc123@你的域名`）时，将以该地址发信，显示名为 local-part。

> 免费计划约 **300 封/天**。`/api/send` 发信需配置 `BREVO_API_KEY`。

---

## 1. 注册 Brevo 账户

1. 打开 [Brevo 注册页](https://app.brevo.com/account/register) 创建账户。
2. 账户类型选 **Personal**（个人开发者）。
3. **Company name** 填 `zMailR` 或 `Personal`。
4. **Website** 勾选「I don't have a website yet」。
5. **Address** 用英文或拼音填写（例如 `Beijing, China`）。
6. **Team size** 选 `0-1`。
7. **Contacts** 选 `No contacts yet`。
8. 选择 **Free** 计划（300 emails/day）。

---

## 2. 添加发信域名

1. 登录 [Brevo 控制台](https://app.brevo.com/) → **Settings** → **Senders, domains & dedicated IPs** → **Domains**。
2. 点击 **Add a domain**，输入你的域名（例如 `itool.eu.cc`，需与 `VITE_EMAIL_DOMAIN` / `MAIL_DOMAIN` 一致）。
3. Brevo 会给出 **SPF**、**DKIM**、**DMARC** 三条 DNS 记录。

---

## 3. 在 Cloudflare 配置 DNS

在 Cloudflare 域名 **DNS** 页面添加 Brevo 提供的记录（类型、名称、内容以 Brevo 控制台为准）：

| 类型 | 说明 |
|------|------|
| TXT | SPF（通常 `include:sendinblue.com`） |
| TXT | DKIM（名称形如 `mail._domainkey`） |
| TXT | DMARC（名称 `_dmarc`） |

### DMARC 注意事项

- 域名下 **只能有一条** `_dmarc` TXT 记录。
- 若已有 `p=reject` 等旧记录，**先删除**，再添加 Brevo 提供的记录（通常为 `p=none`）。
- 多条 DMARC 会导致验证失败。

回到 Brevo 点击 **Authenticate**，等待 DNS 生效（通常几分钟到数小时）。

---

## 4. 添加发件人（Sender）

域名验证通过后：

1. **Senders, domains & dedicated IPs** → **Senders** → **Add a sender**。
2. 邮箱填 `no-reply@你的域名`（例如 `no-reply@itool.eu.cc`）。
3. 名称填 `zMailR`。
4. 按提示完成验证（域名已认证时通常无需额外步骤）。

> 必须先完成域名认证，才能添加该域名下的发件人。

---

## 5. 创建 API Key

1. **Settings** → **SMTP & API** → **API keys** 标签（不是 SMTP）。
2. 点击 **Generate a new API key**，命名如 `zmailr-worker`。
3. 复制 Key 并妥善保存（只显示一次）。

---

## 6. API Key 格式：Base64 解码

部分第三方来源或导出工具提供的 Key 是 **Base64 编码的 JSON**，而不是可直接使用的明文 Key。例如：

```
eyJhcGlfa2V5IjoieGtleXNpYi1hYmNkZWY...（省略）In0=
```

解码后的 JSON 结构类似：

```json
{"api_key":"xkeysib-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-xxxxxx"}
```

其中 `api_key` 字段的值才是 Brevo 真正使用的 Key（以 `xkeysib-` 开头）。

**GitHub Secret `BREVO_API_KEY` 与 Cloudflare Worker secret（`wrangler secret put BREVO_API_KEY`）必须填入明文 `xkeysib-...` 字符串，不要粘贴 Base64 整段 blob。**

### 解码方式

**在线工具**：将 Base64 字符串粘贴到任意 Base64 解码网站，得到 JSON 后提取 `api_key` 字段。

**PowerShell**：

```powershell
$b64 = "eyJhcGlfa2V5IjoieGtleXNpYi1hYmNk..."  # 替换为你的 Base64 字符串
([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($b64)) | ConvertFrom-Json).api_key
```

**Linux / macOS**：

```bash
echo 'eyJhcGlfa2V5IjoieGtleXNpYi1hYmNk...' | base64 -d
# 输出: {"api_key":"xkeysib-..."}
```

从输出 JSON 中复制 `api_key` 的值，再写入 GitHub Secret 或 Wrangler secret。

---

## 7. 关闭 API IP 限制（Cloudflare Worker 必需）

Cloudflare Worker 的出口 IP 不固定，必须关闭 Brevo 的 IP 白名单：

1. **Settings** → **Security** → **Authorized IPs**。
2. 找到 **Deactivate API keys blocking**（或类似「关闭 API Key IP 限制」选项）并启用。

未关闭时 Worker 调用 API 会返回 401/403。

---

## 8. 配置 GitHub Secret 并部署

1. GitHub 仓库 → **Settings** → **Secrets and variables** → **Actions**。
2. 新建 Secret：`BREVO_API_KEY` = 明文 `xkeysib-...` Key（见上一节，勿填 Base64 blob）。
3. 推送到 `main` 分支触发部署，或在 Actions 页面手动运行 **Deploy to Cloudflare**。

本地/手动部署：

```bash
wrangler secret put BREVO_API_KEY
```

---

## 9. 测试发信

### 直接测试 Brevo API

```bash
curl -X POST "https://api.brevo.com/v3/smtp/email" \
  -H "accept: application/json" \
  -H "content-type: application/json" \
  -H "api-key: YOUR_BREVO_API_KEY" \
  -d '{
    "sender": {"name": "zMailR", "email": "no-reply@itool.eu.cc"},
    "to": [{"email": "your-test@example.com"}],
    "subject": "Brevo test",
    "textContent": "Hello from zMailR"
  }'
```

PowerShell：

```powershell
$headers = @{
  "accept" = "application/json"
  "content-type" = "application/json"
  "api-key" = "YOUR_BREVO_API_KEY"
}
$body = @{
  sender = @{ name = "zMailR"; email = "no-reply@itool.eu.cc" }
  to = @(@{ email = "your-test@example.com" })
  subject = "Brevo test"
  textContent = "Hello from zMailR"
} | ConvertTo-Json -Depth 4

Invoke-RestMethod -Uri "https://api.brevo.com/v3/smtp/email" -Method Post -Headers $headers -Body $body
```

将 `YOUR_BREVO_API_KEY` 和邮箱地址替换为你的实际值，**勿将真实 Key 提交到仓库**。

### 通过 zMailR `/api/send` 测试

先在管理后台（`https://你的域名/{ADMIN_PATH}`）创建 API Token，然后：

```bash
curl -X POST "https://你的域名/api/send" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"to":"your-test@example.com","subject":"Hello","text":"Plain text body","from":"abc123@你的域名"}'
```

成功后在管理后台的 **发信记录** 中可看到 `sent` 状态。

---

## 常见问题

| 现象 | 可能原因 |
|------|----------|
| 401 / IP not authorized | 未关闭 Authorized IPs 限制 |
| 发件人被拒 | 域名或 Sender 未验证 |
| DMARC 失败 | 存在多条 `_dmarc` 记录，或 SPF/DKIM 未生效 |
| Worker 报未配置 Key | GitHub Secret `BREVO_API_KEY` 未设置或未重新部署 |

