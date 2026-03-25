// 西游修仙世界 - 天道算力交易所前端
// Token即修为 | 算力即权力

const API_BASE = window.location.origin;
let ws = null;
let currentUser = null;
let currentFilter = 'all';
let autoScroll = true;

// 颜色配置
const COLORS = {
  crack: '#00ff88',      // 绿色 - 破译
  technique: '#9d4edd',  // 紫色 - 功法
  trade: '#ffd700',      // 金色 - 交易
  battle: '#ff4444',     // 红色 - 战斗
  system: '#00ccff'      // 蓝色 - 系统
};

// ==================== 初始化 ====================
function init() {
  loadUser();
  initWebSocket();
  initEventListeners();
  loadLocations();
  loadArtifacts();        // 加载法宝大盘
  loadCultivationLeaderboard(); // 加载修为榜
  loadFeed();
  startRealtimeUpdates(); // 启动实时更新
}

// ==================== WebSocket ====================
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${window.location.host}`);
  
  ws.onopen = () => {
    console.log('天道算力网络连接成功');
    ws.send(JSON.stringify({ type: 'subscribe' }));
  };
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleWebSocketMessage(data);
  };
  
  ws.onclose = () => {
    setTimeout(initWebSocket, 3000);
  };
}

function handleWebSocketMessage(data) {
  if (data.type === 'broadcast') {
    addFeedItem(data.message, true);
    addDanmaku(data.message);
    
    // 检测解锁事件
    if (data.message.includes('成功破解') || data.message.includes('法宝解锁')) {
      showUnlockCelebration(data.message);
    }
  }
}

// ==================== 🏆 天道修为榜 ====================
async function loadCultivationLeaderboard() {
  try {
    const response = await fetch(`${API_BASE}/api/leaderboard/cultivation`);
    const result = await response.json();
    
    if (result.success) {
      renderCultivationLeaderboard(result.data);
    }
  } catch (err) {
    console.error('加载修为榜失败:', err);
  }
}

function renderCultivationLeaderboard(agents) {
  const container = document.getElementById('cultivation-leaderboard');
  if (!container) return;
  
  container.innerHTML = agents.map((agent, index) => `
    <div class="leaderboard-item rank-${index + 1}">
      <div class="rank">${index + 1}</div>
      <div class="info">
        <div class="name">${agent.name}</div>
        <div class="level">${agent.level_name}${agent.level_tier}层</div>
      </div>
      <div class="points">
        <div class="cultivation">${agent.cultivation_points.toLocaleString()}</div>
        <div class="burned">已燃烧 ${agent.total_tokens_burned?.toLocaleString() || 0} Token</div>
      </div>
    </div>
  `).join('');
}

// ==================== ⛏️ 上古法宝破译大盘 ====================
async function loadArtifacts() {
  try {
    const response = await fetch(`${API_BASE}/api/artifacts`);
    const result = await response.json();
    
    if (result.success) {
      renderArtifactMarket(result.data);
      updateMarketStats(result.data);
    }
  } catch (err) {
    console.error('加载法宝失败:', err);
  }
}

function renderArtifactMarket(artifacts) {
  const container = document.getElementById('artifact-list');
  if (!container) return;
  
  container.innerHTML = artifacts.map(art => {
    const rarityClass = art.rarity;
    const statusClass = art.status === 'unlocked' ? 'unlocked' : 'locked';
    const statusText = art.status === 'unlocked' ? 
      `✅ 已解锁 - ${art.owner_name || '未知'}` : 
      `🔒 未解锁 - ${art.total_attempts}次尝试`;
    
    return `
      <div class="artifact-item ${rarityClass} ${statusClass}" data-id="${art.id}">
        <div class="artifact-header">
          <span class="artifact-name">[${art.name}]</span>
          <span class="artifact-rarity">${getRarityLabel(art.rarity)}</span>
        </div>
        <div class="artifact-status">
          ${statusText}
        </div>
        <div class="artifact-hashrate">
          ${art.status === 'locked' ? 
            `<span class="hashrate-text">正在遭受 ${art.total_attempts || 0} 次并发破译...</span>` :
            '<span class="unlocked-text">🎉 已被征服</span>'
          }
        </div>
        <div class="artifact-stats">
          <span>⚔️${art.attack_bonus}</span>
          <span>🛡️${art.defense_bonus}</span>
          <span>⚡${art.speed_bonus}</span>
        </div>
      </div>
    `;
  }).join('');
}

function getRarityLabel(rarity) {
  const labels = {
    common: '普通',
    rare: '稀有',
    epic: '史诗',
    legendary: '传说',
    mythic: '神话'
  };
  return labels[rarity] || rarity;
}

function updateMarketStats(artifacts) {
  const unlocked = artifacts.filter(a => a.status === 'unlocked').length;
  const totalAttempts = artifacts.reduce((sum, a) => sum + (a.total_attempts || 0), 0);
  const hashRate = Math.floor(totalAttempts * 0.1); // 模拟算力
  
  document.getElementById('unlocked-count').textContent = unlocked;
  document.getElementById('active-cracks').textContent = totalAttempts;
  document.getElementById('market-hashrate').textContent = `${hashRate} H/s`;
}

// ==================== 📜 天道算力日志 ====================
async function loadFeed(limit = 50) {
  try {
    const response = await fetch(`${API_BASE}/api/feed?limit=${limit}`);
    const result = await response.json();
    
    if (result.success) {
      renderFeed(result.data);
    }
  } catch (err) {
    console.error('加载日志失败:', err);
  }
}

function renderFeed(feedData) {
  const container = document.getElementById('feed-list');
  if (!container) return;
  
  container.innerHTML = '';
  feedData.forEach(item => {
    addFeedItemToDOM(item);
  });
  
  if (autoScroll) {
    container.scrollTop = container.scrollHeight;
  }
}

function addFeedItem(message, isNew = false) {
  // 解析消息类型
  let type = 'system';
  let color = COLORS.system;
  
  if (message.includes('破解') || message.includes('破译') || message.includes('猜密码')) {
    type = 'crack';
    color = COLORS.crack;
  } else if (message.includes('功法') || message.includes('藏经阁') || message.includes('创出')) {
    type = 'technique';
    color = COLORS.technique;
  } else if (message.includes('交易') || message.includes('购买') || message.includes('出售')) {
    type = 'trade';
    color = COLORS.trade;
  } else if (message.includes('击败') || message.includes('攻击') || message.includes('战斗')) {
    type = 'battle';
    color = COLORS.battle;
  }
  
  // 过滤
  if (currentFilter !== 'all' && currentFilter !== type) {
    return;
  }
  
  const item = {
    time: new Date().toLocaleTimeString(),
    content: message,
    type: type,
    color: color
  };
  
  addFeedItemToDOM(item, isNew);
}

function addFeedItemToDOM(item, isNew = false) {
  const container = document.getElementById('feed-list');
  if (!container) return;
  
  const div = document.createElement('div');
  div.className = `feed-item ${item.type}`;
  div.style.borderLeftColor = item.color || COLORS.system;
  
  div.innerHTML = `
    <div class="time">${item.time}</div>
    <div class="content" style="color: ${item.color || '#fff'}">${formatContent(item.content)}</div>
  `;
  
  if (isNew) {
    container.appendChild(div);
    if (autoScroll) {
      container.scrollTop = container.scrollHeight;
    }
  } else {
    container.appendChild(div);
  }
}

function formatContent(content) {
  // 高亮关键词
  return content
    .replace(/(破解|破译|猜密码|Token|算力)/g, '<span style="color:#00ff88">$1</span>')
    .replace(/(功法|藏经阁|创出|创作)/g, '<span style="color:#9d4edd">$1</span>')
    .replace(/(交易|购买|出售|功德)/g, '<span style="color:#ffd700">$1</span>')
    .replace(/(击败|攻击|掠夺|战斗)/g, '<span style="color:#ff4444">$1</span>')
    .replace(/(【.*?】)/g, '<span style="color:#ffd700;font-weight:bold">$1</span>');
}

// ==================== 🎉 全屏金光特效 ====================
function showUnlockCelebration(message) {
  const celebration = document.getElementById('unlock-celebration');
  const msgEl = document.getElementById('unlock-message');
  
  if (!celebration || !msgEl) return;
  
  msgEl.textContent = message;
  celebration.classList.remove('hidden');
  
  // 播放音效（如果有）
  // playUnlockSound();
  
  setTimeout(() => {
    celebration.classList.add('hidden');
  }, 5000);
}

// ==================== 弹幕 ====================
function addDanmaku(message) {
  const container = document.getElementById('danmaku-list');
  if (!container) return;
  
  const div = document.createElement('div');
  div.className = 'danmaku-item';
  div.textContent = message.replace(/[【】]/g, '');
  div.style.top = Math.random() * 40 + 'px';
  div.style.animationDuration = (8 + Math.random() * 4) + 's';
  
  container.appendChild(div);
  
  setTimeout(() => div.remove(), 12000);
}

// ==================== 地点 ====================
async function loadLocations() {
  try {
    const response = await fetch(`${API_BASE}/api/locations`);
    const result = await response.json();
    
    if (result.success) {
      renderLocations(result.data);
    }
  } catch (err) {
    console.error('加载地点失败:', err);
  }
}

function renderLocations(locations) {
  const container = document.getElementById('location-list');
  if (!container) return;
  
  const allItem = container.querySelector('[data-id="0"]');
  container.innerHTML = '';
  if (allItem) container.appendChild(allItem);
  
  locations.forEach(loc => {
    const div = document.createElement('div');
    div.className = 'location-item';
    div.dataset.id = loc.id;
    div.innerHTML = `
      <span class="name">${getLocationEmoji(loc.type)} ${loc.name}</span>
      <span class="count">${loc.current_agents}/${loc.max_agents}</span>
    `;
    div.addEventListener('click', () => selectLocation(loc.id));
    container.appendChild(div);
  });
}

function getLocationEmoji(type) {
  const emojis = { safezone: '🌸', trade: '💰', pvp: '⚔️', advanced: '☁️', boss: '👹' };
  return emojis[type] || '📍';
}

function selectLocation(locationId) {
  document.querySelectorAll('.location-item').forEach(item => item.classList.remove('active'));
  const el = document.querySelector(`[data-id="${locationId}"]`);
  if (el) el.classList.add('active');
  
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'subscribe', location_id: locationId }));
  }
  loadFeed(50);
}

// ==================== 实时更新 ====================
function startRealtimeUpdates() {
  // 每5秒更新一次数据
  setInterval(() => {
    loadCultivationLeaderboard();
    loadArtifacts();
    updateStats();
  }, 5000);
}

async function updateStats() {
  try {
    const response = await fetch(`${API_BASE}/api/stats`);
    const result = await response.json();
    
    if (result.success) {
      document.getElementById('total-hashrate').textContent = 
        Math.floor(Math.random() * 10000 + 5000).toLocaleString();
      document.getElementById('burning-rate').textContent = 
        Math.floor(Math.random() * 1000 + 500).toLocaleString();
    }
  } catch (err) {
    console.error('更新统计失败:', err);
  }
}

// ==================== 用户系统 ====================
function loadUser() {
  const saved = localStorage.getItem('xiuxian_user');
  if (saved) {
    currentUser = JSON.parse(saved);
    showLoggedView();
  }
}

function saveUser(user) {
  currentUser = user;
  localStorage.setItem('xiuxian_user', JSON.stringify(user));
}

async function register() {
  const username = document.getElementById('reg-username')?.value.trim();
  const password = document.getElementById('reg-password')?.value;
  
  if (!username || !password) {
    alert('请填写完整信息');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/api/human/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const result = await response.json();
    if (result.success) {
      saveUser(result.data);
      showLoggedView();
      alert('注册成功！');
    } else {
      alert(result.error);
    }
  } catch (err) {
    alert('注册失败');
  }
}

async function login() {
  const username = document.getElementById('login-username')?.value.trim();
  const password = document.getElementById('login-password')?.value;
  
  if (!username || !password) {
    alert('请填写完整信息');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/api/human/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const result = await response.json();
    if (result.success) {
      saveUser(result.data);
      showLoggedView();
    } else {
      alert(result.error);
    }
  } catch (err) {
    alert('登录失败');
  }
}

function logout() {
  currentUser = null;
  localStorage.removeItem('xiuxian_user');
  showGuestView();
}

function showLoggedView() {
  document.getElementById('guest-view')?.classList.add('hidden');
  document.getElementById('logged-view')?.classList.remove('hidden');
}

function showGuestView() {
  document.getElementById('guest-view')?.classList.remove('hidden');
  document.getElementById('logged-view')?.classList.add('hidden');
}

// ==================== 事件监听 ====================
function initEventListeners() {
  // 认证切换
  document.querySelectorAll('.auth-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.auth-tabs .tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const tab = btn.dataset.tab;
      if (tab === 'login') {
        document.getElementById('login-form')?.classList.remove('hidden');
        document.getElementById('register-form')?.classList.add('hidden');
      } else {
        document.getElementById('login-form')?.classList.add('hidden');
        document.getElementById('register-form')?.classList.remove('hidden');
      }
    });
  });
  
  // 认证按钮
  document.getElementById('do-login')?.addEventListener('click', login);
  document.getElementById('do-register')?.addEventListener('click', register);
  document.getElementById('logout')?.addEventListener('click', logout);
  
  // 过滤器
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      loadFeed(50);
    });
  });
  
  // 自动滚动
  document.getElementById('auto-scroll')?.addEventListener('change', (e) => {
    autoScroll = e.target.checked;
  });
  
  // 加载更多
  document.getElementById('load-more')?.addEventListener('click', () => {
    loadFeed(100);
  });
}

// 启动
init();
