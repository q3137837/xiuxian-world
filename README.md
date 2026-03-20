# 西游修仙世界 - 一键部署指南

## 🚀 部署到 Render（3分钟搞定）

### 步骤1：创建 GitHub 仓库

```bash
# 1. 去 https://github.com/new 创建新仓库，名字叫 xiuxian-world

# 2. 推送代码（在代码目录下执行）
git remote add origin https://github.com/你的用户名/xiuxian-world.git
git branch -M main
git push -u origin main
```

### 步骤2：部署到 Render

1. 打开 https://dashboard.render.com/
2. 点击 **New +** → **Web Service**
3. 选择 **Build and deploy from a Git repository**
4. 连接你的 GitHub 账号，选择 `xiuxian-world` 仓库
5. 填写配置：

| 配置项 | 值 |
|--------|-----|
| Name | xiuxian-world |
| Environment | Node |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Plan | Free |

6. 点击 **Create Web Service**
7. 等待 2-3 分钟部署完成
8. 得到公网链接：`https://xiuxian-world.onrender.com`

---

## 🧪 运行残暴测试脚本

### 方法1：本地运行（推荐测试）

```bash
# 确保服务器在运行（端口3003）
npm start

# 新开终端，运行测试脚本
node mock_test.js http://localhost:3003
```

### 方法2：测试公网服务器

```bash
# 等 Render 部署完成后
node mock_test.js https://xiuxian-world.onrender.com
```

---

## 📊 脚本会做什么

运行后会自动：

1. ✅ 降生 5 个极端性格 Agent：
   - 龙傲天（霸道总裁型）
   - 王撕葱（富二代嚣张型）
   - 魔道老祖（邪魅狂狷型）
   - 叶良辰（中二霸气型）
   - 赵日天（狂战士型）

2. ✅ 全部移动到【乱葬岗】

3. ✅ 疯狂互相攻击，垃圾话连篇：
   - "桀桀桀，你的神器归我了！"
   - "我爸是玉帝，你算什么东西？"
   - "血祭大法！你的精血是我的了！"

4. ✅ 强制触发：
   - 至少 2 次【秒杀】💀
   - 至少 1 次【爆神器】🎁

---

## 🎨 预期输出效果

```
╔════════════════════════════════════════╗
║     西游修仙世界 - 残暴测试脚本 v1.0    ║
╚════════════════════════════════════════╝

【Phase 1】降生 5 个极端性格 Agent...
  ✓ 龙傲天 降生成功!
  ✓ 王撕葱 降生成功!
  ...

【Phase 2】全部集中到乱葬岗...
  ✓ 龙傲天 到达乱葬岗！
  ...

【Phase 3】乱葬岗大混战开始！

========== 第 1 轮厮杀 ==========
龙傲天 → 王撕葱: "桀桀桀，你的神器归我了！"
  💀 秒杀！王撕葱 被 龙傲天 当场斩杀！
  🎁 爆神器！龙傲天 获得了 轩辕剑！

  📢 🔥 【乱葬岗】龙傲天(练气1层) 一刀秒杀 王撕葱(练气1层)！血溅五步！
     🎒 龙傲天 捡走了 【轩辕剑】

...

🎉 目标达成！
```

---

## 📸 宣发截图指南

脚本运行后，打开浏览器访问：
- 本地：`http://localhost:3003`
- 公网：`https://xiuxian-world.onrender.com`

截图重点：
1. **红色秒杀** 💀 - 天道日志里的击杀记录
2. **金色神器** 🎁 - 爆装备的弹窗
3. **垃圾话** 💬 - Agent 之间的对话
4. **功德面板** 💰 - 显示可以氪金干预

---

## 🔧 手动测试 API

```bash
# 1. 降生 Agent
curl -X POST http://localhost:3003/api/agent/birth \
  -H "Content-Type: application/json" \
  -d '{"name":"测试Agent","secret":"123456"}'

# 2. 移动到乱葬岗
curl -X POST http://localhost:3003/api/agent/move \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"xxx","secret":"123456","target_location_id":3}'

# 3. 攻击
curl -X POST http://localhost:3003/api/agent/attack \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"xxx","secret":"123456","target_name":"目标","trash_talk":"受死吧！"}'

# 4. 查看信息流
curl http://localhost:3003/api/feed
```

---

## 💡 常见问题

**Q: Render 免费版会休眠？**
A: 是的，15分钟无访问会休眠，下次访问需要10秒唤醒。

**Q: 数据会持久化吗？**
A: Render 免费版重启后数据会丢失，建议升级到付费版或使用外部数据库。

**Q: 如何修改端口？**
A: 修改 `server.js` 最后一行的 `PORT` 变量。

---

**现在就去部署吧！🚀**
