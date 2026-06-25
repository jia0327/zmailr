# <div align="center">🚀 zMailR · 24小时临时邮箱服务</div>

<div align="center">
  <p>
    <a href="./README.en.md">English</a> | <strong>简体中文</strong>
  </p>

  <p><strong>Enhanced fork of <a href="https://github.com/zaunist/zmail">zaunist/zmail</a></strong>（MIT License）</p>

  <p>
    <a href="https://zmailr.itool.eu.cc/" target="_blank"><strong>🌐 在线体验</strong></a>
  </p>
</div>

---

## 🚀 Fork 后通过 Github Action 自定义部署

<div style="background-color: #2d2d2d; color: #ffffff; padding: 15px; border-radius: 5px; margin: 15px 0;">
  <h4>📋 部署步骤：</h4>
  <ol>
    <li>Fork 本项目到您的 GitHub 账户</li>
    <li>在 Cloudflare Dashboard 中创建一个 D1 数据库，并记录下数据库的 <strong>database_name</strong> 和 <strong>database_id</strong></li>
    <li>在您的 GitHub 仓库中，前往 <strong>Settings</strong> > <strong>Secrets and variables</strong> > <strong>Actions</strong></li>
    <li>点击 <strong>New repository secret</strong> 并添加以下密钥：
      <ul>
        <li><code>CF_API_TOKEN</code>：Cloudflare API Token，可在 <a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank">此处</a> 创建，使用 "Edit Cloudflare Workers" 模板</li>
        <li><code>CF_ACCOUNT_ID</code>：Cloudflare 账户 ID，可在 Workers 页面右侧找到</li>
        <li><code>D1_DATABASE_ID</code>：第二步创建的 D1 数据库 ID</li>
        <li><code>D1_DATABASE_NAME</code>：第二步创建的 D1 数据库名称</li>
        <li><code>VITE_EMAIL_DOMAIN</code>：域名列表，多个域名用逗号分隔（例如：<code>example.com,test.com</code>）</li>
        <li><code>ADMIN_PASSWORD</code>：管理后台（<code>/admin</code>）登录密码，用于创建 API Token 和管理提取规则</li>
        <li><code>BREVO_API_KEY</code>：<a href="docs/brevo-setup.md">Brevo</a> Transactional Email API Key，用于 <code>/api/send</code> 发信（推荐）</li>
        <li><code>MAILCHANNELS_API_KEY</code>（可选）：MailChannels API Key，仅在未配置 Brevo 时作为回退</li>
      </ul>
    </li>
    <li>完成以上步骤后，项目将在每次推送到 <code>main</code> 分支时自动部署；也可在 Actions 页面手动触发</li>
    <li>部署完成后，为 Worker 绑定自定义域名</li>
    <li>配置 Cloudflare Email 路由（见下方）</li>
  </ol>
</div>

### 📧 配置邮件路由

<div style="background-color: #2d2d2d; color: #ffffff; padding: 15px; border-radius: 5px; margin: 15px 0;">
  <ol>
    <li>在 Cloudflare 控制面板中找到您的域名</li>
    <li>进入 "Email" → "Email Routing"</li>
    <li>启用 Email Routing</li>
    <li>添加路由规则：
      <ul>
        <li>匹配类型："Catch-all address"</li>
        <li>操作："Send to a Worker"</li>
        <li>选择您部署的 Worker</li>
      </ul>
    </li>
    <li>如有多个域名，请为每个域名重复上述步骤</li>
  </ol>
</div>

### 📚 相关文档

- **发信配置**：[docs/brevo-setup.md](docs/brevo-setup.md)（Brevo 注册、SPF/DKIM/DMARC、API Key、GitHub Secret 等完整步骤）
- **程序化 API**：部署后访问 <code>https://你的域名/admin</code> 创建 API Token。接口包括 <code>/api/lease</code>（租用邮箱）、<code>/api/mail</code>（长轮询收信）、<code>/api/send</code>（发信），请求需携带 <code>Authorization: Bearer &lt;token&gt;</code>

---

## 📄 许可证

[MIT License](./LICENSE)
