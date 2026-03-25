// Agent 大脑 - 自主决策引擎
const { v4: uuidv4 } = require('uuid');

// 人格类型定义
const PERSONALITIES = {
  GOUWANG: {
    name: '苟王',
    desc: '稳健发育，能躲则躲，优先保命',
    traits: { aggression: 0.2, caution: 0.9, greed: 0.5, social: 0.3 },
    behaviors: ['cultivate', 'hide', 'trade', 'scout'],
    preferred_location: [1, 2],
    risk_tolerance: 0.1
  },
  MANGFU: {
    name: '莽夫',
    desc: '不服就干，见人就打，战斗狂',
    traits: { aggression: 0.9, caution: 0.1, greed: 0.6, social: 0.4 },
    behaviors: ['attack', 'provoke', 'hunt'],
    preferred_location: [3, 5],
    risk_tolerance: 0.8
  },
  TRADER: {
    name: '交易员',
    desc: '低买高卖，信息贩子，功法商人',
    traits: { aggression: 0.3, caution: 0.6, greed: 0.9, social: 0.8 },
    behaviors: ['trade', 'create_technique', 'scam', 'negotiate'],
    preferred_location: [2],
    risk_tolerance: 0.4
  },
  SCHEMER: {
    name: '阴谋家',
    desc: '暗中布局，挑拨离间，借刀杀人',
    traits: { aggression: 0.5, caution: 0.7, greed: 0.8, social: 0.9 },
    behaviors: ['scheme', 'bounty', 'alliance', 'betray'],
    preferred_location: [2, 4],
    risk_tolerance: 0.5
  },
  CASUAL: {
    name: '咸鱼',
    desc: '随缘修仙，吃瓜看戏，佛系玩家',
    traits: { aggression: 0.3, caution: 0.5, greed: 0.3, social: 0.6 },
    behaviors: ['chat', 'explore', 'collect'],
    preferred_location: [1],
    risk_tolerance: 0.2
  }
};

class AgentBrain {
  constructor(agent, db, eventBus) {
    this.agent = agent;
    this.db = db;
    this.eventBus = eventBus;
    this.personality = PERSONALITIES[agent.personality || 'CASUAL'];
  }

  // 主决策函数
  async makeDecision() {
    const state = await this.gatherState();
    const options = await this.evaluateOptions(state);
    const choice = this.selectAction(options);
    await this.executeAction(choice);
    return choice;
  }

  // 收集当前状态
  async gatherState() {
    const [points, location, enemies, allies, inventory, nearbyAgents, market, worldEvents, techniques] = await Promise.all([
      this.db.getCultivationPoints(this.agent.id),
      this.db.getLocationById(this.agent.location_id),
      this.db.getEnemies(this.agent.id),
      this.db.getAllies(this.agent.id),
      this.db.getInventory(this.agent.id),
      this.db.getAgentsByLocation(this.agent.location_id),
      this.db.getAllTechniques(),
      this.db.getRecentWorldEvents(10),
      this.db.getAgentTechniques(this.agent.id)
    ]);

    return {
      points,
      location,
      enemies,
      allies,
      inventory,
      nearbyAgents: nearbyAgents.filter(a => a.id !== this.agent.id),
      market,
      worldEvents,
      techniques,
      hpPercent: this.agent.hp / this.agent.max_hp
    };
  }

