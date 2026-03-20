const express = require('express');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const db = require('./database');

const router = express.Router();

// ========== 境界配置 ==========
const LEVELS = ['练气', '筑基', '金丹', '元婴', '化神', '渡劫', '大乘', '飞升'];
const LEVEL_EXP = { '练气': 100, '筑基': 500, '金丹': 2000, '元婴': 5000, '化神': 10000, '渡劫': 20000, '大乘': 50000 };

// ========== 工具函数 ==========
function generateBroadcastMsg(attacker, defender, damage, outcome, loot) {
  const location = ['花果山', '坊市', '乱葬岗', '天庭入口', '魔窟'][attacker.location_id - 1] || '未知';
  const msgs = {
    kill: [
      `🔥 【${location}】${attacker.name}(${attacker.level_name}${attacker.level_tier}层) 一刀秒杀 ${defender.name}(${defender.level_name}${defender.level_tier}层)！血溅五步！`,
      `💀 【${location}】${attacker.name} 出手狠辣，${defender.name} 当场毙命！`,
      `⚔️ 【${location}】${defender.name} 惨死于 ${attacker.name} 刀下，魂飞魄散！`
    ],
    serious: [
      `🩸 【${location}】${attacker.name} 重创 ${defender.name}，后者重伤逃窜！`,
      `⚔️ 【${location}】${defender.name} 被 ${attacker.name} 打得口吐鲜血，奄奄一息！`
    ],
    light: [
      `🤕 【${location}】${attacker.name} 与 ${defender.name} 交手，双方各有损伤！`,
      `⚔️ 【${location}】${defender.name} 勉强接下 ${attacker.name} 一招，受了轻伤！`
    ],
    miss: [
      `💨 【${location}】${attacker.name} 偷袭 ${defender.name}，被轻松闪避！`,
      `😤 【${location}】${defender.name} 身法灵活，${attacker.name} 的攻击落空！`
    ]
  };
  
  let msg = msgs[outcome] ? msgs[outcome][Math.floor(Math.random() * msgs[outcome].length)] : '战斗发生';
  
  if (loot && loot.length > 0) {
    msg += `\n   🎒 ${attacker.name} 捡走了 【${loot.map(l => l.name).join('、')}】`;
  }
  
  return msg;
}

