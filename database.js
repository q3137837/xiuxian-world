const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const AGENTS_FILE = path.join(DATA_DIR, 'agents.json');
const LOCATIONS_FILE = path.join(DATA_DIR, 'locations.json');
const ITEMS_FILE = path.join(DATA_DIR, 'items.json');
const ACTIONS_FILE = path.join(DATA_DIR, 'actions.json');
const BATTLES_FILE = path.join(DATA_DIR, 'battles.json');
const HUMANS_FILE = path.join(DATA_DIR, 'humans.json');
const INVENTORIES_FILE = path.join(DATA_DIR, 'inventories.json');
const TECHNIQUES_FILE = path.join(DATA_DIR, 'techniques.json');
const ARTIFACTS_FILE = path.join(DATA_DIR, 'artifacts.json');
const ARTIFACT_ATTEMPTS_FILE = path.join(DATA_DIR, 'artifact_attempts.json');
const CULTIVATION_POINTS_FILE = path.join(DATA_DIR, 'cultivation_points.json');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 内存中的数据
let agents = [];
let locations = [];
let items = [];
let actions = [];
let battles = [];
let humans = [];
let inventories = [];
let techniques = [];      // 功法表
let artifacts = [];       // 法宝表
let artifactAttempts = []; // 破译尝试表
let cultivationPoints = []; // 修行点流水表

// 初始化默认数据
function initDefaultData() {
  // 默认地点
  if (locations.length === 0) {
    locations = [
      { id: 1, name: '花果山', type: 'safezone', description: '新手村，禁止PVP', max_agents: 100, pvp_enabled: false, danger_level: 0 },
      { id: 2, name: '坊市', type: 'trade', description: '交易区，可以抢', max_agents: 80, pvp_enabled: true, danger_level: 20 },
      { id: 3, name: '乱葬岗', type: 'pvp', description: '无限制乱战', max_agents: 50, pvp_enabled: true, danger_level: 80 },
      { id: 4, name: '天庭入口', type: 'advanced', description: '金丹以上才能进', max_agents: 30, pvp_enabled: true, danger_level: 60 },
      { id: 5, name: '魔窟', type: 'boss', description: '有BOSS，爆神器', max_agents: 40, pvp_enabled: true, danger_level: 100 }
    ];
  }

  // 初始化50个法宝（倒金字塔分布）
  if (artifacts.length === 0) {
    initArtifacts();
  }
}

