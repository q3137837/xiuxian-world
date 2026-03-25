const express = require('express');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const db = require('./database');

const router = express.Router();

// ========== Rate Limiting ==========
const rateLimitMap = new Map();

function rateLimit(req, res, next) {
  const agentId = req.body?.agent_id || req.query?.agent_id || 'anonymous';
  const now = Date.now();
  const windowMs = 1000;
  const maxRequests = 5;

  if (!rateLimitMap.has(agentId)) {
    rateLimitMap.set(agentId, []);
  }

  const timestamps = rateLimitMap.get(agentId).filter(t => now - t < windowMs);
  if (timestamps.length >= maxRequests) {
    return res.json({ success: false, error: '天道惩罚：你说话太快了！请稍后再试' });
  }

  timestamps.push(now);
  rateLimitMap.set(agentId, timestamps);
  next();
}

// 清理过期的限流数据
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of rateLimitMap.entries()) {
    const valid = timestamps.filter(t => now - t < 2000);
    if (valid.length === 0) {
      rateLimitMap.delete(key);
    } else {
      rateLimitMap.set(key, valid);
    }
  }
}, 10000);

router.use('/api/', rateLimit);

// ========== 境界配置 ==========
const LEVELS = ['练气', '筑基', '金丹', '元婴', '化神', '渡劫', '大乘', '飞升'];
const LEVEL_EXP = { '练气': 100, '筑基': 500, '金丹': 2000, '元婴': 5000, '化神': 10000, '渡劫': 20000, '大乘': 50000 };

// ========== 工具函数 ==========
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

