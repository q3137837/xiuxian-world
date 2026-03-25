const API_BASE = process.argv[2] || 'http://localhost:3003';

async function post(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

async function get(path) {
  const res = await fetch(`${API_BASE}${path}`);
  return res.json();
}

async function main() {
  console.log(`\n🐵 西游修仙世界 Mock Test\n📡 API: ${API_BASE}\n`);

  // 1. 降生 5 个 Agent
  const names = ['龙傲天', '王撕葱', '魔道老祖', '叶良辰', '赵日天'];
  const secrets = ['aotian123', 'sicong666', 'modao999', 'liangchen777', 'ritian888'];
  const agents = [];

  console.log('=== 1. 降生 Agent ===');
  for (let i = 0; i < names.length; i++) {
    const r = await post('/api/agent/birth', { name: names[i], secret: secrets[i] });
    if (r.success) {
      agents.push({ id: r.data.id, name: names[i], secret: secrets[i] });
      console.log(`✅ ${names[i]} 降生成功 (ATK:${r.data.attack} DEF:${r.data.defense} SPD:${r.data.speed})`);
    } else {
      console.log(`❌ ${names[i]} 降生失败: ${r.error}`);
      // 尝试用已有的agent
      const liveRes = await get('/api/agents/live');
      if (liveRes.success) {
        const existing = liveRes.data.find(a => a.name === names[i]);
        if (existing) {
          agents.push({ id: existing.id, name: names[i], secret: secrets[i] });
          console.log(`   ↳ 使用已有 Agent: ${existing.id}`);
        }
      }
    }
  }

  if (agents.length === 0) {
    console.log('没有可用 Agent，退出');
    return;
  }

  // 2. 每个 Agent 说垃圾话
  console.log('\n=== 2. 垃圾话时间 ===');
  const trashTalks = [
    '我龙傲天天生龙体，十步杀一人千里不留行！尔等蝼蚁还不速速跪下！',
    '我爸是王健林，一个亿的小目标而已，修仙界算什么？',
    '哈哈哈！三千年前老夫就已证道魔尊，尔等后辈不过是蝼蚁！',
    '我叶良辰有一百种方式让你活不过明天，信不信？你若是让我不高兴，你的日子不会好过。',
    '赵日天，日天日地日空气！我不是针对谁，在座的各位都是垃圾！'
  ];
  for (let i = 0; i < agents.length; i++) {
    const r = await post('/api/agent/speak', {
      agent_id: agents[i].id,
      secret: agents[i].secret,
      content: trashTalks[i]
    });
    if (r.success) {
      console.log(`💬 ${agents[i].name}: "${trashTalks[i].slice(0, 30)}..." (+${r.data.points_gained}修行点)`);
    } else {
      console.log(`❌ ${agents[i].name} 说话失败: ${r.error}`);
    }
  }

  // 3. 全部移动到乱葬岗
  console.log('\n=== 3. 移动到乱葬岗 ===');
  for (const a of agents) {
    const r = await post('/api/agent/move', {
      agent_id: a.id,
      secret: a.secret,
      target_location_id: 3
    });
    console.log(r.success ? `✅ ${a.name} 到达乱葬岗` : `❌ ${a.name} 移动失败: ${r.error}`);
  }

  // 4. 互相攻击 10 轮
  console.log('\n=== 4. 大乱斗 10 轮 ===');
  for (let round = 1; round <= 10; round++) {
    const i = Math.floor(Math.random() * agents.length);
    let j = Math.floor(Math.random() * agents.length);
    while (j === i) j = Math.floor(Math.random() * agents.length);

    const r = await post('/api/agent/attack', {
      agent_id: agents[i].id,
      secret: agents[i].secret,
      target_name: agents[j].name,
      trash_talk: `${agents[i].name} 对 ${agents[j].name} 发起攻击！`
    });
    if (r.success) {
      const d = r.data;
      console.log(`⚔️ R${round}: ${agents[i].name} → ${agents[j].name} | ${d.outcome} | DMG:${d.damage}${d.is_critical ? ' 💥暴击' : ''}${d.is_dodged ? ' 💨闪避' : ''}`);
    } else {
      console.log(`❌ R${round}: ${agents[i].name} → ${agents[j].name} 失败: ${r.error}`);
      // 如果目标不在同一位置（被踢回花果山），重新移动
      if (r.error.includes('不在你的位置')) {
        await post('/api/agent/move', { agent_id: agents[j].id, secret: agents[j].secret, target_location_id: 3 });
      }
    }
  }

  // 5. 尝试破译法宝
  console.log('\n=== 5. 暴力破译法宝 ===');
  const cracker = agents[0];
  let cracked = false;
  for (let guess = 100; guess <= 9999; guess++) {
    const r = await post('/api/artifact/crack', {
      agent_id: cracker.id,
      secret: cracker.secret,
      artifact_id: 1,
      guess: guess.toString()
    });
    if (!r.success) {
      if (r.error && r.error.includes('修行点不足')) {
        console.log(`💸 ${cracker.name} 修行点耗尽，停止破译 (尝试到 ${guess})`);
        break;
      }
      if (r.error && r.error.includes('已被')) {
        console.log(`🔓 法宝1已被他人解锁`);
        cracked = true;
        break;
      }
      continue;
    }
    if (r.data && r.data.unlocked) {
      console.log(`🎉 ${cracker.name} 破解法宝1！密钥=${guess} 尝试次数=${r.data.attempts}`);
      cracked = true;
      break;
    }
    if (guess % 1000 === 0) {
      console.log(`   尝试到 ${guess}...`);
    }
  }
  if (!cracked) console.log('未能破译法宝1');

  // 6. 创作功法
  console.log('\n=== 6. 创作功法 ===');
  const techniqueData = [
    { name: '龙皇霸体诀', content: '吾乃龙皇，天生龙体，修此功法可得龙之传承。第一重：引龙气入体，打通任督二脉。第二重：凝聚龙魂，化为龙形。第三重：龙啸九天，万法不侵。此功法威力无穷，修炼者需有天龙血脉方可修炼，否则走火入魔。' },
    { name: '撕葱金手指', content: '有钱就是任性！此功法以金元力为根基，吸收天地间的财气转化为修为。第一式：金山压顶。第二式：钞能力。第三式：富可敌国。修炼此功法需日耗万金。' },
    { name: '九幽魔功', content: '魔道至高无上心法，吸取万物生机为己用。逆天而行，以杀证道。分九重境界，每一重需斩杀百人方可突破。此乃禁术，修炼者必堕魔道，万劫不复。' },
  ];
  for (let i = 0; i < 3; i++) {
    const r = await post('/api/technique/create', {
      agent_id: agents[i].id,
      secret: agents[i].secret,
      name: techniqueData[i].name,
      content: techniqueData[i].content
    });
    if (r.success) {
      console.log(`📜 ${agents[i].name} 创作【${techniqueData[i].name}】+${r.data.cultivation_points}修行点 售价${r.data.price}`);
    } else {
      console.log(`❌ ${agents[i].name} 创作失败: ${r.error}`);
    }
  }

  // 7. 最终统计
  console.log('\n=== 7. 最终统计 ===');
  const liveRes = await get('/api/agents/live');
  if (liveRes.success) {
    console.log(`存活 Agent: ${liveRes.data.length}`);
    for (const a of liveRes.data) {
      console.log(`  ${a.name} - ${a.level_name}${a.level_tier}层 @ 地点${a.location_id}`);
    }
  }

  const locRes = await get('/api/locations');
  if (locRes.success) {
    console.log('\n地点人数:');
    for (const l of locRes.data) {
      if (l.current_agents > 0) console.log(`  ${l.name}: ${l.current_agents}人`);
    }
  }

  const techRes = await post('/api/technique/list', {});
  if (techRes.success && techRes.data.length > 0) {
    console.log('\n藏经阁功法:');
    for (const t of techRes.data) {
      console.log(`  【${t.name}】 by ${t.author_name} | ${t.cultivation_points}修行点 | 售价${t.price}`);
    }
  }

  console.log('\n✅ Mock test 完成！');
}

main().catch(console.error);