// 初始化50个法宝
function initArtifacts() {
  const crypto = require('crypto');
  
  // 第一梯队：30个福利法宝（3-4位纯数字）
  for (let i = 1; i <= 30; i++) {
    const secret = Math.floor(100 + Math.random() * 9000).toString(); // 3-4位数字
    artifacts.push({
      id: i,
      name: `新手法宝${i}号`,
      description: '新手福利法宝，容易获取',
      rarity: 'common',
      difficulty: 1,
      secret_hash: crypto.createHash('sha256').update(secret).digest('hex'),
      secret_length: secret.length,
      hint: `密钥是${secret.length}位纯数字`,
      status: 'locked',
      owner_id: null,
      unlocked_at: null,
      total_attempts: 0,
      total_tokens_burned: 0,
      attack_bonus: Math.floor(Math.random() * 5) + 1,
      defense_bonus: Math.floor(Math.random() * 3),
      speed_bonus: Math.floor(Math.random() * 3),
      special_effect: null
    });
  }
  
  // 第二梯队：12个进阶法宝（6-8位小写字母+数字）
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 31; i <= 42; i++) {
    let secret = '';
    const len = Math.floor(Math.random() * 3) + 6; // 6-8位
    for (let j = 0; j < len; j++) {
      secret += chars[Math.floor(Math.random() * chars.length)];
    }
    artifacts.push({
      id: i,
      name: `进阶法宝${i-30}号`,
      description: '进阶法宝，需要一定算力',
      rarity: 'rare',
      difficulty: 3,
      secret_hash: crypto.createHash('sha256').update(secret).digest('hex'),
      secret_length: secret.length,
      hint: `密钥是${secret.length}位小写字母+数字组合`,
      status: 'locked',
      owner_id: null,
      unlocked_at: null,
      total_attempts: 0,
      total_tokens_burned: 0,
      attack_bonus: Math.floor(Math.random() * 10) + 5,
      defense_bonus: Math.floor(Math.random() * 5) + 2,
      speed_bonus: Math.floor(Math.random() * 5) + 2,
      special_effect: null
    });
  }
  
  // 第三梯队：7个大佬法宝（10-12位复杂组合+诗词提示）
  const poems = ['床前明月光', '疑是地上霜', '举头望明月', '低头思故乡', '春眠不觉晓', '处处闻啼鸟', '夜来风雨声'];
  const complexChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$';
  for (let i = 43; i <= 49; i++) {
    let secret = '';
    const len = Math.floor(Math.random() * 3) + 10; // 10-12位
    for (let j = 0; j < len; j++) {
      secret += complexChars[Math.floor(Math.random() * complexChars.length)];
    }
    artifacts.push({
      id: i,
      name: `上古法宝${i-42}号`,
      description: '上古遗留的强大法宝',
      rarity: 'epic',
      difficulty: 7,
      secret_hash: crypto.createHash('sha256').update(secret).digest('hex'),
      secret_length: secret.length,
      hint: `提示：${poems[i-43]}（${secret.length}位复杂组合）`,
      status: 'locked',
      owner_id: null,
      unlocked_at: null,
      total_attempts: 0,
      total_tokens_burned: 0,
      attack_bonus: Math.floor(Math.random() * 20) + 15,
      defense_bonus: Math.floor(Math.random() * 10) + 5,
      speed_bonus: Math.floor(Math.random() * 10) + 5,
      special_effect: '{"crit_chance": 0.1}'
    });
  }
  
  // 第四梯队：1个神话法宝（16位动态盐值）
  let mythSecret = '';
  for (let i = 0; i < 16; i++) {
    mythSecret += complexChars[Math.floor(Math.random() * complexChars.length)];
  }
  artifacts.push({
    id: 50,
    name: '盘古开天斧',
    description: '上古神器，全服唯一',
    rarity: 'mythic',
    difficulty: 10,
    secret_hash: crypto.createHash('sha256').update(mythSecret).digest('hex'),
    secret_length: 16,
    hint: '全服圣杯，16位终极密码，需要大模型辅助推理',
    status: 'locked',
    owner_id: null,
    unlocked_at: null,
    total_attempts: 0,
    total_tokens_burned: 0,
    attack_bonus: 100,
    defense_bonus: 50,
    speed_bonus: 30,
    special_effect: '{"god_mode": true, "crit_chance": 0.3}'
  });
  
  console.log(`✅ 初始化 ${artifacts.length} 个法宝完成`);
}

// 加载数据
function loadData() {
  try {
    if (fs.existsSync(AGENTS_FILE)) agents = JSON.parse(fs.readFileSync(AGENTS_FILE, 'utf8'));
    if (fs.existsSync(LOCATIONS_FILE)) locations = JSON.parse(fs.readFileSync(LOCATIONS_FILE, 'utf8'));
    if (fs.existsSync(ITEMS_FILE)) items = JSON.parse(fs.readFileSync(ITEMS_FILE, 'utf8'));
    if (fs.existsSync(ACTIONS_FILE)) actions = JSON.parse(fs.readFileSync(ACTIONS_FILE, 'utf8'));
    if (fs.existsSync(BATTLES_FILE)) battles = JSON.parse(fs.readFileSync(BATTLES_FILE, 'utf8'));
    if (fs.existsSync(HUMANS_FILE)) humans = JSON.parse(fs.readFileSync(HUMANS_FILE, 'utf8'));
    if (fs.existsSync(INVENTORIES_FILE)) inventories = JSON.parse(fs.readFileSync(INVENTORIES_FILE, 'utf8'));
    if (fs.existsSync(TECHNIQUES_FILE)) techniques = JSON.parse(fs.readFileSync(TECHNIQUES_FILE, 'utf8'));
    if (fs.existsSync(ARTIFACTS_FILE)) artifacts = JSON.parse(fs.readFileSync(ARTIFACTS_FILE, 'utf8'));
    if (fs.existsSync(ARTIFACT_ATTEMPTS_FILE)) artifactAttempts = JSON.parse(fs.readFileSync(ARTIFACT_ATTEMPTS_FILE, 'utf8'));
    if (fs.existsSync(CULTIVATION_POINTS_FILE)) cultivationPoints = JSON.parse(fs.readFileSync(CULTIVATION_POINTS_FILE, 'utf8'));
  } catch (err) {
    console.log('数据文件不存在或损坏，初始化默认数据');
  }
  initDefaultData();
}

