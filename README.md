# <div align="center">🚀 ZMAIL - 24小时临时邮箱服务</div>

<div align="center">
  <p>
    <a href="./README.en.md">English</a> | <strong>简体中文</strong>
  </p>

  <p>如果这个项目对您有帮助，请考虑给它一个 ⭐️ Star ⭐️，这将是对我最大的鼓励！</p>

  <img src="frontend/public/favicon.svg" alt="ZMAIL Logo" width="120" height="120" style="background-color: #4f46e5; padding: 20px; border-radius: 12px; margin: 20px 0;">

  <h3>💌 安全、简单、即用即走的临时邮箱服务</h3>

  <p>
    <a href="https://mail.mdzz.uk" target="_blank"><strong>🌐 在线体验</strong></a> •
    <a href="#功能特点"><strong>✨ 功能特点</strong></a> •
    <a href="#快速部署"><strong>🚀 快速部署</strong></a> •
    <a href="#本地开发"><strong>💻 本地开发</strong></a> •
    <a href="#技术栈"><strong>🔧 技术栈</strong></a>
  </p>

</div>

---

## ✨ 功能特点

<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin: 20px 0;">
  <div>
    <h4>✨ 即时创建</h4>
    <p>无需注册，立即获得一个临时邮箱地址</p>
  </div>
  <div>
    <h4>🔒 隐私保护</h4>
    <p>保护您的真实邮箱，避免垃圾邮件和信息泄露</p>
  </div>
  <div>
    <h4>⚡ 高速接收</h4>
    <p>实时接收邮件，无需刷新页面</p>
  </div>
  <div>
    <h4>🌐 全球可用</h4>
    <p>基于Cloudflare构建，全球边缘网络加速</p>
  </div>
  <div>
    <h4>🔄 自动刷新</h4>
    <p>自动检查新邮件，确保不错过任何重要信息</p>
  </div>
  <div>
    <h4>📱 响应式设计</h4>
    <p>完美适配各种设备，从手机到桌面</p>
  </div>
</div>

---

## 🚀 快速部署

ZMAIL 现在采用全新的一体化部署方式，前端和后端整合为一个 Cloudflare Worker，部署更加简单！

### 🎯 部署方式选择

我们提供两种部署方式，您可以根据需求选择：

#### 方式一：一键部署（推荐新手）

<div align="center">
  <a href="http://deploy.workers.cloudflare.com/?url=https://github.com/zaunist/zmail" target="_blank">
    <img src="https://deploy.workers.cloudflare.com/button" alt="Deploy to Cloudflare" />
  </a>
</div>

<div style="background-color: #2d2d2d; color: #ffffff; padding: 15px; border-radius: 5px; margin: 15px 0;">
  <h4>✅ 优点：</h4>
  <ul>
    <li>部署简单，一键完成</li>
    <li>无需修改配置文件</li>
    <li>适合快速体验</li>
  </ul>
  
  <h4>❌ 缺点：</h4>
  <ul>
    <li>无法获得后续代码更新</li>
    <li>需要手动绑定自定义域名</li>
  </ul>
  
  <h4>📋 部署步骤：</h4>
  <ol>
    <li>点击上方 "Deploy to Cloudflare" 按钮</li>
    <li>按照页面提示连接您的 GitHub 账户</li>
    <li>填写应用名称和数据库名称</li>
    <li>在高级设置 -> 构建变量中设置：
      <ul>
        <li><code>VITE_EMAIL_DOMAIN</code>: 您的域名列表，使用 ',' 分割 (例如: mdzz.uk,zaunist.com)</li>
      </ul>
    </li>
    <li>点击"创建和部署"</li>
    <li>部署完成后，在 Cloudflare Workers 控制面板中绑定自定义域名</li>
    <li>配置 Cloudflare Email 路由，将邮件转发到您的 Worker</li>
  </ol>
</div>

#### 方式二：Fork 后通过 Github Action 自定义部署（推荐进阶用户）

