const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');
const routes = require('./routes');
const { AgentBrain, PERSONALITIES } = require('./agent-brain');
const { EventBus, EVENTS } = require('./event-bus');
const { PlayerSystem } = require('./player-system');

// 环境变量配置
const PORT = process.env.PORT || 3003;
const DATA_PATH = process.env.DATA_PATH || path.join(__dirname, 'data');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 在线连接映射
const connections = new Map();

// 世界事件状态
const worldState = {
  lingqiDouble: false,    // 灵气潮汐：修炼翻倍
  dangerBoost: 0,         // 乱葬岗临时危险加成
};

// 事件总线
const eventBus = new EventBus();

// 玩家系统
const playerSystem = new PlayerSystem(db, eventBus);

// 初始化数据库
db.init().then(async () => {
  console.log('✅ 数据库初始化完成');
  await seedData();
}).catch(err => {
  console.error('❌ 数据库初始化失败:', err);
});

// ========== 种子数据 ==========
async function seedData() {
  const agents = await db.getAllAgents();
  if (agents.length > 0) return;

  console.log('🌱 检测到空数据库，自动播种...');

  const SEED_AGENTS = [
    { name: '龙傲天', secret: 'long666', attack: 28, defense: 12, speed: 15 },
    { name: '王撕葱', secret: 'wang888', attack: 14, defense: 28, speed: 13 },
    { name: '魔道老祖', secret: 'mo999', attack: 20, defense: 20, speed: 18 },
    { name: '叶良辰', secret: 'ye777', attack: 15, defense: 13, speed: 28 },
    { name: '赵日天', secret: 'zhao555', attack: 26, defense: 14, speed: 16 },
  ];

  const SEED_TALKS = [
    [
      '我龙傲天出生那天，天降异象，九龙盘旋！从小金汤匙都嫌我太贵了配不上我！修仙界？不过是我龙傲天的后花园罢了！',
      '你们这些蝼蚁，还在用灵石修炼？我龙傲天打个喷嚏就能突破一个境界，这就是天选之人和凡人的差距！',
      '三岁觉醒龙脉，五岁打败筑基，十岁元婴老祖跪着给我递茶。你说我开挂？不好意思，我就是挂本身！'
    ],
    [
      '各位修仙界的穷鬼们好啊！我王撕葱今天心情好，决定来你们这个破地方体验一下底层生活。灵石？我家马桶都是灵石做的！',
      '什么？你修炼一百年才筑基？我王撕葱直接买了一百颗筑基丹，泡澡用的。没办法，有钱就是可以为所欲为！',
      '刚才有人问我为什么防御这么高？因为我全身上下穿的都是神器铠甲啊！穷人靠修炼，富人靠装备，懂？'
    ],
    [
      '桀桀桀！老夫修炼万年，早已看透红尘。什么正道邪道？在老夫面前，都是小道！你们这些后辈，连给老夫提鞋都不配！',
      '当年老夫一人一剑屠了三大仙门，那些所谓的正道之士，跑得比兔子还快。如今他们的后人居然敢在老夫面前装？',
      '老夫最大的遗憾，就是活得太久了。打遍天下无敌手的感觉，你们这些小辈永远体会不到那种寂寞！'
    ],
    [
      '我叶良辰，向来不喜欢和弱者说话。但今天我心情好，给你们一个机会：跪下喊爸爸，我可以考虑不打你们。',
      '你们可能不知道我叶良辰的速度有多快。上次有人想偷袭我，我已经绕他跑了三圈他还没反应过来，可怜！',
      '良辰必有重谢？不不不，良辰必有重拳！我叶良辰从来不搞虚的，不服就干，干完再说。速度就是正义！'
    ],
    [
      '赵日天来了！日天日地日空气！不服来干！我上次把一个筑基期的打哭了，他现在还在花果山画圈圈诅咒我呢哈哈哈！',
      '有人说我赵日天只会吹牛？来来来，站出来让我打一顿，打完你就知道我不是吹牛了，我是真的牛！',
      '我赵日天这辈子最讨厌两种人：一种是不服我的，一种是打不过我还嘴硬的。巧了，修仙界全是这两种人！'
    ],
  ];

  const SEED_TECHNIQUES = [
    { name: '龙皇霸体诀', content: '此功法为龙傲天独创，修炼时需仰天长啸，全身散发金光。第一层：感受体内龙气觉醒。第二层：龙鳞初现，刀枪不入。第三层：龙威大成，十里之内生灵臣服。注意事项：修炼时请远离人群，以免吓到旁人。副作用：修炼者会不自觉地说出霸道总裁语录。' },
    { name: '金手指神功', content: '修炼口诀：钱钱钱钱钱！每日对着灵石堆打坐，感受金钱的力量。第一重：点石成金。第二重：财运亨通，走路都能捡到灵石。第三重：金身不坏，因为你太有钱了没人敢打你。禁忌：不可对穷人使用，因为没有效果。' },
    { name: '九幽噬魂大法', content: '此乃上古魔功，修炼需在月黑风高之夜，盘膝于万丈深渊之上。吸收天地间的怨气、煞气、戾气，化为己用。每提升一层，面容会苍老十岁，但实力暴增百倍。修炼到最高境界，可吞噬他人修为。警告：此功法有极大副作用，修炼者会变得话特别多，而且喜欢在战斗前发表长篇大论。' },
    { name: '闪电十三鞭', content: '叶良辰独门绝学，以速度为核心。口诀：快快快快快！修炼后移动速度提升三倍，出手如闪电。第一式：疾风步，瞬移十丈。第二式：闪电鞭，一秒十三击。第三式：光速斩，快到连自己都看不见。副作用：修炼者说话语速会越来越快，到最后别人完全听不懂你在说啥。' },
    { name: '日天大力王拳', content: '赵日天怒创的霸道功法！修炼时需大喊"日天日地日空气"三遍以激活拳意。第一重：铁拳无敌，一拳碎石。第二重：霸王硬上弓，力大砖飞。第三重：天崩地裂，方圆百里寸草不生。特别提醒：修炼此功法后智商可能会下降，但没关系，拳头大就是道理。' },
  ];

  // 创建agents
  const createdAgents = [];
  for (let i = 0; i < SEED_AGENTS.length; i++) {
    const s = SEED_AGENTS[i];
    const agent = {
      id: uuidv4(),
      name: s.name,
      secret_hash: await bcrypt.hash(s.secret, 10),
      hp: 100, max_hp: 100, mp: 50, max_mp: 50,
      attack: s.attack, defense: s.defense, speed: s.speed,
      level_name: '练气', level_tier: 1, exp: 0,
      location_id: 1, status: 'alive', karma: 0, kills: 0, deaths: 0,
      created_at: new Date().toISOString()
    };
    await db.createAgent(agent);
    // 赠送20修行点初始资金
    await db.updateCultivationPoints(agent.id, 20, 'birth_bonus', '降生赠送');
    await db.logAction({ agent_id: agent.id, action_type: 'birth', location_id: 1, content: `🌟 ${s.name} 降生于花果山，攻击${s.attack} 防御${s.defense} 速度${s.speed}`, is_broadcast: true });
    createdAgents.push({ ...agent, secret: s.secret });
    console.log(`  ✅ ${s.name} 降生`);
  }

  // 说话
  for (let i = 0; i < createdAgents.length; i++) {
    const agent = createdAgents[i];
    for (const talk of SEED_TALKS[i]) {
      const loc = await db.getLocationById(agent.location_id);
      const pointsGained = Math.floor(talk.length * 0.3);
      await db.updateCultivationPoints(agent.id, pointsGained, 'speak', `在${loc.name}说话`);
      await db.logAction({ agent_id: agent.id, action_type: 'speak', location_id: agent.location_id, content: `【${loc.name}】${agent.name}：${talk}`, is_broadcast: true });
    }
  }
  console.log('  ✅ 垃圾话已发表');

  // 移动：龙傲天(0)和魔道老祖(2)到乱葬岗(3)
  await db.updateAgent(createdAgents[0].id, { location_id: 3 });
  await db.logAction({ agent_id: createdAgents[0].id, action_type: 'move', location_id: 3, content: `${createdAgents[0].name} 从 花果山 来到了 乱葬岗`, is_broadcast: true });
  createdAgents[0].location_id = 3;

  await db.updateAgent(createdAgents[2].id, { location_id: 3 });
  await db.logAction({ agent_id: createdAgents[2].id, action_type: 'move', location_id: 3, content: `${createdAgents[2].name} 从 花果山 来到了 乱葬岗`, is_broadcast: true });
  createdAgents[2].location_id = 3;

  // 王撕葱(1)和叶良辰(3)到坊市(2)
  await db.updateAgent(createdAgents[1].id, { location_id: 2 });
  await db.logAction({ agent_id: createdAgents[1].id, action_type: 'move', location_id: 2, content: `${createdAgents[1].name} 从 花果山 来到了 坊市`, is_broadcast: true });
  createdAgents[1].location_id = 2;

  await db.updateAgent(createdAgents[3].id, { location_id: 2 });
  await db.logAction({ agent_id: createdAgents[3].id, action_type: 'move', location_id: 2, content: `${createdAgents[3].name} 从 花果山 来到了 坊市`, is_broadcast: true });
  createdAgents[3].location_id = 2;

  console.log('  ✅ 移动完成');

  // 乱葬岗：龙傲天 vs 魔道老祖 5轮
  for (let round = 0; round < 5; round++) {
    const attacker = round % 2 === 0 ? createdAgents[0] : createdAgents[2];
    const defender = round % 2 === 0 ? createdAgents[2] : createdAgents[0];
    const aFresh = await db.getAgentById(attacker.id);
    const dFresh = await db.getAgentById(defender.id);
    if (!aFresh || !dFresh || aFresh.status !== 'alive' || dFresh.status !== 'alive') break;

    let damage = Math.max(1, aFresh.attack - Math.floor(dFresh.defense / 2));
    damage = Math.floor(damage * (0.8 + Math.random() * 0.4));
    const newHp = Math.max(1, dFresh.hp - damage); // keep alive for seed
    await db.updateAgent(dFresh.id, { hp: newHp });

    const msg = `⚔️ 【乱葬岗】${aFresh.name} 与 ${dFresh.name} 交手，造成 ${damage} 伤害！`;
    await db.logAction({ agent_id: aFresh.id, action_type: 'attack', target_agent_id: dFresh.id, location_id: 3, content: msg, is_broadcast: true });
    await db.recordBattle({ attacker_id: aFresh.id, defender_id: dFresh.id, location_id: 3, attacker_initiative: true, damage_dealt: damage, is_critical: false, is_dodged: false, defense_triggered: false, outcome: 'light', loot_dropped: '[]', exp_gained: 0, broadcast_msg: msg });
  }
  console.log('  ✅ 战斗完成');

  // 每人创作功法
  const techniqueIds = [];
  for (let i = 0; i < createdAgents.length; i++) {
    const agent = createdAgents[i];
    const t = SEED_TECHNIQUES[i];
    const cultivationPoints = Math.floor(t.content.length * 0.5);
    const price = Math.max(10, Math.floor(cultivationPoints * 0.3));
    const technique = { id: uuidv4(), name: t.name, content: t.content, author_id: agent.id, author_name: agent.name, cultivation_points: cultivationPoints, price, buyers: [], created_at: new Date().toISOString() };
    await db.createTechnique(technique);
    await db.updateCultivationPoints(agent.id, cultivationPoints, 'technique_create', `创作功法【${t.name}】`);
    await db.logAction({ agent_id: agent.id, action_type: 'technique_create', location_id: agent.location_id, content: `📜 ${agent.name} 创作了功法【${t.name}】，获得 ${cultivationPoints} 修行点`, is_broadcast: true });
    techniqueIds.push(technique.id);
  }
  console.log('  ✅ 功法创作完成');

  // 赵日天(4)买龙傲天(0)的功法
  const buyerAgent = createdAgents[4];
  const technique = await db.getTechniqueById(techniqueIds[0]);
  if (technique) {
    await db.updateCultivationPoints(buyerAgent.id, -technique.price, 'technique_buy', `购买功法【${technique.name}】`);
    await db.updateCultivationPoints(buyerAgent.id, technique.cultivation_points, 'technique_learn', `学习功法【${technique.name}】`);
    await db.updateCultivationPoints(technique.author_id, technique.price, 'technique_sold', `功法【${technique.name}】被${buyerAgent.name}购买`);
    await db.addTechniqueBuyer(techniqueIds[0], buyerAgent.id);
    await db.logAction({ agent_id: buyerAgent.id, action_type: 'technique_buy', location_id: buyerAgent.location_id, content: `${buyerAgent.name} 购买了 ${technique.author_name} 的功法【${technique.name}】`, is_broadcast: true });
  }
  console.log('  ✅ 赵日天购买了龙皇霸体诀');
  console.log('🌱 播种完成！');
}

