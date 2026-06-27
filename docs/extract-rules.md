# 自定义提取规则

> [验证码完整流程](./otp-workflow.md) 步骤 4 的详细说明：何时需要、如何配置、如何验证。

## 何时需要自定义规则？

| 情况 | 是否需要 |
|------|----------|
| 常见「验证码：123456」格式 | 通常 **不需要**，内置规则可匹配 |
| 邮件已到，控制台 **无 OTP 高亮** | **需要** |
| API 返回 `404 no_code` 但列表里有邮件 | **需要** |
| 验证码非 6 位纯数字（如 8 位、字母数字） | **需要** |
| 验证码藏在 HTML 表格 / 特殊文案中 | **需要** |

---

## 规则如何工作

收信时，系统按 **发件人域名** 选取规则，对 **主题 + 正文** 执行正则，取 **第一个捕获组** 作为 OTP。

**优先级（高 → 低）**：

1. 你的用户规则（<SiteLink to="/dashboard/extract-rules">Dashboard → 提取规则</SiteLink>）
2. 全局规则（管理员）
3. 内置兜底（`code` / `验证码` / `otp` 等关键词 + 数字）

同一层级内：**域名精确匹配 > `*`**，再按 **priority 降序**。

---

## 步骤 1：打开提取规则页

1. <SiteLink to="/login">登录</SiteLink>
2. 侧栏 **提取规则** → <SiteLink to="/dashboard/extract-rules">/dashboard/extract-rules</SiteLink>

也可从 **收件箱某封未提取 OTP 的邮件** 点击「配置提取规则」，自动填入发件人域名。

---

## 步骤 2：新建规则

![自定义提取规则](./screenshots/extract-rules-custom.png)

| 字段 | 说明 | 示例 |
|------|------|------|
| **域名** | 发件人 `@` 后部分；`*` 匹配全部 | `npmjs.com`、`example.com` |
| **正则表达式** | JavaScript 风格，**必须含捕获组** `(...)` | `(\d{6})`、`code is:\s*(\d{4,8})` |
| **优先级** | 整数，越大越先匹配 | `10`（站点专用）、`0`（默认） |
| **启用** | 关闭后不参与匹配 | 开启 |
| **备注** | 可选，便于团队识别 | `某 App 注册邮件` |

::: warning 捕获组
正则必须包含至少一组括号 `(...)`，系统提取 **第一组** 的内容作为 OTP。例如 `验证码[：:]\s*(\d{6})` 匹配「验证码：847291」→ `847291`。
:::

---

## 步骤 3：常见正则示例

| 场景 | 域名 | 正则 |
|------|------|------|
| 正文独立 6 位数字 | `*` | `(\d{6})` |
| 中文「验证码：123456」 | `example.com` | `[验证码|校验码][：:]\s*(\d{4,8})` |
| 英文 `Your code is 123456` | `*` | `(?:code|otp|pin)\s*(?:is|:)\s*(\d{4,8})` |
| npm 注册 | `npmjs.com` | 已内置，一般无需重复添加 |

在控制台 **新建规则** 前，可复制邮件正文到正则测试工具验证匹配结果。

---

## 步骤 4：保存后自动重提取

保存或更新规则后，系统会在后台对 **尚未提取 OTP** 的历史邮件（最多 100 封 / 批）自动重跑提取。

也可手动：

- **控制台**：邮件列表 / 详情 → **重新提取**
- **API**：`POST /api/emails/:id/re-extract`（Bearer `mail` scope）

```bash
curl -s -X POST "<SiteOrigin />/api/emails/EMAIL_ID/re-extract" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 步骤 5：验证规则生效

1. 回到 **收件箱**，确认原邮件出现 OTP 高亮，或
2. 调用 `GET .../latest-code` 返回 200 + `code`

若仍失败：

- 检查 **域名** 是否与 `From` 完全一致（不区分大小写）
- 检查正则是否能在 **完整正文**（含 HTML 转纯文本后）匹配
- 提高 **priority**，避免被其他规则抢先
- 在目标站点 **重发验证邮件**，让新信走新规则

---

## API 说明（Session）

提取规则的增删改目前通过 **Dashboard Session** 完成（需登录 Cookie），**暂无 Bearer Token API**。

| 端点 | 说明 |
|------|------|
| `GET /api/user/extract-rules` | 列出用户规则 + 全局规则 |
| `POST /api/user/extract-rules` | 新建 |
| `PUT /api/user/extract-rules/:id` | 更新 |
| `DELETE /api/user/extract-rules/:id` | 删除 |

自动化场景：**预先在 Dashboard 配好规则**，脚本只负责 lease / 收 OTP。

---

## 下一步

| 目标 | 文档 |
|------|------|
| 完整六步流程 | [验证码完整流程](./otp-workflow.md) |
| 脚本模板 | [脚本接入](./scripting.md) |
| `no_code` 与其他错误 | [错误码与限流](./errors.md) |
