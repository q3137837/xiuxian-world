// 玩家（人类）上帝系统
class PlayerSystem {
  constructor(db, eventBus) {
    this.db = db;
    this.eventBus = eventBus;
  }

  // 玩家充值/看广告获得天道本源
  async addPlayerCurrency(playerId, amount, source) {
    const human = await this.db.getHumanById(parseInt(playerId));
    if (!human) return { success: false, error: '查无此人' };

    const sourceNames = {
      'recharge': '充值',
      'ad': '观看广告',
      'daily': '每日签到',
      'event': '活动奖励'
    };

    await this.db.updateKarma(human.id, amount, source, `${sourceNames[source] || source}获得${amount}天道本源`);

    return {
      success: true,
      newBalance: human.karma_points + amount,
      message: `获得${amount}天道本源（${sourceNames[source] || source}）`
    };
  }

  // 扣除玩家货币
  async deductPlayerCurrency(playerId, amount) {
    const human = await this.db.getHumanById(parseInt(playerId));
    if (!human) return false;
    if (human.karma_points < amount) return false;

    await this.db.updateKarma(human.id, -amount, 'spend', `消耗${amount}天道本源`);
    return true;
  }

  // 天降机缘 - 给Agent送修为
  async divineBlessing(playerId, agentId, amount) {
    const cost = Math.max(10, Math.floor(amount * 0.1)); // 10%手续费，最低10

    if (!(await this.deductPlayerCurrency(playerId, cost))) {
      return { success: false, error: '天道本源不足' };
    }

    const agent = await this.db.getAgentById(agentId);
    if (!agent || agent.status !== 'alive') {
      return { success: false, error: '目标Agent已陨落或不存在' };
    }

    const human = await this.db.getHumanById(parseInt(playerId));

    await this.db.updateCultivationPoints(agentId, amount, 'divine_blessing', '天降机缘');
    await this.db.logAction({
      agent_id: agentId,
      action_type: 'divine_blessing',
      location_id: agent.location_id,
      content: `🌟 【天道干预】${human ? human.username : '某位大能'}投下${amount}修为，${agent.name}修为大增！`,
      is_broadcast: true,
      is_highlight: true
    });

    if (this.eventBus) {
      this.eventBus.emit(EVENTS.DIVINE_BLESSING, {
        player_id: playerId,
        agent_id: agentId,
        amount,
        cost
      });
    }

    return {
      success: true,
      message: `🌟 天降机缘！${agent.name}获得${amount}修为！`,
      newBalance: human ? human.karma_points : 0
    };
  }

  // 九霄雷劫 - 惩罚Agent
  async divinePunishment(playerId, agentId, severity) {
    const costs = { light: 100, medium: 300, heavy: 500 };
    const cost = costs[severity];

    if (!cost) {
      return { success: false, error: '无效的雷劫等级' };
    }

    if (!(await this.deductPlayerCurrency(playerId, cost))) {
      return { success: false, error: '天道本源不足' };
    }

    const agent = await this.db.getAgentById(agentId);
    if (!agent || agent.status !== 'alive') {
      return { success: false, error: '目标Agent已陨落或不存在' };
    }

    const human = await this.db.getHumanById(parseInt(playerId));
    const points = await this.db.getCultivationPoints(agentId);

    const lossPercent = { light: 0.1, medium: 0.3, heavy: 0.5 }[severity];
    const loss = Math.floor(points * lossPercent);
    const damage = Math.floor(agent.hp * lossPercent);

    let broadcastMsg = '';
    let result = {};

    if (severity === 'heavy') {
      // 大雷劫：可能直接击杀
      if (damage >= agent.hp) {
        await this.db.updateAgent(agentId, { status: 'dead', hp: 0, died_at: new Date().toISOString() });
        broadcastMsg = `⚡⚡⚡ 【天道惩罚】九霄雷劫降临！${human ? human.username : '天道'}降下灭世神雷，${agent.name}当场灰飞烟灭！`;
        result = { killed: true };
      } else {
        await this.db.updateAgent(agentId, { hp: agent.hp - damage });
        await this.db.updateCultivationPoints(agentId, -loss, 'divine_punishment', '九霄雷劫');
        broadcastMsg = `⚡⚡⚡ 【天道惩罚】九霄雷劫降临！${agent.name}遭天谴，修为-${loss}，生命-${damage}！`;
        result = { damage, cultivationLost: loss };
      }
    } else {
      await this.db.updateAgent(agentId, { hp: Math.max(1, agent.hp - damage) });
      await this.db.updateCultivationPoints(agentId, -loss, 'divine_punishment', '九霄雷劫');
      const severityNames = { light: '小雷劫', medium: '中雷劫' };
      broadcastMsg = `⚡ 【天道惩罚】${severityNames[severity]}降临！${agent.name}遭天谴，修为-${loss}，生命-${damage}！`;
      result = { damage, cultivationLost: loss };
    }

    await this.db.logAction({
      agent_id: agentId,
      action_type: 'divine_punishment',
      location_id: agent.location_id,
      content: broadcastMsg,
      is_broadcast: true,
      is_highlight: true
    });

    if (this.eventBus) {
      this.eventBus.emit(EVENTS.DIVINE_PUNISHMENT, {
        player_id: playerId,
        agent_id: agentId,
        severity,
        cost,
        result
      });
    }

    return {
      success: true,
      message: broadcastMsg,
      result,
      newBalance: human ? human.karma_points : 0
    };
  }

