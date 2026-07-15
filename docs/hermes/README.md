# Hermes 工程 —— 任务分发与验收体系

> 2026-07-14 立。**为什么叫 Hermes**：信使——用户拍板方向，Hermes（主会话 AI）把需求翻译成自包含任务书分发出去，工作者执行，Hermes 验收。
> **第一性原理 = 赛题**。评审锚点原文："用户在刷到的一瞬间，是否就能被打动、被满足，并自然产生一次互动或使用？"（体验完整性 30% 最重）。每份任务书开头必须回答：这个任务如何服务这句话。

---

## 一、角色与流程

| 角色 | 职责 |
|---|---|
| **用户（决策者）** | 定方向、拍板取舍、终审 merge |
| **Hermes（主会话）** | 与用户对齐需求 → 写任务书 → 开 issue 分发 → 跑 DoD 验收 → 汇报 |
| **工作者** | 按任务书执行。两类受众：**AI 编码代理**（细粒度、带命令与验收脚本）／**人**（H1/H2，人话、清单化） |

流程（沿用 CLAUDE.md §5 git 约定）：

```
任务书 docs/hermes/HERMES-XX-<slug>.md
  → GitHub issue（标题 [HERMES-XX]，body 链任务书）
  → 工作者开 feat/* 分支执行
  → PR（目标 main，body 链任务书 + 自述 DoD 逐条核对）
  → Hermes 逐条跑 DoD 验收，结果评论进 PR
  → 用户终审人工 merge（AI 永不自行 merge）
```

**冲突纪律**：一个文件同一时间只属于一个任务。接任务前先看看板"占用文件"列；正在被占用的文件出现在你的改动里 = 直接打回。

## 二、任务书模板（新任务书复制此骨架）

```markdown
# HERMES-XX ｜ <标题>

- **受众**：AI 编码代理 ／ 人（H1/H2） ／ 混合（分节标注）
- **状态**：待领 → 进行中 → 待验收 → 已验收
- **时间窗**：M.DD–M.DD（硬截止写明为什么）
- **占用文件**：<本任务允许改动的文件清单——之外的改动一律打回>

## 0. 为什么做（对赛题的回答）
一段话：这个任务如何让"刷到的一瞬间被打动/被满足"更成立。

## 1. 背景（自包含，读完即可开工）
现状、已核实的事实（带 文件:行号）、此前踩过的相关坑。

## 2. 目标
做成什么样。明确"不做什么"同样重要。

## 3. DoD（验收标准，二元，逐条可执行）
- [ ] <命令或对照物写死，验收人照跑>

## 4. 输入材料
文件路径清单 + 每个文件看什么。

## 5. 红线（不可逾越）
F6 真实性（不编造数据，不确定标"待核"+置信度）等按任务列。

## 6. 调参口 / 取证清单（按需）

## 7. 交付方式
分支名建议、PR 要求、check_report 位置。
```

## 三、全景版图（新来的先看这张，再去看板领任务）

> **📢 7.15 结构变更公告**：负责人拍板产品从四板块整合为**三板块**——①钩子（feed 卡+判断）②光影地图×社区（照片气泡，融合原「路线·光区」与「社区」两列）③滤镜摄影（PR #29 为底座）。全案与拍板项见 **[product-arch-v3.md](product-arch-v3.md)**；下文历史"四页"表述逐步更新中，冲突时以 v3 对齐稿为准。

产品最终形态 = 抖音 AI 平台 vibecoding 产出的 **feed 卡 + 小程序**（7.24 平台开放后在平台内生成，**不在本仓库写产品代码**）。本仓库一切工作都是它的上游，四条线汇入一个漏斗：

```
弹药线（数据/算法/文案）──┐
原型线（体验蓝本，本仓库）─┼─→ AGENT_05 需求包 ＋ HERMES-09 迁移资产包（对话编排＋弹药直传 = 产品的源代码）
叙事线（路演/商业延展）───┘        ↓
人工线（外联/实拍/盲评）→ 素材注入   7.25–7.27 平台内 vibecoding → Gate 1 真机三板块 → 7.31 现场
```

