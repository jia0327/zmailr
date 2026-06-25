# <div align="center">🚀 zMailR - 24-hour Temporary Email Service</div>

<div align="center">
  <p>
    <strong>English</strong> | <a href="./README.md">中文</a>
  </p>

  <p><strong>Enhanced fork of <a href="https://github.com/zaunist/zmail">zaunist/zmail</a></strong> (MIT License)</p>

  <p>If you find this project helpful, please consider giving it a ⭐️ Star ⭐️. Your support is greatly appreciated!</p>

  <img src="frontend/public/favicon.svg" alt="zMailR Logo" width="120" height="120" style="background-color: #4f46e5; padding: 20px; border-radius: 12px; margin: 20px 0;">

  <h3>💌 Secure, Simple, Disposable Email Service</h3>

  <p>
    <a href="https://mail.mdzz.uk" target="_blank"><strong>🌐 Live Demo</strong></a> •
    <a href="#features"><strong>✨ Features</strong></a> •
    <a href="#quick-deployment"><strong>🚀 Deployment</strong></a> •
    <a href="#local-development"><strong>💻 Development</strong></a> •
    <a href="#tech-stack"><strong>🔧 Tech Stack</strong></a>
  </p>

  <div style="display: flex; gap: 10px; justify-content: center; margin: 25px 0;">
    <a href="https://dash.cloudflare.com/" target="_blank">
      <img src="https://img.shields.io/badge/Cloudflare-F38020?style=for-the-badge&logo=cloudflare&logoColor=white" alt="Cloudflare" />
    </a>
  </div>
</div>

---

## ✨ Features

<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin: 20px 0;">
  <div>
    <h4>✨ Instant Creation</h4>
    <p>Get a temporary email address instantly, no registration required</p>
  </div>
  <div>
    <h4>🔒 Privacy Protection</h4>
    <p>Protect your real email from spam and data leaks</p>
  </div>
  <div>
    <h4>⚡ Real-time Reception</h4>
    <p>Receive emails in real-time without refreshing the page</p>
  </div>
  <div>
    <h4>🌐 Global Availability</h4>
    <p>Built on Cloudflare's global edge network for fast access worldwide</p>
  </div>
  <div>
    <h4>🔄 Auto-refresh</h4>
    <p>Automatically check for new emails, never miss important messages</p>
  </div>
  <div>
    <h4>📱 Responsive Design</h4>
    <p>Perfect fit for all devices, from mobile to desktop</p>
  </div>
</div>

---

## 🚀 Quick Deployment

zMailR now adopts a brand new integrated deployment approach, with frontend and backend integrated into a single Cloudflare Worker, making deployment even simpler!

### 🎯 Deployment Options

We provide two deployment methods, you can choose according to your needs:

#### Option 1: One-Click Deployment (Recommended for Beginners)

<div align="center">
  <a href="http://deploy.workers.cloudflare.com/?url=https://github.com/jia0327/zmailr" target="_blank">
    <img src="https://deploy.workers.cloudflare.com/button" alt="Deploy to Cloudflare" />
  </a>
</div>

<div style="background-color: #2d2d2d; color: #ffffff; padding: 15px; border-radius: 5px; margin: 15px 0;">
  <h4>✅ Advantages:</h4>
  <ul>
    <li>Simple deployment, one-click completion</li>
    <li>No need to modify configuration files</li>
    <li>Perfect for quick testing</li>
  </ul>
  
  <h4>❌ Disadvantages:</h4>
  <ul>
    <li>Cannot receive subsequent code updates</li>
    <li>Need to manually bind custom domain</li>
  </ul>
  
  <h4>📋 Deployment Steps:</h4>
  <ol>
    <li>Click the "Deploy to Cloudflare" button above</li>
    <li>Follow the page instructions to connect your GitHub account</li>
    <li>Fill in application name and database name</li>
    <li>In Advanced Settings -> Build Variables, set:
      <ul>
        <li><code>VITE_EMAIL_DOMAIN</code>: Your domain list, separated by ',' (e.g., mdzz.uk,zaunist.com)</li>
      </ul>
    </li>
    <li>Click "Create and Deploy"</li>
    <li>After deployment, bind custom domain in Cloudflare Workers dashboard</li>
    <li>Configure Cloudflare Email routing to forward emails to your Worker</li>
  </ol>
</div>

#### Option 2: Fork and Custom Deployment via Github Action (Recommended for Advanced Users)

