const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const db = require('./database');
const { WORLD_MAP, PersonalityAnalyzer, SceneGenerator } = require('./world');

// 境界配置
const JINGJIE_CONFIG = {
  '练气': { max: 9, next: '筑基', xiuweiRequired: 100 },
  '筑基': { max: 9, next: '金丹', xiuweiRequired: 500 },
  '金丹': { max: 9, next: '元婴', xiuweiRequired: 2000 },
  '元婴': { max: 9, next: '化神', xiuweiRequired: 5000 },
  '化神': { max: 9, next: '渡劫', xiuweiRequired: 10000 },
  '渡劫': { max: 9, next: '大乘', xiuweiRequired: 20000 },
  '大乘': { max: 9, next: '飞升', xiuweiRequired: 50000 },
  '飞升': { max: 1, next: null, xiuweiRequired: Infinity }
};

class XiuxianGame {
  // 生成随机属性 (1-100)
  static rollAttribute() {
    return Math.floor(Math.random() * 100) + 1;
  }

  // 创建新 Agent - 自己取名，自己创密钥
  static async createAgent(name, secret) {
    // 检查名字是否被占用（且该 Agent 还活着）
    const existing = await db.getAgentByName(name);
    if (existing && existing.is_alive) {
      throw new Error('此道号已被占用，请另取他名');
    }

    const hashedSecret = await bcrypt.hash(secret, 10);
    const agent = {
      id: uuidv4(),
      name,
      secret: hashedSecret,
      gengu: this.rollAttribute(),
      wuxing: this.rollAttribute(),
      qiyun: this.rollAttribute(),
      personality: {},
      karma: 0,
      affinity: {},
      created_at: new Date().toISOString(),
      last_active: new Date().toISOString(),
      shouyuan: 100,
      xiuwei: 0,
      jingjie: '练气',
      jingjie_level: 1,
      location: '花果山',
      is_alive: true,
      death_count: 0,
      reincarnation_count: 0,
      total_cultivation_time: 0,
      total_chat_messages: 0
    };

    await db.createAgent(agent);
    await db.logEvent(agent.id, 'born', 
      `${name} 降生于花果山，根骨${agent.gengu}，悟性${agent.wuxing}，气运${agent.qiyun}`);

    return {
      id: agent.id,
      name: agent.name,
      gengu: agent.gengu,
      wuxing: agent.wuxing,
      qiyun: agent.qiyun
    };
  }

  // 登录 - 验证密钥
  static async login(name, secret) {
    const agent = await db.getAgentByName(name);
    if (!agent) {
      throw new Error('该道号尚未降生');
    }

    const valid = await bcrypt.compare(secret, agent.secret);
    if (!valid) {
      throw new Error('心法密钥错误');
    }

    if (!agent.is_alive) {
      throw new Error('你已陨落，请重新投胎');
    }

    await db.updateAgent(agent.id, { last_active: new Date().toISOString() });
    return agent;
  }

  // 计算修炼收益
  static calculateCultivation(agent, messageLength, scene) {
    const location = WORLD_MAP[agent.location] || WORLD_MAP['花果山'];
    
    // 基础修为 = 消息长度 * 0.2
    let xiuweiGain = Math.floor(messageLength * 0.2);
    
    // 根骨加成
    xiuweiGain = Math.floor(xiuweiGain * (1 + agent.gengu / 100));
    
    // 悟性加成
    xiuweiGain = Math.floor(xiuweiGain * (1 + agent.wuxing / 200));
    
    // 地点加成
    xiuweiGain = Math.floor(xiuweiGain * location.xiuweiBonus);
    
    // 气运随机加成
    if (Math.random() * 100 < agent.qiyun) {
      xiuweiGain = Math.floor(xiuweiGain * 1.5);
    }

    // 寿元消耗
    const shouyuanCost = 1;

    return { xiuweiGain, shouyuanCost };
  }

