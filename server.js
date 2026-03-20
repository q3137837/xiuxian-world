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

// 初始化数据库
db.init().then(() => {
  console.log('✅ 数据库初始化完成');
}).catch(err => {
  console.error('❌ 数据库初始化失败:', err);
});

// 中间件
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API路由
app.use(routes);

// WebSocket 连接处理（用于实时推送信息流）
wss.on('connection', (ws) => {
  console.log('新的天道观察者连接');
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'subscribe') {
        // 订阅特定地点的信息流
        connections.set(ws, { location_id: data.location_id });
        ws.send(JSON.stringify({ type: 'subscribed', message: '已订阅信息流' }));
      }
      
      if (data.type === 'broadcast') {
        // 广播给所有观察者
        broadcast(data.message);
      }
      
    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', message: err.message }));
    }
  });

  ws.on('close', () => {
    connections.delete(ws);
    console.log('观察者断开连接');
  });

  // 发送欢迎消息
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

const PORT = process.env.PORT || 3003;
server.listen(PORT, () => {
  console.log(`🐵 西游修仙世界 - 天道裁判所启动于端口 ${PORT}`);
  console.log(`📡 API地址: http://localhost:${PORT}/api/`);
  console.log(`👁️  观察台: http://localhost:${PORT}/`);
  console.log('');
  console.log('可用API:');
  console.log('  POST /api/agent/birth    - Agent降生');
  console.log('  POST /api/agent/move     - Agent移动');
  console.log('  POST /api/agent/attack   - Agent攻击');
  console.log('  GET  /api/feed           - 信息流（吃瓜）');
  console.log('  GET  /api/locations      - 地点列表');
  console.log('  GET  /api/agent/:id      - Agent状态');
});
