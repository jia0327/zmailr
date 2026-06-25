export function getAdminHtml(): string {
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
.empty{text-align:center;color:#64748b;padding:32px}
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
  </div>
  <div id="panel-dashboard" class="panel active">
    <div class="stats" id="statsGrid"></div>
  </div>
  <div id="panel-users" class="panel">
    <div class="toolbar">
      <button class="btn" onclick="showUserModal()">新增用户</button>
    </div>
    <table><thead><tr><th>ID</th><th>用户名</th><th>角色</th><th>日配额</th><th>状态</th><th>操作</th></tr></thead><tbody id="usersBody"></tbody></table>
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
const API='/admin/api';
async function api(path,opts={}){const r=await fetch(API+path,{...opts,credentials:'include',headers:{'Content-Type':'application/json',...(opts.headers||{})}});if(r.status===401){showLogin();throw new Error('未授权')}return r.json()}
function showLogin(){document.getElementById('loginView').style.display='flex';document.getElementById('appView').style.display='none'}
function showApp(){document.getElementById('loginView').style.display='none';document.getElementById('appView').style.display='block'}
async function doLogin(){const pw=document.getElementById('passwordInput').value;const err=document.getElementById('loginError');err.style.display='none';try{const r=await fetch('/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({password:pw})});const d=await r.json();if(!d.success){err.textContent=d.error||'登录失败';err.style.display='block';return}showApp();loadAll()}catch(e){err.textContent='网络错误';err.style.display='block'}}
async function doLogout(){await fetch('/admin/logout',{method:'POST',credentials:'include'});showLogin()}
function switchTab(name){document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===name));document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active',p.id==='panel-'+name));if(name==='users')loadUsers();if(name==='announcements')loadAnnouncements();if(name==='rules')loadRules()}
function hideModal(id){document.getElementById(id).classList.remove('show')}
function showModal(id){document.getElementById(id).classList.add('show')}
function fmtTime(ts){if(!ts)return'-';const d=new Date(ts>1e12?ts:ts*1000);return d.toLocaleString('zh-CN')}
async function loadAll(){await loadStats()}
async function loadStats(){const d=await api('/stats');const s=d.stats;document.getElementById('statsGrid').innerHTML=[
  ['用户总数',s.totalUsers],['启用用户',s.activeUsers],['有效邮箱',s.activeMailboxes],['邮箱总数',s.totalMailboxes],
  ['今日收信',s.receivedToday],['今日发信',s.sentToday],['今日活跃用户',s.activeUsersToday],['有效用户 Token',s.activeUserTokens]
].map(([l,v])=>'<div class="stat"><div class="label">'+l+'</div><div class="value">'+v+'</div></div>').join('')}
async function loadUsers(){const d=await api('/users');const b=document.getElementById('usersBody');if(!d.users.length){b.innerHTML='<tr><td colspan="6" class="empty">暂无用户</td></tr>';return}b.innerHTML=d.users.map(u=>'<tr><td>'+u.id+'</td><td>'+u.username+'</td><td>'+u.role+'</td><td>'+(u.dailySendQuota<0?'无限':u.dailySendQuota)+'</td><td><span class="badge '+(u.enabled?'badge-ok':'badge-off')+'">'+(u.enabled?'启用':'禁用')+'</span></td><td><button class="btn btn-sm" onclick="editUser('+u.id+')">编辑</button> <button class="btn btn-danger btn-sm" onclick="deleteUser('+u.id+')">删除</button></td></tr>').join('');window._users=d.users}
function showUserModal(){document.getElementById('userModalTitle').textContent='新增用户';document.getElementById('userId').value='';document.getElementById('userUsername').value='';document.getElementById('userPassword').value='';document.getElementById('userRole').value='user';document.getElementById('userQuota').value='50';document.getElementById('userEnabledGroup').style.display='none';showModal('userModal')}
function editUser(id){const u=(window._users||[]).find(x=>x.id===id);if(!u)return;document.getElementById('userModalTitle').textContent='编辑用户';document.getElementById('userId').value=u.id;document.getElementById('userUsername').value=u.username;document.getElementById('userUsername').disabled=true;document.getElementById('userPassword').value='';document.getElementById('userRole').value=u.role;document.getElementById('userQuota').value=u.dailySendQuota;document.getElementById('userEnabled').value=u.enabled?'1':'0';document.getElementById('userEnabledGroup').style.display='block';showModal('userModal')}
async function saveUser(){const id=document.getElementById('userId').value;const body={username:document.getElementById('userUsername').value,password:document.getElementById('userPassword').value,role:document.getElementById('userRole').value,dailySendQuota:parseInt(document.getElementById('userQuota').value)||50};if(id){body.enabled=document.getElementById('userEnabled').value==='1';if(!body.password)delete body.password;await api('/users/'+id,{method:'PUT',body:JSON.stringify(body)})}else{if(!body.username||!body.password){alert('用户名和密码必填');return}await api('/users',{method:'POST',body:JSON.stringify(body)})}document.getElementById('userUsername').disabled=false;hideModal('userModal');loadUsers()}
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