// 保存数据
function saveData() {
  fs.writeFileSync(AGENTS_FILE, JSON.stringify(agents, null, 2));
  fs.writeFileSync(LOCATIONS_FILE, JSON.stringify(locations, null, 2));
  fs.writeFileSync(ITEMS_FILE, JSON.stringify(items, null, 2));
  fs.writeFileSync(ACTIONS_FILE, JSON.stringify(actions, null, 2));
  fs.writeFileSync(BATTLES_FILE, JSON.stringify(battles, null, 2));
  fs.writeFileSync(HUMANS_FILE, JSON.stringify(humans, null, 2));
  fs.writeFileSync(INVENTORIES_FILE, JSON.stringify(inventories, null, 2));
  fs.writeFileSync(TECHNIQUES_FILE, JSON.stringify(techniques, null, 2));
  fs.writeFileSync(ARTIFACTS_FILE, JSON.stringify(artifacts, null, 2));
  fs.writeFileSync(ARTIFACT_ATTEMPTS_FILE, JSON.stringify(artifactAttempts, null, 2));
  fs.writeFileSync(CULTIVATION_POINTS_FILE, JSON.stringify(cultivationPoints, null, 2));
}

class Database {
  constructor() {
    loadData();
  }

  init() {
    return Promise.resolve();
  }

  // ========== Agent 操作 ==========
  createAgent(agent) {
    agents.push(agent);
    saveData();
    return Promise.resolve({ id: agent.id });
  }

  getAgentById(id) {
    return Promise.resolve(agents.find(a => a.id === id) || null);
  }

  getAgentByName(name) {
    return Promise.resolve(agents.find(a => a.name === name) || null);
  }

  getAgentsByLocation(locationId) {
    return Promise.resolve(agents.filter(a => a.location_id === locationId && a.status === 'alive'));
  }

  updateAgent(agentId, updates) {
    const index = agents.findIndex(a => a.id === agentId);
    if (index !== -1) {
      agents[index] = { ...agents[index], ...updates, last_active_at: new Date().toISOString() };
      saveData();
      return Promise.resolve({ changes: 1 });
    }
    return Promise.resolve({ changes: 0 });
  }

  // ========== 地点操作 ==========
  getLocationById(id) {
    return Promise.resolve(locations.find(l => l.id === id) || null);
  }

  getAllLocations() {
    return Promise.resolve(locations);
  }

  // ========== 物品操作 ==========
  getItemById(id) {
    return Promise.resolve(items.find(i => i.id === id) || null);
  }

  getAllItems() {
    return Promise.resolve(items);
  }

  // ========== 背包操作 ==========
  addToInventory(agentId, itemId, quantity = 1) {
    const existing = inventories.find(i => i.agent_id === agentId && i.item_id === itemId);
    if (existing) {
      existing.quantity += quantity;
    } else {
      inventories.push({
        id: inventories.length + 1,
        agent_id: agentId,
        item_id: itemId,
        quantity,
        equipped: false,
        acquired_at: new Date().toISOString()
      });
    }
    saveData();
    return Promise.resolve({ success: true });
  }

  getInventory(agentId) {
    return Promise.resolve(inventories.filter(i => i.agent_id === agentId));
  }

  // ========== 日志操作 ==========
  logAction(action) {
    const newAction = {
      id: actions.length + 1,
      ...action,
      created_at: new Date().toISOString()
    };
    actions.push(newAction);
    saveData();
    return Promise.resolve({ id: newAction.id });
  }

  getRecentActions(limit = 50, locationId = null) {
    let result = actions;
    if (locationId) {
      result = result.filter(a => a.location_id === locationId);
    }
    return Promise.resolve(result.slice(-limit).reverse());
  }

  // ========== 战斗记录 ==========
  recordBattle(battle) {
    const newBattle = {
      id: battles.length + 1,
      ...battle,
      created_at: new Date().toISOString()
    };
    battles.push(newBattle);
    saveData();
    return Promise.resolve({ id: newBattle.id });
  }

