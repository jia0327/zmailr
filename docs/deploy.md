# 部署指南

本文档说明如何将 zMailR 部署到 Cloudflare Workers + D1，并通过 GitHub Actions 自动发布。发信（Brevo）与入站收信（Email Routing）为独立配置步骤，见文末链接。

---

## 前置条件

- [Cloudflare](https://dash.cloudflare.com/) 账户
- 已托管在 Cloudflare 的域名（用于 Worker 自定义域名与 Email Routing）
- GitHub 账户（Fork 本仓库并配置 Actions Secrets）
- （可选）[Brevo](https://www.brevo.com/) 账户，用于 `/api/send` 出站发信

---

## 1. Fork 与 D1 数据库

1. Fork [jia0327/zmailr](https://github.com/jia0327/zmailr) 到你的 GitHub 账户。
2. 在 Cloudflare Dashboard → **Workers & Pages** → **D1** → **Create database**。
3. 记录 **database_name** 与 **database_id**（部署 workflow 会写入 `wrangler.toml`）。

首次部署前，本地或 CI 需对 D1 执行迁移（仓库内 `migrations/`）；GitHub Actions 的 `wrangler deploy` 会按 `wrangler.toml` 绑定数据库。

---

## 2. GitHub Actions Secrets

在仓库 **Settings → Secrets and variables → Actions** 中添加：

| Secret | 必填 | 说明 |
|--------|------|------|
| `CF_API_TOKEN` | 是 | Cloudflare API Token（[创建](https://dash.cloudflare.com/profile/api-tokens)，使用 **Edit Cloudflare Workers** 模板，并附加 **Account → R2 → Edit** 以便 CI 自动创建附件 bucket） |
| `CF_ACCOUNT_ID` | 是 | Cloudflare 账户 ID（Workers 页面右侧） |
| `D1_DATABASE_ID` | 是 | D1 数据库 ID |
| `D1_DATABASE_NAME` | 是 | D1 数据库名称 |
| `VITE_EMAIL_DOMAIN` | 是 | 邮箱域名，多个用逗号分隔（如 `example.com,mail.example.com`） |
| `ADMIN_PASSWORD` | 是 | 管理后台登录密码（勿写入代码仓库） |
| `ADMIN_PATH` | 是 | 管理后台 URL 路径段，**推荐 UUID**，无 `/` 前缀（如 `a1b2c3d4-e5f6-7890-abcd-ef1234567890`） |
| `BREVO_API_KEY` | 否 | Brevo Transactional API Key（`xkeysib-...`），未配置时出站发信不可用 |

### `ADMIN_PATH` 要求

- **生产环境必填**：`.github/workflows/deploy.yml` 在 `ADMIN_PATH` 为空时会直接失败。
- 使用 **UUID 或足够随机的字符串**，避免可猜测路径（如 `admin`）。
- 访问 URL：`https://你的域名/{ADMIN_PATH}`。
- 错误路径返回 **404**，不暴露后台是否存在。
- 管理功能说明见 [admin-guide.md](./admin-guide.md)。

### `BREVO_API_KEY`

- 通过 `wrangler secret put BREVO_API_KEY` 上传至 Worker（workflow 自动执行）。
- 若拿到的是 Base64 JSON 而非明文 `xkeysib-...`，需先解码，见 [brevo-setup.md](./brevo-setup.md)。

---

## 3. 触发部署

推送至 **`main`** 分支即触发 [Deploy to Cloudflare](../.github/workflows/deploy.yml)；也可在 Actions 页手动运行 **Deploy to Cloudflare**。

Workflow 主要步骤：

1. `pnpm install` → `pnpm run build`（构建会生成 `frontend/public/openapi.json`，并打包 React 前端）
2. 用 Secrets 替换 `wrangler.toml` 中的 `${D1_*}`、`${VITE_EMAIL_DOMAIN}`、`${ADMIN_PASSWORD}`、`${ADMIN_PATH}` 占位符
3. 若不存在则自动创建 R2 bucket `zmailr-attachments`（与 `wrangler.toml` 一致）
4. （可选）上传 `BREVO_API_KEY` secret
5. `wrangler deploy` 发布 Worker `zmailr`

部署后可通过 `GET /openapi.json` 与 `/api-docs` 查看 API 规范与文档，详见 [user-auth.md](./user-auth.md)。

部署完成后，在 Cloudflare Workers 控制台为 Worker **绑定自定义域名**（如 `zmail.example.com`）。

---

## 4. 入站邮件（Email Routing）

zMailR 通过 Cloudflare **Email Routing** 接收邮件：

1. Cloudflare Dashboard → 你的域名 → **Email** → **Email Routing** → 启用。
2. 添加 **Catch-all** 规则，操作选 **Send to a Worker**，指向已部署的 Worker（`zmailr`）。
3. 若 `VITE_EMAIL_DOMAIN` 配置了多个域名，每个域名需分别启用 Email Routing 并绑定同一 Worker。

Worker 使用 `postal-mime` 解析 MIME，写入 D1，并按提取规则自动识别验证码。

---

## 5. 出站发信（Brevo）

`/api/send` 与 Dashboard 发件箱依赖 Brevo。完整步骤（注册、SPF/DKIM/DMARC、API Key、GitHub Secret）见 **[brevo-setup.md](./brevo-setup.md)**。

---

## 6. R2 附件存储（推荐）

入站邮件附件默认写入 R2，D1 仅存元数据（文件名、MIME、大小、`r2_key`）。历史仅存于 D1 的附件在下载时自动回退读取。

1. GitHub Actions 会在部署前自动创建 bucket `zmailr-attachments`（需 `CF_API_TOKEN` 含 R2 Edit 权限）
2. 也可手动在 Cloudflare Dashboard → **R2** → **Create bucket**，名称须与 `wrangler.toml` 中 `bucket_name` 一致
3. **无需填写 bucket ID**：`wrangler.toml` 仅配置 `binding = "ATTACHMENTS"` 与 `bucket_name`；`wrangler deploy` 会自动绑定 Worker → R2
4. 无需在 GitHub Secrets 中添加 R2 相关项

本地开发：同样创建 bucket（名称 `zmailr-attachments`），`wrangler dev` 会使用 `preview_bucket_name`。

---

## 7. MCP 集成（可选）

若需在 Cursor / Claude Desktop 中通过 AI 助手调用 zMailR API，可配置 npm 包 **`@zmailr/mcp`**。需先在 Dashboard → **API 密钥** 创建 Bearer Token，再设置 `ZMAILR_BASE_URL` 与 `ZMAILR_TOKEN` 环境变量。

完整工具列表与 Cursor 配置见 **[mcp.md](./mcp.md)** 与 [`packages/mcp/README.md`](../packages/mcp/README.md)。MCP 为客户端可选组件，**不影响 Worker 部署**。

---

## 8. 本地开发

1. 复制环境变量模板：

   ```bash
   cp .dev.vars.example .dev.vars
   ```

2. 编辑 `.dev.vars`（**勿提交**）：

   ```env
   ADMIN_PASSWORD=change-me
   ADMIN_PATH=admin
   # BREVO_API_KEY=xkeysib-...   # 可选，本地测发信
   ```

3. 本地 D1 与启动：

   ```bash
   pnpm install   # 自动配置 git hooks（prepare 脚本）
   pnpm run build
   pnpm exec wrangler dev
   ```

   未设置 `ADMIN_PATH` 时，本地管理后台默认为 `http://localhost:8787/admin`。

   本地 OpenAPI：`http://localhost:8787/openapi.json`。

4. 前端热更新（可选）：

   ```bash
   cd frontend && pnpm dev
   ```

---

## 9. 部署后验证

1. 访问 `https://你的域名/login`，创建用户或使用管理后台创建账号。
2. 在 Dashboard → **API 密钥** 创建 Bearer Token（所有程序化 API 均需 Bearer，不支持匿名）。
3. 确认 `https://你的域名/openapi.json` 与 `/api-docs` 可访问。
4. 运行 API 验证脚本（将 `<token>` 与域名替换为你的值）：

   ```bash
   pip install requests
   python scripts/verify_api.py \
     --base-url https://你的域名 \
     --token <your-bearer-token> \
     --send-test
   ```

5. 管理后台：`https://你的域名/{ADMIN_PATH}`，使用 `ADMIN_PASSWORD` 登录。
6. （可选）按 [mcp.md](./mcp.md) 配置 `@zmailr/mcp` 供 Cursor 使用。

---

## 相关文档

| 文档 | 说明 |
|------|------|
| [admin-guide.md](./admin-guide.md) | 管理后台、维护模式、限流监控、审计日志 |
| [brevo-setup.md](./brevo-setup.md) | Brevo 发信与 DNS 配置 |
| [user-auth.md](./user-auth.md) | 用户登录、API Token scope、per-user 速率限制 |
| [mcp.md](./mcp.md) | MCP 集成（`@zmailr/mcp`） |
| [mailsink-comparison.md](./mailsink-comparison.md) | 与 MailSink 功能对照 |
| [../README.md](../README.md) | 项目简介与效果图 |