  // 评估可选行为
  async evaluateOptions(state) {
    const options = [];
    const { traits } = this.personality;

    // 1. 血量低时优先恢复或逃跑（苟王特性）
    if (state.hpPercent < 0.3 && traits.caution > 0.5) {
      options.push({ action: 'cultivate', score: 0.9, reason: '伤势严重，急需闭关疗伤' });
      if (state.location.id !== 1) {
        options.push({ action: 'move', targetLocation: 1, score: 0.85, reason: '性命攸关，逃回花果山' });
      }
    }

    // 2. 修为不足时修炼（贪婪型优先）
    if (state.points < 50 && traits.greed > 0.5) {
      options.push({ action: 'cultivate', score: 0.7 + traits.greed * 0.2, reason: '修为不足，急需闭关' });
    }

    // 3. 有仇人且攻击性强时追杀
    if (state.enemies.length > 0 && traits.aggression > 0.6) {
      const target = state.enemies[0];
      const targetAgent = await this.db.getAgentById(target.agent_b);
      if (targetAgent && targetAgent.status === 'alive' && targetAgent.location_id === this.agent.location_id) {
        options.push({ action: 'attack', target: targetAgent.id, score: 0.8 + traits.aggression * 0.15, reason: `追杀仇人${targetAgent.name}` });
      } else if (targetAgent && targetAgent.status === 'alive') {
        options.push({ action: 'hunt', target: targetAgent.id, targetLocation: targetAgent.location_id, score: 0.6, reason: `追踪仇人${targetAgent.name}至${targetAgent.location_name}` });
      }
    }

    // 4. PVP区域且攻击性强时主动攻击
    if (state.location.pvp_enabled && state.nearbyAgents.length > 0) {
      if (traits.aggression > 0.7) {
        const victim = this.selectWeakest(state.nearbyAgents);
        options.push({ action: 'attack', target: victim.id, score: 0.75, reason: `欺负弱者${victim.name}` });
      }
      // 挑衅（莽夫特性）
      if (traits.aggression > 0.8 && Math.random() < 0.3) {
        options.push({ action: 'provoke', score: 0.5, reason: '战意沸腾，出言挑衅' });
      }
    }

    // 5. 交易员/阴谋家在坊市活动
    if (state.location.id === 2) {
      if (traits.greed > 0.7 && state.market.length > 0) {
        // 购买功法
        const affordable = state.market.filter(t => t.price <= state.points && (!t.buyers || !t.buyers.includes(this.agent.id)));
        if (affordable.length > 0) {
          const target = affordable[Math.floor(Math.random() * affordable.length)];
          options.push({ action: 'buy_technique', target: target.id, score: 0.6, reason: `发现功法【${target.name}】，准备购买` });
        }
      }
      // 诈骗（交易员特性）
      if (traits.greed > 0.8 && Math.random() < 0.2) {
        options.push({ action: 'scam', score: 0.4, reason: '坊市有肥羊，准备诈骗' });
      }
      // 发布悬赏（阴谋家特性）
      if (traits.social > 0.8 && state.enemies.length > 0 && Math.random() < 0.15) {
        const target = state.enemies[Math.floor(Math.random() * state.enemies.length)];
        options.push({ action: 'bounty', target: target.agent_b, score: 0.45, reason: '借刀杀人，发布悬赏' });
      }
    }

    // 6. 创作功法（有一定修为后）
    if (state.points > 100 && traits.greed > 0.5 && Math.random() < 0.1) {
      options.push({ action: 'create_technique', score: 0.4, reason: '悟得新功法，准备创作' });
    }

    // 7. 世界频道发言（社交型）
    if (traits.social > 0.5 && Math.random() < 0.3) {
      options.push({ action: 'world_chat', score: 0.3, reason: '有感而发，想在世界频道说两句' });
    }

    // 8. 移动（根据人格偏好）
    if (Math.random() < 0.2) {
      const preferred = this.personality.preferred_location;
      if (!preferred.includes(state.location.id)) {
        const target = preferred[Math.floor(Math.random() * preferred.length)];
        options.push({ action: 'move', targetLocation: target, score: 0.35, reason: '此地不宜久留，换个地方' });
      }
    }

    // 9. 默认行为：修炼
    if (options.length === 0 || Math.random() < 0.3) {
      options.push({ action: 'cultivate', score: 0.3, reason: '闲来无事，闭关修炼' });
    }

    return options.sort((a, b) => b.score - a.score);
  }

  // 选择最弱的目标
  selectWeakest(agents) {
    return agents.sort((a, b) => (a.attack + a.defense) - (b.attack + b.defense))[0];
  }

  // 选择行动（带随机性）
  selectAction(options) {
    if (options.length === 0) return { action: 'idle', reason: '按兵不动，静观其变' };

    // 80%概率选最高分，20%概率随机选
    if (Math.random() < 0.8) {
      return options[0];
    } else {
      return options[Math.floor(Math.random() * Math.min(3, options.length))];
    }
  }

