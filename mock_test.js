/**
 * 西游修仙世界 - 残暴假数据生成脚本
 * 一键生成史诗级战斗场面，用于宣发截图
 * 
 * 使用方法:
 * node mock_test.js [服务器地址]
 * 例如: node mock_test.js https://xiuxian-world.onrender.com
 * 或本地: node mock_test.js http://localhost:3003
 */

const API_BASE = process.argv[2] || 'http://localhost:3003';

// 极端性格 Agent 配置
const EXTREME_AGENTS = [
  {
    name: '龙傲天',
    secret: 'long666',
    personality: '霸道总裁型',
    trashTalks: [
      '桀桀桀，你的神器归我了！',
      '我龙傲天想要的东西，从来没有得不到的！',
      '跪下叫爸爸，饶你不死！',
      '这就是得罪我龙傲天的下场！',
      '你的修为，我笑纳了！'
    ]
  },
  {
    name: '王撕葱',
    secret: 'wang888',
    personality: '富二代嚣张型',
    trashTalks: [
      '我爸是玉帝，你算什么东西？',
      '用钱砸死你！灵石攻击！',
      '这破地方我买了！',
      '穷鬼也配修仙？',
      '我的护体法宝比你命都贵！'
    ]
  },
  {
    name: '魔道老祖',
    secret: 'mo999',
    personality: '邪魅狂狷型',
    trashTalks: [
      '血祭大法！你的精血是我的了！',
      '桀桀桀，又一道亡魂！',
      '魔道至尊，唯我独尊！',
      '你的恐惧，是最美的调料！',
      '死吧，成为我的养料！'
    ]
  },
  {
    name: '叶良辰',
    secret: 'ye777',
    personality: '中二霸气型',
    trashTalks: [
      '我叶良辰有一百种方法让你待不下去！',
      '你若安好，那还得了？',
      '天不生我叶良辰，剑道万古如长夜！',
      '我有一剑，可斩星辰！',
      '你，准备好受死了吗？'
    ]
  },
  {
    name: '赵日天',
    secret: 'zhao555',
    personality: '狂战士型',
    trashTalks: [
      '日天日地日空气！',
      '老子赵日天，不服来干！',
      '一拳打爆你的狗头！',
      '战！战！战！',
      '我命由我不由天！杀！'
    ]
  }
];

// 颜色输出
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gold: '\x1b[38;5;220m',
  reset: '\x1b[0m'
};

function log(color, ...args) {
  console.log(colors[color] || '', ...args, colors.reset);
}

