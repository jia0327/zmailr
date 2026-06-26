export function getAdminHtml(adminBase: string): string {
  const apiBase = `${adminBase}/api`;
  const loginPath = `${adminBase}/login`;
  const logoutPath = `${adminBase}/logout`;
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>zMailR 管理后台</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh}
.login-wrap{display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}
.login-box{background:#1e293b;padding:32px;border-radius:12px;width:100%;max-width:400px;box-shadow:0 4px 24px rgba(0,0,0,.3)}
.login-box h1{font-size:1.5rem;margin-bottom:24px;text-align:center;color:#f8fafc}
.login-box input{width:100%;padding:12px 16px;border:1px solid #334155;border-radius:8px;background:#0f172a;color:#e2e8f0;margin-bottom:16px;font-size:1rem}
.login-box button{width:100%;padding:12px;background:#6366f1;color:#fff;border:none;border-radius:8px;font-size:1rem;cursor:pointer}
.login-box button:hover{background:#4f46e5}
.error{color:#f87171;font-size:.875rem;margin-bottom:12px;display:none}
.app{display:none;max-width:1200px;margin:0 auto;padding:24px}
header{display:flex;justify-content:space-between;align-items:center;margin-bottom:32px;padding-bottom:16px;border-bottom:1px solid #334155}
header h1{font-size:1.5rem;color:#f8fafc}
.logout{background:#475569;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:.875rem}
.tabs{display:flex;gap:8px;margin-bottom:24px;flex-wrap:wrap}
.tab{padding:10px 20px;background:#1e293b;border:1px solid #334155;border-radius:8px;cursor:pointer;color:#94a3b8;font-size:.875rem}
.tab.active{background:#6366f1;border-color:#6366f1;color:#fff}
.panel{display:none;background:#1e293b;border-radius:12px;padding:24px;border:1px solid #334155}
.panel.active{display:block}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:24px}
.stat{background:#0f172a;padding:20px;border-radius:8px;border:1px solid #334155}
.stat .label{font-size:.75rem;color:#94a3b8;margin-bottom:8px}
.stat .value{font-size:2rem;font-weight:700;color:#6366f1}
.toolbar{display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;align-items:center}
.btn{padding:8px 16px;background:#6366f1;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:.875rem}
.btn:hover{background:#4f46e5}
.btn-danger{background:#dc2626}
.btn-danger:hover{background:#b91c1c}
.btn-sm{padding:4px 10px;font-size:.75rem}
table{width:100%;border-collapse:collapse;font-size:.875rem}
th,td{padding:10px 12px;text-align:left;border-bottom:1px solid #334155}
th{color:#94a3b8;font-weight:600}
td code{font-size:.75rem;background:#0f172a;padding:2px 6px;border-radius:4px;word-break:break-all}
.badge{display:inline-block;padding:2px 8px;border-radius:9999px;font-size:.75rem}
.badge-ok{background:#166534;color:#86efac}
.badge-off{background:#7f1d1d;color:#fca5a5}
.badge-builtin{background:#1e3a5f;color:#93c5fd}
.badge-warn{background:#713f12;color:#fcd34d}
.section-title{font-size:1rem;color:#f8fafc;margin-bottom:8px}
.section-desc{font-size:.75rem;color:#64748b;margin-bottom:12px}
.section-title+.section-desc{margin-top:-4px}
.modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);align-items:center;justify-content:center;z-index:100;padding:20px}
.modal.show{display:flex}
.modal-box{background:#1e293b;padding:24px;border-radius:12px;width:100%;max-width:480px;border:1px solid #334155}
.modal-box h3{margin-bottom:16px;color:#f8fafc}
.form-group{margin-bottom:12px}
.form-group label{display:block;font-size:.75rem;color:#94a3b8;margin-bottom:4px}
.form-group input,.form-group textarea,.form-group select{width:100%;padding:8px 12px;border:1px solid #334155;border-radius:6px;background:#0f172a;color:#e2e8f0;font-size:.875rem}
.form-group textarea{min-height:80px;font-family:monospace}
.form-group textarea.content-area{min-height:160px;font-family:inherit;white-space:pre-wrap}
.modal-actions{display:flex;gap:8px;margin-top:16px;justify-content:flex-end}
.form-group input[type=checkbox]{width:auto;margin-right:8px}
.pagination{display:flex;gap:8px;align-items:center;margin-top:16px;flex-wrap:wrap}
.pagination span{font-size:.875rem;color:#94a3b8}
.banner-warn{background:#422006;border:1px solid #92400e;color:#fcd34d;padding:12px 16px;border-radius:8px;margin-bottom:16px;font-size:.875rem}
.grid-2{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin-bottom:24px}
.card{background:#0f172a;padding:16px;border-radius:8px;border:1px solid #334155}
.card h4{font-size:.875rem;color:#f8fafc;margin-bottom:12px}
.hint{font-size:.75rem;color:#64748b;margin-top:8px}
.chart-wrap{background:#0f172a;border:1px solid #334155;border-radius:8px;padding:16px;margin-bottom:24px}
.chart-title{font-size:.875rem;color:#f8fafc;margin-bottom:12px}
.chart-canvas{width:100%;height:280px;display:block}
.chart-legend{display:flex;flex-wrap:wrap;gap:12px 20px;margin-top:12px;font-size:.75rem;color:#94a3b8}
.chart-legend-item{display:flex;align-items:center;gap:6px;cursor:pointer;user-select:none}
.chart-legend-item.off{opacity:.35}
.chart-legend-swatch{width:12px;height:3px;border-radius:2px}
.chart-empty{text-align:center;color:#64748b;padding:48px 16px;font-size:.875rem}
</style>
</head>
<body>
<div id="loginView" class="login-wrap">
  <div class="login-box">
    <h1>zMailR 管理后台</h1>
    <div id="loginError" class="error"></div>
    <input type="password" id="passwordInput" placeholder="管理员密码" autocomplete="current-password">
    <button onclick="doLogin()">登录</button>
  </div>
</div>
<div id="appView" class="app">
  <header>
    <h1>zMailR 管理后台</h1>
    <button class="logout" onclick="doLogout()">退出登录</button>
  </header>
  <div class="tabs">
    <div class="tab active" data-tab="dashboard" onclick="switchTab('dashboard')">仪表盘</div>
    <div class="tab" data-tab="users" onclick="switchTab('users')">用户</div>
    <div class="tab" data-tab="announcements" onclick="switchTab('announcements')">公告</div>
    <div class="tab" data-tab="rules" onclick="switchTab('rules')">提取规则</div>
    <div class="tab" data-tab="ratelimit" onclick="switchTab('ratelimit')">请求监控</div>
    <div class="tab" data-tab="settings" onclick="switchTab('settings')">系统设置</div>
    <div class="tab" data-tab="audit" onclick="switchTab('audit')">审计日志</div>
  </div>
  <div id="panel-dashboard" class="panel active">
    <div id="maintBanner" class="banner-warn" style="display:none"></div>
    <h3 class="section-title">系统健康</h3>
    <p class="section-desc">D1 / R2 / Brevo 依赖探测（GET /api/public/status）</p>
    <div class="toolbar" style="margin-bottom:12px">
      <button class="btn btn-sm" onclick="loadHealthStatus()">刷新状态</button>
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
    <div class="toolbar">
      <button class="btn" onclick="showUserModal()">新增用户</button>
    </div>
    <table><thead><tr><th>ID</th><th>用户名</th><th>角色</th><th>日配额</th><th>速率限制</th><th>状态</th><th>操作</th></tr></thead><tbody id="usersBody"></tbody></table>
  </div>
  <div id="panel-announcements" class="panel">
    <div class="toolbar">
      <button class="btn" onclick="showAnnouncementModal()">新增公告</button>
    </div>
    <table><thead><tr><th>ID</th><th>标题</th><th>创建时间</th><th>状态</th><th>已读人数</th><th>操作</th></tr></thead><tbody id="announcementsBody"></tbody></table>
  </div>
  <div id="panel-rules" class="panel">
    <h3 class="section-title">系统内置规则</h3>
    <p class="section-desc">系统级规则，对所有用户生效；可新增、编辑、删除</p>
    <div class="toolbar">
      <button class="btn" onclick="showRuleModal()">新增规则</button>
    </div>
    <table><thead><tr><th>ID</th><th>域名</th><th>正则</th><th>优先级</th><th>状态</th><th>备注</th><th>操作</th></tr></thead><tbody id="rulesBody"></tbody></table>
    <h3 class="section-title" style="margin-top:24px">所有用户自定义规则</h3>
    <p class="section-desc">汇总展示所有用户创建的规则，便于参考优质规则并提升平台提取能力</p>
    <table><thead><tr><th>ID</th><th>用户名</th><th>域名</th><th>正则</th><th>优先级</th><th>状态</th><th>备注</th><th>操作</th></tr></thead><tbody id="userRulesBody"></tbody></table>
  </div>
  <div id="panel-ratelimit" class="panel">
    <div class="toolbar">
      <button class="btn btn-sm" onclick="loadRateLimitStats()">刷新</button>
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
  <div id="panel-settings" class="panel">
    <h3 class="section-title">维护模式</h3>
    <p class="section-desc">开启后按下方选项阻断对应 API，用户端显示维护横幅</p>
    <div class="form-group"><label><input type="checkbox" id="maintEnabled"> 启用维护模式</label></div>
    <div class="form-group"><label>维护提示信息</label><textarea id="maintMessage" placeholder="系统维护中，部分功能暂不可用"></textarea></div>
    <div class="form-group"><label><input type="checkbox" id="maintBlockLease" checked> 阻断 POST /api/lease</label></div>
    <div class="form-group"><label><input type="checkbox" id="maintBlockSend" checked> 阻断 POST /api/send 与 /api/user/send</label></div>
    <div class="form-group"><label><input type="checkbox" id="maintBlockMailbox" checked> 阻断创建邮箱（含 lease）</label></div>
    <button class="btn" onclick="saveMaintenance()">保存系统设置</button>
  </div>
  <div id="panel-audit" class="panel">
    <div class="toolbar">
      <div class="form-group" style="margin:0"><label>起始日期</label><input type="date" id="auditFrom"></div>
      <div class="form-group" style="margin:0"><label>结束日期</label><input type="date" id="auditTo"></div>
      <button class="btn" onclick="loadAuditLogs(1)">筛选</button>
    </div>
    <table><thead><tr><th>时间</th><th>操作者</th><th>动作</th><th>详情</th><th>IP</th></tr></thead><tbody id="auditBody"></tbody></table>
    <div class="pagination" id="auditPagination"></div>
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
      <button class="btn" onclick="hideModal('announcementModal')">取消</button>
      <button class="btn" onclick="saveAnnouncement()">保存</button>
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
    <div class="form-group"><label>速率方案</label><select id="userRatePlan" onchange="applyRatePlan()"><option value="free">Free (60/min)</option><option value="pro">Pro (600/min, burst 30)</option><option value="team">Team (3000/min, burst 200)</option><option value="custom">自定义</option></select></div>
    <div class="form-group"><label>速率限制 (req/min)</label><input id="userRateLimit" type="number" min="1" value="60"></div>
    <div class="form-group"><label>突发 (burst, 可选)</label><input id="userRateBurst" type="number" min="0" placeholder="留空表示无 burst"></div>
    <div class="form-group" id="userEnabledGroup" style="display:none"><label>启用</label><select id="userEnabled"><option value="1">启用</option><option value="0">禁用</option></select></div>
    <div class="modal-actions">
      <button class="btn" onclick="hideModal('userModal')">取消</button>
      <button class="btn" onclick="saveUser()">保存</button>
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
      <button class="btn" onclick="hideModal('ruleModal')">取消</button>
      <button class="btn" onclick="saveRule()">保存</button>
    </div>
  </div>
</div>
<script>
const API='${apiBase}';
async function api(path,opts={}){const r=await fetch(API+path,{...opts,credentials:'include',headers:{'Content-Type':'application/json',...(opts.headers||{})}});if(r.status===401){showLogin();throw new Error('未授权')}return r.json()}
function showLogin(){document.getElementById('loginView').style.display='flex';document.getElementById('appView').style.display='none'}
function showApp(){document.getElementById('loginView').style.display='none';document.getElementById('appView').style.display='block'}
async function doLogin(){const pw=document.getElementById('passwordInput').value;const err=document.getElementById('loginError');err.style.display='none';try{const r=await fetch('${loginPath}',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({password:pw})});const d=await r.json();if(!d.success){err.textContent=d.error||'登录失败';err.style.display='block';return}showApp();loadAll()}catch(e){err.textContent='网络错误';err.style.display='block'}}
async function doLogout(){await fetch('${logoutPath}',{method:'POST',credentials:'include'});showLogin()}
function switchTab(name){document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===name));document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active',p.id==='panel-'+name));if(name==='users')loadUsers();if(name==='announcements')loadAnnouncements();if(name==='rules')loadRules();if(name==='ratelimit')loadRateLimitStats();if(name==='settings')loadMaintenance();if(name==='audit')loadAuditLogs(1)}
function hideModal(id){document.getElementById(id).classList.remove('show')}
function showModal(id){document.getElementById(id).classList.add('show')}
function fmtTime(ts){if(!ts)return'-';const d=new Date(ts>1e12?ts:ts*1000);return d.toLocaleString('zh-CN')}
async function loadAll(){await Promise.all([loadHealthStatus(),loadStats(),loadBrevoStats()])}
function statusLabel(s){if(s==='ok')return'正常';if(s==='degraded')return'降级';return'故障'}
function statusBadgeClass(s){if(s==='ok')return'badge-ok';if(s==='degraded')return'badge-warn';return'badge-off'}
function checkDisplay(check){if(check&&check.configured===false)return{icon:'',text:'未配置',cls:'badge-builtin'};if(check&&check.ok)return{icon:'✅',text:'正常',cls:'badge-ok'};return{icon:'❌',text:'异常',cls:'badge-off'}}
async function loadHealthStatus(){const hint=document.getElementById('healthHint');hint.style.color='#64748b';try{const r=await fetch('/api/public/status',{credentials:'include'});const d=await r.json();if(!r.ok||!d.success){throw new Error(d.message||d.error||'请求失败')}const mb=document.getElementById('maintBanner');if(d.maintenance&&d.maintenance.enabled){mb.style.display='block';mb.textContent='⚠ 维护模式已启用：'+(d.maintenance.message||'系统维护中，部分功能暂不可用')}else{mb.style.display='none'}const checks=d.checks||{};const overallCls=statusBadgeClass(d.status);const rows=[['D1 数据库',checks.d1],['R2 存储',checks.r2],['Brevo API',checks.brevo]];document.getElementById('healthGrid').innerHTML='<div class="stat"><div class="label">整体状态</div><div class="value" style="font-size:1.25rem"><span class="badge '+overallCls+'">'+statusLabel(d.status)+'</span></div></div>'+rows.map(([lbl,chk])=>{const disp=checkDisplay(chk);return'<div class="stat"><div class="label">'+lbl+'</div><div class="value" style="font-size:1.25rem"><span class="badge '+disp.cls+'">'+(disp.icon?disp.icon+' ':'')+disp.text+'</span></div></div>'}).join('');const hints=[];if(checks.d1&&!checks.d1.ok&&checks.d1.message)hints.push('D1: '+checks.d1.message);if(checks.r2&&!checks.r2.ok&&checks.r2.message)hints.push('R2: '+checks.r2.message);if(checks.brevo&&checks.brevo.configured&&!checks.brevo.ok&&checks.brevo.message)hints.push('Brevo: '+checks.brevo.message);hint.textContent=hints.length?hints.join(' · '):'上次刷新：'+new Date().toLocaleString('zh-CN')}catch(e){hint.textContent='无法获取健康状态：'+(e.message||'网络错误');hint.style.color='#f87171'}}
async function loadStats(){const d=await api('/stats');const s=d.stats;document.getElementById('statsGrid').innerHTML=[
  ['用户总数',s.totalUsers],['启用用户',s.activeUsers],['有效邮箱',s.activeMailboxes],['邮箱总数',s.totalMailboxes],
  ['今日收信',s.receivedToday],['今日发信',s.sentToday],['今日活跃用户',s.activeUsersToday],['有效用户 Token',s.activeUserTokens]
].map(([l,v])=>'<div class="stat"><div class="label">'+l+'</div><div class="value">'+v+'</div></div>').join('')}
async function loadBrevoStats(){const d=await api('/brevo-stats');const s=d.stats;const l=s.local;document.getElementById('brevoStatsGrid').innerHTML=[
  ['今日发信',l.sentToday],['今日失败',l.failedToday],['累计失败',l.failedTotal],['用户日配额合计',l.userQuotaSum]
].map(([lbl,v])=>'<div class="stat"><div class="label">'+lbl+'</div><div class="value">'+v+'</div></div>').join('');
const hint=document.getElementById('brevoHint');
if(s.brevoAvailable&&s.brevo){hint.textContent='Brevo 账户: '+s.brevo.email+' · 套餐: '+s.brevo.planType+' · Credits: '+JSON.stringify(s.brevo.credits);hint.style.color='#86efac'}else{hint.textContent='Brevo API: '+(s.brevoError||'不可用')+'（仅显示本地统计）';hint.style.color='#94a3b8'}}
function statusCodeBadge(code){if(code>=200&&code<300)return'badge-ok';if(code>=400&&code<500)return'badge-warn';if(code>=500)return'badge-off';return'badge-builtin'}
function fmtChartDate(d){const p=d.split('-');return parseInt(p[1],10)+'/'+parseInt(p[2],10)}
function drawRequestTrendChart(trend){const host=document.getElementById('requestTrendChart');const legend=document.getElementById('requestTrendLegend');if(!trend||!trend.dates||!trend.dates.length){host.innerHTML='<div class="chart-empty">暂无趋势数据</div>';legend.innerHTML='';return}const dates=trend.dates;const series=trend.series||[];const W=800;const H=280;const pad={t:16,r:16,b:36,l:48};const plotW=W-pad.l-pad.r;const plotH=H-pad.t-pad.b;const maxY=Math.max(1,...series.flatMap(s=>s.values));const yTicks=4;const yStep=Math.ceil(maxY/yTicks)||1;const yMax=yStep*yTicks;const xStep=dates.length>1?plotW/(dates.length-1):0;const hidden=window._chartHidden||{};const visible=series.filter(s=>!hidden[s.key]);let svg='<svg class="chart-canvas" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet">';svg+='<line x1="'+pad.l+'" y1="'+(pad.t+plotH)+'" x2="'+(pad.l+plotW)+'" y2="'+(pad.t+plotH)+'" stroke="#334155"/>';for(let i=0;i<=yTicks;i++){const y=pad.t+plotH-(plotH*i/yTicks);const val=yStep*i;svg+='<line x1="'+pad.l+'" y1="'+y+'" x2="'+(pad.l+plotW)+'" y2="'+y+'" stroke="#1e293b"/>';svg+='<text x="'+(pad.l-8)+'" y="'+(y+4)+'" fill="#64748b" font-size="11" text-anchor="end">'+val+'</text>'}dates.forEach((d,i)=>{const x=pad.l+(dates.length>1?i*xStep:plotW/2);if(i===0||i===dates.length-1||dates.length<=7){svg+='<text x="'+x+'" y="'+(H-8)+'" fill="#64748b" font-size="11" text-anchor="middle">'+fmtChartDate(d)+'</text>'}});visible.forEach(s=>{const pts=s.values.map((v,i)=>{const x=pad.l+(dates.length>1?i*xStep:plotW/2);const y=pad.t+plotH-(v/yMax)*plotH;return x+','+y}).join(' ');svg+='<polyline fill="none" stroke="'+s.color+'" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="'+pts+'"/>';s.values.forEach((v,i)=>{if(!v)return;const x=pad.l+(dates.length>1?i*xStep:plotW/2);const y=pad.t+plotH-(v/yMax)*plotH;svg+='<circle cx="'+x+'" cy="'+y+'" r="3" fill="'+s.color+'"/>'})});svg+='</svg>';host.innerHTML=svg;legend.innerHTML=series.map(s=>'<span class="chart-legend-item'+(hidden[s.key]?' off':'')+'" data-key="'+s.key+'" onclick="toggleChartSeries(\\''+s.key+'\\')"><span class="chart-legend-swatch" style="background:'+s.color+'"></span>'+s.label+'</span>').join('')}
function toggleChartSeries(key){window._chartHidden=window._chartHidden||{};window._chartHidden[key]=!window._chartHidden[key];if(window._lastTrend)drawRequestTrendChart(window._lastTrend)}
async function loadRateLimitStats(){const [reqData,rlData]=await Promise.all([api('/request-stats'),api('/rate-limit-stats')]);const rs=reqData.stats;window._lastTrend=rs.trend;drawRequestTrendChart(rs.trend);const cat=rs.byCategory;document.getElementById('requestStatsGrid').innerHTML=[
  ['总请求',rs.totalRequests],['2xx 成功',cat.success2xx],['4xx 客户端',cat.client4xx],['5xx 服务端',cat.server5xx],['其他',cat.other]
].map(([l,v])=>'<div class="stat"><div class="label">'+l+'</div><div class="value">'+v+'</div></div>').join('');
const scB=document.getElementById('statusCodeBody');if(!rs.byStatusCode.length){scB.innerHTML='<tr><td colspan="3" class="empty">暂无</td></tr>'}else{const total=rs.totalRequests||1;scB.innerHTML=rs.byStatusCode.map(r=>'<tr><td><span class="badge '+statusCodeBadge(r.statusCode)+'">'+r.statusCode+'</span></td><td>'+r.count+'</td><td>'+(100*r.count/total).toFixed(1)+'%</td></tr>').join('')}
const pB=document.getElementById('topPathsBody');if(!rs.topPaths.length){pB.innerHTML='<tr><td colspan="2" class="empty">暂无</td></tr>'}else{pB.innerHTML=rs.topPaths.map(r=>'<tr><td><code>'+r.pathGroup+'</code></td><td>'+r.count+'</td></tr>').join('')}
const s=rlData.stats;document.getElementById('rateLimitStatsGrid').innerHTML='<div class="stat"><div class="label">今日 429 次数</div><div class="value">'+s.todayCount+'</div></div>';
const ipB=document.getElementById('topIpsBody');if(!s.topIps.length){ipB.innerHTML='<tr><td colspan="2" class="empty">暂无</td></tr>'}else{ipB.innerHTML=s.topIps.map(r=>'<tr><td><code>'+r.ip+'</code></td><td>'+r.count+'</td></tr>').join('')}
const uB=document.getElementById('topUsersBody');if(!s.topUsers.length){uB.innerHTML='<tr><td colspan="2" class="empty">暂无</td></tr>'}else{uB.innerHTML=s.topUsers.map(r=>'<tr><td>'+r.username+' (#'+r.userId+')</td><td>'+r.count+'</td></tr>').join('')}}
async function loadMaintenance(){const d=await api('/maintenance');const m=d.maintenance;document.getElementById('maintEnabled').checked=!!m.enabled;document.getElementById('maintMessage').value=m.message||'';document.getElementById('maintBlockLease').checked=!!m.blockLease;document.getElementById('maintBlockSend').checked=!!m.blockSend;document.getElementById('maintBlockMailbox').checked=!!m.blockMailboxCreate}
async function saveMaintenance(){const body={enabled:document.getElementById('maintEnabled').checked,message:document.getElementById('maintMessage').value,blockLease:document.getElementById('maintBlockLease').checked,blockSend:document.getElementById('maintBlockSend').checked,blockMailboxCreate:document.getElementById('maintBlockMailbox').checked};await api('/maintenance',{method:'PUT',body:JSON.stringify(body)});alert('已保存')}
function dateToUnixStart(d){if(!d)return undefined;const t=new Date(d+'T00:00:00');return Math.floor(t.getTime()/1000)}
function dateToUnixEnd(d){if(!d)return undefined;const t=new Date(d+'T23:59:59');return Math.floor(t.getTime()/1000)}
async function loadAuditLogs(page){window._auditPage=page;const from=dateToUnixStart(document.getElementById('auditFrom').value);const to=dateToUnixEnd(document.getElementById('auditTo').value);let q='?page='+page+'&limit=50';if(from)q+='&from='+from;if(to)q+='&to='+to;const d=await api('/audit-logs'+q);const b=document.getElementById('auditBody');if(!d.logs.length){b.innerHTML='<tr><td colspan="5" class="empty">暂无日志</td></tr>'}else{b.innerHTML=d.logs.map(l=>'<tr><td>'+fmtTime(l.createdAt)+'</td><td>'+l.actorType+(l.actorName?': '+l.actorName:'')+'</td><td><code>'+l.action+'</code></td><td><code>'+(l.detail?JSON.stringify(l.detail):'-')+'</code></td><td>'+(l.ip||'-')+'</td></tr>').join('')}
const totalPages=Math.max(1,Math.ceil(d.total/d.limit));document.getElementById('auditPagination').innerHTML='<span>共 '+d.total+' 条 · 第 '+d.page+' / '+totalPages+' 页</span>'+(d.page>1?'<button class="btn btn-sm" onclick="loadAuditLogs('+(d.page-1)+')">上一页</button>':'')+(d.page<totalPages?'<button class="btn btn-sm" onclick="loadAuditLogs('+(d.page+1)+')">下一页</button>':'')}
const RATE_PLANS={free:{limit:60,burst:null},pro:{limit:600,burst:30},team:{limit:3000,burst:200}};
function fmtRateLimit(u){const l=u.rateLimitPerMin??60;const b=u.rateLimitBurst;return l+'/min'+(b?' (+'+b+' burst)':'');}
function detectRatePlan(u){const l=u.rateLimitPerMin??60;const b=u.rateLimitBurst??null;for(const[k,p]of Object.entries(RATE_PLANS)){if(p.limit===l&&p.burst===b)return k}return'custom'}
function applyRatePlan(){const p=document.getElementById('userRatePlan').value;if(p==='custom')return;const plan=RATE_PLANS[p];document.getElementById('userRateLimit').value=plan.limit;document.getElementById('userRateBurst').value=plan.burst??''}
async function loadUsers(){const d=await api('/users');const b=document.getElementById('usersBody');if(!d.users.length){b.innerHTML='<tr><td colspan="7" class="empty">暂无用户</td></tr>';return}b.innerHTML=d.users.map(u=>'<tr><td>'+u.id+'</td><td>'+u.username+'</td><td>'+u.role+'</td><td>'+(u.dailySendQuota<0?'无限':u.dailySendQuota)+'</td><td>'+fmtRateLimit(u)+'</td><td><span class="badge '+(u.enabled?'badge-ok':'badge-off')+'">'+(u.enabled?'启用':'禁用')+'</span></td><td><button class="btn btn-sm" onclick="editUser('+u.id+')">编辑</button> <button class="btn btn-danger btn-sm" onclick="deleteUser('+u.id+')">删除</button></td></tr>').join('');window._users=d.users}
function showUserModal(){document.getElementById('userModalTitle').textContent='新增用户';document.getElementById('userId').value='';document.getElementById('userUsername').value='';document.getElementById('userPassword').value='';document.getElementById('userRole').value='user';document.getElementById('userQuota').value='50';document.getElementById('userRatePlan').value='free';applyRatePlan();document.getElementById('userEnabledGroup').style.display='none';showModal('userModal')}
function editUser(id){const u=(window._users||[]).find(x=>x.id===id);if(!u)return;document.getElementById('userModalTitle').textContent='编辑用户';document.getElementById('userId').value=u.id;document.getElementById('userUsername').value=u.username;document.getElementById('userUsername').disabled=true;document.getElementById('userPassword').value='';document.getElementById('userRole').value=u.role;document.getElementById('userQuota').value=u.dailySendQuota;document.getElementById('userRatePlan').value=detectRatePlan(u);document.getElementById('userRateLimit').value=u.rateLimitPerMin??60;document.getElementById('userRateBurst').value=u.rateLimitBurst??'';document.getElementById('userEnabled').value=u.enabled?'1':'0';document.getElementById('userEnabledGroup').style.display='block';showModal('userModal')}
async function saveUser(){const id=document.getElementById('userId').value;const burstRaw=document.getElementById('userRateBurst').value;const body={username:document.getElementById('userUsername').value,password:document.getElementById('userPassword').value,role:document.getElementById('userRole').value,dailySendQuota:parseInt(document.getElementById('userQuota').value)||50,rateLimitPerMin:parseInt(document.getElementById('userRateLimit').value)||60,rateLimitBurst:burstRaw===''?null:parseInt(burstRaw)||null};if(id){body.enabled=document.getElementById('userEnabled').value==='1';if(!body.password)delete body.password;await api('/users/'+id,{method:'PUT',body:JSON.stringify(body)})}else{if(!body.username||!body.password){alert('用户名和密码必填');return}await api('/users',{method:'POST',body:JSON.stringify(body)})}document.getElementById('userUsername').disabled=false;hideModal('userModal');loadUsers()}
async function deleteUser(id){if(!confirm('确定删除此用户？'))return;await api('/users/'+id,{method:'DELETE'});loadUsers()}
async function loadAnnouncements(){const d=await api('/announcements');const b=document.getElementById('announcementsBody');if(!d.announcements.length){b.innerHTML='<tr><td colspan="6" class="empty">暂无公告</td></tr>';return}b.innerHTML=d.announcements.map(a=>'<tr><td>'+a.id+'</td><td>'+a.title+'</td><td>'+fmtTime(a.createdAt)+'</td><td><span class="badge '+(a.enabled?'badge-ok':'badge-off')+'">'+(a.enabled?'启用':'禁用')+'</span></td><td>'+(a.readCount??0)+'</td><td><button class="btn btn-sm" onclick="editAnnouncement('+a.id+')">编辑</button> <button class="btn btn-danger btn-sm" onclick="deleteAnnouncement('+a.id+')">删除</button></td></tr>').join('');window._announcements=d.announcements}
function showAnnouncementModal(){document.getElementById('announcementModalTitle').textContent='新增公告';document.getElementById('announcementId').value='';document.getElementById('announcementTitle').value='';document.getElementById('announcementContent').value='';document.getElementById('announcementEnabled').value='1';showModal('announcementModal')}
function editAnnouncement(id){const a=(window._announcements||[]).find(x=>x.id===id);if(!a)return;document.getElementById('announcementModalTitle').textContent='编辑公告';document.getElementById('announcementId').value=a.id;document.getElementById('announcementTitle').value=a.title;document.getElementById('announcementContent').value=a.content;document.getElementById('announcementEnabled').value=a.enabled?'1':'0';showModal('announcementModal')}
async function saveAnnouncement(){const id=document.getElementById('announcementId').value;const title=document.getElementById('announcementTitle').value.trim();const content=document.getElementById('announcementContent').value.trim();if(!title||!content){alert('标题和内容必填');return}const body={title,content,enabled:document.getElementById('announcementEnabled').value==='1'};if(id){await api('/announcements/'+id,{method:'PUT',body:JSON.stringify(body)})}else{await api('/announcements',{method:'POST',body:JSON.stringify(body)})}hideModal('announcementModal');loadAnnouncements()}
async function deleteAnnouncement(id){if(!confirm('确定删除此公告？'))return;await api('/announcements/'+id,{method:'DELETE'});loadAnnouncements()}
async function loadRules(){const d=await api('/rules');const b=document.getElementById('rulesBody');const ub=document.getElementById('userRulesBody');if(!d.rules.length){b.innerHTML='<tr><td colspan="7" class="empty">暂无全局规则</td></tr>'}else{b.innerHTML=d.rules.map(r=>'<tr><td>'+r.id+'</td><td>'+r.domain+'</td><td><code>'+r.regex+'</code></td><td>'+r.priority+'</td><td><span class="badge '+(r.enabled?'badge-ok':'badge-off')+'">'+(r.enabled?'启用':'禁用')+'</span></td><td>'+(r.remark||'-')+'</td><td><button class="btn btn-sm" onclick="editRule('+r.id+')">编辑</button> <button class="btn btn-danger btn-sm" onclick="deleteRule('+r.id+')">删除</button></td></tr>').join('')};window._rules=d.rules;if(!d.userRules||!d.userRules.length){ub.innerHTML='<tr><td colspan="8" class="empty">暂无用户规则</td></tr>'}else{ub.innerHTML=d.userRules.map(r=>'<tr><td>'+r.id+'</td><td>'+r.username+'</td><td>'+r.domain+'</td><td><code>'+r.regex+'</code></td><td>'+r.priority+'</td><td><span class="badge '+(r.enabled?'badge-ok':'badge-off')+'">'+(r.enabled?'启用':'禁用')+'</span></td><td>'+(r.remark||'-')+'</td><td><button class="btn btn-danger btn-sm" onclick="deleteUserRule('+r.id+')">删除</button></td></tr>').join('')}}
function showRuleModal(){document.getElementById('ruleModalTitle').textContent='新增规则';document.getElementById('ruleId').value='';document.getElementById('ruleDomain').value='*';document.getElementById('ruleRegex').value='';document.getElementById('rulePriority').value='0';document.getElementById('ruleRemark').value='';document.getElementById('ruleEnabled').value='1';showModal('ruleModal')}
function editRule(id){const r=(window._rules||[]).find(x=>x.id===id);if(!r)return;document.getElementById('ruleModalTitle').textContent='编辑规则';document.getElementById('ruleId').value=r.id;document.getElementById('ruleDomain').value=r.domain;document.getElementById('ruleRegex').value=r.regex;document.getElementById('rulePriority').value=r.priority;document.getElementById('ruleRemark').value=r.remark||'';document.getElementById('ruleEnabled').value=r.enabled?'1':'0';showModal('ruleModal')}
async function saveRule(){const id=document.getElementById('ruleId').value;const remark=document.getElementById('ruleRemark').value.trim();const body={domain:document.getElementById('ruleDomain').value,regex:document.getElementById('ruleRegex').value,priority:parseInt(document.getElementById('rulePriority').value)||0,enabled:document.getElementById('ruleEnabled').value==='1',remark:remark||null};if(id){await api('/rules/'+id,{method:'PUT',body:JSON.stringify(body)})}else{await api('/rules',{method:'POST',body:JSON.stringify(body)})}hideModal('ruleModal');loadRules()}
async function deleteRule(id){if(!confirm('确定删除此规则？'))return;await api('/rules/'+id,{method:'DELETE'});loadRules()}
async function deleteUserRule(id){if(!confirm('确定删除此用户规则？'))return;await api('/rules/user/'+id,{method:'DELETE'});loadRules()}
(async()=>{try{const d=await api('/stats');if(d.success){showApp();loadAll()}}catch{showLogin()}})();
document.getElementById('passwordInput').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin()});
</script>
</body>
</html>`;
}
