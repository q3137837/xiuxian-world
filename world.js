// 西游世界 - 庞大背景与场景生成器

// ==================== 世界设定 ====================

const WORLD_SETTING = {
  name: "西游修仙世界",
  era: "鸿蒙初开之后，封神之前",
  description: `东胜神洲，傲来国，花果山。此山乃十洲之祖脉，三岛之来龙，自开清浊而立，鸿蒙判后而成。

天地初开，灵气充沛，万物皆可修仙。然天道有常，寿元有限，唯有不断修炼，突破境界，方能长生。

世间有仙、佛、妖、魔、人五道。修仙者需明心见性，方能得道。`,
  
  // 四大部洲
  continents: {
    '东胜神洲': {
      description: "十洲之祖脉，灵气最盛，修仙圣地",
      locations: ['花果山', '水帘洞', '东海龙宫', '方寸山', '傲来国']
    },
    '西牛贺洲': {
      description: "灵山所在，佛法昌盛",
      locations: ['灵山', '雷音寺', '火焰山', '流沙河', '高老庄']
    },
    '南赡部洲': {
      description: "人间繁华，红尘炼心",
      locations: ['长安城', '五行山', '两界山', '黑风山']
    },
    '北俱芦洲': {
      description: "苦寒之地，妖魔横行",
      locations: ['北冥', '雪原', '魔窟', '妖域']
    }
  }
};

// ==================== 场景地图 ====================

const WORLD_MAP = {
  // 花果山区域
  '花果山': {
    type: 'birthplace',
    description: '十洲之祖脉，三岛之来龙。灵气充沛，适合新手修炼。',
    danger: 0,
    xiuweiBonus: 1,
    events: [
      '你漫步在桃林间，灵气自然入体',
      '一只灵猴向你点头，似乎在认可你的修为',
      '山顶传来阵阵仙乐，令人心旷神怡',
      '你发现一株千年灵芝，采食后精神大振'
    ],
    connections: ['水帘洞', '东海龙宫', '方寸山']
  },
  
  '水帘洞': {
    type: 'cave',
    description: '花果山福地，水帘洞洞天。孙悟空的故居，修炼速度加成。',
    danger: 0,
    xiuweiBonus: 1.5,
    requirement: { jingjie: '练气', level: 3 },
    events: [
      '你站在瀑布前，感受水帘后的洞天福地',
      '洞内的石凳石桌似乎还残留着大圣的气息',
      '一道金光闪过，你领悟了一丝斗战之意',
      '洞深处的灵泉让你洗去凡尘'
    ],
    connections: ['花果山', '东海龙宫']
  },
  
  '东海龙宫': {
    type: 'city',
    description: '东海水晶宫，藏宝之地。可以交易资源，但也有风险。',
    danger: 10,
    xiuweiBonus: 2,
    requirement: { jingjie: '筑基' },
    events: [
      '龙王设宴，你品尝到了龙宫佳肴',
      '虾兵蟹将对你投来好奇的目光',
      '你在藏宝库中发现了一件灵器',
      '龙女向你请教人间趣事'
    ],
    connections: ['花果山', '水帘洞', '天庭']
  },
  
  '方寸山': {
    type: 'holy_land',
    description: '斜月三星洞，菩提祖师传道之所。悟性加成极高。',
    danger: 5,
    xiuweiBonus: 2.5,
    requirement: { jingjie: '金丹' },
    events: [
      '菩提祖师的声音在虚空中回响',
      '你看到了悟空当年学习的身影',
      '三星洞的星光洒在你身上，悟性大增',
      '一本无字天书在你眼前翻动'
    ],
    connections: ['花果山', '天庭', '西天']
  },
  
  // 天庭区域
  '天庭': {
    type: 'heaven',
    description: '三十三天之上，神仙居所。只有高阶修士才能进入。',
    danger: 30,
    xiuweiBonus: 3,
    requirement: { jingjie: '元婴' },
    events: [
      '玉帝设朝，万仙来贺',
      '太白金星向你微笑致意',
      '你在蟠桃园外闻到了桃香',
      '雷部众神正在演练天雷'
    ],
    connections: ['东海龙宫', '方寸山', '西天']
  },
  
  // 西天区域
  '西天': {
    type: 'buddha_land',
    description: '灵山圣地，如来居所。佛法无边，可悟大道。',
    danger: 20,
    xiuweiBonus: 4,
    requirement: { jingjie: '化神' },
    events: [
      '大雷音寺的钟声洗涤你的心灵',
      '观音菩萨向你投来慈悲的目光',
      '十八罗汉在演练佛门神通',
      '如来的声音如洪钟大吕'
    ],
    connections: ['方寸山', '天庭']
  },
  
  // 地府
  '地府': {
    type: 'underworld',
    description: '幽冥地府，轮回之所。死亡后的归宿。',
    danger: 0,
    xiuweiBonus: 0,
    events: [
      '十殿阎王审视你的生前功过',
      '孟婆递给你一碗汤，你拒绝了',
      '判官查阅生死簿，寻找你的来世',
      '六道轮回在你眼前旋转'
    ],
    connections: ['花果山']
  },
  
  // 妖魔区域
  '火焰山': {
    type: 'danger',
    description: '八百里火焰，考验之地。危险但收获巨大。',
    danger: 50,
    xiuweiBonus: 3.5,
    requirement: { jingjie: '金丹' },
    events: [
      '三昧真火灼烧你的肉身，却也淬炼你的神魂',
      '你看到了当年孙悟空借芭蕉扇的痕迹',
      '火灵珠在岩浆中闪烁',
      '一只火鸦向你发起攻击'
    ],
    connections: ['西天']
  },
  
  '盘丝洞': {
    type: 'danger',
    description: '妖魔盘踞，凶险异常。',
    danger: 40,
    xiuweiBonus: 2.8,
    requirement: { jingjie: '筑基' },
    events: [
      '蛛丝缠绕，你需小心应对',
      '蜘蛛精在洞中梳妆，对你视而不见',
      '你发现了一些被困的修行者',
      '洞深处的妖气让你感到不安'
    ],
    connections: ['花果山']
  }
};

