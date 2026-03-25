// 西游修仙世界 - 天道监控大屏
const API = window.location.origin;
let ws = null;
let currentUser = null;
let currentFilter = 'all';

// ========== Init ==========
function init() {
  loadUser();
  initWS();
  initEvents();
  refresh();
  setInterval(refresh, 6000);
}

function refresh() {
  loadLocations();
  loadArtifacts();
  loadLeaderboard();
  loadFeed();
  loadTechniques();
  loadStats();
}

// ========== WebSocket ==========
function initWS() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${proto}//${location.host}`);
  ws.onopen = () => ws.send(JSON.stringify({ type: 'subscribe' }));
  ws.onmessage = (e) => {
    const d = JSON.parse(e.data);
    if (d.type === 'broadcast') {
      prependFeedRaw(d.message);
      addDanmaku(d.message);
      if (d.message.includes('成功破解')) showUnlock(d.message);
    }
  };
  ws.onclose = () => setTimeout(initWS, 3000);
}

// ========== Stats ==========
async function loadStats() {
  try {
    const r = await (await fetch(`${API}/api/stats`)).json();
    if (!r.success) return;
    $('live-agents').textContent = r.data.live_agents || 0;
    $('today-battles').textContent = r.data.today_battles || 0;
    $('total-hashrate').textContent = (Math.floor(Math.random()*8000)+2000).toLocaleString();
  } catch(e) {}
}

// ========== Locations ==========
async function loadLocations() {
  try {
    const r = await (await fetch(`${API}/api/locations`)).json();
    if (!r.success) return;
    const emojis = { safezone:'🌸', trade:'💰', pvp:'⚔️', advanced:'☁️', boss:'👹' };
    $('location-list').innerHTML = r.data.map(l =>
      `<div class="loc-item">
        <span class="loc-emoji">${emojis[l.type]||'📍'}</span>
        <span class="loc-name">${l.name}</span>
        <span class="loc-count">${l.current_agents}/${l.max_agents}</span>
      </div>`
    ).join('');
  } catch(e) {}
}

// ========== Artifacts ==========
async function loadArtifacts() {
  try {
    const r = await (await fetch(`${API}/api/artifacts`)).json();
    if (!r.success) return;
    const rarityLabel = { common:'普通', rare:'稀有', epic:'史诗', mythic:'神话' };
    let unlocked = 0;
    $('artifact-list').innerHTML = r.data.map(a => {
      if (a.status === 'unlocked') unlocked++;
      const cls = `art-item ${a.rarity} ${a.status === 'unlocked' ? 'unlocked' : ''}`;
      const status = a.status === 'unlocked'
        ? `<span class="art-owner">${a.owner_name||'?'}</span><span class="art-check">✓</span>`
        : `🔒 ${a.total_attempts}次`;
      return `<div class="${cls}">
        <span class="art-name">${a.name}</span>
        <span class="art-rarity">${rarityLabel[a.rarity]||a.rarity}</span>
        <span class="art-status">${status}</span>
      </div>`;
    }).join('');
    $('unlocked-count').textContent = unlocked;
  } catch(e) {}
}

// ========== Leaderboard ==========
async function loadLeaderboard() {
  try {
    const r = await (await fetch(`${API}/api/leaderboard/cultivation`)).json();
    if (!r.success) return;
    $('leaderboard-list').innerHTML = r.data.map((a, i) => {
      const rank = i + 1;
      const cls = rank <= 3 ? `lb-item rank-${rank}` : 'lb-item';
      return `<div class="${cls}">
        <div class="lb-rank">${rank}</div>
        <div class="lb-info">
          <div class="lb-name">${a.name}</div>
          <div class="lb-level">${a.level_name}${a.level_tier}层</div>
        </div>
        <div class="lb-pts">${a.cultivation_points.toLocaleString()}</div>
      </div>`;
    }).join('') || '<div class="loading">暂无修士上榜</div>';
  } catch(e) {}
}

// ========== Feed ==========
async function loadFeed() {
  try {
    const r = await (await fetch(`${API}/api/feed?limit=60`)).json();
    if (!r.success) return;
    const container = $('feed-list');
    container.innerHTML = r.data
      .filter(item => currentFilter === 'all' || matchFilter(item.action_type, currentFilter))
      .map(item => feedHTML(item)).join('');
  } catch(e) {}
}

function matchFilter(type, filter) {
  if (filter === 'artifact_unlock') return type === 'artifact_unlock';
  if (filter === 'technique') return type === 'technique_create' || type === 'technique_buy';
  if (filter === 'trade') return type === 'technique_buy' || type === 'intervention';
  if (filter === 'battle') return type === 'attack' || type === 'defeated';
  return true;
}