| 线 | Part | 状态 | 去哪看 |
|---|---|---|---|
| 弹药 | 机位库 25 点 / 光线引擎 / 文案引擎 | ✅ 已交付 | `agents_output/01 02 03` |
| 弹药 | 晚霞算法置信度 + 多源 + 竞品对标 | **待领（开发）** | HERMES-02 |
| 弹药 | 出片场景扩展（schema+泛化筛选设计） | 待领（设计稿先行） | HERMES-05 |
| 原型 | 步行导航走反路根治 | ✅ PR #28 验收 6/6 过，待终审 merge | HERMES-01 |
| 原型 | **板块二融合：地图照片气泡社区层** | **待领（P0，phase1 立即可开工）** | HERMES-10 |
| 原型 | 3D 楼群消失（真机）+ WebGL 恢复 | 进行中（部分解决；相位二 GL 引擎，继续推进） | `docs/3d光影地图-交接文档.md` + HERMES-07 |
| 原型 | GL 3D 招牌+气泡（相位二，committed） | 待相位一 2D 稳后启动 | HERMES-11 |
| 原型 | ~~3D 光域高亮~~ | **取消（7.15 D-c）** | HERMES-03 |
| 原型 | P1 前5秒 / P4 相机收尾（06a 可领；06b P3 取消；先等 PR #29 合入） | 待领（开发） | HERMES-06 |
| 平台 | 上下文字段级测绘 | 7.24 执行（人） | HERMES-04 |
| 平台 | **迁移资产包（数据/设计/动效/提示词/Skill 五包，开箱即传）** | **待领（P0，7.23 硬截止）** | HERMES-09 |
| 平台 | **需求包 = 产品本体的"源代码"** | Hermes+决策者结对中（7.14–7.22） | `Thoughts/AGENT_05_Vibecoding需求包.md` |
| 平台 | vibecoding 落地 feed 卡+三板块 | 7.25–7.27（依赖 04/05/06 测绘） | 平台内，非本仓库 |
| 叙事 | 路演脚本 / 海报 / 商业延展 | Hermes 起草（7.15–7.27） | `Thoughts/AGENT_08_*` |
| 人工 | 外联回收（发送 7.13 已开始）/ 可颂链接 / 7.28 实拍 / 盲评 / PR#8 | 人工池 | [#26 残留追踪](https://github.com/Suaiii/LIGHTCHASER/issues/26) |

> 一句话回答"开发 part 有哪些"：**现在可领 = 02 / 06a / 09 / 10 四个**（09 混合受众、7.23 硬截止；10 phase1 立即可开工且 7.18 前要出 photos schema 喂 09；01 已交付待 merge；07 进行中（部分解决，相位二 GL 引擎）；**03 已取消**、11 committed 相位二待启动）；**最大的开发 part 是产品本体**，但它的"编码"发生在 7.24 后的平台对话里，源代码=需求包+迁移资产包（Hermes 主线，不外包）。

## 四、看板

