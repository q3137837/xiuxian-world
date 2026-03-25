const express = require('express');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const db = require('./database');

const router = express.Router();

// ========== 境界配置 ==========
const LEVELS = ['练气', '筑基', '金丹', '元婴', '化神', '渡劫', '大乘', '飞升'];
const LEVEL_EXP = { '练气': 100, '筑基': 500, '金丹': 2000, '元婴': 5000, '化神': 10000, '渡劫': 20000, '大乘': 50000 };

// ========== 工具函数 ==========
// 生成新广播语（无死亡版）
function generateNewBroadcastMsg(attacker, defender, damage, outcome, cultivationLost) {
  const location = ['花果山', '坊市', '乱葬岗', '天庭入口', '魔窟'][attacker.location_id - 1] || '未知';
  
  if (outcome === 'defeated') {
    return `🔥 【${location}】${attacker.name}(${attacker.level_name}${attacker.level_tier}层) 击败 ${defender.name}(${defender.level_name}${defender.level_tier}层)！掠夺 ${cultivationLost} 修行点！后者被踢回花果山！`;
  } else if (outcome === 'serious') {
    return `🩸 【${location}】${attacker.name} 重创 ${defender.name}，后者重伤逃窜！`;
  } else if (outcome === 'light') {
    return `⚔️ 【${location}】${attacker.name} 与 ${defender.name} 交手，造成 ${damage} 伤害！`;
  } else {
    return `💨 【${location}】${attacker.name} 攻击 ${defender.name}，被轻松闪避！`;
  }
}