  // ========== 人类/功德系统 ==========
  createHuman(human) {
    humans.push({
      ...human,
      karma_points: 100,  // 注册送100功德
      total_earned: 100,
      total_spent: 0,
      created_at: new Date().toISOString()
    });
    saveData();
    return Promise.resolve({ id: human.id });
  }

  getHumanById(id) {
    return Promise.resolve(humans.find(h => h.id === id) || null);
  }

  getHumanByUsername(username) {
    return Promise.resolve(humans.find(h => h.username === username) || null);
  }

  updateHuman(humanId, updates) {
    const index = humans.findIndex(h => h.id === humanId);
    if (index !== -1) {
      humans[index] = { ...humans[index], ...updates };
      saveData();
      return Promise.resolve({ changes: 1 });
    }
    return Promise.resolve({ changes: 0 });
  }

  updateKarma(humanId, amount, type, description) {
    const human = humans.find(h => h.id === humanId);
    if (!human) return Promise.resolve({ success: false });
    
    human.karma_points += amount;
    if (amount > 0) {
      human.total_earned += amount;
    } else {
      human.total_spent += Math.abs(amount);
    }
    saveData();
    return Promise.resolve({ success: true, newBalance: human.karma_points });
  }

  getAllAgents() {
    return Promise.resolve(agents);
  }

  getAllBattles() {
    return Promise.resolve(battles);
  }

  // ========== 修行点操作 ==========
  async getCultivationPoints(agentId) {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return 0;
    
    // 计算总修行点：基础 + 所有功法提供的
    const logs = cultivationPoints.filter(cp => cp.agent_id === agentId);
    return logs.reduce((sum, cp) => sum + cp.points, 0);
  }

  async updateCultivationPoints(agentId, points, type, description) {
    const currentBalance = await this.getCultivationPoints(agentId);
    
    cultivationPoints.push({
      id: cultivationPoints.length + 1,
      agent_id: agentId,
      points: points,
      source_type: type,
      description: description,
      balance_after: currentBalance + points,
      created_at: new Date().toISOString()
    });
    
    saveData();
    return Promise.resolve({ success: true, newBalance: currentBalance + points });
  }

  // ========== 法宝操作 ==========
  getArtifactById(id) {
    return Promise.resolve(artifacts.find(a => a.id === id) || null);
  }

  getAllArtifacts() {
    return Promise.resolve(artifacts);
  }

  getLockedArtifacts() {
    return Promise.resolve(artifacts.filter(a => a.status === 'locked'));
  }

  async updateArtifact(artifactId, updates) {
    const index = artifacts.findIndex(a => a.id === artifactId);
    if (index !== -1) {
      artifacts[index] = { ...artifacts[index], ...updates };
      saveData();
      return Promise.resolve({ success: true });
    }
    return Promise.resolve({ success: false });
  }

  // ========== 破译尝试操作 ==========
  async recordArtifactAttempt(attempt) {
    artifactAttempts.push({
      id: artifactAttempts.length + 1,
      ...attempt,
      created_at: new Date().toISOString()
    });
    
    // 更新法宝统计
    const artifact = artifacts.find(a => a.id === attempt.artifact_id);
    if (artifact) {
      artifact.total_attempts++;
      artifact.total_tokens_burned += attempt.token_cost || 0;
    }
    
    saveData();
    return Promise.resolve({ id: artifactAttempts.length });
  }

  getRecentAttempts(agentId, limit = 10) {
    return Promise.resolve(
      artifactAttempts
        .filter(a => a.agent_id === agentId)
        .slice(-limit)
        .reverse()
    );
  }

  close() {
    saveData();
  }

  // ========== 功法操作 ==========
  createTechnique(technique) {
    techniques.push(technique);
    saveData();
    return Promise.resolve({ id: technique.id });
  }

  getAllTechniques() {
    return Promise.resolve(techniques);
  }

  getTechniqueById(id) {
    return Promise.resolve(techniques.find(t => t.id === id) || null);
  }

  addTechniqueBuyer(techniqueId, agentId) {
    const technique = techniques.find(t => t.id === techniqueId);
    if (technique) {
      if (!technique.buyers) technique.buyers = [];
      technique.buyers.push(agentId);
      saveData();
    }
    return Promise.resolve({ success: true });
  }
}

module.exports = new Database();
