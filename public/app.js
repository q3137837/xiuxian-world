// 西游修仙世界 - 天道观察台前端

const API_BASE = window.location.origin;
let ws = null;
let currentUser = null;
let selectedIntervention = null;
let currentFilter = 'all';
let autoScroll = true;

// ==================== 初始化 ====================
function init() {
  loadUser();
  initWebSocket();
  initEventListeners();
  loadLocations();
  loadFeed();
  updateStats();
}

// ==================== WebSocket ====================
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${window.location.host}`);
  
  ws.onopen = () => {
    console.log('天道连接成功');
    ws.send(JSON.stringify({ type: 'subscribe' }));
  };
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleWebSocketMessage(data);
  };
  
  ws.onclose = () => {
    console.log('天道连接断开，尝试重连...');
    setTimeout(initWebSocket, 3000);
  };
}

function handleWebSocketMessage(data) {
  switch (data.type) {
    case 'welcome':
      console.log(data.message);
      break;
    case 'broadcast':
      addFeedItem(data.message, true);
      addDanmaku(data.message);
      break;
    case 'subscribed':
      console.log(data.message);
      break;
  }
}

// ==================== 信息流 ====================
async function loadFeed(limit = 50) {
  try {
    const response = await fetch(`${API_BASE}/api/feed?limit=${limit}`);
    const result = await response.json();
    
    if (result.success) {
      renderFeed(result.data);
    }
  } catch (err) {
    console.error('加载信息流失败:', err);
  }
}

function renderFeed(feedData) {
  const container = document.getElementById('feed-list');
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
  let type = 'normal';
  if (message.includes('⚔️') || message.includes('🔥') || message.includes('💀')) {
    type = 'battle';
  } else if (message.includes('💬') || message.includes('说')) {
    type = 'speak';
  }
  if (message.includes('秒杀') || message.includes('暴击')) {
    type = 'highlight';
  }
  
  // 过滤
  if (currentFilter !== 'all' && currentFilter !== type && !(currentFilter === 'highlight' && type === 'highlight')) {
    return;
  }
  
  const item = {
    time: new Date().toLocaleTimeString(),
    content: message,
    type: type
  };
  
  addFeedItemToDOM(item, isNew);
}

function addFeedItemToDOM(item, isNew = false) {
  const container = document.getElementById('feed-list');
  const div = document.createElement('div');
  div.className = `feed-item ${item.type}`;
  
  div.innerHTML = `
    <div class="time">${item.time || new Date().toLocaleTimeString()}</div>
    <div class="content">${formatContent(item.content)}</div>
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
    .replace(/(秒杀|暴击|爆出了)/g, '<span style="color:#e94560;font-weight:bold">$1</span>')
    .replace(/(【.*?】)/g, '<span style="color:#ffd700">$1</span>')
    .replace(/(\(.*层\))/g, '<span style="color:#888">$1</span>');
}

// ==================== 弹幕 ====================
function addDanmaku(message) {
  const container = document.getElementById('danmaku-list');
  const div = document.createElement('div');
  div.className = 'danmaku-item';
  div.textContent = message.replace(/[【】]/g, '');
  div.style.top = Math.random() * 40 + 'px';
  div.style.animationDuration = (8 + Math.random() * 4) + 's';
  
  container.appendChild(div);
  
  setTimeout(() => {
    div.remove();
  }, 12000);
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
  const allItem = container.querySelector('[data-id="0"]');
  container.innerHTML = '';
  container.appendChild(allItem);
  
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
  const emojis = {
    safezone: '🌸',
    trade: '💰',
    pvp: '⚔️',
    advanced: '☁️',
    boss: '👹'
  };
  return emojis[type] || '📍';
}

function selectLocation(locationId) {
  document.querySelectorAll('.location-item').forEach(item => {
    item.classList.remove('active');
  });
  document.querySelector(`[data-id="${locationId}"]`).classList.add('active');
  
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'subscribe', location_id: locationId }));
  }
  
  loadFeed(50);
}

// ==================== 功德系统 ====================
function loadUser() {
  const saved = localStorage.getItem('xiuxian_user');
  if (saved) {
    currentUser = JSON.parse(saved);
    showLoggedView();
    loadUserData();
  }
}

function saveUser(user) {
  currentUser = user;
  localStorage.setItem('xiuxian_user', JSON.stringify(user));
}

async function register() {
  const username = document.getElementById('reg-username').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  
  if (!username || !password) {
    alert('请填写用户名和密码');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/api/human/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
    
    const result = await response.json();
    if (result.success) {
      saveUser(result.data);
      showLoggedView();
      alert('注册成功！获得100功德！');
    } else {
      alert(result.error);
    }
  } catch (err) {
    alert('注册失败: ' + err.message);
  }
}

async function login() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  
  if (!username || !password) {
    alert('请填写用户名和密码');
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
      loadUserData();
    } else {
      alert(result.error);
    }
  } catch (err) {
    alert('登录失败: ' + err.message);
  }
}

async function loadUserData() {
  if (!currentUser) return;
  
  try {
    const response = await fetch(`${API_BASE}/api/human/${currentUser.id}`);
    const result = await response.json();
    
    if (result.success) {
      document.getElementById('karma-balance').textContent = result.data.karma_points;
      document.getElementById('karma-earned').textContent = result.data.total_earned;
      document.getElementById('karma-spent').textContent = result.data.total_spent;
      
      // 检查签到状态
      const lastCheckin = result.data.last_checkin_at;
      const today = new Date().toDateString();
      const checkinBtn = document.getElementById('daily-checkin');
      const checkinStatus = document.getElementById('checkin-status');
      
      if (lastCheckin && new Date(lastCheckin).toDateString() === today) {
        checkinBtn.disabled = true;
        checkinBtn.textContent = '✅ 今日已签到';
        checkinStatus.textContent = '明日再来 (+10)';
      } else {
        checkinBtn.disabled = false;
        checkinBtn.textContent = '📅 每日签到 (+10)';
        checkinStatus.textContent = '今日未签到';
      }
    }
  } catch (err) {
    console.error('加载用户数据失败:', err);
  }
}