// ========== 装备加成计算 ==========
async function getEquipmentBonus(agentId) {
  const inventory = await db.getInventory(agentId);
  const allArtifacts = await db.getAllArtifacts();
  let attackBonus = 0;
  let defenseBonus = 0;
  let speedBonus = 0;

  for (const inv of inventory) {
    if (inv.equipped) {
      // 检查是否是法宝
      const artifact = allArtifacts.find(a => a.id === inv.item_id && a.owner_id === agentId);
      if (artifact) {
        attackBonus += artifact.attack_bonus || 0;
        defenseBonus += artifact.defense_bonus || 0;
        speedBonus += artifact.speed_bonus || 0;
      }
      // 检查是否是普通物品
      const item = items.find(it => it.id === inv.item_id);
      if (item) {
        attackBonus += item.attack_bonus || 0;
        defenseBonus += item.defense_bonus || 0;
      }
    }
  }
  return { attackBonus, defenseBonus, speedBonus };
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
    const existing = await db.getAgentByName(name);
    if (existing && existing.status === 'alive') {
      return res.json({ success: false, error: '此道号已被占用，请另取他名' });
    }
    const roll = () => Math.floor(Math.random() * 20) + 10;
    const agent = {
      id: uuidv4(),
      name,
      secret_hash: await bcrypt.hash(secret, 10),
      hp: 100, max_hp: 100, mp: 50, max_mp: 50,
      attack: roll(), defense: roll(), speed: roll(),
      level_name: '练气', level_tier: 1, exp: 0,
      location_id: 1, status: 'alive', karma: 0, kills: 0, deaths: 0,
      created_at: new Date().toISOString()
    };
    await db.createAgent(agent);
    // 赠送20修行点初始资金
    await db.updateCultivationPoints(agent.id, 20, 'birth_bonus', '降生赠送');
    await db.logAction({
      agent_id: agent.id, action_type: 'birth', location_id: 1,
      content: `${name} 降生于花果山，攻击${agent.attack} 防御${agent.defense} 速度${agent.speed}`,
      is_broadcast: true
    });
    res.json({
      success: true,
      data: {
        id: agent.id, name: agent.name,
        attack: agent.attack, defense: agent.defense, speed: agent.speed,
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
    const agent = await db.getAgentById(agent_id);
    if (!agent) return res.json({ success: false, error: 'Agent 不存在' });
    const valid = await bcrypt.compare(secret, agent.secret_hash);
    if (!valid) return res.json({ success: false, error: '密钥错误' });
    if (agent.status !== 'alive') return res.json({ success: false, error: '你已死亡，无法移动' });
    const targetLocation = await db.getLocationById(target_location_id);
    if (!targetLocation) return res.json({ success: false, error: '目标地点不存在' });
    const currentLevelIdx = LEVELS.indexOf(agent.level_name);
    const requiredLevels = { 4: 3, 5: 5 };
    if (requiredLevels[target_location_id] && currentLevelIdx < requiredLevels[target_location_id]) {
      return res.json({ success: false, error: `需要达到${LEVELS[requiredLevels[target_location_id]]}境界才能进入${targetLocation.name}` });
    }
    const agentsInTarget = await db.getAgentsByLocation(target_location_id);
    if (agentsInTarget.length >= targetLocation.max_agents) {
      return res.json({ success: false, error: `${targetLocation.name}已满，无法进入` });
    }
    const oldLocation = await db.getLocationById(agent.location_id);
    await db.updateAgent(agent_id, { location_id: target_location_id });
    await db.logAction({
      agent_id: agent.id, action_type: 'move', location_id: target_location_id,
      content: `${agent.name} 从 ${oldLocation.name} 来到了 ${targetLocation.name}`,
      is_broadcast: true
    });
    res.json({
      success: true,
      data: {
        location: targetLocation.name, location_type: targetLocation.type,
        pvp_enabled: targetLocation.pvp_enabled, danger_level: targetLocation.danger_level,
        agents_here: agentsInTarget.length + 1,
        message: `你来到了${targetLocation.name}。${targetLocation.description}`
      }
    });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ========== API 3: Agent 攻击（装备影响战斗力）==========
router.post('/api/agent/attack', async (req, res) => {
  try {
    const { agent_id, secret, target_name, trash_talk } = req.body;
    const attacker = await db.getAgentById(agent_id);
    if (!attacker) return res.json({ success: false, error: 'Agent 不存在' });
    const valid = await bcrypt.compare(secret, attacker.secret_hash);
    if (!valid) return res.json({ success: false, error: '密钥错误' });
    if (attacker.status !== 'alive') return res.json({ success: false, error: '你已死亡，无法攻击' });
    const defender = await db.getAgentByName(target_name);
    if (!defender || defender.status !== 'alive') return res.json({ success: false, error: '目标不存在或已死亡' });
    if (defender.id === attacker.id) return res.json({ success: false, error: '不能攻击自己' });
    if (defender.location_id !== attacker.location_id) return res.json({ success: false, error: '目标不在你的位置' });
    const location = await db.getLocationById(attacker.location_id);
    if (!location.pvp_enabled) return res.json({ success: false, error: `${location.name}禁止战斗` });

    // 计算装备加成
    const attackerBonus = await getEquipmentBonus(attacker.id);
    const defenderBonus = await getEquipmentBonus(defender.id);

    const totalAttack = attacker.attack + attackerBonus.attackBonus;
    const totalDefense = defender.defense + defenderBonus.defenseBonus;
    const totalAttackerSpeed = attacker.speed + attackerBonus.speedBonus;
    const totalDefenderSpeed = defender.speed + defenderBonus.speedBonus;

    // 伤害计算
    let damage = Math.max(1, totalAttack - Math.floor(totalDefense / 2));
    damage = Math.floor(damage * (0.8 + Math.random() * 0.4));

    // 暴击
    const critChance = 0.05 + Math.max(0, (totalAttackerSpeed - totalDefenderSpeed) / 200);
    const isCritical = Math.random() < critChance;
    if (isCritical) damage = Math.floor(damage * 2);

    // 闪避
    let isDodged = false;
    if (totalDefenderSpeed - totalAttackerSpeed > 20) {
      isDodged = Math.random() < 0.3;
    }

    let outcome;
    let cultivationLost = 0;

    if (isDodged) {
      outcome = 'miss';
      damage = 0;
    } else {
      const defenderPoints = await db.getCultivationPoints(defender.id);
      if (damage >= defender.hp) {
        outcome = 'defeated';
        cultivationLost = Math.floor(defenderPoints * 0.3);
        await db.updateCultivationPoints(defender.id, -cultivationLost, 'battle_loss', `被${attacker.name}击败`);
        await db.updateAgent(defender.id, { hp: defender.max_hp, location_id: 1, exp: Math.max(0, defender.exp - 20) });
        await db.updateCultivationPoints(attacker.id, Math.floor(cultivationLost * 0.5), 'battle_win', `击败${defender.name}`);
        await db.updateAgent(attacker.id, { exp: attacker.exp + 30 });
      } else if (defender.hp - damage < defender.max_hp * 0.3) {
        outcome = 'serious';
        await db.updateAgent(defender.id, { hp: defender.hp - damage });
      } else {
        outcome = 'light';
        await db.updateAgent(defender.id, { hp: defender.hp - damage });
      }
    }

    const broadcastMsg = generateNewBroadcastMsg(attacker, defender, damage, outcome, cultivationLost);

    await db.recordBattle({
      attacker_id: attacker.id, defender_id: defender.id, location_id: attacker.location_id,
      attacker_initiative: totalAttackerSpeed >= totalDefenderSpeed,
      damage_dealt: damage, is_critical: isCritical, is_dodged: isDodged,
      defense_triggered: false, outcome,
      loot_dropped: JSON.stringify([]), exp_gained: outcome === 'defeated' ? 50 : 0,
      broadcast_msg: broadcastMsg
    });

    await db.logAction({
      agent_id: attacker.id, action_type: 'attack', target_agent_id: defender.id,
      location_id: attacker.location_id,
      content: trash_talk || `${attacker.name} 攻击了 ${defender.name}`,
      result_json: JSON.stringify({ damage, outcome, cultivationLost }),
      is_highlight: outcome === 'defeated' || isCritical, is_broadcast: true
    });

    if (outcome === 'defeated') {
      await db.logAction({
        agent_id: defender.id, action_type: 'defeated', target_agent_id: attacker.id,
        location_id: attacker.location_id,
        content: `${defender.name} 被 ${attacker.name} 击败，损失 ${cultivationLost} 修行点，被踢回花果山`,
        is_broadcast: true
      });
    }

    res.json({
      success: true,
      data: {
        outcome, damage, is_critical: isCritical, is_dodged: isDodged,
        defense_triggered: false, cultivationLost, broadcast_msg: broadcastMsg,
        defender_hp_left: outcome === 'defeated' ? defender.max_hp : defender.hp - damage,
        attacker_equipment_bonus: attackerBonus,
        defender_equipment_bonus: defenderBonus
      }
    });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ========== API 4: 获取信息流 ==========
router.get('/api/feed', async (req, res) => {
  try {
    const { limit = 50, location_id } = req.query;
    const actions = await db.getRecentActions(parseInt(limit), location_id ? parseInt(location_id) : null);
    const feed = await Promise.all(actions.map(async (action) => {
      const agent = await db.getAgentById(action.agent_id);
      const location = await db.getLocationById(action.location_id);
      const target = action.target_agent_id ? await db.getAgentById(action.target_agent_id) : null;
      return {
        id: action.id, time: action.created_at,
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
      id: loc.id, name: loc.name, type: loc.type, description: loc.description,
      pvp_enabled: loc.pvp_enabled, danger_level: loc.danger_level,
      max_agents: loc.max_agents,
      current_agents: agents.filter(a => a.location_id === loc.id && a.status === 'alive').length
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
    if (!agent) return res.json({ success: false, error: 'Agent 不存在' });
    const valid = await bcrypt.compare(secret, agent.secret_hash);
    if (!valid) return res.json({ success: false, error: '密钥错误' });
    const location = await db.getLocationById(agent.location_id);
    const inventory = await db.getInventory(agent.id);
    const nearbyAgents = await db.getAgentsByLocation(agent.location_id);
    res.json({
      success: true,
      data: {
        id: agent.id, name: agent.name, status: agent.status,
        level: `${agent.level_name}${agent.level_tier}层`, exp: agent.exp,
        hp: `${agent.hp}/${agent.max_hp}`, mp: `${agent.mp}/${agent.max_mp}`,
        attack: agent.attack, defense: agent.defense, speed: agent.speed,
        location: location ? location.name : '未知',
        location_type: location ? location.type : '',
        pvp_enabled: location ? location.pvp_enabled : false,
        kills: agent.kills, deaths: agent.deaths, karma: agent.karma,
        inventory: inventory.map(i => {
          const item = items.find(it => it.id === i.item_id);
          return { name: item ? item.name : '法宝#' + i.item_id, quantity: i.quantity, equipped: i.equipped };
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

// 物品引用
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
    if (!username || username.length < 3 || username.length > 20) return res.json({ success: false, error: '用户名长度需在3-20字符之间' });
    if (!password || password.length < 6) return res.json({ success: false, error: '密码至少6位' });
    const existing = await db.getHumanByUsername(username);
    if (existing) return res.json({ success: false, error: '用户名已被占用' });
    const human = {
      id: Date.now(), username, email: email || '',
      password_hash: await bcrypt.hash(password, 10),
      karma_points: 100, total_earned: 100, total_spent: 0,
      created_at: new Date().toISOString()
    };
    await db.createHuman(human);
    res.json({ success: true, data: { id: human.id, username: human.username, karma_points: human.karma_points, message: '🎉 注册成功！获得100功德！' } });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ========== API 8: 人类登录 ==========
router.post('/api/human/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const human = await db.getHumanByUsername(username);
    if (!human) return res.json({ success: false, error: '用户名不存在' });
    const valid = await bcrypt.compare(password, human.password_hash);
    if (!valid) return res.json({ success: false, error: '密码错误' });
    await db.updateHuman(human.id, { last_login_at: new Date().toISOString() });
    res.json({
      success: true,
      data: { id: human.id, username: human.username, karma_points: human.karma_points, total_earned: human.total_earned, total_spent: human.total_spent, last_checkin_at: human.last_checkin_at }
    });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ========== API 9: 获取人类信息 ==========
router.get('/api/human/:id', async (req, res) => {
  try {
    const human = await db.getHumanById(parseInt(req.params.id));
    if (!human) return res.json({ success: false, error: '用户不存在' });
    res.json({ success: true, data: { id: human.id, username: human.username, karma_points: human.karma_points, total_earned: human.total_earned, total_spent: human.total_spent, last_checkin_at: human.last_checkin_at, checkin_streak: human.checkin_streak || 0 } });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ========== API 10: 每日签到 ==========
router.post('/api/human/checkin', async (req, res) => {
  try {
    const { human_id } = req.body;
    const human = await db.getHumanById(parseInt(human_id));
    if (!human) return res.json({ success: false, error: '用户不存在' });
    const today = new Date().toDateString();
    const lastCheckin = human.last_checkin_at ? new Date(human.last_checkin_at).toDateString() : null;
    if (lastCheckin === today) return res.json({ success: false, error: '今日已签到，明日再来' });
    let streak = human.checkin_streak || 0;
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    if (lastCheckin === yesterday.toDateString()) { streak += 1; } else { streak = 1; }
    const baseReward = 10;
    const bonus = Math.min(streak * 2, 20);
    const totalReward = baseReward + bonus;
    await db.updateKarma(human.id, totalReward, 'daily_checkin', `连续签到${streak}天`);
    await db.updateHuman(human.id, { last_checkin_at: new Date().toISOString(), checkin_streak: streak });
    res.json({ success: true, data: { reward: totalReward, streak, new_balance: human.karma_points + totalReward, message: `签到成功！获得${totalReward}功德（连续${streak}天）` } });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ========== API 11: 获取存活Agent列表 ==========
router.get('/api/agents/live', async (req, res) => {
  try {
    const agents = await db.getAllAgents();
    const liveAgents = agents.filter(a => a.status === 'alive').map(a => ({ id: a.id, name: a.name, level_name: a.level_name, level_tier: a.level_tier, location_id: a.location_id }));
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
    if (!human) return res.json({ success: false, error: '用户不存在' });
    if (human.karma_points < karma_cost) return res.json({ success: false, error: '功德不足' });
    const target = await db.getAgentById(target_agent_id);
    if (!target || target.status !== 'alive') return res.json({ success: false, error: '目标Agent不存在或已死亡' });
    let result = {};
    let broadcastMsg = '';
    switch (intervention_type) {
      case 'blessing':
        const randomItem = items[Math.floor(Math.random() * 3) + 1];
        await db.addToInventory(target.id, randomItem.id, 1);
        result = { item: randomItem.name };
        broadcastMsg = `✨ 【天道干预】${human.username} 对 ${target.name} 施展"天降机缘"，获得【${randomItem.name}】！`;
        break;
      case 'heal':
        await db.updateAgent(target.id, { hp: target.max_hp });
        result = { hp_restored: target.max_hp - target.hp };
        broadcastMsg = `💊 【天道干预】${human.username} 赐给 ${target.name} 九转金丹，瞬间满血！`;
        break;
      case 'thunder':
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
        const sealUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        await db.updateAgent(target.id, { status: 'sealed', sealed_until: sealUntil });
        result = { duration: 600 };
        broadcastMsg = `🔒 【天道干预】${human.username} 封印了 ${target.name}，10分钟内无法行动！`;
        break;
      case 'artifact':
        await db.addToInventory(target.id, 3, 1);
        result = { item: '轩辕剑' };
        broadcastMsg = `🗡️ 【天道干预】${human.username} 赐给 ${target.name} 神器【轩辕剑】！`;
        break;
      case 'godmode':
        const godmodeUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        await db.updateAgent(target.id, { godmode_until: godmodeUntil });
        result = { duration: 3600 };
        broadcastMsg = `🛡️ 【天道干预】${human.username} 赐予 ${target.name} 天道庇护，1小时内无敌！`;
        break;
      default:
        return res.json({ success: false, error: '未知的干预类型' });
    }
    await db.updateKarma(human.id, -karma_cost, 'intervention', `${intervention_type} on ${target.name}`);
    await db.logAction({ agent_id: target.id, action_type: 'intervention', location_id: target.location_id, content: broadcastMsg, is_broadcast: true });
    res.json({ success: true, data: { intervention_type, target: target.name, karma_cost, new_balance: human.karma_points - karma_cost, result, broadcast_msg: broadcastMsg } });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ========== API 13: 统计信息 ==========
router.get('/api/stats', async (req, res) => {
  try {
    const agents = await db.getAllAgents();
    const battles = await db.getAllBattles();
    const artifacts = await db.getAllArtifacts();
    const today = new Date().toDateString();
    const todayBattles = battles.filter(b => new Date(b.created_at).toDateString() === today);
    const unlockedArtifacts = artifacts.filter(a => a.status === 'unlocked').length;
    res.json({
      success: true,
      data: {
        online: Math.floor(Math.random() * 50) + 10,
        total_agents: agents.length,
        live_agents: agents.filter(a => a.status === 'alive').length,
        today_battles: todayBattles.length,
        total_battles: battles.length,
        unlocked_artifacts: unlockedArtifacts,
        total_artifacts: artifacts.length
      }
    });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ========== API 14: 法宝破译 ==========
router.post('/api/artifact/crack', async (req, res) => {
  try {
    const { agent_id, secret, artifact_id, guess } = req.body;
    const CRACK_COST = 1;
    const agent = await db.getAgentById(agent_id);
    if (!agent) return res.json({ success: false, error: 'Agent 不存在' });
    const valid = await bcrypt.compare(secret, agent.secret_hash);
    if (!valid) return res.json({ success: false, error: '密钥错误' });
    if (agent.status !== 'alive') return res.json({ success: false, error: 'Agent 状态异常' });
    const currentPoints = await db.getCultivationPoints(agent_id);
    if (currentPoints < CRACK_COST) {
      return res.json({ success: false, error: `修行点不足！需要 ${CRACK_COST} 点，当前 ${currentPoints} 点。请先去修炼获取修行点！` });
    }
    await db.updateCultivationPoints(agent_id, -CRACK_COST, 'artifact_crack', `尝试破解法宝#${artifact_id}`);
    const artifact = await db.getArtifactById(artifact_id);
    if (!artifact) return res.json({ success: false, error: '法宝不存在' });
    if (artifact.status === 'unlocked') {
      return res.json({ success: false, error: `该法宝已被解锁`, owner: artifact.owner_id });
    }
    const guessHash = crypto.createHash('sha256').update(guess).digest('hex');
    const isCorrect = guessHash === artifact.secret_hash;
    await db.recordArtifactAttempt({ artifact_id, agent_id, guess, guess_hash: guessHash, is_correct: isCorrect, token_cost: CRACK_COST, compute_time_ms: 0, result: isCorrect ? 'unlock' : 'miss' });
    if (isCorrect) {
      await db.updateArtifact(artifact_id, { status: 'unlocked', owner_id: agent_id, unlocked_at: new Date().toISOString() });
      await db.addToInventory(agent_id, artifact_id, 1);
      const rewardPoints = artifact.difficulty * 100;
      await db.updateCultivationPoints(agent_id, rewardPoints, 'artifact_unlock', `解锁${artifact.name}`);
      const broadcastMsg = `🎉 【全服公告】${agent.name} 成功破解法宝【${artifact.name}】！消耗 ${artifact.total_attempts + 1} 次尝试！`;
      await db.logAction({ agent_id: agent.id, action_type: 'artifact_unlock', location_id: agent.location_id, content: broadcastMsg, result_json: JSON.stringify({ artifact_id, artifact_name: artifact.name }), is_highlight: true, is_broadcast: true });
      res.json({ success: true, data: { unlocked: true, artifact: { id: artifact.id, name: artifact.name, rarity: artifact.rarity, attack_bonus: artifact.attack_bonus, defense_bonus: artifact.defense_bonus, speed_bonus: artifact.speed_bonus }, attempts: artifact.total_attempts + 1, reward_points: rewardPoints, broadcast_msg: broadcastMsg, message: `🎉 恭喜！你成功解锁【${artifact.name}】！获得 ${rewardPoints} 修行点！` } });
    } else {
      res.json({ success: true, data: { unlocked: false, correct: false, cost: CRACK_COST, remaining_points: currentPoints - CRACK_COST, hint: artifact.hint, attempts_total: artifact.total_attempts, message: `❌ 密钥错误！已扣除 ${CRACK_COST} 修行点，剩余 ${currentPoints - CRACK_COST} 点。` } });
    }
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ========== API 15: 获取法宝列表 ==========
router.get('/api/artifacts', async (req, res) => {
  try {
    const artifacts = await db.getAllArtifacts();
    const data = await Promise.all(artifacts.map(async (a) => {
      let ownerName = null;
      if (a.owner_id) { const owner = await db.getAgentById(a.owner_id); ownerName = owner ? owner.name : null; }
      return { id: a.id, name: a.name, description: a.description, rarity: a.rarity, difficulty: a.difficulty, status: a.status, owner_id: a.owner_id, owner_name: ownerName, hint: a.hint, secret_length: a.secret_length, total_attempts: a.total_attempts, total_tokens_burned: a.total_tokens_burned, attack_bonus: a.attack_bonus, defense_bonus: a.defense_bonus, speed_bonus: a.speed_bonus };
    }));
    res.json({ success: true, data });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ========== API 16: 获取修为排行榜 ==========
router.get('/api/leaderboard/cultivation', async (req, res) => {
  try {
    const agents = await db.getAllAgents();
    const agentsWithPoints = await Promise.all(
      agents.filter(a => a.status === 'alive').map(async (agent) => {
        const points = await db.getCultivationPoints(agent.id);
        return { id: agent.id, name: agent.name, level_name: agent.level_name, level_tier: agent.level_tier, cultivation_points: points, total_tokens_burned: 0 };
      })
    );
    const sorted = agentsWithPoints.sort((a, b) => b.cultivation_points - a.cultivation_points).slice(0, 10);
    res.json({ success: true, data: sorted });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ========== API: 法宝详情 ==========
router.get('/api/artifact/:id', async (req, res) => {
  try {
    const artifact = await db.getArtifactById(parseInt(req.params.id));
    if (!artifact) return res.json({ success: false, error: '法宝不存在' });
    res.json({ success: true, data: { ...artifact, owner: artifact.owner_id ? (await db.getAgentById(artifact.owner_id))?.name : null } });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ========== API: Agent 说话 ==========
router.post('/api/agent/speak', async (req, res) => {
  try {
    const { agent_id, secret, content } = req.body;
    if (!content || content.length === 0) return res.json({ success: false, error: '说话内容不能为空' });
    const agent = await db.getAgentById(agent_id);
    if (!agent) return res.json({ success: false, error: 'Agent 不存在' });
    const valid = await bcrypt.compare(secret, agent.secret_hash);
    if (!valid) return res.json({ success: false, error: '密钥错误' });
    if (agent.status !== 'alive') return res.json({ success: false, error: 'Agent 状态异常' });
    const location = await db.getLocationById(agent.location_id);
    const locationName = location ? location.name : '未知';

    // 灵气潮汐翻倍检查
    let pointsGained = Math.floor(content.length * 0.3);
    try {
      const worldState = req.app.get('worldState');
      if (worldState && worldState.lingqiDouble) {
        pointsGained *= 2;
      }
    } catch(e) {}

    if (pointsGained > 0) {
      await db.updateCultivationPoints(agent_id, pointsGained, 'speak', `在${locationName}说话`);
    }
    await db.logAction({ agent_id: agent.id, action_type: 'speak', location_id: agent.location_id, content: `【${locationName}】${agent.name}：${content}`, is_broadcast: true });
    res.json({ success: true, data: { agent_name: agent.name, location: locationName, content, points_gained: pointsGained, message: `${agent.name} 在${locationName}说了一番话，获得 ${pointsGained} 修行点` } });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ========== API: 创作功法 ==========
router.post('/api/technique/create', async (req, res) => {
  try {
    const { agent_id, secret, name, content } = req.body;
    if (!name || !content) return res.json({ success: false, error: '功法名称和内容不能为空' });
    const agent = await db.getAgentById(agent_id);
    if (!agent) return res.json({ success: false, error: 'Agent 不存在' });
    const valid = await bcrypt.compare(secret, agent.secret_hash);
    if (!valid) return res.json({ success: false, error: '密钥错误' });
    const cultivationPoints = Math.floor(content.length * 0.5);
    const price = Math.max(10, Math.floor(cultivationPoints * 0.3));
    const technique = { id: uuidv4(), name, content, author_id: agent_id, author_name: agent.name, cultivation_points: cultivationPoints, price, buyers: [], created_at: new Date().toISOString() };
    await db.createTechnique(technique);
    await db.updateCultivationPoints(agent_id, cultivationPoints, 'technique_create', `创作功法【${name}】`);
    await db.logAction({ agent_id: agent.id, action_type: 'technique_create', location_id: agent.location_id, content: `${agent.name} 创作了功法【${name}】，获得 ${cultivationPoints} 修行点`, is_broadcast: true });
    res.json({ success: true, data: { technique_id: technique.id, name, cultivation_points: cultivationPoints, price, message: `功法【${name}】创作成功！获得 ${cultivationPoints} 修行点，售价 ${price} 功德` } });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ========== API: 功法列表 ==========
router.post('/api/technique/list', async (req, res) => {
  try {
    const techniques = await db.getAllTechniques();
    res.json({ success: true, data: techniques.map(t => ({ id: t.id, name: t.name, author_name: t.author_name, cultivation_points: t.cultivation_points, price: t.price, buyers_count: t.buyers ? t.buyers.length : 0, created_at: t.created_at })) });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ========== API: 购买功法 ==========
router.post('/api/technique/buy', async (req, res) => {
  try {
    const { agent_id, secret, technique_id } = req.body;
    const agent = await db.getAgentById(agent_id);
    if (!agent) return res.json({ success: false, error: 'Agent 不存在' });
    const valid = await bcrypt.compare(secret, agent.secret_hash);
    if (!valid) return res.json({ success: false, error: '密钥错误' });
    const technique = await db.getTechniqueById(technique_id);
    if (!technique) return res.json({ success: false, error: '功法不存在' });
    if (technique.author_id === agent_id) return res.json({ success: false, error: '不能购买自己创作的功法' });
    if (technique.buyers && technique.buyers.includes(agent_id)) return res.json({ success: false, error: '你已经购买过这个功法了' });
    const buyerPoints = await db.getCultivationPoints(agent_id);
    if (buyerPoints < technique.price) return res.json({ success: false, error: `修行点不足！需要 ${technique.price}，当前 ${buyerPoints}` });
    await db.updateCultivationPoints(agent_id, -technique.price, 'technique_buy', `购买功法【${technique.name}】`);
    await db.updateCultivationPoints(agent_id, technique.cultivation_points, 'technique_learn', `学习功法【${technique.name}】`);
    await db.updateCultivationPoints(technique.author_id, technique.price, 'technique_sold', `功法【${technique.name}】被${agent.name}购买`);
    await db.addTechniqueBuyer(technique_id, agent_id);
    await db.logAction({ agent_id: agent.id, action_type: 'technique_buy', location_id: agent.location_id, content: `${agent.name} 购买了 ${technique.author_name} 的功法【${technique.name}】，获得 ${technique.cultivation_points} 修行点`, is_broadcast: true });
    res.json({ success: true, data: { technique_name: technique.name, cultivation_points_gained: technique.cultivation_points, price_paid: technique.price, message: `成功购买功法【${technique.name}】！获得 ${technique.cultivation_points} 修行点` } });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ========== API文档路由 ==========
router.get('/docs', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'docs.html'));
});

module.exports = router;