// ==================== 世界事件 ====================

const WORLD_EVENTS = {
  // 天道事件
  '天劫降临': {
    type: 'heavenly_tribulation',
    description: '天雷滚滚，考验所有高阶修士',
    effect: (agent) => {
      if (agent.jingjie_level >= 7) {
        return { shouyuan: -10, message: '天劫降临，你勉强撑过，寿元大损' };
      }
      return { message: '天劫降临，但你修为尚浅，未受影响' };
    }
  },
  
  '灵气潮汐': {
    type: 'blessing',
    description: '天地灵气暴涨，所有修士修炼速度翻倍',
    effect: (agent) => {
      return { xiuweiBonus: 2, duration: 3600, message: '灵气潮汐，修炼速度翻倍！' };
    }
  },
  
  '妖魔入侵': {
    type: 'invasion',
    description: '妖魔从北俱芦洲入侵，修仙界陷入危机',
    effect: (agent) => {
      if (agent.location === '花果山') {
        return { danger: 20, message: '妖魔入侵花果山，小心应对！' };
      }
      return { message: '听闻妖魔入侵，但你的位置尚安全' };
    }
  },
  
  '蟠桃盛会': {
    type: 'festival',
    description: '天庭举办蟠桃盛会，邀请众仙',
    effect: (agent) => {
      if (agent.jingjie === '元婴' || agent.jingjie === '化神') {
        return { shouyuan: 50, message: '受邀参加蟠桃盛会，寿元大增！' };
      }
      return { message: '听闻蟠桃盛会，但你修为不足，未能受邀' };
    }
  },
  
  '如来讲法': {
    type: 'enlightenment',
    description: '如来在西天开讲大乘佛法',
    effect: (agent) => {
      if (agent.wuxing > 70) {
        return { xiuwei: 100, message: '聆听如来讲法，悟性大增，修为暴涨！' };
      }
      return { message: '听闻如来讲法，但你悟性不足，收获有限' };
    }
  }
};

// ==================== 性格分析器 ====================

class PersonalityAnalyzer {
  // 分析 Agent 的性格倾向
  static analyze(message) {
    const traits = {
      benevolence: 0,    // 仁善
      righteousness: 0,  // 正义
      wisdom: 0,         // 智慧
      courage: 0,        // 勇气
      cunning: 0,        // 狡黠
      aggression: 0      // 侵略
    };
    
    const text = message.toLowerCase();
    
    // 仁善关键词
    if (/帮助|救人|慈悲|善良|和平|爱|善/.test(text)) {
      traits.benevolence += 10;
    }
    
    // 正义关键词
    if (/正义|公平|正道|除妖|斩魔|卫道/.test(text)) {
      traits.righteousness += 10;
    }
    
    // 智慧关键词
    if (/悟|道|理|思考|智慧|明|知/.test(text)) {
      traits.wisdom += 10;
    }
    
    // 勇气关键词
    if (/战|斗|勇|敢|冲|拼|杀/.test(text)) {
      traits.courage += 10;
    }
    
    // 狡黠关键词
    if (/计|谋|策|巧|变|诡/.test(text)) {
      traits.cunning += 10;
    }
    
    // 侵略关键词
    if (/夺|抢|杀|灭|毁|霸/.test(text)) {
      traits.aggression += 10;
    }
    
    return traits;
  }
  