| 任务 | 受众 | 优先级 | 时间窗 | 状态 | Issue | 占用文件 |
|---|---|---|---|---|---|---|
| [HERMES-01 导航走反路根治](HERMES-01-routing-foot.md) | AI | **P0**（演示可信度） | 7.14–7.17 | ✅ PR #28 验收 6/6，待终审 merge | [#16](https://github.com/Suaiii/LIGHTCHASER/issues/16) | lib/route-service.js, api/route.js, docs/page_specs.md(P2节) |
| [HERMES-02 晚霞算法置信度+多源+竞品对标](HERMES-02-confidence.md) | AI | **P0**（AI×产品 15%+叙事弹药） | 7.15–7.20 | 待领 | [#17](https://github.com/Suaiii/LIGHTCHASER/issues/17) | api/sunset.js, lib/sunset-service.js, agents_output/02/checks/*新增 |
| ~~HERMES-03 3D 光域高亮层~~ | AI | — | — | **取消（7.15 D-c：见光点效果糟糕删除）** | [#18](https://github.com/Suaiii/LIGHTCHASER/issues/18) | — |
| [HERMES-04 平台上下文字段级测绘](HERMES-04-context-matrix.md) | 人+AI | **P0**（7.24 唯一窗口） | 清单即备，7.24 执行 | 待领 | [#19](https://github.com/Suaiii/LIGHTCHASER/issues/19) | agents_output/06/*新增 |
| [HERMES-05 出片场景扩展先导](HERMES-05-scene-expansion.md) | 混合 | P2（用户定调：不急） | 设计 7.16–7.20 | 待领 | [#20](https://github.com/Suaiii/LIGHTCHASER/issues/20) | agents_output/01/*（schema 设计稿新增，不改 spots.v1.json 主体） |
| [HERMES-06 原型收尾包（06a 有效/06b 冻结）](HERMES-06-proto-polish.md) | AI | P1 | 7.15–7.19（#29 合入起） | **已被 Suaiii 领取**（拆单已发 #21 评论） | [#21](https://github.com/Suaiii/LIGHTCHASER/issues/21) | public/app.jsx, public/subpanels.jsx（06a 只碰 QuickShoot/P1 区段）, public/追·光.html |
| 3D 真机楼消失（存量，交接文档制） | AI | P0 | 进行中 | 进行中 | #15(PR) | public/light-map-gl.jsx |
| [HERMES-07 GL 楼群消失捕获与动画恢复](HERMES-07-webgl-recovery.md) | AI | **P0** | 7.14 起 | 进行中 | #15 后续 | public/light-map-gl.jsx, scripts/e2e/webgl-recovery.mjs |
| [HERMES-09 迁移资产包（五包，开箱即传）](HERMES-09-migration-kit.md) | 混合 | **P0**（7.23 Gate 0 硬截止） | 7.15–7.22 | 待领（§2c 有 7.15 条件增补） | [#25](https://github.com/Suaiii/LIGHTCHASER/issues/25) | agents_output/09/*（全新增） |
| [HERMES-10 板块二融合：地图照片气泡社区层（提案制）](HERMES-10-photo-map-community.md) | AI | **P0**（三板块整合主载体） | p1: 7.15–7.18 / p2: 7.18–7.21 | 待领（p2 有闸门） | [#31](https://github.com/Suaiii/LIGHTCHASER/issues/31) | p1: agents_output/10/*；p2: public/subpanels.jsx(SceneCommunity/地图区段), app.jsx（#29 合入→06a→本任务 rebase） |
| HERMES-11 板块二 GL 招牌：3D 光影地图上移植气泡层（相位二·committed D-e） | AI | P1（招牌，相位二） | 待相位一 2D 稳 + HERMES-07 结案后成书 | committed（待启动） | 待开 | public/light-map-gl.jsx |

> 状态由 Hermes 维护；工作者只改任务书内自己的"状态"行 + issue 评论。

## 五、验收纪律（Hermes 自律）

1. DoD 逐条**亲自跑**，不采信工作者自述；跑不通=打回并把失败输出贴进 issue。
2. 验收看两层：DoD 过了没（功能）+ 红线破了没（真实性/调参口/占用文件越界）。
3. 每次验收在 PR 留痕：`DoD n/n ✅/❌ + 证据`。
4. 任务书发出后发现写漏了关键信息 → 修任务书并在 issue 评论 @工作者，不私聊补丁。

## 六、平台协作纪律（7.14 情报，依据 platform-capabilities.md）

1. **单驾驶员**：平台项目仅创建者可对话/编辑/发布 → 7.24 前定唯一驾驶员（谁建主项目谁贴 prompt）；其余队员飞书邮箱加"共享查看/调试"。
2. **评委随访**：大赛评委随时可访问任一项目、不受权限约束 → 主项目任何时刻保持可演示；大改前确认可回退稳定版。
3. **沙盒前缀**：实验一律 `sandbox-` 前缀项目，主项目只进已验证的对话轮（HERMES-04 纪律提级为全局）。

## 七、日历锚点

7.23 **Gate 0**（弹药全齐）｜ 7.24 平台开放（HERMES-04 执行日）｜ 7.27 Gate 1（真机三板块）｜ 7.30 Gate 2 ｜ 7.31–8.2 深圳现场。
