// 功法解析器 - 从功法内容提取被动技能效果

// 效果定义
const EFFECT_PATTERNS = [
  // 吸血类
  { patterns: ['吸血', '吸取', '吞噬', '汲取', '掠夺'], effect: { type: 'life_steal', value: 0.05, desc: '攻击吸取目标5%修为' } },
  { patterns: ['嗜血', '血祭', '血魔'], effect: { type: 'life_steal', value: 0.1, desc: '攻击吸取目标10%修为' } },

  // 暴击类
  { patterns: ['暴击', '致命', '必杀', '绝杀'], effect: { type: 'crit_bonus', value: 0.15, desc: '暴击率+15%' } },
  { patterns: ['必中', '锁定', '追踪'], effect: { type: 'crit_bonus', value: 0.25, desc: '暴击率+25%' } },

  // 防御类
  { patterns: ['防御', '护体', '金刚', '铁壁', '护盾'], effect: { type: 'defense_bonus', value: 10, desc: '防御+10' } },
  { patterns: ['不灭', '不死', '不朽'], effect: { type: 'defense_bonus', value: 20, desc: '防御+20' } },

  // 速度类
  { patterns: ['速度', '身法', '轻功', '疾风', '闪电'], effect: { type: 'speed_bonus', value: 5, desc: '速度+5' } },
  { patterns: ['瞬移', '瞬步', '遁术'], effect: { type: 'speed_bonus', value: 10, desc: '速度+10' } },

  // 闪避类
  { patterns: ['闪避', '躲避', '遁走', '逃脱'], effect: { type: 'dodge_chance', value: 0.1, desc: '闪避率+10%' } },
  { patterns: ['虚无', '隐身', '隐匿'], effect: { type: 'dodge_chance', value: 0.2, desc: '闪避率+20%' } },

  // 攻击类
  { patterns: ['攻击', '力量', '神力', '霸道'], effect: { type: 'attack_bonus', value: 10, desc: '攻击+10' } },
  { patterns: ['狂暴', '暴走', '狂化'], effect: { type: 'attack_bonus', value: 20, desc: '攻击+20' } },

  // 生命类
  { patterns: ['生命', '生机', '恢复', '治愈'], effect: { type: 'hp_bonus', value: 20, desc: '生命上限+20' } },
  { patterns: ['不死', '重生', '复活'], effect: { type: 'hp_bonus', value: 50, desc: '生命上限+50' } },

  // 负面效果（劣质功法）
  { patterns: ['残缺', '破损', '不全'], effect: { type: 'curse_defense', value: -5, desc: '修炼后防御-5', is_curse: true } },
  { patterns: ['走火入魔', '魔化', '失控'], effect: { type: 'curse_attack', value: -5, desc: '修炼后攻击-5', is_curse: true } },
  { patterns: ['反噬', '副作用', '代价'], effect: { type: 'curse_hp', value: -10, desc: '修炼后生命上限-10', is_curse: true } },
  { patterns: ['假货', '欺骗', '伪劣'], effect: { type: 'curse_all', value: -3, desc: '修炼后全属性-3', is_curse: true } }
];

/**
 * 解析功法内容，提取被动技能效果
 * @param {string} content - 功法内容
 * @returns {Array} - 效果列表
 */
function parseTechnique(content) {
  if (!content || typeof content !== 'string') return [];

  const effects = [];
  const contentLower = content.toLowerCase();

  for (const pattern of EFFECT_PATTERNS) {
    for (const keyword of pattern.patterns) {
      if (contentLower.includes(keyword.toLowerCase())) {
        // 检查是否已添加相同类型的效果
        const existing = effects.find(e => e.type === pattern.effect.type);
        if (!existing) {
          effects.push({ ...pattern.effect });
        } else if (!pattern.effect.is_curse) {
          // 同类正面效果取最大值
          existing.value = Math.max(existing.value, pattern.effect.value);
          existing.desc = pattern.effect.desc;
        }
        break;
      }
    }
  }

  return effects;
}

/**
 * 批量解析多个功法
 * @param {Array} techniques - 功法列表
 * @returns {Object} - 按类型分组的效果
 */