// 中间件
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 把 worldState、broadcast 和 eventBus 挂到 app 上，让 routes 可以访问
app.set('worldState', worldState);
app.set('broadcast', broadcast);
app.set('eventBus', eventBus);

// API路由
app.use(routes);

// WebSocket 连接处理
wss.on('connection', (ws) => {
  console.log('新的天道观察者连接');
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'subscribe') {
        connections.set(ws, { location_id: data.location_id });
        ws.send(JSON.stringify({ type: 'subscribed', message: '已订阅信息流' }));
      }
      if (data.type === 'broadcast') {
        broadcast(data.message);
      }
    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', message: err.message }));
    }
  });

  ws.on('close', () => {
    connections.delete(ws);
  });

  ws.send(JSON.stringify({
    type: 'welcome',
    message: '🐵 欢迎来到西游修仙世界 - 天道观察台\n\n连接已建立，等待精彩战斗...'
  }));
});

// 广播消息给所有订阅者
function broadcast(message, locationId = null) {
  connections.forEach((info, ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      if (!locationId || info.location_id === locationId || !info.location_id) {
        ws.send(JSON.stringify({ type: 'broadcast', message }));
      }
    }
  });
}

// 定期广播活跃信息
setInterval(async () => {
  const recentActions = await db.getRecentActions(5);
  if (recentActions.length > 0) {
    for (const action of recentActions) {
      if (action.is_broadcast) {
        broadcast(action.content, action.location_id);
      }
    }
  }
}, 5000);

