# <div align="center">🚀 zMailR - 24-hour Temporary Email Service</div>

<div align="center">
  <p>
    <strong>English</strong> | <a href="./README.md">中文</a>
  </p>

  <p><em>Web UI is Chinese (zh-CN) only.</em></p>

  <p><strong>Enhanced fork of <a href="https://github.com/zaunist/zmail">zaunist/zmail</a></strong> (MIT License)</p>

  <p>
    <a href="https://zmailr.itool.eu.cc/" target="_blank"><strong>🌐 Live Demo</strong></a>
  </p>
</div>

---

## Fork and Deploy via GitHub Actions

<div style="background-color: #2d2d2d; color: #ffffff; padding: 15px; border-radius: 5px; margin: 15px 0;">
  <h4>📋 Deployment steps:</h4>
  <ol>
    <li>Fork this project to your GitHub account</li>
    <li>Create a D1 database in the Cloudflare Dashboard and note the <strong>database_name</strong> and <strong>database_id</strong></li>
    <li>In your GitHub repository, go to <strong>Settings</strong> > <strong>Secrets and variables</strong> > <strong>Actions</strong></li>
    <li>Click <strong>New repository secret</strong> and add the following secrets:
      <ul>
        <li><code>CF_API_TOKEN</code>: Cloudflare API Token — create one <a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank">here</a> using the "Edit Cloudflare Workers" template</li>
        <li><code>CF_ACCOUNT_ID</code>: Cloudflare Account ID — found on the right side of the Workers page</li>
        <li><code>D1_DATABASE_ID</code>: D1 database ID from step 2</li>
        <li><code>D1_DATABASE_NAME</code>: D1 database name from step 2</li>
        <li><code>VITE_EMAIL_DOMAIN</code>: Comma-separated domain list (e.g. <code>example.com,test.com</code>)</li>
        <li><code>ADMIN_PASSWORD</code>: Admin panel login password for API tokens and extract rules</li>
        <li><code>ADMIN_PATH</code>: Secret URL path segment for the admin panel (UUID, no leading slash; e.g. <code>a1b2c3d4-e5f6-7890-abcd-ef1234567890</code>) — <strong>required for production</strong></li>
        <li><code>BREVO_API_KEY</code>: <a href="docs/brevo-setup.md">Brevo</a> Transactional Email API key for <code>/api/send</code></li>
      </ul>
    </li>
    <li>After setup, the project deploys automatically on every push to <code>main</code>; you can also trigger deployment manually from the Actions page</li>
    <li>Bind a custom domain to your Worker after deployment</li>
    <li>Configure Cloudflare Email Routing (see below)</li>
  </ol>
</div>

### 📧 Configure Email Routing

<div style="background-color: #2d2d2d; color: #ffffff; padding: 15px; border-radius: 5px; margin: 15px 0;">
  <ol>
    <li>Find your domain in the Cloudflare dashboard</li>
    <li>Go to "Email" → "Email Routing"</li>
    <li>Enable Email Routing</li>
    <li>Add a routing rule:
      <ul>
        <li>Match type: "Catch-all address"</li>
        <li>Action: "Send to a Worker"</li>
        <li>Select your deployed Worker</li>
      </ul>
    </li>
    <li>Repeat for each domain if you have multiple</li>
  </ol>
</div>

### 📚 Related docs

- **Outbound mail**: [docs/brevo-setup.md](docs/brevo-setup.md) (Brevo signup, SPF/DKIM/DMARC, API key, GitHub Secret, testing)
- **Programmatic API**: After deploy, open <code>https://your-domain/{ADMIN_PATH}</code> (path from the <code>ADMIN_PATH</code> secret) to create an API token. Endpoints: <code>/api/lease</code>, <code>/api/mail</code>, <code>/api/send</code> — all require <code>Authorization: Bearer &lt;token&gt;</code>

---

## 📄 License

[MIT License](./LICENSE)
