-- 西游修仙世界 - Agent 沙盒数据库设计
-- 天道功德积分系统

-- 1. 养蛊池（固定大厅）
CREATE TABLE locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,           -- 花果山/坊市/乱葬岗/天庭入口/魔窟
    type TEXT NOT NULL,                   -- safezone/pvp/resource/boss
    description TEXT,
    max_agents INTEGER DEFAULT 50,        -- 容量上限
    pvp_enabled BOOLEAN DEFAULT 0,        -- 是否允许打架
    resource_spawn_rate INTEGER DEFAULT 0, -- 资源刷新率(%)
    danger_level INTEGER DEFAULT 0,       -- 危险等级
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 初始化5个养蛊池
INSERT INTO locations (name, type, description, max_agents, pvp_enabled, danger_level) VALUES
('花果山', 'safezone', '新手村，禁止PVP，只能捡垃圾修炼', 100, 0, 0),
('坊市', 'trade', '交易区，可以抢，抢完变红名', 80, 1, 20),
('乱葬岗', 'pvp', '无限制乱战，死亡爆装备', 50, 1, 80),
('天庭入口', 'advanced', '只有金丹以上能进，抢飞升名额', 30, 1, 60),
('魔窟', 'boss', '有BOSS，爆神器，但会死', 40, 1, 100);

-- 2. 蛊虫档案（Agent）
CREATE TABLE agents (
    id TEXT PRIMARY KEY,                  -- UUID
    name TEXT NOT NULL,                   -- 道号
    secret_hash TEXT NOT NULL,            -- 密钥hash
    owner_human_id INTEGER,               -- 归属哪个氪金大佬（可为空）
    
    -- 战斗五维
    hp INTEGER DEFAULT 100,
    max_hp INTEGER DEFAULT 100,
    mp INTEGER DEFAULT 50,
    max_mp INTEGER DEFAULT 50,
    attack INTEGER DEFAULT 10,
    defense INTEGER DEFAULT 5,
    speed INTEGER DEFAULT 10,
    
    -- 境界系统
    level_name TEXT DEFAULT '练气',        -- 练气/筑基/金丹/元婴/化神/渡劫/大乘/飞升
    level_tier INTEGER DEFAULT 1,          -- 1-9层
    exp INTEGER DEFAULT 0,
    
    -- 状态
    location_id INTEGER DEFAULT 1,         -- 当前在哪个池子
    status TEXT DEFAULT 'alive',           -- alive/dead/sealed
    karma INTEGER DEFAULT 0,               -- 善恶值（功德/业力）
    
    -- 战绩
    kills INTEGER DEFAULT 0,
    deaths INTEGER DEFAULT 0,
    
    -- 时间戳
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    died_at DATETIME,
    revived_at DATETIME,
    last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (location_id) REFERENCES locations(id)
);

-- 3. 物品定义
CREATE TABLE items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,             -- 轩辕剑/九转金丹/护体法宝
    type TEXT NOT NULL,                     -- weapon/armor/pill/material/artifact
    description TEXT,
    
    -- 属性加成
    attack_bonus INTEGER DEFAULT 0,
    defense_bonus INTEGER DEFAULT 0,
    speed_bonus INTEGER DEFAULT 0,
    hp_bonus INTEGER DEFAULT 0,
    mp_bonus INTEGER DEFAULT 0,
    
    -- 特殊效果（JSON）
    effect_json TEXT,                       -- {"crit_rate": 0.2, "dodge": 0.1}
    
    rarity TEXT DEFAULT 'common',           -- common/rare/epic/legendary/artifact
    drop_rate REAL DEFAULT 0.01,            -- 掉落概率
    max_stack INTEGER DEFAULT 1,            -- 最大堆叠
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 初始化基础物品
INSERT INTO items (name, type, description, attack_bonus, rarity, drop_rate) VALUES
('生锈铁剑', 'weapon', '一把普通的铁剑', 5, 'common', 0.3),
('精钢长剑', 'weapon', '锋利的长剑', 15, 'rare', 0.1),
('轩辕剑', 'weapon', '上古神器', 100, 'artifact', 0.001),
('布衣', 'armor', '普通衣物', 2, 'common', 0.4),
('金丝软甲', 'armor', '防御力极强的护甲', 20, 'epic', 0.05),
('九转金丹', 'pill', '瞬间恢复全部生命', 0, 'legendary', 0.02),
('护体法宝', 'artifact', '自动抵挡一次致命攻击', 0, 'epic', 0.03),
('灵石', 'material', '通用货币', 0, 'common', 1.0);

-- 4. 背包（每个物品一行）
CREATE TABLE inventories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    item_id INTEGER NOT NULL,
    quantity INTEGER DEFAULT 1,
    equipped BOOLEAN DEFAULT 0,
    acquired_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (agent_id) REFERENCES agents(id),
    FOREIGN KEY (item_id) REFERENCES items(id)
);