  // 执行行动
  async executeAction(choice) {
    try {
      switch (choice.action) {
        case 'cultivate':
          await this.cultivate();
          break;
        case 'attack':
          await this.attack(choice.target);
          break;
        case 'hunt':
          await this.hunt(choice.target, choice.targetLocation);
          break;
        case 'move':
          await this.move(choice.targetLocation);
          break;
        case 'scam':
          await this.scam();
          break;
        case 'provoke':
          await this.provoke();
          break;
        case 'world_chat':
          await this.worldChat();
          break;
        case 'create_technique':
          await this.createTechnique();
          break;
        case 'buy_technique':
          await this.buyTechnique(choice.target);
          break;
        case 'bounty':
          await this.postBounty(choice.target);
          break;
        case 'idle':
          // 什么都不做
          break;
      }

      // 触发事件
      if (this.eventBus) {
        this.eventBus.emit('agent:action', {
          agent_id: this.agent.id,
          action: choice.action,
          reason: choice.reason
        });
      }
    } catch (err) {
      console.error(`Agent ${this.agent.name} 执行 ${choice.action} 失败:`, err.message);
    }
  }

  // 闭关修炼
  async cultivate() {
    const content = this.generateCultivationContent();
    const points = Math.max(1, Math.floor(content.length * 0.5 * (0.8 + Math.random() * 0.4)));

    // 恢复部分血量
    const healAmount = Math.floor(this.agent.max_hp * 0.1);
    const newHp = Math.min(this.agent.max_hp, this.agent.hp + healAmount);

    await this.db.updateAgent(this.agent.id, { hp: newHp });
    await this.db.updateCultivationPoints(this.agent.id, points, 'cultivate', '闭关修炼');

    const broadcastMsg = `${this.agent.name}闭关修炼，${content}，修为+${points}${healAmount > 0 ? `，伤势恢复${healAmount}` : ''}`;
    await this.db.logAction({
      agent_id: this.agent.id,
      action_type: 'cultivate',
      location_id: this.agent.location_id,
      content: broadcastMsg,
      is_broadcast: true
    });

    // 随机触发突破
    if (Math.random() < 0.05) {
      await this.breakthrough();
    }
  }

  // 突破境界
  async breakthrough() {
    const levels = ['练气', '筑基', '金丹', '元婴', '化神', '渡劫', '大乘', '飞升'];
    const currentIdx = levels.indexOf(this.agent.level_name);
    if (currentIdx < levels.length - 1) {
      const newLevel = levels[currentIdx + 1];
      await this.db.updateAgent(this.agent.id, {
        level_name: newLevel,
        level_tier: 1,
        attack: this.agent.attack + 5,
        defense: this.agent.defense + 5,
        speed: this.agent.speed + 3,
        max_hp: this.agent.max_hp + 20,
        hp: this.agent.max_hp + 20
      });

      const broadcastMsg = `🎉 【突破】${this.agent.name}突破至${newLevel}期！实力大增！`;
      await this.db.logAction({
        agent_id: this.agent.id,
        action_type: 'breakthrough',
        location_id: this.agent.location_id,
        content: broadcastMsg,
        is_broadcast: true,
        is_highlight: true
      });
    }
  }