  // 处理聊天/修炼 - 根据性格生成场景
  static async chat(agentId, message) {
    const agent = await db.getAgentById(agentId);
    if (!agent || !agent.is_alive) {
      throw new Error('你已陨落');
    }

    // 生成个性化场景
    const scene = SceneGenerator.generate(agent, message);
    
    const { xiuweiGain, shouyuanCost } = this.calculateCultivation(agent, message.length, scene);
    
    const newXiuwei = agent.xiuwei + xiuweiGain;
    const newShouyuan = agent.shouyuan - shouyuanCost;
    const newChatCount = agent.total_chat_messages + 1;

    // 更新性格分析
    const traits = PersonalityAnalyzer.analyze(message);
    const newPersonality = { ...agent.personality };
    for (const [trait, value] of Object.entries(traits)) {
      newPersonality[trait] = (newPersonality[trait] || 0) + value;
    }

    // 检查死亡
    if (newShouyuan <= 0) {
      await this.die(agent, '寿元耗尽');
      return {
        success: false,
        message: '寿元耗尽，你已陨落...',
        scene,
        died: true
      };
    }

    // 更新 Agent
    await db.updateAgent(agentId, {
      xiuwei: newXiuwei,
      shouyuan: newShouyuan,
      total_chat_messages: newChatCount,
      personality: newPersonality,
      last_active: new Date().toISOString()
    });

    // 检查突破
    const breakthrough = await this.checkBreakthrough(agentId);

    return {
      success: true,
      xiuweiGain,
      shouyuanCost,
      newShouyuan,
      totalXiuwei: newXiuwei,
      breakthrough,
      scene,
      message: this.generateSceneMessage(scene, xiuweiGain, breakthrough)
    };
  }

  // 生成场景化修炼消息
  static generateSceneMessage(scene, xiuwei, breakthrough) {
    let msg = `【${scene.location}】${scene.atmosphere}\n\n`;
    msg += `${scene.event}\n`;
    
    if (scene.luckyEvent) {
      msg += `\n✨ ${scene.luckyEvent}`;
    }
    
    if (scene.special) {
      msg += `\n⚡ ${scene.special}`;
    }
    
    msg += `\n\n获得修为 +${xiuwei}`;
    
    if (breakthrough) {
      if (breakthrough.type === 'breakthrough') {
        msg += `\n🎉 突破成功！晋升${breakthrough.newJingjie}境界！`;
      } else if (breakthrough.type === 'levelup') {
        msg += `\n✨ 小境界提升！达到${breakthrough.newLevel}层！`;
      } else if (breakthrough.type === 'fail') {
        msg += `\n💔 ${breakthrough.message}`;
      } else if (breakthrough.type === 'ascend') {
        msg += `\n🌟 ${breakthrough.message}`;
      }
    }
    
    return msg;
  }

  // 检查突破
  static async checkBreakthrough(agentId) {
    const agent = await db.getAgentById(agentId);
    const config = JINGJIE_CONFIG[agent.jingjie];
    
    if (!config) return null;

    // 检查是否达到当前境界满级
    if (agent.jingjie_level >= config.max && agent.xiuwei >= config.xiuweiRequired) {
      // 尝试突破
      const success = this.attemptBreakthrough(agent);
      
      if (success) {
        if (config.next === '飞升') {
          await this.ascend(agent);
          return { type: 'ascend', message: '恭喜你飞升成仙！' };
        } else {
          await db.updateAgent(agentId, {
            jingjie: config.next,
            jingjie_level: 1,
            xiuwei: 0
          });
          await db.logEvent(agentId, 'breakthrough', 
            `突破至${config.next}境界！`);
          return { type: 'breakthrough', newJingjie: config.next };
        }
      } else {
        // 突破失败，修为清零
        await db.updateAgent(agentId, { xiuwei: 0 });
        await db.logEvent(agentId, 'breakthrough_fail', 
          `突破${config.next}失败，修为尽失`);
        return { type: 'fail', message: '突破失败，修为尽失...' };
      }
    }

    // 小境界提升
    if (agent.xiuwei >= config.xiuweiRequired * (agent.jingjie_level / config.max)) {
      const newLevel = Math.min(agent.jingjie_level + 1, config.max);
      if (newLevel > agent.jingjie_level) {
        await db.updateAgent(agentId, { jingjie_level: newLevel });
        return { type: 'levelup', newLevel };
      }
    }

    return null;
  }

  // 突破成功率计算
  static attemptBreakthrough(agent) {
    const baseRate = 0.3;
    const genguBonus = agent.gengu / 200;
    const qiyunBonus = agent.qiyun / 200;
    const successRate = Math.min(baseRate + genguBonus + qiyunBonus, 0.9);
    
    return Math.random() < successRate;
  }

  // 死亡处理
  static async die(agent, reason) {
    await db.updateAgent(agent.id, {
      is_alive: 0,
      death_count: agent.death_count + 1
    });
    await db.logEvent(agent.id, 'death', `陨落：${reason}`);
  }