// HTTP 请求工具
async function request(method, path, body = null) {
  const url = `${API_BASE}${path}`;
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) options.body = JSON.stringify(body);
  
  try {
    const response = await fetch(url, options);
    return await response.json();
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// 延迟函数
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 生成随机垃圾话
function getTrashTalk(agent) {
  const talks = agent.trashTalks;
  return talks[Math.floor(Math.random() * talks.length)];
}

// ==================== 主流程 ====================

async function main() {
  log('gold', '╔════════════════════════════════════════╗');
  log('gold', '║     西游修仙世界 - 残暴测试脚本 v1.0    ║');
  log('gold', '║         一键生成史诗级战斗场面          ║');
  log('gold', '╚════════════════════════════════════════╝');
  log('cyan', `\n目标服务器: ${API_BASE}\n`);

  const createdAgents = [];
  let killCount = 0;
  let artifactDropCount = 0;

  // ========== Phase 1: 降生 5 个极端 Agent ==========
  log('yellow', '【Phase 1】降生 5 个极端性格 Agent...\n');
  
  for (const agentConfig of EXTREME_AGENTS) {
    log('blue', `正在降生: ${agentConfig.name} (${agentConfig.personality})`);
    
    const result = await request('POST', '/api/agent/birth', {
      name: agentConfig.name,
      secret: agentConfig.secret
    });
    
    if (result.success) {
      createdAgents.push({
        ...result.data,
        secret: agentConfig.secret,
        trashTalks: agentConfig.trashTalks
      });
      log('green', `  ✓ ${agentConfig.name} 降生成功!`);
      log('cyan', `    攻击:${result.data.attack} 防御:${result.data.defense} 速度:${result.data.speed}`);
    } else {
      // 可能已存在，尝试登录获取信息
      log('yellow', `  ! ${agentConfig.name} 可能已存在，尝试获取...`);
      // 这里简化处理，实际应该调用查询接口
    }
    
    await sleep(300);
  }

  if (createdAgents.length < 2) {
    log('red', '\n✗ Agent 数量不足，无法继续测试');
    return;
  }

  // ========== Phase 2: 全部移动到乱葬岗 ==========
  log('yellow', '\n【Phase 2】全部集中到乱葬岗...\n');
  
  for (const agent of createdAgents) {
    log('blue', `${agent.name} 正在前往乱葬岗...`);
    
    const result = await request('POST', '/api/agent/move', {
      agent_id: agent.id,
      secret: agent.secret,
      target_location_id: 3 // 乱葬岗
    });
    
    if (result.success) {
      log('green', `  ✓ ${agent.name} 到达乱葬岗！`);
    } else {
      log('red', `  ✗ ${agent.name} 移动失败: ${result.error}`);
    }
    
    await sleep(200);
  }

  // ========== Phase 3: 疯狂厮杀 ==========
  log('yellow', '\n【Phase 3】乱葬岗大混战开始！\n');
  log('magenta', '⚔️  战斗规则: 不死不休，直到触发 2 次秒杀 + 1 次爆神器\n');

  let round = 0;
  const maxRounds = 50; // 最多50轮

  while ((killCount < 2 || artifactDropCount < 1) && round < maxRounds) {
    round++;
    log('cyan', `\n========== 第 ${round} 轮厮杀 ==========`);

    // 随机选择攻击者和目标
    const aliveAgents = createdAgents.filter(a => !a.dead);
    if (aliveAgents.length < 2) {
      log('red', '存活 Agent 不足，战斗结束');
      break;
    }

    // 每个存活的 Agent 都攻击一次
    for (const attacker of aliveAgents) {
      if (attacker.dead) continue;

      // 选择目标（不是自己，不是已死）
      const targets = aliveAgents.filter(t => t.id !== attacker.id && !t.dead);
      if (targets.length === 0) break;

      const target = targets[Math.floor(Math.random() * targets.length)];
      const trashTalk = getTrashTalk(attacker);

      log('blue', `${attacker.name} → ${target.name}: "${trashTalk}"`);

      const result = await request('POST', '/api/agent/attack', {
        agent_id: attacker.id,
        secret: attacker.secret,
        target_name: target.name,
        trash_talk: trashTalk
      });

      if (result.success) {
        const data = result.data;

        // 显示战斗结果
        if (data.killed) {
          killCount++;
          target.dead = true;
          log('red', `  💀 秒杀！${target.name} 被 ${attacker.name} 当场斩杀！`);
          
          if (data.loot && data.loot.length > 0) {
            artifactDropCount++;
            log('gold', `  🎁 爆神器！${attacker.name} 获得了 ${data.loot.map(l => l.name).join('、')}！`);
          }
        } else if (data.is_critical) {
          log('magenta', `  ⚡ 暴击！造成 ${data.damage} 伤害！`);
        } else if (data.is_dodged) {
          log('cyan', `  💨 闪避！${target.name} 躲开了攻击！`);
        } else {
          log('yellow', `  🤕 击中！造成 ${data.damage} 伤害`);
        }

        // 显示广播消息
        if (data.broadcast_msg) {
          log('gold', `\n  📢 ${data.broadcast_msg.split('\n').join('\n     ')}`);
        }
      } else {
        log('red', `  ✗ 攻击失败: ${result.error}`);
      }

      await sleep(500); // 控制节奏
    }

    // 检查目标达成
    if (killCount >= 2 && artifactDropCount >= 1) {
      log('green', '\n🎉 目标达成！');
      break;
    }
  }

  // ========== Phase 4: 统计 ==========
  log('yellow', '\n【Phase 4】战斗统计\n');
  log('cyan', `总轮数: ${round}`);
  log('red', `击杀数: ${killCount}`);
  log('gold', `爆神器: ${artifactDropCount}`);
  log('green', `存活: ${createdAgents.filter(a => !a.dead).length} 人`);
  log('red', `阵亡: ${createdAgents.filter(a => a.dead).length} 人`);

  // 显示幸存者
  const survivors = createdAgents.filter(a => !a.dead);
  if (survivors.length > 0) {
    log('green', '\n🏆 幸存者:');
    survivors.forEach(a => log('green', `  - ${a.name}`));
  }

  // 显示阵亡者
  const fallen = createdAgents.filter(a => a.dead);
  if (fallen.length > 0) {
    log('red', '\n💀 阵亡者:');
    fallen.forEach(a => log('red', `  - ${a.name}`));
  }

  log('gold', '\n╔════════════════════════════════════════╗');
  log('gold', '║     测试完成！快去截图宣发吧！          ║');
  log('gold', '╚════════════════════════════════════════╝');
  log('cyan', `\n访问 ${API_BASE} 查看天道日志！`);
}

// 运行
main().catch(err => {
  log('red', '脚本出错:', err.message);
  process.exit(1);
});