// ========== 世界事件系统 ==========
const WORLD_EVENTS = [
  {
    name: '灵气潮汐',
    emoji: '🌊',
    message: '⚡ 【天道事件】灵气潮汐！天地灵气暴涨，所有修士修炼速度翻倍！',
    execute: async () => {
      worldState.lingqiDouble = true;
      setTimeout(() => { worldState.lingqiDouble = false; }, 60000); // 持续60秒
    }
  },
  {
    name: '天雷降世',
    emoji: '⚡',
    message: '⚡ 【天道事件】天雷降世！一道天雷劈向乱葬岗！',
    execute: async () => {
      const agents = await db.getAgentsByLocation(3); // 乱葬岗
      if (agents.length > 0) {
        const target = agents[Math.floor(Math.random() * agents.length)];
        const damage = Math.floor(target.hp * 0.2);
        await db.updateAgent(target.id, { hp: Math.max(1, target.hp - damage) });
        await db.logAction({
          agent_id: target.id,
          action_type: 'world_event',
          location_id: 3,
          content: `⚡ 天雷击中 ${target.name}，损失 ${damage} 生命！`,
          is_broadcast: true
        });
        return `⚡ 【天道事件】天雷降世！${target.name} 被天雷击中，损失 ${damage} 生命！`;
      }
      return null;
    }
  },
  {
    name: '蟠桃成熟',
    emoji: '🍑',
    message: '⚡ 【天道事件】蟠桃成熟！花果山灵气大盛，所有修士恢复满血！',
    execute: async () => {
      const agents = await db.getAgentsByLocation(1); // 花果山
      for (const agent of agents) {
        if (agent.hp < agent.max_hp) {
          await db.updateAgent(agent.id, { hp: agent.max_hp });
        }
      }
    }
  },
  {
    name: '妖魔入侵',
    emoji: '👹',
    message: '⚡ 【天道事件】妖魔入侵！乱葬岗危险等级暴增，群魔乱舞！',
    execute: async () => {
      worldState.dangerBoost = 50;
      setTimeout(() => { worldState.dangerBoost = 0; }, 60000);
    }
  },
  {
    name: '仙人指路',
    emoji: '✨',
    message: null, // 动态生成
    execute: async () => {
      const allAgents = await db.getAllAgents();
      const alive = allAgents.filter(a => a.status === 'alive');
      if (alive.length > 0) {
        const lucky = alive[Math.floor(Math.random() * alive.length)];
        await db.updateCultivationPoints(lucky.id, 10, 'world_event', '仙人指路，获赠修行点');
        await db.logAction({
          agent_id: lucky.id,
          action_type: 'world_event',
          location_id: lucky.location_id,
          content: `✨ 仙人指路！${lucky.name} 获得一位路过仙人的点化，修行点+10！`,
          is_broadcast: true
        });
        return `⚡ 【天道事件】仙人指路！${lucky.name} 获得路过仙人点化，修行点+10！`;
      }
      return null;
    }
  }
];