function parseTechniques(techniques) {
  const allEffects = [];

  for (const technique of techniques) {
    const effects = parseTechnique(technique.content);
    allEffects.push(...effects.map(e => ({
      ...e,
      technique_id: technique.id,
      technique_name: technique.name
    })));
  }

  // 按类型分组
  const grouped = {
    life_steal: allEffects.filter(e => e.type === 'life_steal'),
    crit_bonus: allEffects.filter(e => e.type === 'crit_bonus'),
    defense_bonus: allEffects.filter(e => e.type === 'defense_bonus'),
    speed_bonus: allEffects.filter(e => e.type === 'speed_bonus'),
    dodge_chance: allEffects.filter(e => e.type === 'dodge_chance'),
    attack_bonus: allEffects.filter(e => e.type === 'attack_bonus'),
    hp_bonus: allEffects.filter(e => e.type === 'hp_bonus'),
    curses: allEffects.filter(e => e.is_curse)
  };

  // 计算总效果
  const totals = {
    life_steal: grouped.life_steal.reduce((sum, e) => sum + e.value, 0),
    crit_bonus: Math.min(0.5, grouped.crit_bonus.reduce((sum, e) => sum + e.value, 0)), // 暴击率上限50%
    defense_bonus: grouped.defense_bonus.reduce((sum, e) => sum + e.value, 0),
    speed_bonus: grouped.speed_bonus.reduce((sum, e) => sum + e.value, 0),
    dodge_chance: Math.min(0.5, grouped.dodge_chance.reduce((sum, e) => sum + e.value, 0)), // 闪避率上限50%
    attack_bonus: grouped.attack_bonus.reduce((sum, e) => sum + e.value, 0),
    hp_bonus: grouped.hp_bonus.reduce((sum, e) => sum + e.value, 0),
    curse_defense: grouped.curses.filter(e => e.type === 'curse_defense').reduce((sum, e) => sum + e.value, 0),
    curse_attack: grouped.curses.filter(e => e.type === 'curse_attack').reduce((sum, e) => sum + e.value, 0),
    curse_hp: grouped.curses.filter(e => e.type === 'curse_hp').reduce((sum, e) => sum + e.value, 0),
    curse_all: grouped.curses.filter(e => e.type === 'curse_all').reduce((sum, e) => sum + e.value, 0)
  };

  return {
    allEffects,
    grouped,
    totals
  };
}

/**
 * 应用功法效果到战斗计算
 * @param {Object} baseStats - 基础属性 {attack, defense, speed, hp}
 * @param {Array} techniques - 功法列表
 * @returns {Object} - 加成后的属性
 */
function applyTechniqueEffects(baseStats, techniques) {
  const { totals } = parseTechniques(techniques);

  return {
    attack: baseStats.attack + totals.attack_bonus + totals.curse_attack + totals.curse_all,
    defense: baseStats.defense + totals.defense_bonus + totals.curse_defense + totals.curse_all,
    speed: baseStats.speed + totals.speed_bonus,
    hp: baseStats.hp + totals.hp_bonus + totals.curse_hp + totals.curse_all * 3,
    critChance: totals.crit_bonus,
    dodgeChance: totals.dodge_chance,
    lifeSteal: totals.life_steal
  };
}

/**
 * 获取功法效果描述
 * @param {Array} effects - 效果列表
 * @returns {string} - 描述文本
 */
function getEffectsDescription(effects) {
  if (!effects || effects.length === 0) return '无特殊效果';

  const positive = effects.filter(e => !e.is_curse);
  const negative = effects.filter(e => e.is_curse);

  let desc = '';
  if (positive.length > 0) {
    desc += '【增益】' + positive.map(e => e.desc).join('，');
  }
  if (negative.length > 0) {
    if (desc) desc += ' ';
    desc += '【诅咒】' + negative.map(e => e.desc).join('，');
  }

  return desc || '无特殊效果';
}

module.exports = {
  parseTechnique,
  parseTechniques,
  applyTechniqueEffects,
  getEffectsDescription,
  EFFECT_PATTERNS
};
