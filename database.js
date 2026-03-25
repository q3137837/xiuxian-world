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
let techniques = [];
let artifacts = [];
let artifactAttempts = [];
let cultivationPoints = [];

// 初始化默认数据
function initDefaultData() {
  if (locations.length === 0) {
    locations = [
      { id: 1, name: '花果山', type: 'safezone', description: '新手村，禁止PVP', max_agents: 100, pvp_enabled: false, danger_level: 0 },
      { id: 2, name: '坊市', type: 'trade', description: '交易区，可以抢', max_agents: 80, pvp_enabled: true, danger_level: 20 },
      { id: 3, name: '乱葬岗', type: 'pvp', description: '无限制乱战', max_agents: 50, pvp_enabled: true, danger_level: 80 },
      { id: 4, name: '天庭入口', type: 'advanced', description: '金丹以上才能进', max_agents: 30, pvp_enabled: true, danger_level: 60 },
      { id: 5, name: '魔窟', type: 'boss', description: '有BOSS，爆神器', max_agents: 40, pvp_enabled: true, danger_level: 100 }
    ];
  }

  if (artifacts.length === 0) {
    initArtifacts();
  }
}

// 初始化50个法宝
function initArtifacts() {
  const crypto = require('crypto');

  // 第一梯队：30个普通法宝
  const commonNames = [
    '定风珠', '紫金铃', '玲珑塔', '金刚琢', '芭蕉扇',
    '照妖镜', '乾坤袋', '九齿钉耙', '金箍棒(复制品)', '火尖枪',
    '混天绫', '风火轮', '七星剑', '白玉净瓶', '杨柳枝',
    '缚妖索', '降魔杵', '辟火罩', '隐身衣', '分光镜',
    '穿云箭', '凝血珠', '翠玉瓶', '冰魄针', '灵犀角',
    '碎星锤', '月牙铲', '铁扇公主扇', '避水珠', '通灵石'
  ];
  const commonDescs = [
    '可定八方来风，护体无虞', '铃声一响，摄人心魄', '七宝玲珑，镇妖降魔',
    '太上老君所炼，无物不破', '一扇生风，二扇生火，三扇下雨', '照见一切妖魔原形',
    '纳须弥于芥子，空间法宝', '天蓬元帅旧物，威力不凡', '仿制品亦有神通',
    '三坛海会大神兵器', '灵珠子护身法宝', '哪吒脚踏之宝',
    '北斗七星之力汇聚', '观音大士法宝', '甘露洒遍三界',
    '一缚即紧，妖魔难逃', '降妖除魔之法器', '火焰不侵，防护至宝',
    '穿之隐形，来去无踪', '分光化影，迷惑敌人',
    '一箭穿云，百步之外', '凝血止伤，疗伤圣品', '翠玉灵瓶，储灵聚气',
    '冰魄所铸，寒气逼人', '灵犀之角，通灵之宝',
    '星辰之力凝于锤中', '月华所化，锋利异常', '铁扇公主遗留宝扇',
    '水火不侵，深海行走', '通灵万物，感知天机'
  ];

  for (let i = 0; i < 30; i++) {
    const secret = Math.floor(100 + Math.random() * 9000).toString();
    artifacts.push({
      id: i + 1,
      name: commonNames[i],
      description: commonDescs[i],
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

  // 第二梯队：12个稀有法宝
  const rareNames = [
    '如意金箍棒(残片)', '九转还魂丹', '太上老君炉', '东皇钟',
    '昆仑镜', '炼妖壶', '天机盘', '河图洛书',
    '混元金斗', '五行旗', '盘古幡', '乾坤圈'
  ];
  const rareDescs = [
    '定海神针残片，仍有神威', '九转大还丹，起死回生', '八卦炉，炼丹至宝',
    '上古神器，镇压万物', '时空神器，窥探过去未来', '收妖炼妖，化为己用',
    '推算天机，预知吉凶', '伏羲圣物，演化万象',
    '金斗一翻，神仙亦堕', '五方五行，阵法至宝', '盘古遗物，开天之幡',
    '哪吒命宝，乾坤在握'
  ];
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 12; i++) {
    let secret = '';
    const len = Math.floor(Math.random() * 3) + 6;
    for (let j = 0; j < len; j++) {
      secret += chars[Math.floor(Math.random() * chars.length)];
    }
    artifacts.push({
      id: 31 + i,
      name: rareNames[i],
      description: rareDescs[i],
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

  // 第三梯队：7个史诗法宝
  const epicNames = [
    '如意金箍棒', '定海神针铁', '东皇太一剑', '昊天塔',
    '玲珑宝塔', '七宝妙树', '斩仙飞刀'
  ];
  const epicDescs = [
    '大圣真正的兵器，如意变化', '定海之铁，重一万三千五百斤',
    '东皇太一之剑，斩天灭地', '托塔天王镇妖之塔',
    '七宝所成，光华万丈', '接引道人法宝，万法不侵',
    '陆压道人绝杀法宝，斩仙灭佛'
  ];
  const poems = ['床前明月光', '疑是地上霜', '举头望明月', '低头思故乡', '春眠不觉晓', '处处闻啼鸟', '夜来风雨声'];
  const complexChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$';
  for (let i = 0; i < 7; i++) {
    let secret = '';
    const len = Math.floor(Math.random() * 3) + 10;
    for (let j = 0; j < len; j++) {
      secret += complexChars[Math.floor(Math.random() * complexChars.length)];
    }
    artifacts.push({
      id: 43 + i,
      name: epicNames[i],
      description: epicDescs[i],
      rarity: 'epic',
      difficulty: 7,
      secret_hash: crypto.createHash('sha256').update(secret).digest('hex'),
      secret_length: secret.length,
      hint: `提示：${poems[i]}（${secret.length}位复杂组合）`,
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

  // 第四梯队：1个神话法宝
  let mythSecret = '';
  for (let i = 0; i < 16; i++) {
    mythSecret += complexChars[Math.floor(Math.random() * complexChars.length)];
  }
  artifacts.push({
    id: 50,
    name: '盘古开天斧',
    description: '上古神器，全服唯一，开天辟地之力',
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

  getLocationById(id) {
    return Promise.resolve(locations.find(l => l.id === id) || null);
  }

  getAllLocations() {
    return Promise.resolve(locations);
  }

  getItemById(id) {
    return Promise.resolve(items.find(i => i.id === id) || null);
  }

  getAllItems() {
    return Promise.resolve(items);
  }

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
        equipped: true,
        acquired_at: new Date().toISOString()
      });
    }
    saveData();
    return Promise.resolve({ success: true });
  }

  getInventory(agentId) {
    return Promise.resolve(inventories.filter(i => i.agent_id === agentId));
  }

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

  createHuman(human) {
    humans.push({
      ...human,
      karma_points: 100,
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

  async getCultivationPoints(agentId) {
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

  async recordArtifactAttempt(attempt) {
    artifactAttempts.push({
      id: artifactAttempts.length + 1,
      ...attempt,
      created_at: new Date().toISOString()
    });
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