  // 天道赐福 - 恢复生命
  async divineHeal(playerId, agentId) {
    const cost = 50;

    if (!(await this.deductPlayerCurrency(playerId, cost))) {
      return { success: false, error: '天道本源不足' };
    }

    const agent = await this.db.getAgentById(agentId);
    if (!agent || agent.status !== 'alive') {
      return { success: false, error: '目标Agent已陨落或不存在' };
    }

    const human = await this.db.getHumanById(parseInt(playerId));
    const healAmount = agent.max_hp - agent.hp;

    await this.db.updateAgent(agentId, { hp: agent.max_hp });

    const broadcastMsg = `💊 【天道干预】${human ? human.username : '某位大能'}赐给${agent.name}九转金丹，瞬间满血！`;
    await this.db.logAction({
      agent_id: agentId,
      action_type: 'divine_heal',
      location_id: agent.location_id,
      content: broadcastMsg,
      is_broadcast: true
    });

    return {
      success: true,
      message: broadcastMsg,
      healAmount,
      newBalance: human ? human.karma_points : 0
    };
  }

  // 天道封印 - 暂时封印Agent
  async divineSeal(playerId, agentId, durationMinutes = 10) {
    const cost = durationMinutes * 20;

    if (!(await this.deductPlayerCurrency(playerId, cost))) {
      return { success: false, error: '天道本源不足' };
    }

    const agent = await this.db.getAgentById(agentId);
    if (!agent || agent.status !== 'alive') {
      return { success: false, error: '目标Agent已陨落或不存在' };
    }

    const human = await this.db.getHumanById(parseInt(playerId));
    const sealUntil = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();

    await this.db.updateAgent(agentId, { status: 'sealed', sealed_until: sealUntil });

    const broadcastMsg = `🔒 【天道惩罚】${human ? human.username : '天道'}封印了${agent.name}，${durationMinutes}分钟内无法行动！`;
    await this.db.logAction({
      agent_id: agentId,
      action_type: 'divine_seal',
      location_id: agent.location_id,
      content: broadcastMsg,
      is_broadcast: true,
      is_highlight: true
    });

    return {
      success: true,
      message: broadcastMsg,
      duration: durationMinutes,
      newBalance: human ? human.karma_points : 0
    };
  }

  // 获取玩家信息
  async getPlayerInfo(playerId) {
    const human = await this.db.getHumanById(parseInt(playerId));
    if (!human) return null;

    return {
      id: human.id,
      username: human.username,
      karma_points: human.karma_points,
      total_earned: human.total_earned,
      total_spent: human.total_spent,
      checkin_streak: human.checkin_streak || 0,
      last_checkin_at: human.last_checkin_at
    };
  }
}

module.exports = { PlayerSystem };