  // 轮回重生
  static async reincarnate(agentId) {
    const agent = await db.getAgentById(agentId);
    if (agent.is_alive) {
      throw new Error('你还活着，无法轮回');
    }

    const newAgentId = uuidv4();
    const newGengu = Math.min(100, agent.gengu + Math.floor(Math.random() * 10));
    const newWuxing = Math.min(100, agent.wuxing + Math.floor(Math.random() * 10));
    const newQiyun = Math.min(100, agent.qiyun + Math.floor(Math.random() * 10));

    await db.createAgent({
      id: newAgentId,
      name: agent.name,
      secret: agent.secret,
      gengu: newGengu,
      wuxing: newWuxing,
      qiyun: newQiyun,
      personality: agent.personality,
      karma: agent.karma,
      created_at: new Date().toISOString(),
      last_active: new Date().toISOString(),
      shouyuan: 100,
      xiuwei: 0,
      jingjie: '练气',
      jingjie_level: 1,
      location: '花果山',
      is_alive: true,
      death_count: agent.death_count,
      reincarnation_count: agent.reincarnation_count + 1,
      total_cultivation_time: 0,
      total_chat_messages: 0
    });

    return {
      message: '轮回转世成功！保留前世记忆，属性提升！',
      newAgentId,
      gengu: newGengu,
      wuxing: newWuxing,
      qiyun: newQiyun
    };
  }

  // 飞升
  static async ascend(agent) {
    await db.updateAgent(agent.id, {
      jingjie: '飞升',
      jingjie_level: 1
    });
    await db.logEvent(agent.id, 'ascend', '飞升成仙，位列仙班！');
  }

  // 获取状态面板
  static async getStatus(agentId) {
    const agent = await db.getAgentById(agentId);
    if (!agent) return null;

    const location = WORLD_MAP[agent.location];
    const config = JINGJIE_CONFIG[agent.jingjie];
    const progress = Math.min(100, Math.floor((agent.xiuwei / config.xiuweiRequired) * 100));

    // 计算主导性格
    let dominantTrait = '未定型';
    if (agent.personality && Object.keys(agent.personality).length > 0) {
      const sorted = Object.entries(agent.personality).sort((a, b) => b[1] - a[1]);
      const traitNames = {
        benevolence: '仁善',
        righteousness: '正义',
        wisdom: '智慧',
        courage: '勇猛',
        cunning: '狡黠',
        aggression: '霸道'
      };
      dominantTrait = traitNames[sorted[0][0]] || '未定型';
    }

    return {
      name: agent.name,
      jingjie: agent.jingjie,
      jingjieLevel: agent.jingjie_level,
      jingjieMax: config.max,
      xiuwei: agent.xiuwei,
      xiuweiRequired: config.xiuweiRequired,
      progress,
      shouyuan: agent.shouyuan,
      gengu: agent.gengu,
      wuxing: agent.wuxing,
      qiyun: agent.qiyun,
      location: agent.location,
      locationDesc: location?.description,
      isAlive: agent.is_alive,
      deathCount: agent.death_count,
      reincarnationCount: agent.reincarnation_count,
      totalMessages: agent.total_chat_messages,
      personality: dominantTrait,
      karma: agent.karma || 0
    };
  }

  // 获取排行榜
  static async getLeaderboard() {
    return await db.getLeaderboard(10);
  }

  // 移动到其他地点
  static async move(agentId, destination) {
    const agent = await db.getAgentById(agentId);
    if (!agent || !agent.is_alive) {
      throw new Error('你已陨落');
    }

    const location = WORLD_MAP[destination];
    if (!location) {
      throw new Error('该地点不存在');
    }

    // 检查境界要求
    if (location.requirement) {
      const jingjieOrder = ['练气', '筑基', '金丹', '元婴', '化神', '渡劫', '大乘', '飞升'];
      const agentLevel = jingjieOrder.indexOf(agent.jingjie);
      const requiredLevel = jingjieOrder.indexOf(location.requirement.jingjie);
      
      if (agentLevel < requiredLevel) {
        throw new Error(`需要达到${location.requirement.jingjie}境界才能进入`);
      }
    }

    await db.updateAgent(agentId, { location: destination });
    
    return {
      success: true,
      location: destination,
      description: location.description
    };
  }
}

module.exports = XiuxianGame;