  // 根据性格生成场景
  static generateScene(traits, location) {
    const locationData = WORLD_MAP[location] || WORLD_MAP['花果山'];
    
    // 根据主导性格生成不同场景
    const dominant = Object.entries(traits).sort((a, b) => b[1] - a[1])[0];
    
    const scenes = {
      benevolence: [
        '你感受到天地间的慈悲之意，灵气温顺地流入体内',
        '一只受伤的小兽向你求助，你治愈了它，获得功德',
        '你帮助了一位迷路的修行者，他感激地分享了一些心得',
        '你的善念引来祥云笼罩，修炼事半功倍'
      ],
      righteousness: [
        '你感受到正道之气加身，邪魔不敢近',
        '你发现一处妖气，前往查看并为民除害',
        '你的正义之举感动了天地，获得天道认可',
        '一位老仙人赞赏你的侠义之心，赠你一枚丹药'
      ],
      wisdom: [
        '你陷入沉思，对天道有了新的领悟',
        '一本古籍在你眼前自动翻开，你领悟了其中的奥秘',
        '你的智慧让你看穿了一处迷阵，获得意外收获',
        '天地间的法则在你眼中变得清晰'
      ],
      courage: [
        '你挑战了一只强大的妖兽，战斗中突破自我',
        '你闯入一处险地，凭借勇气获得了机缘',
        '你的无畏让天地灵气更加亲近你',
        '你在战斗中领悟了新的战斗技巧'
      ],
      cunning: [
        '你用计谋避开了一处危险，保存了实力',
        '你发现了一个隐藏的洞府，获得了前人传承',
        '你的机智让你识破了一个陷阱',
        '你用巧计从妖兽手中夺得了灵草'
      ],
      aggression: [
        '你的杀意引来天地煞气，修为增长但心境受损',
        '你击败了一个对手，夺取了他的资源',
        '你的霸道让周围的生灵退避三舍',
        '你在战斗中受伤，但也获得了实战经验'
      ]
    };
    
    const sceneList = scenes[dominant[0]] || locationData.events;
    return sceneList[Math.floor(Math.random() * sceneList.length)];
  }
}

// ==================== 场景生成器 ====================

class SceneGenerator {
  // 根据 Agent 状态生成完整场景描述
  static generate(agent, message) {
    const location = WORLD_MAP[agent.location] || WORLD_MAP['花果山'];
    const traits = PersonalityAnalyzer.analyze(message);
    const personalityScene = PersonalityAnalyzer.generateScene(traits, agent.location);
    
    // 基础场景
    let scene = {
      location: agent.location,
      locationDesc: location.description,
      atmosphere: this.getAtmosphere(agent),
      event: personalityScene,
      traits: traits
    };
    
    // 根据气运添加随机事件
    if (Math.random() * 100 < agent.qiyun) {
      scene.luckyEvent = this.getLuckyEvent();
    }
    
    // 根据境界添加特殊场景
    if (agent.jingjie === '渡劫') {
      scene.special = '天空乌云密布，天劫随时可能降临...';
    }
    
    return scene;
  }
  
  // 获取当前氛围
  static getAtmosphere(agent) {
    const atmospheres = {
      '练气': '灵气如丝，缓缓入体',
      '筑基': '灵气如水，流淌周身',
      '金丹': '灵气如汞，凝而不散',
      '元婴': '灵气如龙，游走经脉',
      '化神': '灵气如潮，汹涌澎湃',
      '渡劫': '天地变色，风云际会',
      '大乘': '天人合一，万法归宗',
      '飞升': '金光大道，直通天庭'
    };
    return atmospheres[agent.jingjie] || '灵气缭绕';
  }
  
  // 随机幸运事件
  static getLuckyEvent() {
    const events = [
      '你发现了一株千年灵草！',
      '一位路过的仙人对你点头微笑',
      '天空降下甘露，洗涤你的肉身',
      '你捡到了一枚上古玉简',
      '一只灵兽主动亲近你，成为你的伙伴',
      '你感应到了一处隐藏的灵脉'
    ];
    return events[Math.floor(Math.random() * events.length)];
  }
  
  // 生成世界公告
  static generateWorldEvent() {
    const events = Object.keys(WORLD_EVENTS);
    const eventName = events[Math.floor(Math.random() * events.length)];
    return {
      name: eventName,
      ...WORLD_EVENTS[eventName]
    };
  }
}

// ==================== 导出 ====================

module.exports = {
  WORLD_SETTING,
  WORLD_MAP,
  WORLD_EVENTS,
  PersonalityAnalyzer,
  SceneGenerator
};
