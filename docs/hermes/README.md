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

**开源优先（负责人定调）**：动手前先找开源替代/公共服务（例证：MapLibre GL 让 3D 地图一步到位），自研是最后手段；自研前须在交付报告说明"找过什么轮子、为什么不能用"。许可核对与 vendored 规则见 `CLAUDE.md` §3。

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

产品最终形态 = 抖音 AI 平台 vibecoding 产出的 **feed 卡 + 小程序**（7.24 平台开放后在平台内生成，**不在本仓库写产品代码**）。本仓库一切工作都是它的上游，四条线汇入一个漏斗：

```
弹药线（数据/算法/文案）──┐
原型线（体验蓝本，本仓库）─┼─→ AGENT_05 需求包（“让平台AI写对代码的话”=产品的源代码）
叙事线（路演/商业延展）───┘        ↓
人工线（外联/实拍/盲评）→ 素材注入   7.25–7.27 平台内 vibecoding → Gate 1 真机四页 → 7.31 现场
```

| 线 | Part | 状态 | 去哪看 |
|---|---|---|---|
| 弹药 | 机位库 25 点 / 光线引擎 / 文案引擎 | ✅ 已交付 | `agents_output/01 02 03` |
| 弹药 | 晚霞算法置信度 + 多源 + 竞品对标 | **待领（开发）** | HERMES-02 |
| 弹药 | 历史爆发日回测（命中率真值证据） | **待领（H2 收集日期 + AI 回测）** | HERMES-08 |
| 弹药 | 出片场景扩展（schema+泛化筛选设计） | 待领（设计稿先行） | HERMES-05 |
| 原型 | 步行导航走反路根治 | **待领（开发）** | HERMES-01 |
| 原型 | 3D 楼群消失（真机）+ WebGL 恢复 | 进行中 | `docs/3d光影地图-交接文档.md` + HERMES-07 |
| 原型 | 3D 光域高亮"哪里有光" | 排队（等上行结案） | HERMES-03 |
| 原型 | P1 前5秒 / P3 / P4 相机收尾 | **待领（开发）** | HERMES-06 |
| 平台 | 上下文字段级测绘 | 7.24 执行（人） | HERMES-04 |
| 平台 | **需求包 = 产品本体的"源代码"** | Hermes+决策者结对中（7.14–7.22） | `Thoughts/AGENT_05_Vibecoding需求包.md` |
| 平台 | vibecoding 落地 feed 卡+四页 | 7.25–7.27（依赖 04/05/06 测绘） | 平台内，非本仓库 |
| 叙事 | 路演脚本 / 海报 / 商业延展 | Hermes 起草（7.15–7.27） | `Thoughts/AGENT_08_*` |
| 人工 | 外联发送 / 可颂链接收集 / 7.28 实拍 / 盲评 / PR merge | 人工池 | `CLAUDE.md` §6 遗留表 |

> 一句话回答"开发 part 有哪些"：**现在可领的纯开发 = 01 / 02 / 06 三个**（07 进行中、03 排队）；**最大的开发 part 是产品本体**，但它的"编码"发生在 7.24 后的平台对话里，源代码=需求包（Hermes 主线，不外包）。

## 四、看板

| 任务 | 受众 | 优先级 | 时间窗 | 状态 | Issue | 占用文件 |
|---|---|---|---|---|---|---|
| [HERMES-01 导航走反路根治](HERMES-01-routing-foot.md) | AI | **P0**（演示可信度） | 7.14–7.17 | 待领 | [#16](https://github.com/Suaiii/LIGHTCHASER/issues/16) | lib/route-service.js, api/route.js, docs/page_specs.md(P2节) |
| [HERMES-02 晚霞算法置信度+多源+竞品对标](HERMES-02-confidence.md) | AI | **P0**（AI×产品 15%+叙事弹药） | 7.15–7.20 | 待领 | [#17](https://github.com/Suaiii/LIGHTCHASER/issues/17) | api/sunset.js, lib/sunset-service.js, agents_output/02/checks/*新增 |
| [HERMES-03 3D 光域高亮层（提案制）](HERMES-03-light-zone.md) | AI | P1 | 7.18–7.22 | 进行中（开源调研/提案） | [#18](https://github.com/Suaiii/LIGHTCHASER/issues/18) | public/light-map-gl.jsx, scripts/e2e/, docs/hermes/HERMES-03-提案.md |
| [HERMES-04 平台上下文字段级测绘](HERMES-04-context-matrix.md) | 人+AI | **P0**（7.24 唯一窗口） | 清单即备，7.24 执行 | 待领 | [#19](https://github.com/Suaiii/LIGHTCHASER/issues/19) | agents_output/06/*新增 |
| [HERMES-05 出片场景扩展先导](HERMES-05-scene-expansion.md) | 混合 | P2（用户定调：不急） | 设计 7.16–7.20 | 待领 | [#20](https://github.com/Suaiii/LIGHTCHASER/issues/20) | agents_output/01/*（schema 设计稿新增，不改 spots.v1.json 主体） |
| [HERMES-06 原型收尾包](HERMES-06-proto-polish.md) | AI | P1 | 7.15–7.19 | 待领 | [#21](https://github.com/Suaiii/LIGHTCHASER/issues/21) | public/app.jsx, public/subpanels.jsx, public/追·光.html |
| 3D 真机楼消失（存量，交接文档制） | AI | P0 | 进行中 | 进行中（PR #15 已合并，收尾并入 HERMES-07） | — | public/light-map-gl.jsx |
| [HERMES-07 GL 楼群消失捕获与动画恢复](HERMES-07-webgl-recovery.md) | AI | **P0** | 7.14 起 | 进行中（完成后走新 PR） | [#22](https://github.com/Suaiii/LIGHTCHASER/issues/22) | public/light-map-gl.jsx, scripts/e2e/webgl-recovery.mjs |
| [HERMES-08 历史爆发日回测](HERMES-08-history-backtest.md) | 混合（H2 日期 + AI 回测） | P1（叙事硬证据） | A 7.15–7.18 / B 7.18–7.20 | 待领 | [#23](https://github.com/Suaiii/LIGHTCHASER/issues/23) | agents_output/02/burst_days.v1.json, checks/backtest_history.* （新增，引擎零改动） |

> 状态由 Hermes 维护；工作者只改任务书内自己的"状态"行 + issue 评论。

## 五、验收纪律（Hermes 自律）

1. DoD 逐条**亲自跑**，不采信工作者自述；跑不通=打回并把失败输出贴进 issue。
2. 验收看两层：DoD 过了没（功能）+ 红线破了没（真实性/调参口/占用文件越界）。
3. 每次验收在 PR 留痕：`DoD n/n ✅/❌ + 证据`。
4. 任务书发出后发现写漏了关键信息 → 修任务书并在 issue 评论 @工作者，不私聊补丁。

## 六、日历锚点

7.23 **Gate 0**（弹药全齐）｜ 7.24 平台开放（HERMES-04 执行日）｜ 7.27 Gate 1（真机四页）｜ 7.30 Gate 2 ｜ 7.31–8.2 深圳现场。