<div style="background-color: #2d2d2d; color: #ffffff; padding: 15px; border-radius: 5px; margin: 15px 0;">
  <h4>✅ 优点：</h4>
  <ul>
    <li>可以获得后续代码更新</li>
    <li>完全自定义配置</li>
    <li>更好的版本控制</li>
    <li>通过 GitHub Action 自动部署，更加安全便捷</li>
  </ul>
  
  <h4>❌ 缺点：</h4>
  <ul>
    <li>需要一定的技术基础</li>
    <li>需要手动创建数据库和配置密钥</li>
  </ul>
  
  <h4>📋 部署步骤：</h4>
  <ol>
    <li>Fork 本项目到您的 GitHub 账户</li>
    <li>在 Cloudflare Dashboard 中创建一个 D1 数据库，并记录下数据库的 <strong>database_name</strong> 和 <strong>database_id</strong></li>
    <li>在您的 GitHub 仓库中, 前往 <strong>Settings</strong> > <strong>Secrets and variables</strong> > <strong>Actions</strong></li>
    <li>点击 <strong>New repository secret</strong> 并添加以下六个密钥：
      <ul>
        <li><code>CF_API_TOKEN</code>: 你的 Cloudflare API Token。你可以在 <a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank">这里</a> 创建，使用 "Edit Cloudflare Workers" 模板即可。</li>
        <li><code>CF_ACCOUNT_ID</code>: 你的 Cloudflare 账户 ID。你可以在 Workers 页面的右侧找到。</li>
        <li><code>D1_DATABASE_ID</code>: 你在第二步中创建的 D1 数据库的 ID。</li>
        <li><code>D1_DATABASE_NAME</code>: 你在第二步中创建的 D1 数据库的名称。</li>
        <li><code>VITE_EMAIL_DOMAIN</code>: 你的域名列表，多个域名用逗号 ',' 分割 (例如: example.com,test.com)。</li>
        <li><code>ADMIN_PASSWORD</code>: 管理后台 (<code>/admin</code>) 登录密码，用于创建 API Token 和管理提取规则。</li>
      </ul>
    </li>
    <li>完成以上步骤后，项目将在每次推送到 <code>main</code> 分支时自动部署。你也可以在 Actions 页面手动触发部署。</li>
    <li>部署完成后，为你的 Worker 绑定一个自定义域名。</li>
    <li>最后，配置 Cloudflare Email 路由，将邮件转发到你的 Worker。</li>
  </ol>
</div>

### 📧 配置邮件路由

无论选择哪种部署方式，都需要配置 Cloudflare Email 路由：

<div style="background-color: #2d2d2d; color: #ffffff; padding: 15px; border-radius: 5px; margin: 15px 0;">
  <ol>
    <li>在 Cloudflare 控制面板中找到您的域名</li>
    <li>进入 "Email" -> "Email Routing"</li>
    <li>启用 Email Routing</li>
    <li>添加路由规则：
      <ul>
        <li>匹配类型："Catch-all address"</li>
        <li>操作："Send to a Worker"</li>
        <li>选择您部署的 Worker</li>
      </ul>
    </li>
    <li>如果有多个域名，请为每个域名重复上述步骤</li>
  </ol>
</div>

---


## 💻 本地开发

### 🚀 开发

<div style="background-color: #2d2d2d; color: #ffffff; padding: 15px; border-radius: 5px; margin: 15px 0;">

```bash
# 安装依赖
pnpm install

# 启动前端开发服务器
pnpm dev:frontend

# 启动后端开发服务器
pnpm dev:backend
```

</div>

### ⚙️ 部署

<div style="background-color: #2d2d2d; color: #ffffff; padding: 15px; border-radius: 5px; margin: 15px 0;">

```bash
# 部署
pnpm run deploy
```

</div>

---

## 🔧 技术栈

<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin: 20px 0;">
  <div>
    <h3>🎨 前端</h3>
    <ul>
      <li><strong>React</strong> - 用户界面库</li>
      <li><strong>TypeScript</strong> - 类型安全的JavaScript超集</li>
      <li><strong>Tailwind CSS</strong> - 实用优先的CSS框架</li>
      <li><strong>Vite</strong> - 现代前端构建工具</li>
    </ul>
  </div>
  <div>
    <h3>⚙️ 后端</h3>
    <ul>
      <li><strong>Cloudflare Workers</strong> - 边缘计算平台</li>
      <li><strong>Cloudflare D1</strong> - 边缘SQL数据库</li>
      <li><strong>Cloudflare Email Workers</strong> - 邮件处理服务</li>
    </ul>
  </div>
</div>

---

## 🔌 程序化 API

除 Web 前端使用的 `/api/mailboxes` 等接口外，ZMAIL 还提供需 **Bearer Token** 鉴权的程序化 API，适合自动化注册、收验证码、发通知等场景。

### 获取 API Token

1. 在 GitHub Secrets 或 `wrangler.toml` 中配置 `ADMIN_PASSWORD`
2. 访问 `https://你的域名/admin`，使用管理员密码登录
3. 在「API Token」面板创建 Token，复制保存（仅显示一次）

所有程序化 API 请求需携带 Header：

```
Authorization: Bearer <your-api-token>
```