<div style="background-color: #2d2d2d; color: #ffffff; padding: 15px; border-radius: 5px; margin: 15px 0;">
  <h4>✅ Advantages:</h4>
  <ul>
    <li>Can receive subsequent code updates</li>
    <li>Fully customizable configuration</li>
    <li>Better version control</li>
    <li>Automatic deployment via GitHub Actions, more secure and convenient</li>
  </ul>
  
  <h4>❌ Disadvantages:</h4>
  <ul>
    <li>Requires some technical knowledge</li>
    <li>Need to manually create database and configure secrets</li>
  </ul>
  
  <h4>📋 Deployment Steps:</h4>
  <ol>
    <li>Fork this project to your GitHub account</li>
    <li>Create a D1 database in your Cloudflare Dashboard and note down the <strong>database_name</strong> and <strong>database_id</strong></li>
    <li>In your GitHub repository, go to <strong>Settings</strong> > <strong>Secrets and variables</strong> > <strong>Actions</strong></li>
    <li>Click <strong>New repository secret</strong> and add the following seven secrets:
      <ul>
        <li><code>CF_API_TOKEN</code>: Your Cloudflare API Token. You can create one <a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank">here</a> using the "Edit Cloudflare Workers" template.</li>
        <li><code>CF_ACCOUNT_ID</code>: Your Cloudflare Account ID. You can find it on the right side of the Workers page.</li>
        <li><code>D1_DATABASE_ID</code>: The ID of the D1 database you created in step 2.</li>
        <li><code>D1_DATABASE_NAME</code>: The name of the D1 database you created in step 2.</li>
        <li><code>VITE_EMAIL_DOMAIN</code>: Your list of domains, separated by commas (e.g., example.com,test.com).</li>
        <li><code>ADMIN_PASSWORD</code>: Admin panel (<code>/admin</code>) login password for API token and extract-rule management.</li>
        <li><code>MAILCHANNELS_API_KEY</code>: MailChannels Email API key (scope: <code>api</code>) for <code>/api/send</code>.</li>
      </ul>
    </li>
    <li>After completing the steps above, the project will be automatically deployed on every push to the <code>main</code> branch. You can also trigger the deployment manually from the Actions page.</li>
    <li>After deployment, bind a custom domain to your Worker.</li>
    <li>Finally, configure Cloudflare Email Routing to forward emails to your Worker.</li>
  </ol>
</div>

### 📧 Configure Email Routing

Regardless of which deployment method you choose, you need to configure Cloudflare Email routing:

<div style="background-color: #2d2d2d; color: #ffffff; padding: 15px; border-radius: 5px; margin: 15px 0;">
  <ol>
    <li>Find your domain in the Cloudflare dashboard</li>
    <li>Go to "Email" -> "Email Routing"</li>
    <li>Enable Email Routing</li>
    <li>Add routing rules:
      <ul>
        <li>Match type: "Catch-all address"</li>
        <li>Action: "Send to a Worker"</li>
        <li>Select your deployed Worker</li>
      </ul>
    </li>
    <li>If you have multiple domains, repeat the above steps for each domain</li>
  </ol>
</div>

---

## 💻 Local Development

### 🚀 Development

<div style="background-color: #2d2d2d; color: #ffffff; padding: 15px; border-radius: 5px; margin: 15px 0;">

```bash
# install dependencies
pnpm install

# start frontend development server
pnpm dev:frontend

# start backend development server
pnpm dev:backend
```

</div>

### ⚙️ Deployment

<div style="background-color: #2d2d2d; color: #ffffff; padding: 15px; border-radius: 5px; margin: 15px 0;">

```bash
# deploy
pnpm run deploy
```

</div>

---

## 🔧 Tech Stack

<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin: 20px 0;">
  <div>
    <h3>🎨 Frontend</h3>
    <ul>
      <li><strong>React</strong> - UI library</li>
      <li><strong>TypeScript</strong> - Type-safe JavaScript</li>
      <li><strong>Tailwind CSS</strong> - Utility-first CSS framework</li>
      <li><strong>Vite</strong> - Modern frontend build tool</li>
    </ul>
  </div>
  <div>
    <h3>⚙️ Backend</h3>
    <ul>
      <li><strong>Cloudflare Workers</strong> - Edge computing platform</li>
      <li><strong>Cloudflare D1</strong> - Edge SQL database</li>
      <li><strong>Cloudflare Email Workers</strong> - Email processing service</li>
    </ul>
  </div>
</div>

---

## 🔌 Programmatic API

In addition to the Web frontend routes (`/api/mailboxes`, etc.), zMailR exposes Bearer-authenticated APIs for automation: registration flows, OTP retrieval, notifications, and more.