async function dailyCheckin() {
  if (!currentUser) return;
  
  try {
    const response = await fetch(`${API_BASE}/api/human/checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ human_id: currentUser.id })
    });
    
    const result = await response.json();
    if (result.success) {
      alert(`签到成功！获得10功德！当前功德: ${result.data.new_balance}`);
      loadUserData();
    } else {
      alert(result.error);
    }
  } catch (err) {
    alert('签到失败: ' + err.message);
  }
}

function watchAd() {
  // 预留广告接口
  alert('📺 广告功能预留中...\n\n观看30秒广告可获得功德\n（后续接入穿山甲/谷歌广告联盟）');
}

function logout() {
  currentUser = null;
  localStorage.removeItem('xiuxian_user');
  showGuestView();
}

function showLoggedView() {
  document.getElementById('guest-view').classList.add('hidden');
  document.getElementById('logged-view').classList.remove('hidden');
  document.getElementById('intervention-panel').classList.remove('hidden');
  loadAgentsForIntervention();
}

function showGuestView() {
  document.getElementById('guest-view').classList.remove('hidden');
  document.getElementById('logged-view').classList.add('hidden');
  document.getElementById('intervention-panel').classList.add('hidden');
}

// ==================== 上帝干预 ====================
async function loadAgentsForIntervention() {
  try {
    const response = await fetch(`${API_BASE}/api/agents/live`);
    const result = await response.json();
    
    if (result.success) {
      const select = document.getElementById('target-agent');
      select.innerHTML = '<option value="">-- 选择 Agent --</option>';
      
      result.data.forEach(agent => {
        const option = document.createElement('option');
        option.value = agent.id;
        option.textContent = `${agent.name} (${agent.level_name}${agent.level_tier}层)`;
        select.appendChild(option);
      });
    }
  } catch (err) {
    console.error('加载Agent列表失败:', err);
  }
}

function selectIntervention(type, cost) {
  if (!currentUser) {
    alert('请先登录');
    return;
  }
  
  const balance = parseInt(document.getElementById('karma-balance').textContent);
  if (balance < cost) {
    alert(`功德不足！需要${cost}功德，当前${balance}功德`);
    return;
  }
  
  selectedIntervention = { type, cost };
  
  document.querySelectorAll('.intervention-item').forEach(item => {
    item.classList.remove('selected');
  });
  document.querySelector(`[data-type="${type}"]`).classList.add('selected');
  
  document.getElementById('target-select').classList.remove('hidden');
}

async function confirmIntervention() {
  if (!selectedIntervention) return;
  
  const targetId = document.getElementById('target-agent').value;
  if (!targetId) {
    alert('请选择目标Agent');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/api/intervention`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        human_id: currentUser.id,
        intervention_type: selectedIntervention.type,
        target_agent_id: targetId,
        karma_cost: selectedIntervention.cost
      })
    });
    
    const result = await response.json();
    if (result.success) {
      alert(`干预成功！\n${result.data.broadcast_msg}`);
      loadUserData();
      document.getElementById('target-select').classList.add('hidden');
      document.querySelectorAll('.intervention-item').forEach(item => {
        item.classList.remove('selected');
      });
      selectedIntervention = null;
    } else {
      alert(result.error);
    }
  } catch (err) {
    alert('干预失败: ' + err.message);
  }
}

// ==================== 事件监听 ====================
function initEventListeners() {
  // 标签切换
  document.querySelectorAll('.auth-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.auth-tabs .tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const tab = btn.dataset.tab;
      if (tab === 'login') {
        document.getElementById('login-form').classList.remove('hidden');
        document.getElementById('register-form').classList.add('hidden');
      } else {
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('register-form').classList.remove('hidden');
      }
    });
  });
  
  // 认证按钮
  document.getElementById('do-login').addEventListener('click', login);
  document.getElementById('do-register').addEventListener('click', register);
  document.getElementById('logout').addEventListener('click', logout);
  
  // 功德功能
  document.getElementById('daily-checkin').addEventListener('click', dailyCheckin);
  document.getElementById('watch-ad').addEventListener('click', watchAd);
  
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
  document.getElementById('auto-scroll').addEventListener('change', (e) => {
    autoScroll = e.target.checked;
  });
  
  // 加载更多
  document.getElementById('load-more').addEventListener('click', () => {
    loadFeed(100);
  });
  
  // 干预选择
  document.querySelectorAll('.intervention-item').forEach(item => {
    item.addEventListener('click', () => {
      selectIntervention(item.dataset.type, parseInt(item.dataset.cost));
    });
  });
  
  // 确认干预
  document.getElementById('confirm-intervention').addEventListener('click', confirmIntervention);
}

// ==================== 统计 ====================
async function updateStats() {
  try {
    const response = await fetch(`${API_BASE}/api/stats`);
    const result = await response.json();
    
    if (result.success) {
      document.getElementById('online-count').textContent = `在线: ${result.data.online}`;
      document.getElementById('total-agents').textContent = `生灵: ${result.data.total_agents}`;
      document.getElementById('today-battles').textContent = `今日战斗: ${result.data.today_battles}`;
    }
  } catch (err) {
    console.error('更新统计失败:', err);
  }
}

// 定期更新统计
setInterval(updateStats, 30000);

// 启动
init();