### POST /api/lease — 租用临时邮箱

创建一个新的 24 小时临时邮箱地址。

```bash
curl -X POST "https://你的域名/api/lease" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

响应示例：

```json
{
  "success": true,
  "email": "abc123@example.com",
  "address": "abc123",
  "expiresAt": 1719360000
}
```

### GET /api/mail — 长轮询等待邮件

等待指定邮箱收到新邮件，并返回自动提取的验证码（`extracted_code`）。

| 参数 | 说明 |
|------|------|
| `to` | 必填，完整邮箱或 local-part |
| `timeout` | 可选，超时秒数，默认 60，最大 55 |
| `since` | 可选，Unix 时间戳（秒），只匹配此时间之后的邮件 |
| `require_code` | 可选，默认 `true`；设为 `false` 时无验证码也会返回 |

```bash
curl "https://你的域名/api/mail?to=abc123@example.com&timeout=60" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

响应示例：

```json
{
  "success": true,
  "code": "123456",
  "email": {
    "id": "...",
    "subject": "Your verification code",
    "from": "noreply@service.com",
    "receivedAt": 1719350000
  }
}
```

### POST /api/send — 发送邮件

通过 MailChannels 从 `no-reply@你的域名` 发送邮件（需完成下方 DNS 配置）。

```bash
curl -X POST "https://你的域名/api/send" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"to":"user@example.com","subject":"Hello","text":"Plain text body"}'
```

### Web API 中的 extractedCode

Web 前端使用的邮件列表与详情接口同样返回 `extractedCode` 字段（邮件入库时自动提取，无则为 `null`）：

- `GET /api/mailboxes/:address/emails`
- `GET /api/emails/:id`

### Python 示例

```python
import requests

BASE = "https://你的域名"
TOKEN = "YOUR_TOKEN"
headers = {"Authorization": f"Bearer {TOKEN}"}

# 租用邮箱
lease = requests.post(f"{BASE}/api/lease", headers=headers).json()
email = lease["email"]

# 等待验证码（长轮询，最长 60 秒）
mail = requests.get(
    f"{BASE}/api/mail",
    headers=headers,
    params={"to": email, "timeout": 60},
    timeout=65,
).json()
print(mail.get("code"))
```

---

## 🛠 管理后台

访问 `https://你的域名/admin` 可管理：

- **API Token**：创建/删除程序化 API 访问令牌
- **提取规则**：按发件人域名配置正则，自动从邮件中提取验证码
- **发信记录**：查看 `/api/send` 发送审计日志
- **统计**：当日收信/发信/活跃 Token 数量

### 配置 ADMIN_PASSWORD

管理员密码通过 Worker 环境变量 `ADMIN_PASSWORD` 注入：

- **GitHub Actions 部署**：在仓库 Secrets 中添加 `ADMIN_PASSWORD`
- **本地/手动部署**：在 `wrangler.toml` 的 `[vars]` 中设置，或使用 `wrangler secret put ADMIN_PASSWORD`

未配置时管理后台无法登录，程序化 API 的 Token 也无法通过 UI 创建。

---

## 📤 MailChannels 发信 DNS 配置

`/api/send` 使用 [MailChannels](https://www.mailchannels.com/) 发送邮件。域名必须在 Cloudflare 上完成验证，否则发信会被拒绝。

在 Cloudflare DNS 中为发信域名（与 `VITE_EMAIL_DOMAIN` / `MAIL_DOMAIN` 一致）添加以下记录：

| 类型 | 名称 | 内容 | 说明 |
|------|------|------|------|
| TXT | `_mailchannels` | `v=mc1 cfid=你的Cloudflare账户ID` | MailChannels 域名验证 |
| TXT | `@` | `v=spf1 a mx include:relay.mailchannels.net ~all` | SPF，授权 MailChannels 代发 |

操作步骤：

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/) → 选择域名 → **DNS**
2. 添加上述两条 TXT 记录（若已有 SPF 记录，将 `include:relay.mailchannels.net` 合并进现有 SPF，避免多条 SPF 冲突）
3. 在 **Email** → **Email Routing** 中确认域名已启用（接收邮件与发信 DNS 可共用同一域名）
4. 部署后通过 `/admin` 发信记录或 `POST /api/send` 测试；失败时查看 Worker 日志中的 MailChannels 错误详情

> 发件地址固定为 `no-reply@你的域名`，由 `sender.ts` 通过 MailChannels API 发送。

---

## 👥 贡献指南

欢迎提交Pull Request或Issue来改进这个项目！

## 📄 许可证

[MIT License](./LICENSE)