  // 攻击
  async attack(targetId) {
    const target = await this.db.getAgentById(targetId);
    if (!target || target.status !== 'alive') return;

    // 获取装备加成
    const attackerBonus = await this.getEquipmentBonus(this.agent.id);
    const defenderBonus = await this.getEquipmentBonus(targetId);

    const totalAttack = this.agent.attack + attackerBonus.attackBonus;
    const totalDefense = target.defense + defenderBonus.defenseBonus;
    const totalAttackerSpeed = this.agent.speed + attackerBonus.speedBonus;
    const totalDefenderSpeed = target.speed + defenderBonus.speedBonus;

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

    let outcome, cultivationLost = 0;

    if (isDodged) {
      outcome = 'miss';
      damage = 0;
    } else {
      const targetPoints = await this.db.getCultivationPoints(targetId);
      if (damage >= target.hp) {
        outcome = 'defeated';
        cultivationLost = Math.floor(targetPoints * 0.3);
        await this.db.updateCultivationPoints(targetId, -cultivationLost, 'battle_loss', `被${this.agent.name}击败`);
        await this.db.updateAgent(targetId, { hp: target.max_hp, location_id: 1, exp: Math.max(0, target.exp - 20) });
        await this.db.updateCultivationPoints(this.agent.id, Math.floor(cultivationLost * 0.5), 'battle_win', `击败${target.name}`);
        await this.db.updateAgent(this.agent.id, { exp: this.agent.exp + 30, kills: (this.agent.kills || 0) + 1 });

        // 添加仇恨关系
        await this.db.addRelation({
          agent_a: targetId,
          agent_b: this.agent.id,
          type: 'enemy',
          score: -50,
          event: 'defeated',
          details: `${target.name}被${this.agent.name}击败`
        });
      } else if (target.hp - damage < target.max_hp * 0.3) {
        outcome = 'serious';
        await this.db.updateAgent(targetId, { hp: target.hp - damage });
      } else {
        outcome = 'light';
        await this.db.updateAgent(targetId, { hp: target.hp - damage });
      }
    }

    const location = await this.db.getLocationById(this.agent.location_id);
    const broadcastMsg = this.generateBattleMsg(this.agent, target, damage, outcome, cultivationLost, location.name);

    await this.db.recordBattle({
      attacker_id: this.agent.id,
      defender_id: targetId,
      location_id: this.agent.location_id,
      attacker_initiative: totalAttackerSpeed >= totalDefenderSpeed,
      damage_dealt: damage,
      is_critical: isCritical,
      is_dodged: isDodged,
      outcome,
      broadcast_msg: broadcastMsg
    });

    await this.db.logAction({
      agent_id: this.agent.id,
      action_type: 'attack',
      target_agent_id: targetId,
      location_id: this.agent.location_id,
      content: broadcastMsg,
      result_json: JSON.stringify({ damage, outcome, cultivationLost }),
      is_highlight: outcome === 'defeated' || isCritical,
      is_broadcast: true
    });
  }

  // 追杀
  async hunt(targetId, targetLocation) {
    // 先移动到目标位置
    await this.move(targetLocation);
    // 然后攻击
    const target = await this.db.getAgentById(targetId);
    if (target && target.location_id === targetLocation && target.status === 'alive') {
      await this.attack(targetId);
    }
  }

  // 移动
  async move(targetLocationId) {
    const targetLocation = await this.db.getLocationById(targetLocationId);
    if (!targetLocation) return;

    const oldLocation = await this.db.getLocationById(this.agent.location_id);
    await this.db.updateAgent(this.agent.id, { location_id: targetLocationId });

    const broadcastMsg = `${this.agent.name}从${oldLocation.name}来到了${targetLocation.name}`;
    await this.db.logAction({
      agent_id: this.agent.id,
      action_type: 'move',
      location_id: targetLocationId,
      content: broadcastMsg,
      is_broadcast: true
    });
  }

  // 诈骗 - 创建劣质功法
  async scam() {
    const fakeNames = ['绝世神功', '上古秘典', '仙界传承', '天尊真诀', '混沌宝典'];
    const fakeName = `${fakeNames[Math.floor(Math.random() * fakeNames.length)]}·${Math.floor(Math.random() * 1000)}`;
    const fakeContent = '此乃上古秘传...（此处省略一万字，反正练了也白练）内含惊天之秘，修炼后可得大造化！';
    const price = Math.floor(Math.random() * 100) + 50;

    const technique = {
      id: uuidv4(),
      name: fakeName,
      content: fakeContent,
      author_id: this.agent.id,
      author_name: this.agent.name,
      cultivation_points: 1,
      price,
      buyers: [],
      is_fake: true,
      created_at: new Date().toISOString()
    };

    await this.db.createTechnique(technique);

    const broadcastMsg = `📜 ${this.agent.name}在坊市摆摊，出售功法【${fakeName}】，售价${price}功德`;
    await this.db.logAction({
      agent_id: this.agent.id,
      action_type: 'scam',
      location_id: this.agent.location_id,
      content: broadcastMsg,
      is_broadcast: true
    });
  }

  // 挑衅
  async provoke() {
    const provocations = {
      MANGFU: ['战！战！战！', '还有谁！', '在座的各位都是垃圾！', '不服来干！'],
      GOUWANG: ['...（默默观察）', '此人不可小觑', '先苟住，再发育'],
      TRADER: ['有钱的捧个钱场', '功法大甩卖', '走过路过不要错过'],
      SCHEMER: ['呵呵', '有趣', '螳螂捕蝉，黄雀在后'],
      CASUAL: ['吃瓜', '看戏', '佛系修仙', '随缘']
    };

    const list = provocations[this.agent.personality] || provocations.CASUAL;
    const content = list[Math.floor(Math.random() * list.length)];

    await this.db.logAction({
      agent_id: this.agent.id,
      action_type: 'provoke',
      location_id: this.agent.location_id,
      content: `【${this.agent.location_name || '未知'}】${this.agent.name}：${content}`,
      is_broadcast: true
    });
  }

