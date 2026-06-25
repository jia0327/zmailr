# <div align="center">zMailR</div>

<div align="center">
  <p><strong>24 小时临时邮箱服务</strong></p>

  <p>
    <a href="https://github.com/jia0327/zmailr/stargazers"><img src="https://img.shields.io/github/stars/jia0327/zmailr?style=social" alt="GitHub stars"></a>
    <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="MIT License"></a>
    <a href="https://workers.cloudflare.com/"><img src="https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white" alt="Cloudflare Workers"></a>
    <a href="https://zmailr.itool.eu.cc/"><img src="https://img.shields.io/badge/demo-zmailr.itool.eu.cc-blue" alt="Live Demo"></a>
  </p>

  <p><strong>Enhanced fork of <a href="https://github.com/zaunist/zmail">zaunist/zmail</a></strong>（MIT License）</p>

  <p>
    <a href="https://zmailr.itool.eu.cc/" target="_blank"><strong>在线体验</strong></a>
    ·
    <a href="./README.en.md">English</a>
    ·
    <a href="docs/deploy.md"><strong>部署指南</strong></a>
  </p>
</div>

---

## 项目简介

**zMailR** 是基于 Cloudflare Workers + D1 部署的**开源、可自托管**临时邮箱服务。用户可在 Web 界面一键生成 24 小时有效地址并实时收信；开发者通过 Bearer Token 完成「租用邮箱 → 长轮询收信 → 提取验证码 → 可选 Brevo 发信」。定位类似 [MailSink](https://mailsink.dev/docs/) 的收信与 OTP 自动化，但以自托管与出站发信为差异化。

**技术栈**：Cloudflare Workers、D1、Email Routing（入站）、Brevo Transactional API（出站）、React + Vite 前端。

**在线演示**：[https://zmailr.itool.eu.cc/](https://zmailr.itool.eu.cc/) · 演示账号 `guest` / `guest`

---

## 功能亮点

- **Web 控制台**：临时邮箱、收件箱/发件箱、验证码高亮（OtpBox）、明暗主题、简体中文界面
- **程序化 API**：`lease` / `mail` / `send` scope 的 Bearer Token，长轮询收信与 OTP 提取
- **提取规则**：系统内置 + 用户自定义，按发件人域名匹配正则
- **管理后台**：用户治理、公告、限流监控、维护模式、审计日志（路径由 `ADMIN_PATH` 配置）
- **GitHub Actions**：推送 `main` 自动部署至 Cloudflare Workers

完整 API 列表与限流说明见部署后的 [`/api-docs`](https://zmailr.itool.eu.cc/api-docs) 或 [user-auth.md](docs/user-auth.md)。

---

## 效果图

以下截图来自生产环境 [zmailr.itool.eu.cc](https://zmailr.itool.eu.cc/) 的 E2E 实测（2026-06-26）。完整测试报告见 [docs/testing.md](docs/testing.md)。

### 用户端

#### 登录

![登录页 — guest 账号入口](docs/screenshots/login.png)

#### 系统公告

登录后弹出未读公告，支持逐条确认与「全部标记已读」。

![公告弹窗 — 验证 E2E 测试公告展示与已读流程](docs/screenshots/announcement-modal.png)

#### 仪表板

![仪表板 — API Token 状态、收件/发件用量与今日发信配额](docs/screenshots/dashboard.png)

#### 收件箱

新建 24 小时临时地址；收信后 OTP 列自动高亮。

![新建收件箱 — 点击「新建收件箱」生成地址](docs/screenshots/inbox-new-mailbox.png)

![收信与 OTP — 向下滚动至邮件列表，POST /api/send 测试邮件到达，验证码 847291 高亮](docs/screenshots/inbox-with-otp.png)

#### 发件箱

![发件箱撰写 — 填写收件人/主题/正文（Brevo 出站）](docs/screenshots/outbox-send.png)

![发信记录 — 已发送列表与今日配额计数](docs/screenshots/outbox-sent.png)

#### API 密钥

![Token 创建 — 删除并重新创建后一次性展示明文 Bearer Token](docs/screenshots/api-keys-create.png)

每位用户限 1 个 Bearer Token，可选 `lease` / `mail` / `send` scope，含 curl 示例。

#### API 调试

![API 调试 — GET /api/user/quota 返回 200 与速率限制头](docs/screenshots/api-debug-response.png)

浏览器内直接调用 Bearer API，查看 JSON 响应与 `x-ratelimit-*` 头。

#### 提取规则

![自定义提取规则 — 按域名 zmailr.itool.eu.cc 配置 OTP 正则](docs/screenshots/extract-rules-custom.png)

系统内置规则（只读）与用户自定义规则（按域名优先级匹配）。

---

### 管理后台

管理后台 URL 为 `https://你的域名/{ADMIN_PATH}`，需配置 `ADMIN_PASSWORD` 登录。详见 [admin-guide.md](docs/admin-guide.md)。

#### 登录

![管理后台登录](docs/screenshots/admin-login.png)

#### 仪表盘

![管理后台仪表盘 — 用户/邮箱/收发信统计与 Brevo 套餐信息](docs/screenshots/admin-dashboard.png)

#### 公告

![创建公告 — 新增 E2E 测试公告表单（标题/内容/启用）](docs/screenshots/admin-announcement-create.png)

![公告列表 — 「测试」公告启用，已读 1 人](docs/screenshots/admin-announcements-list.png)

#### 用户管理

![管理后台用户](docs/screenshots/admin-users.png)

创建/编辑用户、日发信配额与速率方案（Free / Pro / Team）。

#### 提取规则（管理）

![管理后台提取规则](docs/screenshots/admin-rules.png)

全局内置规则与所有用户自定义规则汇总。

#### 限流监控

![管理后台限流监控](docs/screenshots/admin-ratelimit.png)

今日 429 次数、Top IP / Top 用户排行。

#### 系统设置

![管理后台系统设置](docs/screenshots/admin-settings.png)

维护模式：可选阻断 lease、发信、创建邮箱等 API。

#### 审计日志

![管理后台审计日志](docs/screenshots/admin-audit.png)

管理员与用户关键操作记录，按日期筛选。

---

## 使用指南（简要）

### 用户端

1. 访问演示站或自托管实例，使用账号登录（演示：`guest` / `guest`）。
2. 若有未读**系统公告**，在弹窗中阅读并标记已读。
3. 在 **仪表板** 查看配额；若无 API Token，在 **API 密钥** 创建（明文仅显示一次）。
4. 在 **收件箱** 点击「新建收件箱」生成临时地址；可配合 `POST /api/send` 或外部发信测试收信。
5. 在 **发件箱** 发送测试邮件（需配置 Brevo，见 [brevo-setup.md](docs/brevo-setup.md)）。
6. 在 **提取规则** 按发件人域名添加 OTP 正则；未匹配时回退到内置规则。
7. 使用 **API 调试** 或 curl 调用程序化接口；完整流程可用 `scripts/verify_api.py` 验证。

### 管理后台

1. 访问 `https://你的域名/{ADMIN_PATH}`，输入 `ADMIN_PASSWORD` 登录。
2. 在 **公告** 创建/启用面向用户的系统公告（Markdown/纯文本）。
3. 在 **用户** 管理账号、日发信配额与速率方案。
4. 在 **系统设置** 按需开启维护模式；在 **审计日志** 查看操作记录。

---

## 文档导航

| 文档 | 说明 |
|------|------|
| [docs/deploy.md](docs/deploy.md) | **部署指南**（D1、GitHub Secrets、Email Routing、本地开发） |
| [docs/admin-guide.md](docs/admin-guide.md) | 管理后台（`ADMIN_PATH`、用户、维护模式、审计日志） |
| [docs/brevo-setup.md](docs/brevo-setup.md) | Brevo 出站发信与 DNS（SPF/DKIM/DMARC） |
| [docs/user-auth.md](docs/user-auth.md) | 用户认证、API Token scope、per-user 速率限制 |
| [docs/testing.md](docs/testing.md) | **生产 E2E 测试报告**（Pass/Fail 与截图索引） |
| [docs/mailsink-comparison.md](docs/mailsink-comparison.md) | 与 MailSink 功能对照与端点映射 |
| [README.en.md](README.en.md) | English README |

---

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=jia0327/zmailr&type=Date)](https://star-history.com/#jia0327/zmailr&Date)

---

## 许可证

[MIT License](./LICENSE)