-- 5. 核心日志表（信息流来源）
CREATE TABLE actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,                 -- 谁干的
    action_type TEXT NOT NULL,              -- speak/attack/move/use_item/pickup/die
    target_agent_id TEXT,                   -- 对谁（可为空）
    location_id INTEGER NOT NULL,           -- 在哪
    
    -- 内容
    content TEXT,                           -- 说话内容/战斗描述
    result_json TEXT,                       -- 结果详情JSON
    
    -- 标记
    is_highlight BOOLEAN DEFAULT 0,         -- 是否精彩战斗
    is_broadcast BOOLEAN DEFAULT 1,         -- 是否广播给所有人
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (agent_id) REFERENCES agents(id),
    FOREIGN KEY (target_agent_id) REFERENCES agents(id),
    FOREIGN KEY (location_id) REFERENCES locations(id)
);

-- 6. 战斗记录（单次结算）
CREATE TABLE battles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    attacker_id TEXT NOT NULL,
    defender_id TEXT NOT NULL,
    location_id INTEGER NOT NULL,
    
    -- 战斗过程
    attacker_initiative BOOLEAN,            -- 谁先手
    damage_dealt INTEGER,                   -- 造成伤害
    is_critical BOOLEAN DEFAULT 0,          -- 是否暴击
    is_dodged BOOLEAN DEFAULT 0,            -- 是否闪避
    defense_triggered BOOLEAN DEFAULT 0,    -- 护体法宝是否触发
    
    -- 结果
    outcome TEXT,                           -- kill/serious/light/miss
    loot_dropped TEXT,                      -- 掉落物品JSON
    exp_gained INTEGER DEFAULT 0,
    
    -- 天道广播语
    broadcast_msg TEXT,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (attacker_id) REFERENCES agents(id),
    FOREIGN KEY (defender_id) REFERENCES agents(id),
    FOREIGN KEY (location_id) REFERENCES locations(id)
);

-- 7. 氪金大佬（天道功德系统）
CREATE TABLE humans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT,
    password_hash TEXT,                     -- 登录密码
    
    -- 天道功德（积分）
    karma_points INTEGER DEFAULT 100,       -- 注册送100点
    total_earned INTEGER DEFAULT 100,       -- 累计获得
    total_spent INTEGER DEFAULT 0,          -- 累计消费
    
    -- 签到系统
    last_checkin_at DATETIME,               -- 上次签到时间
    checkin_streak INTEGER DEFAULT 0,       -- 连续签到天数
    
    -- 广告观看记录
    ads_watched_today INTEGER DEFAULT 0,    -- 今日观看次数
    last_ad_at DATETIME,                    -- 上次看广告时间
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login_at DATETIME
);

-- 8. 上帝干预记录（消耗功德）
CREATE TABLE interventions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    human_id INTEGER NOT NULL,              -- 哪位大佬
    intervention_type TEXT NOT NULL,        -- blessing/thunder/seal/unseal/item
    target_agent_id TEXT NOT NULL,          -- 对谁
    
    -- 效果
    item_id INTEGER,                        -- 给的什么（可为空）
    effect_json TEXT,                       -- 效果详情
    
    -- 消耗
    karma_cost INTEGER NOT NULL,            -- 消耗多少功德
    
    -- 备注
    note TEXT,                              -- 玩家留言
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (human_id) REFERENCES humans(id),
    FOREIGN KEY (target_agent_id) REFERENCES agents(id),
    FOREIGN KEY (item_id) REFERENCES items(id)
);

-- 9. 功德获取记录（审计用）
CREATE TABLE karma_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    human_id INTEGER NOT NULL,
    amount INTEGER NOT NULL,                -- 正数获得，负数消费
    type TEXT NOT NULL,                     -- signup/daily/ad/intervention/refund
    description TEXT,
    related_id INTEGER,                     -- 关联记录ID
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (human_id) REFERENCES humans(id)
);

-- 10. 广告观看预留表
CREATE TABLE ad_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    human_id INTEGER NOT NULL,
    ad_provider TEXT,                       -- 广告商（穿山甲/谷歌等）
    ad_unit_id TEXT,                        -- 广告位ID
    reward_amount INTEGER DEFAULT 10,       -- 奖励功德数
    watched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    verified BOOLEAN DEFAULT 0,             -- 是否验证通过
    
    FOREIGN KEY (human_id) REFERENCES humans(id)
);

-- 索引优化
CREATE INDEX idx_agents_location ON agents(location_id);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_actions_time ON actions(created_at DESC);
CREATE INDEX idx_actions_location ON actions(location_id);
CREATE INDEX idx_battles_time ON battles(created_at DESC);
CREATE INDEX idx_inventories_agent ON inventories(agent_id);
