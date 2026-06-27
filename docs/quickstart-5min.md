# 5 分钟体验

> 在控制台完成 **登录 → 创建 Token → 租用邮箱 → 查看 OTP**，无需写代码。

## 前提条件

- 可访问本实例：<SiteOrigin />
- 演示账号 `guest` / `guest`（或你的自有账号）

预计耗时：**约 5 分钟**

---

## 步骤 1：登录控制台

1. 打开 <SiteLink to="/login">登录页</SiteLink>（未登录时可从 <SiteLink to="/">首页</SiteLink> 进入）
2. 输入用户名 `guest`、密码 `guest`
3. 点击 **登录**

![登录页](./screenshots/login.png)

登录成功后进入 <SiteLink to="/dashboard/usage">仪表板</SiteLink>。

---

## 步骤 2：创建 API 密钥

程序化调用（脚本 / MCP）需要 Bearer Token。

1. 侧栏进入 **API 密钥**（<SiteLink to="/dashboard/api-keys">/dashboard/api-keys</SiteLink>）
2. 点击 **新建 Token**
3. 名称随意（如 `quickstart`）
4. Scope 勾选 **`lease`**、**`mail`**
5. 创建后 **立即复制** 明文 Token（只显示一次）

![创建 API 密钥](./screenshots/api-keys-create.png)

::: warning 请妥善保存 Token
明文 Token 关闭弹窗后无法再次查看。丢失须删除并重建。
:::

图文详解 → [创建 API 密钥](./create-api-key.md)

---

## 步骤 3：租用临时邮箱

有两种方式，任选其一：

### 方式 A：控制台（本教程）

1. 进入 **收件箱**（<SiteLink to="/dashboard/inbox">/dashboard/inbox</SiteLink>）
2. 点击 **新建邮箱**，获得一个 24h 临时地址

![新建收件箱](./screenshots/inbox-new-mailbox.png)

### 方式 B：API（脚本用户）

```bash
curl -s -X POST "<SiteOrigin />/api/lease" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

返回 JSON 中的 `email` 即为临时地址。

---

## 步骤 4：触发验证邮件并查看 OTP

1. 在任意支持邮箱验证的站点，使用上一步的 **完整邮箱地址** 注册或登录
2. 等待验证邮件到达（通常数秒～数十秒）
3. 回到 zMailR **收件箱**，打开该邮箱，查看邮件列表

系统会自动从正文中 **高亮提取 OTP**：

![收信与 OTP 高亮](./screenshots/inbox-with-otp.png)

::: tip 脚本如何等 OTP？
控制台适合人工确认；自动化请用 `GET /api/mail` 长轮询或 `latest-code` 轮询 → [第一个脚本](./first-script.md)
:::

::: warning 能看到邮件但没有 OTP 高亮？
说明 **提取规则未匹配**该站点模板，不是邮件延迟。按 [验证码完整流程 · 步骤 3–5](./otp-workflow.md#步骤-3收到邮件但未获取到验证码) 配置 [自定义提取规则](./extract-rules.md)。
:::

---

## 步骤 5：用 API 调试页验证（可选）

1. 打开 **API 调试**（Dashboard → API 调试）
2. 选择 `GET /api/user/quota` 或 `GET .../latest-code`
3. 确认 Bearer 调用返回 200

![API 调试响应](./screenshots/api-debug-response.png)

---

## 你已完成

- 登录并熟悉 Dashboard
- 创建带 `lease` + `mail` 的 Token
- 租用 24h 邮箱并看到 OTP 提取效果

## 下一步

| 目标 | 文档 |
|------|------|
| 系统学习 Token / Scope | [认证说明](./user-auth.md) |
| 写 Python / curl 自动化 | [第一个脚本](./first-script.md) |
| 有信但无 OTP / 接 CI | [验证码完整流程](./otp-workflow.md) |
| 查全部 REST 端点 | [API 概览](./api-overview.md) |
| Cursor Agent 接入 | [MCP 快速接入](./mcp.md) |
