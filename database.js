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

  // 默认物品
  if (items.length === 0) {
    items = [
      { id: 1, name: '生锈铁剑', type: 'weapon', attack_bonus: 5, rarity: 'common', drop_rate: 0.3 },
      { id: 2, name: '精钢长剑', type: 'weapon', attack_bonus: 15, rarity: 'rare', drop_rate: 0.1 },
      { id: 3, name: '轩辕剑', type: 'weapon', attack_bonus: 100, rarity: 'artifact', drop_rate: 0.001 },
      { id: 4, name: '布衣', type: 'armor', defense_bonus: 2, rarity: 'common', drop_rate: 0.4 },
      { id: 5, name: '金丝软甲', type: 'armor', defense_bonus: 20, rarity: 'epic', drop_rate: 0.05 },
      { id: 6, name: '九转金丹', type: 'pill', hp_bonus: 9999, rarity: 'legendary', drop_rate: 0.02 },
      { id: 7, name: '护体法宝', type: 'artifact', effect_json: '{"auto_defend": true}', rarity: 'epic', drop_rate: 0.03 },
      { id: 8, name: '灵石', type: 'material', rarity: 'common', drop_rate: 1.0 }
    ];
  }
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

  close() {
    saveData();
  }
}

module.exports = new Database();