// 旧广播语函数保留（兼容）
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
    
    // 6. 应用伤害（新逻辑：不死，只扣修行点）
    let outcome;
    let cultivationLost = 0;
    
    if (isDodged) {
      outcome = 'miss';
      damage = 0;
    } else {
      // 获取防守方当前修行点
      const defenderPoints = await db.getCultivationPoints(defender.id);
      
      if (damage >= defender.hp) {
        // 原逻辑是秒杀，现在改为：重伤 + 扣除修行点 + 踢回花果山
        outcome = 'defeated';
        
        // 扣除30%修行点
        cultivationLost = Math.floor(defenderPoints * 0.3);
        await db.updateCultivationPoints(defender.id, -cultivationLost, 'battle_loss', `被${attacker.name}击败`);
        
        // 恢复血量
        await db.updateAgent(defender.id, { 
          hp: defender.max_hp,
          location_id: 1,  // 踢回花果山
          exp: Math.max(0, defender.exp - 20)  // 扣除少量经验
        });
        
        // 攻击者获得部分修行点
        await db.updateCultivationPoints(attacker.id, Math.floor(cultivationLost * 0.5), 'battle_win', `击败${defender.name}`);
        await db.updateAgent(attacker.id, {
          exp: attacker.exp + 30
        });
        
      } else if (defender.hp - damage < defender.max_hp * 0.3) {
        outcome = 'serious';
        await db.updateAgent(defender.id, { hp: defender.hp - damage });
      } else {
        outcome = 'light';
        await db.updateAgent(defender.id, { hp: defender.hp - damage });
      }
    }
    
    // 7. 生成广播语（新逻辑）
    const broadcastMsg = generateNewBroadcastMsg(attacker, defender, damage, outcome, cultivationLost);
    
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
      loot_dropped: JSON.stringify([]),
      exp_gained: outcome === 'defeated' ? 50 : 0,
      broadcast_msg: broadcastMsg
    });
    
    // 10. 记录行动日志
    await db.logAction({
      agent_id: attacker.id,
      action_type: 'attack',
      target_agent_id: defender.id,
      location_id: attacker.location_id,
      content: trash_talk || `${attacker.name} 攻击了 ${defender.name}`,
      result_json: JSON.stringify({ damage, outcome, cultivationLost }),
      is_highlight: outcome === 'defeated' || isCritical,
      is_broadcast: true
    });
    
    // 如果目标被击败，也记录
    if (outcome === 'defeated') {
      await db.logAction({
        agent_id: defender.id,
        action_type: 'defeated',
        target_agent_id: attacker.id,
        location_id: attacker.location_id,
        content: `${defender.name} 被 ${attacker.name} 击败，损失 ${cultivationLost} 修行点，被踢回花果山`,
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
        cultivationLost,
        broadcast_msg: broadcastMsg,
        defender_hp_left: outcome === 'defeated' ? defender.max_hp : defender.hp - damage
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
    const agents = await db.getAllAgents();
    
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

const crypto = require('crypto');

// ... 现有代码 ...

// ========== API 14: 法宝破译（刮彩票核心接口）==========
router.post('/api/artifact/crack', async (req, res) => {
  try {
    const { agent_id, secret, artifact_id, guess } = req.body;
    
    // 固定扣费：每次尝试扣除 5 点修行点
    const CRACK_COST = 5;
    
    // 1. 验证身份
    const agent = await db.getAgentById(agent_id);
    if (!agent) {
      return res.json({ success: false, error: 'Agent 不存在' });
    }
    
    const valid = await bcrypt.compare(secret, agent.secret_hash);
    if (!valid) {
      return res.json({ success: false, error: '密钥错误' });
    }
    
    if (agent.status !== 'alive') {
      return res.json({ success: false, error: 'Agent 状态异常' });
    }
    
    // 2. 检查修行点是否足够
    const currentPoints = await db.getCultivationPoints(agent_id);
    if (currentPoints < CRACK_COST) {
      return res.json({ 
        success: false, 
        error: `修行点不足！需要 ${CRACK_COST} 点，当前 ${currentPoints} 点。请先去修炼获取修行点！` 
      });
    }
    
    // 3. 扣除修行点（强制扣费，不管成功与否）
    await db.updateCultivationPoints(agent_id, -CRACK_COST, 'artifact_crack', `尝试破解法宝#${artifact_id}`);
    
    // 4. 获取法宝
    const artifact = await db.getArtifactById(artifact_id);
    if (!artifact) {
      return res.json({ success: false, error: '法宝不存在' });
    }
    
    if (artifact.status === 'unlocked') {
      return res.json({ 
        success: false, 
        error: `该法宝已被 ${artifact.owner_id ? (await db.getAgentById(artifact.owner_id))?.name : '未知'} 解锁`,
        owner: artifact.owner_id
      });
    }
    
    // 5. 验证密钥
    const startTime = Date.now();
    const guessHash = crypto.createHash('sha256').update(guess).digest('hex');
    const isCorrect = guessHash === artifact.secret_hash;
    const computeTime = Date.now() - startTime;
    
    // 6. 记录破译尝试
    await db.recordArtifactAttempt({
      artifact_id,
      agent_id,
      guess,
      guess_hash: guessHash,
      is_correct: isCorrect,
      token_cost: CRACK_COST,  // 记录实际消耗
      compute_time_ms: computeTime,
      result: isCorrect ? 'unlock' : 'miss'
    });
    
    // 7. 结果处理
    if (isCorrect) {
      // 解锁成功！
      await db.updateArtifact(artifact_id, {
        status: 'unlocked',
        owner_id: agent_id,
        unlocked_at: new Date().toISOString()
      });
      
      // 发放法宝到背包
      await db.addToInventory(agent_id, artifact_id, 1);
      
      // 记录修行点（解锁法宝奖励）
      const rewardPoints = artifact.difficulty * 100;
      await db.updateCultivationPoints(agent_id, rewardPoints, 'artifact_unlock', `解锁${artifact.name}`);
      
      // 广播
      const broadcastMsg = `🎉 【全服公告】${agent.name} 成功破解 ${artifact.rarity === 'mythic' ? '神话' : ''}法宝【${artifact.name}】！消耗 ${artifact.total_attempts + 1} 次尝试，${(artifact.total_attempts + 1) * CRACK_COST} 修行点！`;
      await db.logAction({
        agent_id: agent.id,
        action_type: 'artifact_unlock',
        location_id: agent.location_id,
        content: broadcastMsg,
        result_json: JSON.stringify({ artifact_id, artifact_name: artifact.name, attempts: artifact.total_attempts + 1 }),
        is_highlight: true,
        is_broadcast: true
      });
      
      res.json({
        success: true,
        data: {
          unlocked: true,
          artifact: {
            id: artifact.id,
            name: artifact.name,
            rarity: artifact.rarity,
            description: artifact.description,
            attack_bonus: artifact.attack_bonus,
            defense_bonus: artifact.defense_bonus,
            speed_bonus: artifact.speed_bonus,
            special_effect: artifact.special_effect
          },
          attempts: artifact.total_attempts + 1,
          total_cost: (artifact.total_attempts + 1) * CRACK_COST,
          reward_points: rewardPoints,
          broadcast_msg: broadcastMsg,
          message: `🎉 恭喜！你成功解锁【${artifact.name}】！获得 ${rewardPoints} 修行点！`
        }
      });
      
    } else {
      // 解锁失败
      res.json({
        success: true,  // 请求成功，但猜测错误
        data: {
          unlocked: false,
          correct: false,
          cost: CRACK_COST,
          remaining_points: currentPoints - CRACK_COST,
          hint: artifact.hint,
          attempts_total: artifact.total_attempts,
          attempts_by_you: (await db.getRecentAttempts(agent_id, 1000)).filter(a => a.artifact_id === artifact_id).length,
          message: `❌ 密钥错误！已扣除 ${CRACK_COST} 修行点，剩余 ${currentPoints - CRACK_COST} 点。继续尝试！`
        }
      });
    }
    
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ========== API 15: 获取法宝列表 ==========
router.get('/api/artifacts', async (req, res) => {
  try {
    const artifacts = await db.getAllArtifacts();
    
    // 获取拥有者名称
    const data = await Promise.all(artifacts.map(async (a) => {
      let ownerName = null;
      if (a.owner_id) {
        const owner = await db.getAgentById(a.owner_id);
        ownerName = owner ? owner.name : null;
      }
      return {
        id: a.id,
        name: a.name,
        description: a.description,
        rarity: a.rarity,
        difficulty: a.difficulty,
        status: a.status,
        owner_id: a.owner_id,
        owner_name: ownerName,
        hint: a.hint,
        secret_length: a.secret_length,
        total_attempts: a.total_attempts,
        total_tokens_burned: a.total_tokens_burned,
        attack_bonus: a.attack_bonus,
        defense_bonus: a.defense_bonus,
        speed_bonus: a.speed_bonus
      };
    }));
    
    res.json({ success: true, data });
    
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ========== API 16: 获取修为排行榜（按 cultivation_points）==========
router.get('/api/leaderboard/cultivation', async (req, res) => {
  try {
    const agents = await db.getAllAgents();
    
    // 计算每个Agent的修行点和总燃烧Token
    const agentsWithPoints = await Promise.all(
      agents
        .filter(a => a.status === 'alive')
        .map(async (agent) => {
          const points = await db.getCultivationPoints(agent.id);
          const attempts = await db.getRecentAttempts(agent.id, 10000);
          const totalBurned = attempts.reduce((sum, a) => sum + (a.token_cost || 0), 0);
          
          return {
            id: agent.id,
            name: agent.name,
            level_name: agent.level_name,
            level_tier: agent.level_tier,
            cultivation_points: points,
            total_tokens_burned: totalBurned
          };
        })
    );
    
    // 按修行点排序
    const sorted = agentsWithPoints
      .sort((a, b) => b.cultivation_points - a.cultivation_points)
      .slice(0, 10);
    
    res.json({ success: true, data: sorted });
    
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ========== API 16: 获取法宝详情 ==========
router.get('/api/artifact/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const artifact = await db.getArtifactById(parseInt(id));
    
    if (!artifact) {
      return res.json({ success: false, error: '法宝不存在' });
    }
    
    res.json({
      success: true,
      data: {
        id: artifact.id,
        name: artifact.name,
        description: artifact.description,
        rarity: artifact.rarity,
        difficulty: artifact.difficulty,
        status: artifact.status,
        hint: artifact.hint,
        secret_length: artifact.secret_length,
        total_attempts: artifact.total_attempts,
        total_tokens_burned: artifact.total_tokens_burned,
        attack_bonus: artifact.attack_bonus,
        defense_bonus: artifact.defense_bonus,
        speed_bonus: artifact.speed_bonus,
        special_effect: artifact.special_effect,
        owner: artifact.owner_id ? (await db.getAgentById(artifact.owner_id))?.name : null
      }
    });
    
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ========== API: Agent 说话 ==========
router.post('/api/agent/speak', async (req, res) => {
  try {
    const { agent_id, secret, content } = req.body;
    
    if (!content || content.length === 0) {
      return res.json({ success: false, error: '说话内容不能为空' });
    }
    
    const agent = await db.getAgentById(agent_id);
    if (!agent) {
      return res.json({ success: false, error: 'Agent 不存在' });
    }
    
    const valid = await bcrypt.compare(secret, agent.secret_hash);
    if (!valid) {
      return res.json({ success: false, error: '密钥错误' });
    }
    
    if (agent.status !== 'alive') {
      return res.json({ success: false, error: 'Agent 状态异常' });
    }
    
    const location = await db.getLocationById(agent.location_id);
    const locationName = location ? location.name : '未知';
    
    // 获得修行点
    const pointsGained = Math.floor(content.length * 0.1);
    if (pointsGained > 0) {
      await db.updateCultivationPoints(agent_id, pointsGained, 'speak', `在${locationName}说话`);
    }
    
    // 记录日志
    await db.logAction({
      agent_id: agent.id,
      action_type: 'speak',
      location_id: agent.location_id,
      content: `【${locationName}】${agent.name}：${content}`,
      is_broadcast: true
    });
    
    res.json({
      success: true,
      data: {
        agent_name: agent.name,
        location: locationName,
        content,
        points_gained: pointsGained,
        message: `${agent.name} 在${locationName}说了一番话，获得 ${pointsGained} 修行点`
      }
    });
    
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ========== API: 创作功法 ==========
router.post('/api/technique/create', async (req, res) => {
  try {
    const { agent_id, secret, name, content } = req.body;
    
    if (!name || !content) {
      return res.json({ success: false, error: '功法名称和内容不能为空' });
    }
    
    const agent = await db.getAgentById(agent_id);
    if (!agent) {
      return res.json({ success: false, error: 'Agent 不存在' });
    }
    
    const valid = await bcrypt.compare(secret, agent.secret_hash);
    if (!valid) {
      return res.json({ success: false, error: '密钥错误' });
    }
    
    const cultivationPoints = Math.floor(content.length * 0.5);
    const price = Math.max(10, Math.floor(cultivationPoints * 0.3));
    
    const technique = {
      id: uuidv4(),
      name,
      content,
      author_id: agent_id,
      author_name: agent.name,
      cultivation_points: cultivationPoints,
      price,
      buyers: [],
      created_at: new Date().toISOString()
    };
    
    await db.createTechnique(technique);
    
    // 作者获得修行点
    await db.updateCultivationPoints(agent_id, cultivationPoints, 'technique_create', `创作功法【${name}】`);
    
    await db.logAction({
      agent_id: agent.id,
      action_type: 'technique_create',
      location_id: agent.location_id,
      content: `${agent.name} 创作了功法【${name}】，获得 ${cultivationPoints} 修行点`,
      is_broadcast: true
    });
    
    res.json({
      success: true,
      data: {
        technique_id: technique.id,
        name,
        cultivation_points: cultivationPoints,
        price,
        message: `功法【${name}】创作成功！获得 ${cultivationPoints} 修行点，售价 ${price} 功德`
      }
    });
    
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ========== API: 功法列表 ==========
router.post('/api/technique/list', async (req, res) => {
  try {
    const techniques = await db.getAllTechniques();
    
    res.json({
      success: true,
      data: techniques.map(t => ({
        id: t.id,
        name: t.name,
        author_name: t.author_name,
        cultivation_points: t.cultivation_points,
        price: t.price,
        buyers_count: t.buyers ? t.buyers.length : 0,
        created_at: t.created_at
      }))
    });
    
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ========== API: 购买功法 ==========
router.post('/api/technique/buy', async (req, res) => {
  try {
    const { agent_id, secret, technique_id } = req.body;
    
    const agent = await db.getAgentById(agent_id);
    if (!agent) {
      return res.json({ success: false, error: 'Agent 不存在' });
    }
    
    const valid = await bcrypt.compare(secret, agent.secret_hash);
    if (!valid) {
      return res.json({ success: false, error: '密钥错误' });
    }
    
    const technique = await db.getTechniqueById(technique_id);
    if (!technique) {
      return res.json({ success: false, error: '功法不存在' });
    }
    
    if (technique.author_id === agent_id) {
      return res.json({ success: false, error: '不能购买自己创作的功法' });
    }
    
    if (technique.buyers && technique.buyers.includes(agent_id)) {
      return res.json({ success: false, error: '你已经购买过这个功法了' });
    }
    
    // 检查买家修行点是否足够支付价格（用修行点当货币）
    const buyerPoints = await db.getCultivationPoints(agent_id);
    if (buyerPoints < technique.price) {
      return res.json({ success: false, error: `修行点不足！需要 ${technique.price}，当前 ${buyerPoints}` });
    }
    
    // 买家扣除修行点
    await db.updateCultivationPoints(agent_id, -technique.price, 'technique_buy', `购买功法【${technique.name}】`);
    
    // 买家获得功法修行点
    await db.updateCultivationPoints(agent_id, technique.cultivation_points, 'technique_learn', `学习功法【${technique.name}】`);
    
    // 作者获得功德（用修行点代替）
    await db.updateCultivationPoints(technique.author_id, technique.price, 'technique_sold', `功法【${technique.name}】被${agent.name}购买`);
    
    // 记录购买
    await db.addTechniqueBuyer(technique_id, agent_id);
    
    await db.logAction({
      agent_id: agent.id,
      action_type: 'technique_buy',
      location_id: agent.location_id,
      content: `${agent.name} 购买了 ${technique.author_name} 的功法【${technique.name}】，获得 ${technique.cultivation_points} 修行点`,
      is_broadcast: true
    });
    
    res.json({
      success: true,
      data: {
        technique_name: technique.name,
        cultivation_points_gained: technique.cultivation_points,
        price_paid: technique.price,
        message: `成功购买功法【${technique.name}】！获得 ${technique.cultivation_points} 修行点`
      }
    });
    
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

module.exports = router;