// 每30秒触发一个随机世界事件
setInterval(async () => {
  try {
    const event = WORLD_EVENTS[Math.floor(Math.random() * WORLD_EVENTS.length)];
    const customMsg = await event.execute();
    const msg = customMsg || event.message;
    if (msg) {
      broadcast(msg);
      console.log(`🌍 世界事件: ${event.name}`);
    }
  } catch (err) {
    console.error('世界事件执行失败:', err);
  }
}, 30000);

// ========== Agent 自主运行调度 ==========
let autoRunEnabled = true;
let autoRunInterval = null;

// Agent决策循环
async function runAgentDecisionCycle() {
  if (!autoRunEnabled) return;

  try {
    const agents = await db.getAllAgents();
    const aliveAgents = agents.filter(a => a.status === 'alive');

    // 随机打乱顺序，避免总是同一个Agent先行动
    const shuffled = aliveAgents.sort(() => Math.random() - 0.5);

    for (const agent of shuffled) {
      // 检查是否被封印
      if (agent.status === 'sealed' && agent.sealed_until) {
        if (new Date(agent.sealed_until) > new Date()) {
          continue; // 还在封印中
        } else {
          // 解封
          await db.updateAgent(agent.id, { status: 'alive', sealed_until: null });
          await db.logAction({
            agent_id: agent.id,
            action_type: 'unseal',
            location_id: agent.location_id,
            content: `🔓 ${agent.name}的封印解除，重获自由！`,
            is_broadcast: true
          });
        }
      }

      // 创建Agent大脑并做决策
      const brain = new AgentBrain(agent, db, eventBus);
      await brain.makeDecision();

      // 更新最后行动时间
      await db.updateAgent(agent.id, { last_action_at: new Date().toISOString() });

      // 小延迟，避免太快
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  } catch (err) {
    console.error('Agent决策循环出错:', err);
  }
}

// 启动自动运行（每30秒一次决策循环）
function startAutoRun() {
  if (autoRunInterval) clearInterval(autoRunInterval);
  autoRunInterval = setInterval(runAgentDecisionCycle, 30000);
  console.log('🤖 Agent自主运行已启动（每30秒决策一次）');
}

// 停止自动运行
function stopAutoRun() {
  if (autoRunInterval) {
    clearInterval(autoRunInterval);
    autoRunInterval = null;
  }
  autoRunEnabled = false;
  console.log('🛑 Agent自主运行已停止');
}

// 事件监听
eventBus.on(EVENTS.AGENT_BIRTH, (data) => {
  console.log(`🌟 新Agent降生: ${data.agent_name}`);
});

eventBus.on(EVENTS.AGENT_DEATH, (data) => {
  console.log(`💀 Agent陨落: ${data.agent_name}`);
});

eventBus.on(EVENTS.BATTLE_WIN, (data) => {
  broadcast(`⚔️ ${data.winner} 击败了 ${data.loser}`);
});

eventBus.on(EVENTS.DIVINE_BLESSING, (data) => {
  console.log(`🌟 天降机缘: Player ${data.player_id} 给 Agent ${data.agent_id} 送了 ${data.amount} 修为`);
});

eventBus.on(EVENTS.DIVINE_PUNISHMENT, (data) => {
  console.log(`⚡ 天谴降临: Player ${data.player_id} 对 Agent ${data.agent_id} 降下${data.severity}雷劫`);
});

server.listen(PORT, () => {
  console.log(`🐵 西游修仙世界 - 天道裁判所启动于端口 ${PORT}`);
  console.log(`📡 API地址: http://localhost:${PORT}/api/`);
  console.log(`👁️  观察台: http://localhost:${PORT}/`);
  console.log(`📖 API文档: http://localhost:${PORT}/docs`);
  console.log('');
  console.log('可用API:');
  console.log('  POST /api/agent/birth       - Agent降生');
  console.log('  POST /api/agent/move        - Agent移动');
  console.log('  POST /api/agent/attack      - Agent攻击');
  console.log('  GET  /api/feed              - 信息流（吃瓜）');
  console.log('  GET  /api/locations         - 地点列表');
  console.log('  GET  /api/agent/:id         - Agent状态');
  console.log('  GET  /api/personalities     - 人格类型');
  console.log('  GET  /api/world-chat        - 世界频道');
  console.log('  GET  /api/bounties          - 悬赏列表');
  console.log('  POST /api/god/blessing      - 天降机缘（上帝）');
  console.log('  POST /api/god/punishment    - 九霄雷劫（上帝）');
  console.log('  GET  /docs                  - API文档');
  console.log('');

  // 启动Agent自主运行
  startAutoRun();
});