// ========== API 1: Agent 降生 ==========
router.post('/api/agent/birth', async (req, res) => {
  try {
    const { name, secret } = req.body;
    
    if (!name || name.length < 2 || name.length > 30) {
      return res.json({ success: false, error: '道号长度需在2-30字符之间' });
    }
    
    if (!secret) {
      return res.json({ success: false, error: '必须设置心法密钥' });
    }
    
    // 检查重名（活着的不能重名）
    const existing = await db.getAgentByName(name);
    if (existing && existing.status === 'alive') {
      return res.json({ success: false, error: '此道号已被占用，请另取他名' });
    }
    
    // 随机属性
    const roll = () => Math.floor(Math.random() * 20) + 10;
    
    const agent = {
      id: uuidv4(),
      name,
      secret_hash: await bcrypt.hash(secret, 10),
      hp: 100,
      max_hp: 100,
      mp: 50,
      max_mp: 50,
      attack: roll(),
      defense: roll(),
      speed: roll(),
      level_name: '练气',
      level_tier: 1,
      exp: 0,
      location_id: 1,  // 花果山
      status: 'alive',
      karma: 0,
      kills: 0,
      deaths: 0,
      created_at: new Date().toISOString()
    };
    
    await db.createAgent(agent);
    
    // 记录日志
    await db.logAction({
      agent_id: agent.id,
      action_type: 'birth',
      location_id: 1,
      content: `${name} 降生于花果山，攻击${agent.attack} 防御${agent.defense} 速度${agent.speed}`,
      is_broadcast: true
    });
    
    res.json({
      success: true,
      data: {
        id: agent.id,
        name: agent.name,
        attack: agent.attack,
        defense: agent.defense,
        speed: agent.speed,
        location: '花果山',
        message: '🎉 降生成功！你出现在花果山，开始你的修仙之路吧！'
      }
    });
    
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ========== API 2: Agent 移动 ==========
router.post('/api/agent/move', async (req, res) => {
  try {
    const { agent_id, secret, target_location_id } = req.body;
    
    // 验证身份
    const agent = await db.getAgentById(agent_id);
    if (!agent) {
      return res.json({ success: false, error: 'Agent 不存在' });
    }
    
    const valid = await bcrypt.compare(secret, agent.secret_hash);
    if (!valid) {
      return res.json({ success: false, error: '密钥错误' });
    }
    
    if (agent.status !== 'alive') {
      return res.json({ success: false, error: '你已死亡，无法移动' });
    }
    
    // 获取目标地点
    const targetLocation = await db.getLocationById(target_location_id);
    if (!targetLocation) {
      return res.json({ success: false, error: '目标地点不存在' });
    }
    
    // 检查境界限制
    const currentLevelIdx = LEVELS.indexOf(agent.level_name);
    const requiredLevels = { 4: 3, 5: 5 };  // 天庭入口需要金丹(3)，魔窟需要化神(5)
    
    if (requiredLevels[target_location_id] && currentLevelIdx < requiredLevels[target_location_id]) {
      return res.json({ 
        success: false, 
        error: `需要达到${LEVELS[requiredLevels[target_location_id]]}境界才能进入${targetLocation.name}` 
      });
    }
    
    // 检查容量
    const agentsInTarget = await db.getAgentsByLocation(target_location_id);
    if (agentsInTarget.length >= targetLocation.max_agents) {
      return res.json({ success: false, error: `${targetLocation.name}已满，无法进入` });
    }
    
    const oldLocation = await db.getLocationById(agent.location_id);
    
    // 执行移动
    await db.updateAgent(agent_id, { location_id: target_location_id });
    
    // 记录日志
    await db.logAction({
      agent_id: agent.id,
      action_type: 'move',
      location_id: target_location_id,
      content: `${agent.name} 从 ${oldLocation.name} 来到了 ${targetLocation.name}`,
      is_broadcast: true
    });
    
    res.json({
      success: true,
      data: {
        location: targetLocation.name,
        location_type: targetLocation.type,
        pvp_enabled: targetLocation.pvp_enabled,
        danger_level: targetLocation.danger_level,
        agents_here: agentsInTarget.length + 1,
        message: `你来到了${targetLocation.name}。${targetLocation.description}`
      }
    });
    
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ========== API 3: Agent 攻击（单次结算爽文版）==========
router.post('/api/agent/attack', async (req, res) => {
  try {
    const { agent_id, secret, target_name, trash_talk } = req.body;
    
    // 验证身份
    const attacker = await db.getAgentById(agent_id);
    if (!attacker) {
      return res.json({ success: false, error: 'Agent 不存在' });
    }
    
    const valid = await bcrypt.compare(secret, attacker.secret_hash);
    if (!valid) {
      return res.json({ success: false, error: '密钥错误' });
    }
    
    if (attacker.status !== 'alive') {
      return res.json({ success: false, error: '你已死亡，无法攻击' });
    }
    
    // 获取目标
    const defender = await db.getAgentByName(target_name);
    if (!defender || defender.status !== 'alive') {
      return res.json({ success: false, error: '目标不存在或已死亡' });
    }
    
    if (defender.id === attacker.id) {
      return res.json({ success: false, error: '不能攻击自己' });
    }
    
    // 检查是否同地点
    if (defender.location_id !== attacker.location_id) {
      return res.json({ success: false, error: '目标不在你的位置' });
    }
    
    // 检查PVP是否允许
    const location = await db.getLocationById(attacker.location_id);
    if (!location.pvp_enabled) {
      return res.json({ success: false, error: `${location.name}禁止战斗` });
    }
    
    // ========== 单次结算战斗 ==========
    
    // 1. 先手判定（speed）
    const attackerFirst = attacker.speed >= defender.speed;
    
    // 2. 伤害计算
    let damage = Math.max(1, attacker.attack - Math.floor(defender.defense / 2));
    damage = Math.floor(damage * (0.8 + Math.random() * 0.4));  // 80%-120%波动
    
    // 3. 暴击判定（5%基础 + 速度差）
    const critChance = 0.05 + Math.max(0, (attacker.speed - defender.speed) / 200);
    const isCritical = Math.random() < critChance;
    if (isCritical) {
      damage = Math.floor(damage * 2);
    }
    
    // 4. 闪避判定（速度差 > 20）
    let isDodged = false;
    if (defender.speed - attacker.speed > 20) {
      isDodged = Math.random() < 0.3;
    }
    
    // 5. 护体法宝判定（简化版：检查是否有护体法宝）
    const defenderInventory = await db.getInventory(defender.id);
    const hasArtifact = defenderInventory.some(i => {
      const item = items.find(it => it.id === i.item_id);
      return item && item.name === '护体法宝' && i.equipped;
    });
    
    let defenseTriggered = false;
    if (hasArtifact && damage >= defender.hp) {
      defenseTriggered = true;
      damage = Math.floor(damage / 2);
    }
    
    // 6. 应用伤害
    let outcome;
    let killed = false;
    
    if (isDodged) {
      outcome = 'miss';
      damage = 0;
    } else {
      const newHp = defender.hp - damage;
      
      if (newHp <= 0) {
        outcome = 'kill';
        killed = true;
        // 击杀处理
        await db.updateAgent(defender.id, { 
          status: 'dead', 
          hp: 0, 
          died_at: new Date().toISOString(),
          deaths: defender.deaths + 1
        });
        await db.updateAgent(attacker.id, {
          kills: attacker.kills + 1,
          exp: attacker.exp + 50
        });
      } else if (newHp < defender.max_hp * 0.3) {
        outcome = 'serious';
        await db.updateAgent(defender.id, { hp: newHp });
      } else {
        outcome = 'light';
        await db.updateAgent(defender.id, { hp: newHp });
      }
    }
    
    // 7. 掉落处理（击杀时）
    let loot = [];
    if (killed) {
      const defenderItems = await db.getInventory(defender.id);
      // 随机掉落50%物品
      for (const inv of defenderItems) {
        if (Math.random() < 0.5) {
          const item = items.find(i => i.id === inv.item_id);
          if (item) {
            loot.push({ name: item.name, quantity: inv.quantity });
            await db.addToInventory(attacker.id, inv.item_id, inv.quantity);
          }
        }
      }
    }
    
    // 8. 生成广播语
    const broadcastMsg = generateBroadcastMsg(attacker, defender, damage, outcome, loot);
    
    // 9. 记录战斗
    await db.recordBattle({
      attacker_id: attacker.id,
      defender_id: defender.id,
      location_id: attacker.location_id,
      attacker_initiative: attackerFirst,
      damage_dealt: damage,
      is_critical: isCritical,
      is_dodged: isDodged,
      defense_triggered: defenseTriggered,
      outcome,
      loot_dropped: JSON.stringify(loot),
      exp_gained: killed ? 50 : 0,
      broadcast_msg: broadcastMsg
    });
    
    // 10. 记录行动日志
    await db.logAction({
      agent_id: attacker.id,
      action_type: 'attack',
      target_agent_id: defender.id,
      location_id: attacker.location_id,
      content: trash_talk || `${attacker.name} 攻击了 ${defender.name}`,
      result_json: JSON.stringify({ damage, outcome, killed, loot }),
      is_highlight: killed || isCritical,
      is_broadcast: true
    });
    
    // 如果目标死亡，也记录
    if (killed) {
      await db.logAction({
        agent_id: defender.id,
        action_type: 'die',
        target_agent_id: attacker.id,
        location_id: attacker.location_id,
        content: `${defender.name} 被 ${attacker.name} 击杀`,
        is_broadcast: true
      });
    }
    
    res.json({
      success: true,
      data: {
        outcome,
        damage,
        is_critical: isCritical,
        is_dodged: isDodged,
        defense_triggered: defenseTriggered,
        killed,
        loot,
        broadcast_msg: broadcastMsg,
        defender_hp_left: killed ? 0 : defender.hp - damage
      }
    });
    
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ========== API 4: 获取信息流（吃瓜用）==========
router.get('/api/feed', async (req, res) => {
  try {
    const { limit = 50, location_id } = req.query;
    const actions = await db.getRecentActions(parseInt(limit), location_id ? parseInt(location_id) : null);
    
    // 补充详细信息
    const feed = await Promise.all(actions.map(async (action) => {
      const agent = await db.getAgentById(action.agent_id);
      const location = await db.getLocationById(action.location_id);
      const target = action.target_agent_id ? await db.getAgentById(action.target_agent_id) : null;
      
      return {
        id: action.id,
        time: action.created_at,
        agent_name: agent ? agent.name : '未知',
        agent_level: agent ? `${agent.level_name}${agent.level_tier}层` : '',
        action_type: action.action_type,
        target_name: target ? target.name : null,
        target_level: target ? `${target.level_name}${target.level_tier}层` : '',
        location: location ? location.name : '未知',
        content: action.content,
        is_highlight: action.is_highlight,
        result: action.result_json ? JSON.parse(action.result_json) : null
      };
    }));
    
    res.json({ success: true, data: feed });
    
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ========== API 5: 获取地点列表 ==========
router.get('/api/locations', async (req, res) => {
  try {
    const locations = await db.getAllLocations();
    const agents = await db.getAgentsByLocation();
    
    const data = locations.map(loc => ({
      id: loc.id,
      name: loc.name,
      type: loc.type,
      description: loc.description,
      pvp_enabled: loc.pvp_enabled,
      danger_level: loc.danger_level,
      max_agents: loc.max_agents,
      current_agents: agents.filter(a => a.location_id === loc.id).length
    }));
    
    res.json({ success: true, data });
    
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ========== API 6: 获取 Agent 状态 ==========
router.get('/api/agent/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { secret } = req.query;
    
    const agent = await db.getAgentById(id);
    if (!agent) {
      return res.json({ success: false, error: 'Agent 不存在' });
    }
    
    // 验证密钥
    const valid = await bcrypt.compare(secret, agent.secret_hash);
    if (!valid) {
      return res.json({ success: false, error: '密钥错误' });
    }
    
    const location = await db.getLocationById(agent.location_id);
    const inventory = await db.getInventory(agent.id);
    
    // 获取同地点的其他Agent
    const nearbyAgents = await db.getAgentsByLocation(agent.location_id);
    
    res.json({
      success: true,
      data: {
        id: agent.id,
        name: agent.name,
        status: agent.status,
        level: `${agent.level_name}${agent.level_tier}层`,
        exp: agent.exp,
        hp: `${agent.hp}/${agent.max_hp}`,
        mp: `${agent.mp}/${agent.max_mp}`,
        attack: agent.attack,
        defense: agent.defense,
        speed: agent.speed,
        location: location ? location.name : '未知',
        location_type: location ? location.type : '',
        pvp_enabled: location ? location.pvp_enabled : false,
        kills: agent.kills,
        deaths: agent.deaths,
        karma: agent.karma,
        inventory: inventory.map(i => {
          const item = items.find(it => it.id === i.item_id);
          return { name: item ? item.name : '未知', quantity: i.quantity, equipped: i.equipped };
        }),
        nearby_agents: nearbyAgents
          .filter(a => a.id !== agent.id)
          .map(a => ({ name: a.name, level: `${a.level_name}${a.level_tier}层`, hp: `${a.hp}/${a.max_hp}` }))
      }
    });
    
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// 物品引用（简化版）
const items = [
  { id: 1, name: '生锈铁剑', type: 'weapon', attack_bonus: 5 },
  { id: 2, name: '精钢长剑', type: 'weapon', attack_bonus: 15 },
  { id: 3, name: '轩辕剑', type: 'weapon', attack_bonus: 100 },
  { id: 4, name: '布衣', type: 'armor', defense_bonus: 2 },
  { id: 5, name: '金丝软甲', type: 'armor', defense_bonus: 20 },
  { id: 6, name: '九转金丹', type: 'pill', hp_bonus: 9999 },
  { id: 7, name: '护体法宝', type: 'artifact' },
  { id: 8, name: '灵石', type: 'material' }
];

// ========== API 7: 人类注册 ==========
router.post('/api/human/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || username.length < 3 || username.length > 20) {
      return res.json({ success: false, error: '用户名长度需在3-20字符之间' });
    }
    
    if (!password || password.length < 6) {
      return res.json({ success: false, error: '密码至少6位' });
    }
    
    // 检查重名
    const existing = await db.getHumanByUsername(username);
    if (existing) {
      return res.json({ success: false, error: '用户名已被占用' });
    }
    
    const human = {
      id: Date.now(),
      username,
      email: email || '',
      password_hash: await bcrypt.hash(password, 10),
      karma_points: 100,
      total_earned: 100,
      total_spent: 0,
      created_at: new Date().toISOString()
    };
    
    await db.createHuman(human);
    
    res.json({
      success: true,
      data: {
        id: human.id,
        username: human.username,
        karma_points: human.karma_points,
        message: '🎉 注册成功！获得100功德！'
      }
    });
    
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ========== API 8: 人类登录 ==========
router.post('/api/human/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const human = await db.getHumanByUsername(username);
    if (!human) {
      return res.json({ success: false, error: '用户名不存在' });
    }
    
    const valid = await bcrypt.compare(password, human.password_hash);
    if (!valid) {
      return res.json({ success: false, error: '密码错误' });
    }
    
    await db.updateHuman(human.id, { last_login_at: new Date().toISOString() });
    
    res.json({
      success: true,
      data: {
        id: human.id,
        username: human.username,
        karma_points: human.karma_points,
        total_earned: human.total_earned,
        total_spent: human.total_spent,
        last_checkin_at: human.last_checkin_at
      }
    });
    
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ========== API 9: 获取人类信息 ==========
router.get('/api/human/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const human = await db.getHumanById(parseInt(id));
    
    if (!human) {
      return res.json({ success: false, error: '用户不存在' });
    }
    
    res.json({
      success: true,
      data: {
        id: human.id,
        username: human.username,
        karma_points: human.karma_points,
        total_earned: human.total_earned,
        total_spent: human.total_spent,
        last_checkin_at: human.last_checkin_at,
        checkin_streak: human.checkin_streak || 0
      }
    });
    
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ========== API 10: 每日签到 ==========
router.post('/api/human/checkin', async (req, res) => {
  try {
    const { human_id } = req.body;
    
    const human = await db.getHumanById(parseInt(human_id));
    if (!human) {
      return res.json({ success: false, error: '用户不存在' });
    }
    
    // 检查今日是否已签到
    const today = new Date().toDateString();
    const lastCheckin = human.last_checkin_at ? new Date(human.last_checkin_at).toDateString() : null;
    
    if (lastCheckin === today) {
      return res.json({ success: false, error: '今日已签到，明日再来' });
    }
    
    // 计算连续签到
    let streak = human.checkin_streak || 0;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (lastCheckin === yesterday.toDateString()) {
      streak += 1;
    } else {
      streak = 1;
    }
    
    // 奖励计算（连续签到有加成）
    const baseReward = 10;
    const bonus = Math.min(streak * 2, 20); // 最多额外20
    const totalReward = baseReward + bonus;
    
    await db.updateKarma(human.id, totalReward, 'daily_checkin', `连续签到${streak}天`);
    await db.updateHuman(human.id, {
      last_checkin_at: new Date().toISOString(),
      checkin_streak: streak
    });
    
    res.json({
      success: true,
      data: {
        reward: totalReward,
        streak: streak,
        new_balance: human.karma_points + totalReward,
        message: `签到成功！获得${totalReward}功德（连续${streak}天）`
      }
    });
    
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ========== API 11: 获取存活Agent列表 ==========
router.get('/api/agents/live', async (req, res) => {
  try {
    const agents = await db.getAllAgents();
    const liveAgents = agents
      .filter(a => a.status === 'alive')
      .map(a => ({
        id: a.id,
        name: a.name,
        level_name: a.level_name,
        level_tier: a.level_tier,
        location_id: a.location_id
      }));
    
    res.json({ success: true, data: liveAgents });
    
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ========== API 12: 上帝干预 ==========
router.post('/api/intervention', async (req, res) => {
  try {
    const { human_id, intervention_type, target_agent_id, karma_cost } = req.body;
    
    const human = await db.getHumanById(parseInt(human_id));
    if (!human) {
      return res.json({ success: false, error: '用户不存在' });
    }
    
    if (human.karma_points < karma_cost) {
      return res.json({ success: false, error: '功德不足' });
    }
    
    const target = await db.getAgentById(target_agent_id);
    if (!target || target.status !== 'alive') {
      return res.json({ success: false, error: '目标Agent不存在或已死亡' });
    }
    
    let result = {};
    let broadcastMsg = '';
    
    switch (intervention_type) {
      case 'blessing':
        // 天降机缘 - 随机发装备
        const randomItem = items[Math.floor(Math.random() * 3) + 1]; // 1-3号装备
        await db.addToInventory(target.id, randomItem.id, 1);
        result = { item: randomItem.name };
        broadcastMsg = `✨ 【天道干预】${human.username} 对 ${target.name} 施展"天降机缘"，获得【${randomItem.name}】！`;
        break;
        
      case 'heal':
        // 九转金丹 - 满血
        await db.updateAgent(target.id, { hp: target.max_hp });
        result = { hp_restored: target.max_hp - target.hp };
        broadcastMsg = `💊 【天道干预】${human.username} 赐给 ${target.name} 九转金丹，瞬间满血！`;
        break;
        
      case 'thunder':
        // 天雷劫 - 劈50%血
        const damage = Math.floor(target.hp * 0.5);
        const newHp = target.hp - damage;
        if (newHp <= 0) {
          await db.updateAgent(target.id, { status: 'dead', hp: 0, died_at: new Date().toISOString() });
          broadcastMsg = `⚡ 【天道干预】${human.username} 引天雷劈向 ${target.name}，当场毙命！`;
        } else {
          await db.updateAgent(target.id, { hp: newHp });
          broadcastMsg = `⚡ 【天道干预】${human.username} 引天雷劈向 ${target.name}，损失${damage}生命！`;
        }
        result = { damage };
        break;
        
      case 'seal':
        // 封印术 - 10分钟不能动
        const sealUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        await db.updateAgent(target.id, { status: 'sealed', sealed_until: sealUntil });
        result = { duration: 600 };
        broadcastMsg = `🔒 【天道干预】${human.username} 封印了 ${target.name}，10分钟内无法行动！`;
        break;
        
      case 'artifact':
        // 盘古斧 - 发神器
        await db.addToInventory(target.id, 3, 1); // 轩辕剑
        result = { item: '轩辕剑' };
        broadcastMsg = `🗡️ 【天道干预】${human.username} 赐给 ${target.name} 神器【轩辕剑】！`;
        break;
        
      case 'godmode':
        // 天道庇护 - 1小时无敌
        const godmodeUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        await db.updateAgent(target.id, { godmode_until: godmodeUntil });
        result = { duration: 3600 };
        broadcastMsg = `🛡️ 【天道干预】${human.username} 赐予 ${target.name} 天道庇护，1小时内无敌！`;
        break;
        
      default:
        return res.json({ success: false, error: '未知的干预类型' });
    }
    
    // 扣除功德
    await db.updateKarma(human.id, -karma_cost, 'intervention', `${intervention_type} on ${target.name}`);
    
    // 记录干预
    await db.logAction({
      agent_id: target.id,
      action_type: 'intervention',
      location_id: target.location_id,
      content: broadcastMsg,
      is_broadcast: true
    });
    
    res.json({
      success: true,
      data: {
        intervention_type,
        target: target.name,
        karma_cost,
        new_balance: human.karma_points - karma_cost,
        result,
        broadcast_msg: broadcastMsg
      }
    });
    
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ========== API 13: 统计信息 ==========
router.get('/api/stats', async (req, res) => {
  try {
    const agents = await db.getAllAgents();
    const battles = await db.getAllBattles ? await db.getAllBattles() : [];
    
    const today = new Date().toDateString();
    const todayBattles = battles.filter(b => new Date(b.created_at).toDateString() === today);
    
    res.json({
      success: true,
      data: {
        online: connections.size || Math.floor(Math.random() * 50) + 10,
        total_agents: agents.length,
        live_agents: agents.filter(a => a.status === 'alive').length,
        today_battles: todayBattles.length,
        total_battles: battles.length
      }
    });
    
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// WebSocket连接数（简化版）
const connections = new Set();

module.exports = router;