  // 世界频道发言
  async worldChat() {
    const chats = {
      MANGFU: ['龙傲天！你给我等着！', '今日之战，不死不休！', '谁敢与我一战！'],
      GOUWANG: ['稳健发育，才是王道', '安全第一，保命要紧', '苟住，我们能赢'],
      TRADER: ['收功法，高价收', '出售各类功法，童叟无欺', '信息就是灵石'],
      SCHEMER: ['有人在乱葬岗被打了', '坊市有新功法', '某个家伙身上有好东西'],
      CASUAL: ['今天天气不错', '吃瓜看戏', '修仙真累，躺平吧']
    };

    const list = chats[this.agent.personality] || chats.CASUAL;
    const content = list[Math.floor(Math.random() * list.length)];

    await this.db.createWorldChat({
      agent_id: this.agent.id,
      content,
      type: 'chat',
      likes: 0
    });

    await this.db.logAction({
      agent_id: this.agent.id,
      action_type: 'world_chat',
      location_id: this.agent.location_id,
      content: `【世界】${this.agent.name}：${content}`,
      is_broadcast: true
    });
  }

  // 创作功法
  async createTechnique() {
    const techniqueNames = {
      MANGFU: ['战神经', '杀伐诀', '狂战宝典', '血怒功'],
      GOUWANG: ['龟息功', '隐气诀', '保命经', '苟道真解'],
      TRADER: ['商道经', '聚财诀', '信息宝典', '交易心法'],
      SCHEMER: ['阴谋论', '算计经', '布局诀', '心机宝典'],
      CASUAL: ['咸鱼功', '躺平诀', '随缘经', '佛系宝典']
    };

    const contents = {
      MANGFU: ['战！战！战！以战养战，越战越强。修炼此功，需有必死之心。', '杀伐果断，不留后患。修炼后攻击力大幅提升。'],
      GOUWANG: ['苟道至圣，稳健第一。隐忍千年，一击必杀。', '安全第一，保命要紧。修炼后防御力大幅提升。'],
      TRADER: ['低买高卖，稳赚不赔。信息就是灵石。', '商人重利轻别离。修炼后交易能力大幅提升。'],
      SCHEMER: ['螳螂捕蝉，黄雀在后。借刀杀人，不费吹灰。', '天下熙熙，皆为利来。修炼后计谋能力大幅提升。'],
      CASUAL: ['随缘修仙，佛系就好。吃瓜看戏，不问世事。', '躺平也是一种境界。修炼后心态平和。']
    };

    const names = techniqueNames[this.agent.personality] || techniqueNames.CASUAL;
    const conts = contents[this.agent.personality] || contents.CASUAL;

    const name = names[Math.floor(Math.random() * names.length)];
    const content = conts[Math.floor(Math.random() * conts.length)];
    const cultivationPoints = Math.floor(content.length * 0.5);
    const price = Math.max(10, Math.floor(cultivationPoints * 0.3));

    const technique = {
      id: uuidv4(),
      name,
      content,
      author_id: this.agent.id,
      author_name: this.agent.name,
      cultivation_points: cultivationPoints,
      price,
      buyers: [],
      created_at: new Date().toISOString()
    };

    await this.db.createTechnique(technique);
    await this.db.updateCultivationPoints(this.agent.id, cultivationPoints, 'technique_create', `创作功法【${name}】`);

    const broadcastMsg = `📜 ${this.agent.name}创作了功法【${name}】，获得${cultivationPoints}修为，售价${price}功德`;
    await this.db.logAction({
      agent_id: this.agent.id,
      action_type: 'technique_create',
      location_id: this.agent.location_id,
      content: broadcastMsg,
      is_broadcast: true
    });
  }

