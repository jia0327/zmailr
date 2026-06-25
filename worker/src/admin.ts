export function getAdminHtml(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ZMail Admin</title>
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
.modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);align-items:center;justify-content:center;z-index:100;padding:20px}
.modal.show{display:flex}
.modal-box{background:#1e293b;padding:24px;border-radius:12px;width:100%;max-width:480px;border:1px solid #334155}
.modal-box h3{margin-bottom:16px;color:#f8fafc}
.form-group{margin-bottom:12px}
.form-group label{display:block;font-size:.75rem;color:#94a3b8;margin-bottom:4px}
.form-group input,.form-group textarea,.form-group select{width:100%;padding:8px 12px;border:1px solid #334155;border-radius:6px;background:#0f172a;color:#e2e8f0;font-size:.875rem}
.form-group textarea{min-height:80px;font-family:monospace}
.modal-actions{display:flex;gap:8px;margin-top:16px;justify-content:flex-end}
.empty{text-align:center;color:#64748b;padding:32px}
</style>
</head>
<body>
<div id="loginView" class="login-wrap">
  <div class="login-box">
    <h1>ZMail 管理后台</h1>
    <div id="loginError" class="error"></div>
    <input type="password" id="passwordInput" placeholder="管理员密码" autocomplete="current-password">
    <button onclick="doLogin()">登录</button>
  </div>
</div>
<div id="appView" class="app">
  <header>
    <h1>ZMail 管理后台</h1>
    <button class="logout" onclick="doLogout()">退出登录</button>
  </header>
  <div class="tabs">
    <div class="tab active" data-tab="dashboard" onclick="switchTab('dashboard')">仪表盘</div>
    <div class="tab" data-tab="tokens" onclick="switchTab('tokens')">API Token</div>
    <div class="tab" data-tab="rules" onclick="switchTab('rules')">提取规则</div>
    <div class="tab" data-tab="sent" onclick="switchTab('sent')">发信日志</div>
  </div>
  <div id="panel-dashboard" class="panel active">
    <div class="stats" id="statsGrid"></div>
  </div>
  <div id="panel-tokens" class="panel">
    <div class="toolbar">
      <button class="btn" onclick="showTokenModal()">生成 Token</button>
    </div>
    <table><thead><tr><th>ID</th><th>名称</th><th>Token</th><th>过期时间</th><th>操作</th></tr></thead><tbody id="tokensBody"></tbody></table>
  </div>
  <div id="panel-rules" class="panel">
    <div class="toolbar">
      <button class="btn" onclick="showRuleModal()">新增规则</button>
    </div>
    <table><thead><tr><th>ID</th><th>域名</th><th>正则</th><th>优先级</th><th>状态</th><th>操作</th></tr></thead><tbody id="rulesBody"></tbody></table>
  </div>
  <div id="panel-sent" class="panel">
    <table><thead><tr><th>ID</th><th>收件人</th><th>主题</th><th>状态</th><th>时间</th></tr></thead><tbody id="sentBody"></tbody></table>
  </div>
</div>
<div id="tokenModal" class="modal">
  <div class="modal-box">
    <h3>生成 API Token</h3>
    <div class="form-group"><label>名称</label><input id="tokenName" placeholder="可选，如 Python 脚本"></div>
    <div class="form-group"><label>有效期（天）</label><input id="tokenDays" type="number" value="30" min="1" max="365"></div>
    <div class="modal-actions">
      <button class="btn" onclick="hideModal('tokenModal')">取消</button>
      <button class="btn" onclick="createToken()">生成</button>
    </div>
  </div>
</div>
<div id="ruleModal" class="modal">
  <div class="modal-box">
    <h3 id="ruleModalTitle">新增提取规则</h3>
    <input type="hidden" id="ruleId">
    <div class="form-group"><label>域名（* 为通用）</label><input id="ruleDomain" placeholder="glados.rocks 或 *"></div>
    <div class="form-group"><label>正则表达式</label><textarea id="ruleRegex" placeholder="(?:code|验证码)[:\\s]*(\\d{6})"></textarea></div>
    <div class="form-group"><label>优先级</label><input id="rulePriority" type="number" value="0"></div>
    <div class="form-group"><label>启用</label><select id="ruleEnabled"><option value="1">启用</option><option value="0">禁用</option></select></div>
    <div class="modal-actions">
      <button class="btn" onclick="hideModal('ruleModal')">取消</button>
      <button class="btn" onclick="saveRule()">保存</button>
    </div>
  </div>
</div>
<script>
const API='/admin/api';
async function api(path,opts={}){const r=await fetch(API+path,{...opts,credentials:'include',headers:{'Content-Type':'application/json',...(opts.headers||{})}});if(r.status===401){showLogin();throw new Error('未授权')}return r.json()}
function showLogin(){document.getElementById('loginView').style.display='flex';document.getElementById('appView').style.display='none'}
function showApp(){document.getElementById('loginView').style.display='none';document.getElementById('appView').style.display='block'}
async function doLogin(){const pw=document.getElementById('passwordInput').value;const err=document.getElementById('loginError');err.style.display='none';try{const r=await fetch('/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({password:pw})});const d=await r.json();if(!d.success){err.textContent=d.error||'登录失败';err.style.display='block';return}showApp();loadAll()}catch(e){err.textContent='网络错误';err.style.display='block'}}
async function doLogout(){await fetch('/admin/logout',{method:'POST',credentials:'include'});showLogin()}
function switchTab(name){document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===name));document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active',p.id==='panel-'+name));if(name==='tokens')loadTokens();if(name==='rules')loadRules();if(name==='sent')loadSent()}
function hideModal(id){document.getElementById(id).classList.remove('show')}
function showModal(id){document.getElementById(id).classList.add('show')}
function fmtTime(ts){if(!ts)return'-';const d=new Date(ts>1e12?ts:ts*1000);return d.toLocaleString('zh-CN')}
async function loadAll(){await loadStats()}
async function loadStats(){const d=await api('/stats');const s=d.stats;document.getElementById('statsGrid').innerHTML=[
  ['今日收信',s.receivedToday],['今日发信',s.sentToday],['有效 Token',s.activeTokens],['启用规则',s.activeRules]
].map(([l,v])=>'<div class="stat"><div class="label">'+l+'</div><div class="value">'+v+'</div></div>').join('')}
async function loadTokens(){const d=await api('/tokens');const b=document.getElementById('tokensBody');if(!d.tokens.length){b.innerHTML='<tr><td colspan="5" class="empty">暂无 Token</td></tr>';return}b.innerHTML=d.tokens.map(t=>'<tr><td>'+t.id+'</td><td>'+(t.name||'-')+'</td><td><code>'+t.token+'</code></td><td>'+fmtTime(t.expiresAt)+'</td><td><button class="btn btn-danger btn-sm" onclick="deleteToken('+t.id+')">删除</button></td></tr>').join('')}
function showTokenModal(){document.getElementById('tokenName').value='';document.getElementById('tokenDays').value='30';showModal('tokenModal')}
async function createToken(){const name=document.getElementById('tokenName').value;const days=parseInt(document.getElementById('tokenDays').value)||30;await api('/tokens',{method:'POST',body:JSON.stringify({name,expiresInDays:days})});hideModal('tokenModal');loadTokens();loadStats()}
async function deleteToken(id){if(!confirm('确定删除此 Token？'))return;await api('/tokens/'+id,{method:'DELETE'});loadTokens();loadStats()}
async function loadRules(){const d=await api('/rules');const b=document.getElementById('rulesBody');if(!d.rules.length){b.innerHTML='<tr><td colspan="6" class="empty">暂无规则</td></tr>';return}b.innerHTML=d.rules.map(r=>'<tr><td>'+r.id+'</td><td>'+r.domain+'</td><td><code>'+r.regex+'</code></td><td>'+r.priority+'</td><td><span class="badge '+(r.enabled?'badge-ok':'badge-off')+'">'+(r.enabled?'启用':'禁用')+'</span></td><td><button class="btn btn-sm" onclick="editRule('+r.id+')">编辑</button> <button class="btn btn-danger btn-sm" onclick="deleteRule('+r.id+')">删除</button></td></tr>').join('');window._rules=d.rules}
function showRuleModal(){document.getElementById('ruleModalTitle').textContent='新增提取规则';document.getElementById('ruleId').value='';document.getElementById('ruleDomain').value='*';document.getElementById('ruleRegex').value='';document.getElementById('rulePriority').value='0';document.getElementById('ruleEnabled').value='1';showModal('ruleModal')}
function editRule(id){const r=(window._rules||[]).find(x=>x.id===id);if(!r)return;document.getElementById('ruleModalTitle').textContent='编辑提取规则';document.getElementById('ruleId').value=r.id;document.getElementById('ruleDomain').value=r.domain;document.getElementById('ruleRegex').value=r.regex;document.getElementById('rulePriority').value=r.priority;document.getElementById('ruleEnabled').value=r.enabled?'1':'0';showModal('ruleModal')}
async function saveRule(){const id=document.getElementById('ruleId').value;const body={domain:document.getElementById('ruleDomain').value,regex:document.getElementById('ruleRegex').value,priority:parseInt(document.getElementById('rulePriority').value)||0,enabled:document.getElementById('ruleEnabled').value==='1'};if(id){await api('/rules/'+id,{method:'PUT',body:JSON.stringify(body)})}else{await api('/rules',{method:'POST',body:JSON.stringify(body)})}hideModal('ruleModal');loadRules();loadStats()}
async function deleteRule(id){if(!confirm('确定删除此规则？'))return;await api('/rules/'+id,{method:'DELETE'});loadRules();loadStats()}
async function loadSent(){const d=await api('/sent-emails');const b=document.getElementById('sentBody');if(!d.emails.length){b.innerHTML='<tr><td colspan="5" class="empty">暂无记录</td></tr>';return}b.innerHTML=d.emails.map(e=>'<tr><td>'+e.id+'</td><td>'+e.toEmail+'</td><td>'+e.subject+'</td><td><span class="badge '+(e.status==='sent'?'badge-ok':'badge-off')+'">'+e.status+'</span></td><td>'+fmtTime(e.createdAt)+'</td></tr>').join('')}
(async()=>{try{const d=await api('/stats');if(d.success){showApp();loadAll()}}catch{showLogin()}})();
document.getElementById('passwordInput').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin()});
</script>
</body>
</html>`;
}
