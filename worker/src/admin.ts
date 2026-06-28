export function getAdminHtml(adminBase: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>zMailR 管理后台</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;background:#0c0a09;color:#e2e8f0;min-height:100vh;position:relative}
body::before{content:'';position:fixed;inset:0;pointer-events:none;z-index:0;background:radial-gradient(ellipse 70% 55% at 15% 35%,rgba(14,165,233,.12),transparent),radial-gradient(ellipse 55% 45% at 85% 72%,rgba(168,85,247,.08),transparent)}
.login-wrap,.app{position:relative;z-index:1}
.login-wrap{display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}
.login-box{background:#18181b;padding:32px;border-radius:16px;width:100%;max-width:400px;border:1px solid #27272a;box-shadow:0 8px 32px rgba(0,0,0,.35)}
.login-brand{display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:20px}
.login-brand-icon{width:36px;height:36px;border-radius:10px;background:rgba(14,165,233,.15);display:flex;align-items:center;justify-content:center;color:#38bdf8;font-size:1rem}
.login-box h1{font-size:1.35rem;text-align:center;color:#f8fafc;font-weight:700}
.login-box input{width:100%;padding:12px 16px;border:1px solid #3f3f46;border-radius:10px;background:#0c0a09;color:#e2e8f0;margin-bottom:16px;font-size:1rem}
.login-box input:focus{outline:none;border-color:#0ea5e9;box-shadow:0 0 0 2px rgba(14,165,233,.25)}
.login-turnstile{display:flex;justify-content:center;margin-bottom:16px;min-height:65px}
.login-box button{width:100%;padding:12px;background:#0ea5e9;color:#fff;border:none;border-radius:10px;font-size:1rem;font-weight:600;cursor:pointer;box-shadow:0 4px 14px rgba(14,165,233,.25)}
.login-box button:hover{background:#38bdf8}
.error{color:#f87171;font-size:.875rem;margin-bottom:12px;display:none}
.app{display:none;max-width:1200px;margin:0 auto;padding:24px}
header{display:flex;justify-content:space-between;align-items:center;margin-bottom:28px;padding-bottom:16px;border-bottom:1px solid #27272a}
header h1{font-size:1.35rem;color:#f8fafc;font-weight:700;display:flex;align-items:center;gap:10px}
.header-brand-icon{width:32px;height:32px;border-radius:8px;background:rgba(14,165,233,.15);display:flex;align-items:center;justify-content:center;color:#38bdf8;font-size:.875rem}
.logout{background:#27272a;color:#e2e8f0;border:1px solid #3f3f46;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:.875rem}
.logout:hover{background:#3f3f46}
.tabs{display:flex;gap:8px;margin-bottom:24px;flex-wrap:wrap}
.tab{padding:10px 18px;background:#18181b;border:1px solid #27272a;border-radius:10px;cursor:pointer;color:#a1a1aa;font-size:.875rem;transition:background .15s,color .15s}
.tab:hover{color:#e2e8f0;background:#27272a}
.tab.active{background:rgba(14,165,233,.18);border-color:rgba(14,165,233,.45);color:#38bdf8;font-weight:600}
.panel{display:none;background:#18181b;border-radius:16px;padding:24px;border:1px solid #27272a;box-shadow:0 1px 3px rgba(0,0,0,.2)}
.panel.active{display:block}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:24px}
.stat{background:#0c0a09;padding:20px;border-radius:12px;border:1px solid #27272a;transition:box-shadow .15s}
.stat:hover{box-shadow:0 4px 12px rgba(0,0,0,.25)}
.stat .label{font-size:.75rem;color:#a1a1aa;margin-bottom:8px;font-weight:500}
.stat .value{font-size:2rem;font-weight:700;color:#38bdf8}
.toolbar{display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;align-items:center}
.btn{padding:8px 16px;background:#0ea5e9;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.875rem;font-weight:500}
.btn:hover{background:#38bdf8}
.btn-danger{background:#dc2626}
.btn-danger:hover{background:#b91c1c}
.btn-sm{padding:4px 10px;font-size:.75rem}
table{width:100%;border-collapse:collapse;font-size:.875rem}
th,td{padding:10px 12px;text-align:left;border-bottom:1px solid #27272a}
th{color:#a1a1aa;font-weight:600}
td code{font-size:.75rem;background:#0c0a09;padding:2px 6px;border-radius:4px;word-break:break-all}
.badge{display:inline-block;padding:2px 8px;border-radius:9999px;font-size:.75rem}
.badge-ok{background:#14532d;color:#86efac}
.badge-off{background:#7f1d1d;color:#fca5a5}
.badge-builtin{background:#0c4a6e;color:#7dd3fc}
.badge-warn{background:#713f12;color:#fcd34d}
.section-title{font-size:1rem;color:#f8fafc;margin-bottom:8px;font-weight:600}
.section-desc{font-size:.75rem;color:#71717a;margin-bottom:12px}
.section-title+.section-desc{margin-top:-4px}
.modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:100;padding:20px;overflow-y:auto;-webkit-overflow-scrolling:touch}
.modal.show{display:block}
.modal-box{background:#18181b;padding:24px;border-radius:16px;width:100%;max-width:480px;border:1px solid #27272a;margin:0 auto;max-height:calc(100dvh - 40px);overflow-y:auto}
.modal-box h3{margin-bottom:16px;color:#f8fafc}
.form-group{margin-bottom:12px}
.form-group label{display:block;font-size:.75rem;color:#a1a1aa;margin-bottom:4px}
.form-group input,.form-group textarea,.form-group select{width:100%;padding:8px 12px;border:1px solid #3f3f46;border-radius:8px;background:#0c0a09;color:#e2e8f0;font-size:.875rem}
.form-group textarea{min-height:80px;font-family:monospace}
.form-group textarea.content-area{min-height:160px;font-family:inherit;white-space:pre-wrap}
.modal-actions{display:flex;gap:8px;margin-top:16px;justify-content:flex-end;position:sticky;bottom:0;padding-top:12px;background:inherit;border-top:1px solid #27272a}
.form-group input[type=checkbox]{width:auto;margin-right:8px}
.pagination{display:flex;gap:8px;align-items:center;margin-top:16px;flex-wrap:wrap}
.pagination span{font-size:.875rem;color:#a1a1aa}
.banner-warn{background:#422006;border:1px solid #92400e;color:#fcd34d;padding:12px 16px;border-radius:10px;margin-bottom:16px;font-size:.875rem}
.grid-2{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin-bottom:24px}
.card{background:#0c0a09;padding:16px;border-radius:12px;border:1px solid #27272a}
.card h4{font-size:.875rem;color:#f8fafc;margin-bottom:12px}
.hint{font-size:.75rem;color:#71717a;margin-top:8px}
.chart-wrap{background:#0c0a09;border:1px solid #27272a;border-radius:12px;padding:16px;margin-bottom:24px}
.chart-title{font-size:.875rem;color:#f8fafc;margin-bottom:12px}
.chart-canvas{width:100%;height:280px;display:block}
.chart-legend{display:flex;flex-wrap:wrap;gap:12px 20px;margin-top:12px;font-size:.75rem;color:#a1a1aa}
.chart-legend-item{display:flex;align-items:center;gap:6px;cursor:pointer;user-select:none}
.chart-legend-item.off{opacity:.35}
.chart-legend-swatch{width:12px;height:3px;border-radius:2px}
.chart-empty{text-align:center;color:#71717a;padding:48px 16px;font-size:.875rem}
html.light body{background:#f0f9ff;color:#1e293b}
html.light body::before{background:radial-gradient(ellipse 70% 55% at 15% 35%,rgba(14,165,233,.22),transparent),radial-gradient(ellipse 55% 45% at 85% 72%,rgba(168,85,247,.1),transparent)}
html.light .login-box{background:#fff;border-color:#bae6fd;box-shadow:0 8px 32px rgba(14,165,233,.12)}
html.light .login-box h1{color:#0f172a}
html.light .login-brand-icon{background:rgba(14,165,233,.12);color:#0284c7}
html.light .login-box input{border-color:#bae6fd;background:#f8fafc;color:#1e293b}
html.light .login-box button{box-shadow:0 4px 14px rgba(14,165,233,.2)}
html.light header{border-bottom-color:#bae6fd}
html.light header h1{color:#0f172a}
html.light .header-brand-icon{background:rgba(14,165,233,.12);color:#0284c7}
html.light .logout{background:#f0f9ff;color:#334155;border-color:#bae6fd}
html.light .logout:hover{background:#e0f2fe}
html.light .tab{background:#fff;border-color:#bae6fd;color:#64748b}
html.light .tab:hover{color:#0f172a;background:#f0f9ff}
html.light .tab.active{background:rgba(14,165,233,.14);border-color:rgba(14,165,233,.45);color:#0284c7}
html.light .panel{background:#fff;border-color:#bae6fd;box-shadow:0 4px 24px rgba(14,165,233,.08)}
html.light .stat{background:#f8fafc;border-color:#bae6fd}
html.light .stat:hover{box-shadow:0 4px 12px rgba(14,165,233,.1)}
html.light .stat .label{color:#64748b}
html.light .stat .value{color:#0284c7}
html.light th,html.light td{border-bottom-color:#e0f2fe}
html.light th{color:#64748b}
html.light td code{background:#f0f9ff}
html.light .section-title,html.light .card h4,html.light .modal-box h3,html.light .chart-title{color:#0f172a}
html.light .section-desc,html.light .hint,html.light .pagination span,html.light .chart-legend{color:#64748b}
html.light .modal-box{background:#fff;border-color:#bae6fd}
html.light .modal-actions{border-top-color:#bae6fd}
html.light .form-group input,html.light .form-group textarea,html.light .form-group select{border-color:#bae6fd;background:#f8fafc;color:#1e293b}
html.light .card,html.light .chart-wrap{background:#f8fafc;border-color:#bae6fd}
html.light .chart-empty{color:#94a3b8}
</style>
</head>
<body>
<div id="loginView" class="login-wrap">
  <div class="login-box">
    <div class="login-brand">
      <span class="login-brand-icon">✉</span>
      <h1>zMailR 管理后台</h1>
    </div>
    <div id="loginError" class="error"></div>
    <input type="password" id="passwordInput" placeholder="管理员密码" autocomplete="current-password">
    <div id="turnstileLogin" class="login-turnstile"></div>
    <button data-action="doLogin">登录</button>
  </div>
</div>
<div id="appView" class="app">
  <header>
    <h1><span class="header-brand-icon">✉</span> zMailR 管理后台</h1>
    <button class="logout" data-action="doLogout">退出登录</button>
  </header>
  <div class="tabs">
    <div class="tab active" data-tab="dashboard" >仪表盘</div>
    <div class="tab" data-tab="users" >用户</div>
    <div class="tab" data-tab="announcements" >公告</div>
    <div class="tab" data-tab="rules" >提取规则</div>
    <div class="tab" data-tab="ratelimit" >请求监控</div>
    <div class="tab" data-tab="domains" >域名</div>
    <div class="tab" data-tab="settings" >系统设置</div>
    <div class="tab" data-tab="audit" >审计日志</div>
  </div>
  <div id="panel-dashboard" class="panel active">
    <div id="maintBanner" class="banner-warn" style="display:none"></div>
    <h3 class="section-title">系统健康</h3>
    <p class="section-desc">D1 / R2 / Brevo 依赖探测（GET /api/public/status）</p>
    <div class="toolbar" style="margin-bottom:12px">
      <button class="btn btn-sm" data-action="loadHealthStatus">刷新状态</button>
    </div>
    <div class="stats" id="healthGrid"></div>
    <p class="hint" id="healthHint"></p>
    <h3 class="section-title" style="margin-top:24px">运营统计</h3>
    <div class="stats" id="statsGrid"></div>
    <h3 class="section-title" style="margin-top:8px">Brevo / 发信</h3>
    <p class="section-desc">本地 sent_emails 统计；若配置了 BREVO_API_KEY 则尝试 GET /v3/account 获取套餐信息</p>
    <div class="stats" id="brevoStatsGrid"></div>
    <p class="hint" id="brevoHint"></p>
  </div>
  <div id="panel-users" class="panel">
    <div class="card" style="margin-bottom:24px">
      <h3 class="section-title">用户注册</h3>
      <p class="section-desc">开启后，用户可使用腾讯/网易/Gmail/iCloud/Outlook/搜狐等知名邮箱自助注册；验证码由系统通过 Brevo 发信</p>
      <div class="form-group"><label><input type="checkbox" id="regEnabled"> 开放用户注册</label></div>
      <button class="btn btn-sm" data-action="saveRegistration">保存注册设置</button>
    </div>
    <div class="toolbar">
      <button class="btn" data-action="showUserModal">新增用户</button>
    </div>
    <table><thead><tr><th>ID</th><th>用户名</th><th>角色</th><th>发信配额</th><th>随机邮箱配额</th><th>速率限制</th><th>状态</th><th>操作</th></tr></thead><tbody id="usersBody"></tbody></table>
  </div>
  <div id="panel-announcements" class="panel">
    <div class="toolbar">
      <button class="btn" data-action="showAnnouncementModal">新增公告</button>
    </div>
    <table><thead><tr><th>ID</th><th>标题</th><th>创建时间</th><th>状态</th><th>已读人数</th><th>操作</th></tr></thead><tbody id="announcementsBody"></tbody></table>
  </div>
  <div id="panel-rules" class="panel">
    <h3 class="section-title">规则市场审核</h3>
    <p class="section-desc">用户发布的提取规则模板；通过后会在 Dashboard 规则市场展示，按域名分类供他人安装</p>
    <div class="toolbar">
      <button class="btn btn-sm" data-tfilter="pending" data-action="setTemplateFilter" data-filter="pending">待审核</button>
      <button class="btn btn-sm" data-tfilter="approved" data-action="setTemplateFilter" data-filter="approved">已通过</button>
      <button class="btn btn-sm" data-tfilter="rejected" data-action="setTemplateFilter" data-filter="rejected">已拒绝</button>
      <button class="btn btn-sm" data-tfilter="all" data-action="setTemplateFilter" data-filter="all">全部</button>
      <button class="btn btn-sm" data-action="loadRuleTemplates">刷新</button>
    </div>
    <table><thead><tr><th>ID</th><th>标题</th><th>域名</th><th>正则</th><th>作者</th><th>状态</th><th>安装</th><th>操作</th></tr></thead><tbody id="ruleTemplatesBody"></tbody></table>
    <hr style="border:none;border-top:1px solid #27272a;margin:24px 0">
    <h3 class="section-title">用样例邮件试跑</h3>
    <p class="section-desc">按当前启用规则顺序试匹配，便于调试正则与优先级</p>
    <div class="card" style="margin-bottom:24px">
      <div class="grid-2">
        <div class="form-group"><label>发件人</label><input id="testRunFrom" placeholder="noreply@npmjs.com"></div>
        <div class="form-group"><label>主题</label><input id="testRunSubject" placeholder="Your npm OTP"></div>
      </div>
      <div class="form-group"><label>正文</label><textarea id="testRunText" class="content-area" placeholder="The OTP code is: 123456"></textarea></div>
      <div class="form-group"><label>用户 ID（可选，模拟该用户的个人规则）</label><input id="testRunUserId" type="number" placeholder="留空则仅全局规则"></div>
      <div class="toolbar" style="margin-bottom:0">
        <button class="btn" data-action="runExtractTest">试跑</button>
        <span id="testRunSummary" class="hint"></span>
      </div>
      <table style="margin-top:16px"><thead><tr><th>顺序</th><th>ID</th><th>域名</th><th>优先级</th><th>正则</th><th>匹配</th><th>提取结果</th><th>备注</th></tr></thead><tbody id="testRunBody"><tr><td colspan="8" class="empty">填写样例邮件后点击试跑</td></tr></tbody></table>
    </div>
    <h3 class="section-title">系统内置规则</h3>
    <p class="section-desc">系统级规则，对所有用户生效；可新增、编辑、删除</p>
    <div class="toolbar">
      <button class="btn" data-action="showRuleModal">新增规则</button>
    </div>
    <table><thead><tr><th>ID</th><th>域名</th><th>正则</th><th>优先级</th><th>状态</th><th>备注</th><th>操作</th></tr></thead><tbody id="rulesBody"></tbody></table>
    <h3 class="section-title" style="margin-top:24px">所有用户自定义规则</h3>
    <p class="section-desc">汇总展示所有用户创建的规则，便于参考优质规则并提升平台提取能力</p>
    <table><thead><tr><th>ID</th><th>用户名</th><th>域名</th><th>正则</th><th>优先级</th><th>状态</th><th>备注</th><th>操作</th></tr></thead><tbody id="userRulesBody"></tbody></table>
  </div>
  <div id="panel-ratelimit" class="panel">
    <div class="toolbar">
      <button class="btn btn-sm" data-action="loadRateLimitStats">刷新</button>
    </div>
    <h3 class="section-title">近 7 日请求趋势</h3>
    <p class="section-desc">按 UTC 日聚合；折线含 2xx/4xx/5xx 汇总及 401、403、404、429、500 关键状态码</p>
    <div class="chart-wrap">
      <div id="requestTrendChart"></div>
      <div class="chart-legend" id="requestTrendLegend"></div>
    </div>
    <h3 class="section-title">今日 API 请求概览</h3>
    <p class="section-desc">统计 /api/* 与管理后台 API 响应状态码（UTC 日）</p>
    <div class="stats" id="requestStatsGrid"></div>
    <div class="grid-2">
      <div class="card">
        <h4>状态码分布</h4>
        <table><thead><tr><th>状态码</th><th>次数</th><th>占比</th></tr></thead><tbody id="statusCodeBody"></tbody></table>
      </div>
      <div class="card">
        <h4>Top 10 路由（按请求量）</h4>
        <table><thead><tr><th>路由</th><th>次数</th></tr></thead><tbody id="topPathsBody"></tbody></table>
      </div>
    </div>
    <h3 class="section-title" style="margin-top:24px">429 限流详情</h3>
    <div class="stats" id="rateLimitStatsGrid"></div>
    <div class="grid-2">
      <div class="card">
        <h4>今日 Top 10 IP（429）</h4>
        <table><thead><tr><th>IP</th><th>次数</th></tr></thead><tbody id="topIpsBody"></tbody></table>
      </div>
      <div class="card">
        <h4>今日 Top 10 用户（429）</h4>
        <table><thead><tr><th>用户</th><th>次数</th></tr></thead><tbody id="topUsersBody"></tbody></table>
      </div>
    </div>
    <p class="hint">请求统计保留 7 天（D1 api_request_stats）；429 明细保留 7 天（rate_limit_hits）。每小时 Cron 清理过期数据。</p>
  </div>
  <div id="panel-domains" class="panel">
    <div id="domainPrereqBanner" class="banner-warn">
      <strong>添加域名前请完成以下配置：</strong>
      <ol style="margin:8px 0 0 18px;line-height:1.6">
        <li>在 <strong>Cloudflare</strong> 将该域名接入本账户，启用 <strong>Email Routing</strong>，并将 Catch-all 指向本 zMailR Worker（详见部署文档）。</li>
        <li>在 <strong>Brevo</strong> 完成该域名的发信认证（SPF / DKIM / DMARC），并确保 Worker 已配置 <code>BREVO_API_KEY</code>。</li>
      </ol>
      <p style="margin-top:8px">两项均完成后，方可勾选确认并添加域名。禁用域名后，前端将不再展示该域名，发信 API 也会拒绝该域名地址。</p>
    </div>
    <div class="toolbar">
      <button class="btn" data-action="showDomainModal">添加域名</button>
      <button class="btn btn-sm" data-action="loadDomains">刷新</button>
      <span id="domainBrevoHint" class="hint"></span>
    </div>
    <table><thead><tr><th>ID</th><th>域名</th><th>默认</th><th>Cloudflare</th><th>Brevo</th><th>状态</th><th>操作</th></tr></thead><tbody id="domainsBody"></tbody></table>
  </div>
  <div id="panel-settings" class="panel">
    <h3 class="section-title">无感人机验证（Turnstile）</h3>
    <p class="section-desc">配置 Cloudflare Turnstile 后，登录、注册发码、忘记密码等操作前会进行无感验证，降低恶意刷接口风险</p>
    <div id="turnstilePanel">
      <div class="form-group"><label><input type="checkbox" id="turnstileEnabled"> 启用 Turnstile 人机验证</label></div>
      <p class="hint" style="margin-top:-8px;margin-bottom:12px">关闭后，即使已填写密钥，登录/注册/重置密码也不会要求 Turnstile 验证</p>
      <div class="form-group"><label>Turnstile Site Key（站点公钥）</label><input id="turnstileSiteKey" placeholder="0x4AAAAAAA..."></div>
      <div class="form-group"><label>Turnstile Secret Key（密钥）</label><input id="turnstileSecretKey" type="password" placeholder="0x4AAAAAAA..."><p class="hint" id="turnstileSecretHint"></p></div>
      <div class="card" style="margin-bottom:16px;font-size:.8125rem;line-height:1.65">
        <h4 style="margin-bottom:8px;font-size:.875rem">如何获取 Turnstile 密钥？</h4>
        <ol style="margin:0;padding-left:1.25rem">
          <li>登录 <a href="https://dash.cloudflare.com/" target="_blank" rel="noopener">Cloudflare 控制台</a>，进入 <strong>Turnstile</strong></li>
          <li>点击 <strong>Add widget</strong>，模式选 <strong>Managed</strong>（无感验证，多数用户无需点击）</li>
          <li><strong>Hostname</strong> 填写本站域名（如 <code>example.com</code>，不要带 <code>https://</code>）</li>
          <li>创建后复制 <strong>Site Key</strong> 与 <strong>Secret Key</strong> 填入上方</li>
          <li>保存后，勾选「启用 Turnstile 人机验证」，登录页与注册/重置密码发码前会出现 Turnstile 验证</li>
        </ol>
        <p class="hint" style="margin-top:10px">Secret Key 仅保存在服务器，不会回显；留空密钥输入框表示<strong>不修改</strong>已保存的 Secret。</p>
      </div>
    </div>
    <hr style="border:none;border-top:1px solid #27272a;margin:24px 0">
    <h3 class="section-title">维护模式</h3>
    <p class="section-desc">开启后按下方选项阻断对应 API，用户端显示维护横幅</p>
    <div class="form-group"><label><input type="checkbox" id="maintEnabled"> 启用维护模式</label></div>
    <div class="form-group"><label>维护提示信息（可选前缀）</label><textarea id="maintMessage" placeholder="例如：系统升级中，预计 30 分钟恢复"></textarea></div>
    <p class="hint" style="margin-bottom:12px">下方勾选的阻断项会自动追加到用户端横幅，例如「暂停服务：创建新邮箱（含 API 租用）。」</p>
    <div class="form-group"><label><input type="checkbox" id="maintBlockLease" checked> 阻断 POST /api/lease</label></div>
    <div class="form-group"><label><input type="checkbox" id="maintBlockSend" checked> 阻断 POST /api/send 与 /api/user/send</label></div>
    <div class="form-group"><label><input type="checkbox" id="maintBlockMailbox" checked> 阻断创建邮箱（含 lease）</label></div>
    <div id="maintPreview" class="banner-warn" style="display:none;margin-bottom:16px"></div>
    <button class="btn" data-action="saveMaintenance">保存系统设置</button>
  </div>
  <div id="panel-audit" class="panel">
    <div class="toolbar">
      <div class="form-group" style="margin:0"><label>起始日期</label><input type="date" id="auditFrom"></div>
      <div class="form-group" style="margin:0"><label>结束日期</label><input type="date" id="auditTo"></div>
      <button class="btn" data-action="loadAuditLogs" data-page="1">筛选</button>
    </div>
    <table><thead><tr><th>时间</th><th>操作者</th><th>动作</th><th>详情</th><th>IP</th></tr></thead><tbody id="auditBody"></tbody></table>
    <div class="pagination" id="auditPagination"></div>
  </div>
</div>
<div id="domainModal" class="modal">
  <div class="modal-box" style="max-width:520px">
    <h3 id="domainModalTitle">添加域名</h3>
    <div class="banner-warn" style="margin-bottom:16px;font-size:.8125rem">
      请确认已在 Cloudflare 配置 Email Routing 指向 zMailR，且已在 Brevo 完成域名发信认证。
    </div>
    <div class="form-group"><label>根域名</label><input id="domainName" placeholder="example.com"></div>
    <div class="form-group"><label><input type="checkbox" id="domainCfReady"> 已在 Cloudflare 接入该域名并配置 Email Routing → zMailR Worker</label></div>
    <div class="form-group"><label><input type="checkbox" id="domainBrevoReady"> 已在 Brevo 完成该域名发信认证（SPF/DKIM/DMARC）</label></div>
    <div class="form-group"><label><input type="checkbox" id="domainSetDefault"> 设为默认域名（租用邮箱、未指定 from 时使用）</label></div>
    <div class="modal-actions">
      <button class="btn" data-action="hideModal" data-modal="domainModal">取消</button>
      <button class="btn" data-action="saveDomain">添加</button>
    </div>
  </div>
</div>
<div id="announcementModal" class="modal">
  <div class="modal-box" style="max-width:560px">
    <h3 id="announcementModalTitle">新增公告</h3>
    <input type="hidden" id="announcementId">
    <div class="form-group"><label>标题</label><input id="announcementTitle" placeholder="公告标题"></div>
    <div class="form-group"><label>内容</label><textarea id="announcementContent" class="content-area" placeholder="支持纯文本或 Markdown"></textarea></div>
    <div class="form-group"><label>启用</label><select id="announcementEnabled"><option value="1">启用</option><option value="0">禁用</option></select></div>
    <div class="modal-actions">
      <button class="btn" data-action="hideModal" data-modal="announcementModal">取消</button>
      <button class="btn" data-action="saveAnnouncement">保存</button>
    </div>
  </div>
</div>
<div id="userModal" class="modal">
  <div class="modal-box">
    <h3 id="userModalTitle">新增用户</h3>
    <input type="hidden" id="userId">
    <div class="form-group"><label>用户名</label><input id="userUsername" placeholder="用户名"></div>
    <div class="form-group"><label>密码</label><input id="userPassword" type="password" placeholder="留空则不修改（编辑时）"></div>
    <div class="form-group"><label>角色</label><select id="userRole"><option value="user">user</option><option value="admin">admin</option></select></div>
    <div class="form-group"><label>日发信配额（-1 无限）</label><input id="userQuota" type="number" value="50"></div>
    <div class="form-group"><label>日随机邮箱配额（-1 无限）</label><input id="userLeaseQuota" type="number" value="300"></div>
    <div class="form-group"><label>速率方案</label><select id="userRatePlan"><option value="free">Free (60/min)</option><option value="pro">Pro (600/min, burst 30)</option><option value="team">Team (3000/min, burst 200)</option><option value="custom">自定义</option></select></div>
    <div class="form-group"><label>速率限制 (req/min)</label><input id="userRateLimit" type="number" min="1" value="60"></div>
    <div class="form-group"><label>突发 (burst, 可选)</label><input id="userRateBurst" type="number" min="0" placeholder="留空表示无 burst"></div>
    <div class="form-group"><label>API Token 数量上限</label><input id="userMaxTokens" type="number" min="1" max="100" value="3"><p class="hint">含已过期但未删除的 Token，默认 3</p></div>
    <div class="form-group" id="userEnabledGroup" style="display:none"><label>启用</label><select id="userEnabled"><option value="1">启用</option><option value="0">禁用</option></select></div>
    <div class="modal-actions">
      <button class="btn" data-action="hideModal" data-modal="userModal">取消</button>
      <button class="btn" data-action="saveUser">保存</button>
    </div>
  </div>
</div>
<div id="ruleModal" class="modal">
  <div class="modal-box">
    <h3 id="ruleModalTitle">新增规则</h3>
    <input type="hidden" id="ruleId">
    <div class="form-group"><label>域名（* 为通用）</label><input id="ruleDomain" placeholder="glados.rocks 或 *"></div>
    <div class="form-group"><label>正则表达式</label><textarea id="ruleRegex" placeholder="(?:code|验证码)[:\\s]*(\\d{6})"></textarea></div>
    <div class="form-group"><label>优先级</label><input id="rulePriority" type="number" value="0"></div>
    <div class="form-group"><label>备注</label><input id="ruleRemark" placeholder="可选，说明规则用途"></div>
    <div class="form-group"><label>启用</label><select id="ruleEnabled"><option value="1">启用</option><option value="0">禁用</option></select></div>
    <div class="modal-actions">
      <button class="btn" data-action="hideModal" data-modal="ruleModal">取消</button>
      <button class="btn" data-action="saveRule">保存</button>
    </div>
  </div>
</div>
<script src="${adminBase}/admin.js" defer></script>
</body>
</html>`;
}