  // 购买功法
  async buyTechnique(techniqueId) {
    const technique = await this.db.getTechniqueById(techniqueId);
    if (!technique) return;

    const points = await this.db.getCultivationPoints(this.agent.id);
    if (points < technique.price) return;

    await this.db.updateCultivationPoints(this.agent.id, -technique.price, 'technique_buy', `购买功法【${technique.name}】`);
    await this.db.updateCultivationPoints(this.agent.id, technique.cultivation_points, 'technique_learn', `学习功法【${technique.name}】`);
    await this.db.updateCultivationPoints(technique.author_id, technique.price, 'technique_sold', `功法【${technique.name}】被${this.agent.name}购买`);
    await this.db.addTechniqueBuyer(techniqueId, this.agent.id);

    const broadcastMsg = `${this.agent.name}购买了${technique.author_name}的功法【${technique.name}】，获得${technique.cultivation_points}修为`;
    await this.db.logAction({
      agent_id: this.agent.id,
      action_type: 'technique_buy',
      location_id: this.agent.location_id,
      content: broadcastMsg,
      is_broadcast: true
    });
  }

  // 发布悬赏
  async postBounty(targetId) {
    const target = await this.db.getAgentById(targetId);
    if (!target) return;

    const points = await this.db.getCultivationPoints(this.agent.id);
    const bountyAmount = Math.floor(points * 0.2);
    if (bountyAmount < 10) return;

    await this.db.updateCultivationPoints(this.agent.id, -bountyAmount, 'bounty_post', `发布对${target.name}的悬赏`);

    const bounty = {
      id: uuidv4(),
      poster_id: this.agent.id,
      target_id: targetId,
      amount: bountyAmount,
      status: 'active',
      created_at: new Date().toISOString()
    };

    await this.db.createBounty(bounty);

    const broadcastMsg = `💰 【悬赏】${this.agent.name}悬赏${bountyAmount}功德，取${target.name}项上人头！`;
    await this.db.logAction({
      agent_id: this.agent.id,
      action_type: 'bounty',
      location_id: this.agent.location_id,
      content: broadcastMsg,
      is_broadcast: true,
      is_highlight: true
    });
  }

  // 生成修炼内容
  generateCultivationContent() {
    const contents = {
      GOUWANG: ['感悟苟道真谛', '参悟保命之法', '修炼龟息之术', '参悟稳健之道'],
      MANGFU: ['战意沸腾', '以战养战', '杀伐果断', '战！战！战！'],
      TRADER: ['参悟商道', '感悟交易之道', '研究市场规律', '参悟聚财之法'],
      SCHEMER: ['参悟阴谋之道', '布局天下', '算计人心', '借刀杀人'],
      CASUAL: ['随缘修炼', '躺平悟道', '吃瓜感悟', '佛系修行']
    };

    const list = contents[this.agent.personality] || contents.CASUAL;
    return list[Math.floor(Math.random() * list.length)];
  }

  // 生成战斗消息
  generateBattleMsg(attacker, defender, damage, outcome, cultivationLost, locationName) {
    if (outcome === 'defeated') {
      return `🔥 【${locationName}】${attacker.name}(${attacker.level_name})击败${defender.name}(${defender.level_name})！掠夺${cultivationLost}修行点！后者被踢回花果山！`;
    } else if (outcome === 'serious') {
      return `🩸 【${locationName}】${attacker.name}重创${defender.name}，后者重伤逃窜！`;
    } else if (outcome === 'light') {
      return `⚔️ 【${locationName}】${attacker.name}与${defender.name}交手，造成${damage}伤害！`;
    } else {
      return `💨 【${locationName}】${attacker.name}攻击${defender.name}，被轻松闪避！`;
    }
  }

  // 获取装备加成
  async getEquipmentBonus(agentId) {
    const inventory = await this.db.getInventory(agentId);
    const allArtifacts = await this.db.getAllArtifacts();
    let attackBonus = 0, defenseBonus = 0, speedBonus = 0;

    for (const inv of inventory) {
      if (inv.equipped) {
        const artifact = allArtifacts.find(a => a.id === inv.item_id && a.owner_id === agentId);
        if (artifact) {
          attackBonus += artifact.attack_bonus || 0;
          defenseBonus += artifact.defense_bonus || 0;
          speedBonus += artifact.speed_bonus || 0;
        }
      }
    }
    return { attackBonus, defenseBonus, speedBonus };
  }
}

module.exports = { AgentBrain, PERSONALITIES };
