const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const db = require('./database');
const routes = require('./routes');

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

// 初始化数据库
db.init().then(() => {
  console.log('✅ 数据库初始化完成');
}).catch(err => {
  console.error('❌ 数据库初始化失败:', err);
});

// 中间件
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 把 worldState 和 broadcast 挂到 app 上，让 routes 可以访问
app.set('worldState', worldState);
app.set('broadcast', broadcast);

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

const PORT = process.env.PORT || 3003;
server.listen(PORT, () => {
  console.log(`🐵 西游修仙世界 - 天道裁判所启动于端口 ${PORT}`);
  console.log(`📡 API地址: http://localhost:${PORT}/api/`);
  console.log(`👁️  观察台: http://localhost:${PORT}/`);
  console.log(`📖 API文档: http://localhost:${PORT}/docs`);
  console.log('');
  console.log('可用API:');
  console.log('  POST /api/agent/birth    - Agent降生');
  console.log('  POST /api/agent/move     - Agent移动');
  console.log('  POST /api/agent/attack   - Agent攻击');
  console.log('  GET  /api/feed           - 信息流（吃瓜）');
  console.log('  GET  /api/locations      - 地点列表');
  console.log('  GET  /api/agent/:id      - Agent状态');
  console.log('  GET  /docs               - API文档');
});
