# <div align="center">zMailR</div>

<div align="center">
  <p>
    <a href="https://github.com/jia0327/zmailr/stargazers"><img src="https://img.shields.io/github/stars/jia0327/zmailr?style=social" alt="GitHub stars"></a>
    <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="MIT License"></a>
    <a href="https://workers.cloudflare.com/"><img src="https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white" alt="Cloudflare Workers"></a>
    <a href="https://zmailr.itool.eu.cc/"><img src="https://img.shields.io/badge/demo-zmailr.itool.eu.cc-blue" alt="Live Demo"></a>
  </p>


  <p>
    <a href="https://zmailr.itool.eu.cc/" target="_blank"><strong>在线体验</strong></a>
    ·
    <a href="./README.en.md">English</a>
    ·
    <a href="docs/README.md"><strong>文档</strong></a>
  </p>
</div>

---

## 一句话介绍

**开源、可自托管的 24 小时临时邮箱与 OTP 自动化平台——Web 控制台收信发信，Bearer API 对接脚本与 CI。**

---

## 项目简介

**技术栈**：Cloudflare Workers、D1、Email Routing（入站）、Brevo Transactional API（出站）、React + Vite 前端。

**在线演示**：[https://zmailr.itool.eu.cc/](https://zmailr.itool.eu.cc/) · 演示账号 `guest` / `guest`

---

## 实现的功能

### Web 端

- **登录与会话**：用户名密码登录，受保护的路由与登出
- **仪表板**：API Token 状态与提醒（无 Token / 即将过期横幅）、收件/发件用量、今日发信配额
- **收件箱 / 发件箱**：新建 24 小时临时地址、收信列表、OTP 高亮（OtpBox）、**下载原始 .eml / 复制纯文本**、**附件列表/预览/下载**（Session 鉴权）、Brevo 出站撰写（**纯文本 / 富文本** Tab）、出站附件、发信记录与**详情弹窗**（含失败重发）
- **邮箱历史**：已过期/历史邮箱列表，支持批量删除
- **邮件批量删除**：收件箱与发件箱多选删除
- **API 密钥**：每位用户 1 个 Bearer Token，可选 `lease` / `mail` / `send` scope，含 curl 示例；明文仅创建时展示一次，浏览器可本地保存脱敏预览
- **API 调试**：浏览器内调用 Bearer API，查看 JSON 响应与 `x-ratelimit-*` 头
- **提取规则**：系统内置（只读）+ 用户自定义（按发件人域名优先级匹配），支持备注字段
- **系统公告**：登录后未读公告弹窗，逐条确认或全部标记已读
- **明暗主题**、**移动端响应式**侧边栏布局
- **简体中文界面**（zh-CN only）

### 程序化 API

- **`POST /api/lease`**：租用临时邮箱（长轮询可选）
- **`GET /api/mail`**：拉取邮件与 OTP 提取结果
- **`POST /api/send`**：Brevo 出站发信
- **`GET /api/user/quota`**：配额与用量查询
- **OpenAPI**：[`/openapi.json`](https://zmailr.itool.eu.cc/openapi.json) 机器可读规范（`pnpm run build` 生成 `frontend/public/openapi.json`）
- **MCP**：[`@zmailr/mcp`](https://www.npmjs.com/package/@zmailr/mcp) npm 包（`npx @zmailr/mcp`，Cursor / Claude Desktop），详见 [docs/mcp.md](docs/mcp.md)
- **Bearer Token 认证**（`Authorization: Bearer <token>`）；**不支持匿名 API**
- **速率限制响应头**：`x-ratelimit-limit` / `remaining` / `reset`

完整 API 列表与限流说明见 [docs/api.md](docs/api.md)、部署后的 [`/api-docs`](https://zmailr.itool.eu.cc/api-docs)（含 [`/openapi.json`](https://zmailr.itool.eu.cc/openapi.json)）或 [user-auth.md](docs/user-auth.md)。

### OTP 提取规则

- **系统内置规则**：常见服务商 OTP 正则（只读）
- **全局规则**：管理后台维护，对所有用户生效
- **用户自定义规则**：按发件人域名配置正则，支持**备注**字段说明用途

### 管理后台

访问路径 `https://你的域名/{ADMIN_PATH}`，需 `ADMIN_PASSWORD` 登录。详见 [admin-guide.md](docs/admin-guide.md)。

- **密钥路径**：`ADMIN_PATH` 环境变量配置，隐藏管理入口
- **用户管理**：创建/编辑用户、禁用账号、日发信配额
- **速率方案**：每用户 Free / Pro / Team 档位（独立 RPM 与 burst）
- **公告管理**：创建/启用/停用面向用户的系统公告
- **提取规则**：全局内置规则 + 所有用户自定义规则汇总
- **系统健康**：D1 / R2 / Brevo 依赖探测（`GET /api/public/status`）
- **请求监控**：近 7 日请求趋势图、状态码分布、Top 路由、今日 429 与 Top IP / 用户排行
- **维护模式**：可选阻断 lease、发信、创建邮箱等 API
- **审计日志**：管理员与用户关键操作，按日期筛选
- **Brevo 统计**：出站套餐用量与发信配额概览

### 运维与部署

- **GitHub Actions**：推送 `main` 自动构建并部署至 Cloudflare Workers
- **Cloudflare D1**：用户、邮箱、邮件、规则、审计等持久化
- **R2 附件**：入站附件存 `zmailr-attachments` bucket（`ATTACHMENTS` 绑定）；D1 存元数据，历史 D1 附件可回退读取
- **依赖健康检查**：公开 `GET /api/public/status` 探测 D1/R2/Brevo，聚合 `ok` / `degraded` / `error`；**D1 备份**见 [docs/backup.md](docs/backup.md)
- **文档站**：[`/docs/`](https://zmailr.itool.eu.cc/docs/)（VitePress）、[`/docs/api-interactive`](https://zmailr.itool.eu.cc/docs/api-interactive) 交互式 API 文档
- **Brevo 出站**：Transactional API 发信，SPF/DKIM/DMARC 见 [brevo-setup.md](docs/brevo-setup.md)

---

## 效果图

以下截图来自生产环境 [zmailr.itool.eu.cc](https://zmailr.itool.eu.cc/) 的 E2E 实测（2026-06-26）。完整测试报告见 [docs/testing.md](docs/testing.md)。

### 用户端

#### 登录

![登录页 — guest 账号入口](docs/screenshots/login.png)

#### 仪表板

<img width="1798" height="810" alt="image" src="https://github.com/user-attachments/assets/c84bd5fc-4e16-4e05-9547-6bf23681e981" />



#### 收件箱

新建 24 小时临时地址；收信后 OTP 列自动高亮。

![新建收件箱 — 点击「新建收件箱」生成地址](docs/screenshots/inbox-new-mailbox.png)

![收信与 OTP — 向下滚动至邮件列表，POST /api/send 测试邮件到达，验证码 847291 高亮](docs/screenshots/inbox-with-otp.png)

![收件箱历史 — 邮箱历史列表与分页](docs/screenshots/inbox.png)

#### 发件箱

![发件箱撰写 — 填写收件人/主题/正文（Brevo 出站）](docs/screenshots/outbox-send.png)

![富文本撰写 — 纯文本 / 富文本 Tab 切换](docs/screenshots/outbox-rich-text.png)

![发信记录 — 已发送列表与今日配额计数](docs/screenshots/outbox-sent.png)

![发信详情 — 详情弹窗与发信元数据](docs/screenshots/outbox-sent-detail.png)

#### API 密钥

![Token 创建 — 删除并重新创建后一次性展示明文 Bearer Token](docs/screenshots/api-keys-create.png)

每位用户限 1 个 Bearer Token，可选 `lease` / `mail` / `send` scope，含 curl 示例。

#### API 调试

![API 调试 — GET /api/user/quota 返回 200 与速率限制头](docs/screenshots/api-debug-response.png)

浏览器内直接调用 Bearer API，查看 JSON 响应与 `x-ratelimit-*` 头。

#### 提取规则

![自定义提取规则 — 按域名 zmailr.itool.eu.cc 配置 OTP 正则](docs/screenshots/extract-rules-custom.png)

系统内置规则（只读）与用户自定义规则（按域名优先级匹配）。

#### 文档站

![文档首页 — VitePress 文档站 `/docs/`](docs/screenshots/docs-home.png)

![交互式 API 文档 — `/docs/api-interactive`](docs/screenshots/api-interactive.png)

---

### 管理后台

管理后台 URL 为 `https://你的域名/{ADMIN_PATH}`，需配置 `ADMIN_PASSWORD` 登录。详见 [admin-guide.md](docs/admin-guide.md)。

#### 登录

![管理后台登录](docs/screenshots/admin-login.png)

#### 仪表盘

<img width="1542" height="791" alt="image" src="https://github.com/user-attachments/assets/6cf7513d-77e5-4ad7-b6ce-2b25d5fb4c5f" />

#### 公告

![创建公告 — 新增 E2E 测试公告表单（标题/内容/启用）](docs/screenshots/admin-announcement-create.png)

![公告列表 — 「测试」公告启用，已读 1 人](docs/screenshots/admin-announcements-list.png)

#### 用户管理

![管理后台用户](docs/screenshots/admin-users.png)

创建/编辑用户、日发信配额与速率方案（Free / Pro / Team）。

#### 提取规则（管理）

![管理后台提取规则](docs/screenshots/admin-rules.png)

全局内置规则与所有用户自定义规则汇总。

#### 请求监控
![管理后台请求监控 — 近 7 日趋势、状态码分布、429 Top IP/用户]<img width="1545" height="836" alt="image" src="https://github.com/user-attachments/assets/ff03d0bd-e17f-40c8-bd49-37091ffd1643" />


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
3. 在 **仪表板** 查看配额；若无 API Token，按横幅提醒在 **API 密钥** 创建（明文仅显示一次）。
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

完整分类索引见 **[docs/README.md](docs/README.md)**。

| 分类 | 文档 | 说明 |
|------|------|------|
| 快速开始 | [docs/README.md](docs/README.md) | 体验演示 → 部署 → 验证 API |
| API 参考 | [docs/api.md](docs/api.md) | 端点一览、认证、速率限制、curl 示例 |
| | [docs/user-auth.md](docs/user-auth.md) | Session / Bearer、Token scope、提取规则、OpenAPI |
| MCP | [docs/mcp.md](docs/mcp.md) | `@zmailr/mcp`、Cursor 配置 |
| 部署 | [docs/deploy.md](docs/deploy.md) | D1、GitHub Secrets、Email Routing、R2、本地开发 |
| 管理后台 | [docs/admin-guide.md](docs/admin-guide.md) | `ADMIN_PATH`、用户、维护模式、审计日志 |
| 集成 | [docs/brevo-setup.md](docs/brevo-setup.md) | Brevo 出站发信与 DNS |
| 测试 | [docs/testing.md](docs/testing.md) | 生产 E2E 测试报告 |
| 其他 | [README.en.md](README.en.md) | English README |

---

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=jia0327/zmailr&type=Date)](https://star-history.com/#jia0327/zmailr&Date)

---

## 许可证

[MIT License](./LICENSE)