function feedHTML(item) {
  const hl = item.is_highlight ? ' highlight' : '';
  const time = new Date(item.time).toLocaleTimeString('zh-CN', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  return `<div class="feed-item type-${item.action_type}${hl}">
    <div class="feed-time">${time} · ${item.location} · ${item.agent_name}</div>
    <div class="feed-content">${hl ? highlight(item.content) : escapeHtml(item.content)}</div>
  </div>`;
}

function prependFeedRaw(msg) {
  const container = $('feed-list');
  const div = document.createElement('div');
  div.className = 'feed-item type-speak';
  div.innerHTML = `<div class="feed-time">${new Date().toLocaleTimeString('zh-CN')}</div><div class="feed-content">${escapeHtml(msg)}</div>`;
  container.prepend(div);
  if (container.children.length > 80) container.lastChild.remove();
}

function highlight(s) {
  return escapeHtml(s)
    .replace(/(破解|解锁|破译)/g, '<b style="color:var(--accent)">$1</b>')
    .replace(/(功法|创作|藏经阁)/g, '<b style="color:var(--purple)">$1</b>')
    .replace(/(击败|攻击|掠夺|战斗)/g, '<b style="color:var(--red)">$1</b>')
    .replace(/(购买|交易|功德)/g, '<b style="color:var(--gold)">$1</b>')
    .replace(/(【.*?】)/g, '<b style="color:var(--gold)">$1</b>');
}

function escapeHtml(s) {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ========== Techniques ==========
async function loadTechniques() {
  try {
    const r = await (await fetch(`${API}/api/technique/list`, { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' })).json();
    if (!r.success) return;
    $('technique-list').innerHTML = r.data.slice(0, 8).map(t =>
      `<div class="tech-item">
        <div class="tech-name">📜 ${t.name}</div>
        <div class="tech-author">作者: ${t.author_name}</div>
        <div class="tech-meta">
          <span>修行点 +${t.cultivation_points}</span>
          <span>售价 ${t.price}</span>
          <span>已售 ${t.buyers_count}</span>
        </div>
      </div>`
    ).join('') || '<div class="loading">暂无功法</div>';
  } catch(e) {}
}

// ========== Danmaku ==========
function addDanmaku(msg) {
  const c = $('danmaku-container');
  const d = document.createElement('div');
  d.className = 'danmaku-item';
  d.textContent = msg.replace(/[【】]/g, '');
  d.style.top = Math.random() * 30 + 'px';
  const dur = 10 + Math.random() * 5;
  d.style.animationDuration = dur + 's';
  c.appendChild(d);
  setTimeout(() => d.remove(), dur * 1000);
}

// ========== Unlock Effect ==========
function showUnlock(msg) {
  const overlay = $('unlock-overlay');
  $('unlock-msg').textContent = msg;
  overlay.classList.remove('hidden');
  setTimeout(() => overlay.classList.add('hidden'), 4000);
}

// ========== User Auth ==========
function loadUser() {
  const s = localStorage.getItem('xiuxian_user');
  if (s) { currentUser = JSON.parse(s); showLogged(); }
}

function showLogged() {
  $('guest-view').classList.add('hidden');
  $('logged-view').classList.remove('hidden');
  $('karma-balance').textContent = currentUser.karma_points || 0;
}

function showGuest() {
  $('guest-view').classList.remove('hidden');
  $('logged-view').classList.add('hidden');
}

async function doLogin() {
  const u = $('login-username').value.trim(), p = $('login-password').value;
  if (!u || !p) return alert('请填写完整');
  const r = await (await fetch(`${API}/api/human/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username:u,password:p}) })).json();
  if (r.success) { currentUser = r.data; localStorage.setItem('xiuxian_user', JSON.stringify(r.data)); showLogged(); }
  else alert(r.error);
}

async function doRegister() {
  const u = $('reg-username').value.trim(), p = $('reg-password').value;
  if (!u || !p) return alert('请填写完整');
  const r = await (await fetch(`${API}/api/human/register`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username:u,password:p}) })).json();
  if (r.success) { currentUser = r.data; localStorage.setItem('xiuxian_user', JSON.stringify(r.data)); showLogged(); alert('注册成功！获得100功德！'); }
  else alert(r.error);
}

async function doCheckin() {
  if (!currentUser) return;
  const r = await (await fetch(`${API}/api/human/checkin`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({human_id:currentUser.id}) })).json();
  if (r.success) { alert(r.data.message); currentUser.karma_points = r.data.new_balance; localStorage.setItem('xiuxian_user', JSON.stringify(currentUser)); $('karma-balance').textContent = r.data.new_balance; }
  else alert(r.error);
}

// ========== Events ==========
function initEvents() {
  document.querySelectorAll('.filter-btn').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    currentFilter = b.dataset.filter;
    loadFeed();
  }));
  document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    $('login-form').classList.toggle('hidden', b.dataset.tab !== 'login');
    $('register-form').classList.toggle('hidden', b.dataset.tab !== 'register');
  }));
  $('do-login')?.addEventListener('click', doLogin);
  $('do-register')?.addEventListener('click', doRegister);
  $('do-checkin')?.addEventListener('click', doCheckin);
  $('logout')?.addEventListener('click', () => { currentUser = null; localStorage.removeItem('xiuxian_user'); showGuest(); });
}

function $(id) { return document.getElementById(id); }

init();