### Obtain an API Token

1. Configure `ADMIN_PASSWORD` in GitHub Secrets or `wrangler.toml`
2. Visit `https://your-domain/admin` and sign in
3. Create a token under **API Tokens** and copy it (shown once)

All programmatic requests require:

```
Authorization: Bearer <your-api-token>
```

### POST /api/lease — Lease a temporary mailbox

Creates a new 24-hour disposable address.

```bash
curl -X POST "https://your-domain/api/lease" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Example response:

```json
{
  "success": true,
  "email": "abc123@example.com",
  "address": "abc123",
  "expiresAt": 1719360000
}
```

### GET /api/mail — Long-poll for incoming mail

Waits for new mail on the given address and returns the auto-extracted verification code.

| Param | Description |
|-------|-------------|
| `to` | Required — full address or local-part |
| `timeout` | Optional — seconds, default 60, max 55 |
| `since` | Optional — Unix timestamp (seconds) for emails received after this time; defaults to poll start when omitted. Emails already returned by `/api/mail` are auto-skipped so repeated polls wait for the next message without manual `since` bumps |
| `require_code` | Optional — default `true`; set `false` to return mail without a code |

```bash
curl "https://your-domain/api/mail?to=abc123@example.com&timeout=60" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Example response:

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

### POST /api/send — Send email

Sends mail via MailChannels from `no-reply@your-domain` (requires DNS setup below).

```bash
curl -X POST "https://your-domain/api/send" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"to":"user@example.com","subject":"Hello","text":"Plain text body"}'
```

### extractedCode on Web API

The standard mailbox endpoints also expose `extractedCode` when present:

- `GET /api/mailboxes/:address/emails`
- `GET /api/emails/:id`

### Python example

```python
import requests

BASE = "https://your-domain"
TOKEN = "YOUR_TOKEN"
headers = {"Authorization": f"Bearer {TOKEN}"}

lease = requests.post(f"{BASE}/api/lease", headers=headers).json()
email = lease["email"]

mail = requests.get(
    f"{BASE}/api/mail",
    headers=headers,
    params={"to": email, "timeout": 60},
    timeout=65,
).json()
print(mail.get("code"))
```

Run `python scripts/verify_api.py --help` locally for E2E checks (`pip install -r requirements-dev.txt`).

---

## 🛠 Admin Panel

Open `https://your-domain/admin` to manage:

- **API Tokens** — create/revoke programmatic API credentials
- **Extract rules** — per-sender-domain regex rules for OTP extraction
- **Sent logs** — audit trail for `/api/send`
- **Stats** — daily receive/send counts and active tokens

### ADMIN_PASSWORD

Set the `ADMIN_PASSWORD` Worker variable:

- **GitHub Actions**: add `ADMIN_PASSWORD` repository secret
- **Manual deploy**: set in `wrangler.toml` `[vars]` or `wrangler secret put ADMIN_PASSWORD`

Without it, admin login and UI token creation are disabled.

---

## 📤 MailChannels outbound mail

`/api/send` uses the [MailChannels Email API](https://www.mailchannels.com/). Since 2024, sending requires an **API key** and **Domain Lockdown DNS** (`auth=`); the legacy `cfid=`-only setup no longer works.

### 1. MailChannels account and API key

1. [Sign up](https://signup.mailchannels.net/pricing/signup?txHandle=email-api-free) (free tier ~100 emails/day)
2. [MailChannels Console](https://dash.mailchannels.net) → create API key (scope: `api`)
3. Save **Account ID** (for DNS `auth=`) and **API key** (GitHub Secret `MAILCHANNELS_API_KEY`)

### 2. DNS (Cloudflare)

| Type | Name | Content | Notes |
|------|------|---------|-------|
| TXT | `_mailchannels` | `v=mc1 auth=YOUR_MAILCHANNELS_ACCOUNT_ID` | Domain Lockdown (do not use `cfid=`) |
| TXT | `@` | `v=spf1 a mx include:relay.mailchannels.net ~all` | Merge into existing SPF if needed |

### 3. Deploy and test

1. Add `MAILCHANNELS_API_KEY` to GitHub Secrets and redeploy
2. Ensure **Email Routing** is enabled on the same domain
3. Test via `/admin` sent logs or `POST /api/send`

> Outbound From address is fixed at `no-reply@your-domain`.

---

## 👥 Contributing

Contributions via Pull Requests or Issues are welcome!

---

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=jia0327/zmailr&type=Date)](https://star-history.com/#jia0327/zmailr&Date)

## 📄 License

[MIT License](./LICENSE)
