# 追·光 2.0 — 项目说明（CLAUDE.md）

> 抖音大区赛 **赛道三｜AI体验：刷到懂你的瞬间**（深圳 7.31–8.2，40 小时黑客松）参赛项目。
> 产品：一张嵌在抖音信息流里、刷到即知"今晚值不值得为天空出门"的 **feed 卡 + 小程序**——抖音制造心动 → 追光判断此刻是否值得行动并给最短路径 → 可颂承接机位/攻略/作品。
> **作战计划以 `Thoughts/AGENT_00–08` 编队为准**（AGENT_00 是宪法）；赛道细则见 `instruction.md`。本文件是工程约定 + 当前状态。
> **（7.14 起）工作模式 = Hermes 工程**（`docs/hermes/README.md`）：用户=决策者；主会话 AI=Hermes（需求对齐→自包含任务书→issue 分发→DoD 验收），**不亲手做细节开发**；工作者（AI 代理/人，按任务书标注）执行。第一性原理=赛题评审锚点："用户在刷到的一瞬间，是否就能被打动、被满足，并自然产生一次互动或使用？"

---

## 1｜技术栈与版本

### 本机工具链
| 用途 | 工具 | 版本 / 位置 | 备注 |
|---|---|---|---|
| 脚本/生成器/校验(JS) | Node.js | **v24.14.1** | 含 global `fetch`，可直连 Open-Meteo / OSM Nominatim |
| 校验脚本(Python) | Python(anaconda) | **3.12.7** @ `E:\anaconda\python.exe` | 跑 `.py` 用全路径 + `PYTHONUTF8=1`（否则中文 print 在 Git Bash 显 GBK 乱码）。⚠️ 系统 `py`/Store `python` 已损坏，勿用 |
| 太阳几何 | suncalc | ^1.9.0 | 仓库根 `node_modules/suncalc`；脚本相对路径引用，纯几何离线 |
| 坐标核验 | OSM Nominatim | Web API | 反查/正查，限速 1.1s/请求 |

### 原型（仓库根即原型根：api/ lib/ public/ scripts/；main 已含队友的 AI 相机系统）
- **React 18**（dev UMD，vendored 于 `public/vendor/`）+ **Babel Standalone**（浏览器内 JSX 转译，无构建步骤）
- **Leaflet**（地图，vendored）
- **无打包器**：纯静态 + `scripts/dev-preview.js` 本地服务
- 外部 API：**Open-Meteo**（天气）、**OSRM** `router.project-osrm.org`（步行路线）
- serverless 风格 handler：`api/sunset.js`、`api/route.js`

### 目标产品运行时（大区赛最终交付，**不在本仓库**）
- **抖音AI平台** `douyin-ai.bytedance.net`：Vibecoding 生成"自定义 feed 卡 + 小程序"
- **豆包生成模型** `@Doubao-seed-2.1-pro`（文本/图片）；平台 **Skills / 工具 / 知识库 / 数据库表**
- 7.24 开放平台权限。**我们不写产品代码，我们写"让平台 AI 写对代码的话"**（规格/数据/提示词即产品）。

---

## 2｜项目结构

> **（2026-07-12 合流）唯一仓库 = `github.com/Suaiii/LIGHTCHASER`，本目录即其 clone 根**。原型代码与大区赛弹药同库共存；`Thoughts/`+`agents_output/` 为规范固化目录（不改名）。

```
追光2.0/  (= LIGHTCHASER 仓库根)
├── README.md              # LIGHTCHASER 原文 + 追·光2.0 大区赛导航（合并版）
├── CLAUDE.md / DEVLOG.md  # 工程约定 / 开发日志（新条目置顶）
│
├── api/ lib/ public/ scripts/   # 原型代码（React feed 模拟 + sunset/route API + AI相机[队友]）
├── package.json                 # deps: suncalc; scripts: dev:preview / test:api 等
│
├── docs/                  # LIGHTCHASER 原有交接文档 + 大区赛文档（合并）
│   ├── 追光_Agent开发规范.md      # 开发流程与治理规范（16 节）
│   ├── 立意/{思路.md, 中文故事.md}
│   ├── 赛道细则/                  # instruction.md(.pdf) + 截图 ×11
│   └── role-b-*.md 等             # 初赛交接/路演/部署文档
│
├── Thoughts/              # 作战计划：AGENT_00–08 编队 + 总设计蓝图 v2（源头真理）
├── agents_output/         # agent 交付物：01 机位库 / 02 光线引擎 / 03 文案引擎 / 07 外联工具件
├── assets/                # 初赛原始素材（zip 已 gitignore）
└── _archive/              # 已取代/外部项（归档不删）
```

---

## 3｜编码规范

**JavaScript**
- 2 空格缩进；分号保留；函数/变量 `camelCase`；React 组件 `PascalCase`。
- 模块：`lib/` 用 CommonJS（`module.exports`）；`agents_output/` 脚本用 ES module（`.mjs`）。
- 纯函数优先、可离线、可复算（评分/几何类尤其）。

**数据（JSON）**
- 字段名 `snake_case`：`spot_id`、`cloud_low`、`best_window`、`azimuth_10min`。
- 机位 id：`场景前缀-三位序号`，前缀 `szw`(晚霞/滨海) `szs`(天际线) `sze`(展览) `szc`(咖啡)，如 `szw-001`。
- 枚举锁定：`scene ∈ {sunset,skyline,exhibition,cafe}`；`compose_template ∈ {thirds,leading,silhouette,frame}`。
- 卡片文案：`copy_slots.hook ≤26字`，`tip1/2/3 ≤15字`。

**注释与命名**
- 中文注释 OK 且鼓励；注释解释**"为什么"**而非"是什么"。
- 每个脚本文件头一行：用途 + 用法；agent 脚本标注所属 **AGENT 编号**。
- 描述性命名，避免歧义缩写。

**红线（不可逾越，源自 AGENT_00 F6/§8）**
- 不编造地点/数据：无把握写保守版并标 `待核` + 置信度。
- 不搬他人样张/文案：`sample_img/credit/consent_ref` 三件套同空或同非空，非空时 `consent_ref` 指向 AGENT_07 授权台账行号。
- 评分因子/规格改动只在指定"调参口"，**不加维度**（可解释优先于拟合）。
- 每份交付物必附 `checks/check_report_XX.md`，DoD 二元、K 任务带证据；**无检查报告 = 未交付**。

---

## 4｜本地怎么跑 / 怎么测

**原型（仓库根即原型根）**
```bash
npm install
npm run dev:preview      # → http://127.0.0.1:5174/  （前端 + /api/sunset + /api/route）
npm run test:api         # test-sunset.js：API 响应形状断言
# AI 相机（队友）: http://127.0.0.1:5174/ai-camera.html  （debug: ?debug=1）
# API 示例: /api/sunset?city=shanghai  /api/sunset?demo=high|mid|low
```

**agents_output 校验 / 生成 / 自检**（在仓库根执行）
```bash
# 机位库校验（原生 python；乱码时加 PYTHONUTF8=1）
PYTHONUTF8=1 /e/anaconda/python.exe agents_output/01/validate_spots.py agents_output/01/spots.v1.json
node agents_output/01/validate_spots.mjs agents_output/01/spots.v1.json   # 等价 Node 版

# 坐标外部核验（OSM 反查，约 30s）
node agents_output/01/checks/geo_verify.mjs

# 太阳事件预计算（25 机位 × 18 天 → sun_events.v1.json）
node agents_output/02/gen_sun_events.mjs

# 光线引擎自检（评分三档 + 光位四象限 + 极端输入）
node agents_output/02/light_engine.js --selftest

# 评分回测（真实 Open-Meteo 深圳天气）
node agents_output/02/checks/backtest_c6.mjs
```

---

## 5｜提交前检查清单

> **（7.12 合流）唯一仓库 = `github.com/Suaiii/LIGHTCHASER`**，所有改动（代码+弹药+文档）都在此体现。交付流程 = **issue → feat/* 分支 → PR(目标 main) → 人工审阅合并**（AI 不自行 merge），check_report 链接进 PR body。zhuiguang-2.0 已废弃归档。

1. [ ] **校验跑绿**：`validate_spots.py` 原生 0 error；`light_engine --selftest` 三档正常；生成器 0 缺行。
2. [ ] **检查报告更新**：对应 `checks/check_report_XX.md` DoD 逐条二元、K 任务带真实证据（脚本输出/链接）。
3. [ ] **数据一致性**：01↔02 `spot_id` 集合一致（idMatch=true）；schema 改动同步 readme 与下游。
4. [ ] **真实性红线**：无编造坐标/数据（不确定标 `待核`+置信度）；无搬运样张/文案；三件套规则满足。
5. [ ] **坐标核验**：新增/改动机位过 `geo_verify.mjs`（落正确深圳区县）。
6. [ ] **文案约束**：`hook ≤26字` / `tip ≤15字`。
7. [ ] **编码规范**：字段 `snake_case`、id 前缀规范、文件头用途注释、注释讲"为什么"。
8. [ ] **更新 DEVLOG.md**：这次做了什么 + 当前遗留问题。
9. [ ] **git 流程**：切片有对应 issue；改动在 feat/* 分支；PR 目标 main、body 链 check_report；不直推 main（基建类除外）。动原型代码（api/lib/public/scripts）时 `npm run test:api` 必须绿。

---

## 6｜当前状态与遗留问题（快照 · 2026-07-14）

**（7.14）Hermes 工程开张**：主开发切任务分发制，看板与任务书在 `docs/hermes/`（issues [#16–#21](https://github.com/Suaiii/LIGHTCHASER/issues)）。首批 6 任务对应"恰到好处"四问：01 导航走反路(P0)、02 算法置信度+竞品对标(P0)、03 3D 光域提案制(排队)、04 平台上下文字段级测绘(7.24)、05 出片场景扩展先导(不急)、06 原型收尾包。**AGENT_04 原型 v1.1 已交付**（P2=GL 光影地图 v4.6：真实瓦片建筑+太阳光照+生长动画；3D 真机楼消失遗留 → `docs/3d光影地图-交接文档.md` 工作者进行中）。Hermes 主线：AGENT_05 需求包（与用户结对）+ AGENT_08 叙事。

**已交付（唯一仓库 LIGHTCHASER；详见各 checks 报告 + issue）**
- ✅ **AGENT_01 机位库**：深圳 25 机位（配比 14/4/5/2），校验 0 error，25/25 坐标 OSM 反查核验（曾纠正 szw-012 跨境错误）。
- ◐ **AGENT_02 光线引擎**：**数据层✅**（sun_events 450 条 / 评分 v2 / 双预案 / C6 客观排序）。**UI 待升级**：3D 光影地图愿景 → [issue #12](https://github.com/Suaiii/LIGHTCHASER/issues/12) backlog；可行部分并入 AGENT_04。
- ✅ **AGENT_03 文案引擎**（[issue #10](https://github.com/Suaiii/LIGHTCHASER/issues/10)）：提示词 8 硬规则 + 10 组真实机位 few-shot + 27 格兜底 + **ARK 真跑盲测**（doubao-seed-2.0-pro：三轮迭代 4→5→**8/10 C1达标**，**幻觉 0/40 C2达标**）。⑤⑥语气盲评待人工；平台 seed-2.1 复测挂 AGENT_06 K3。
- ✅ **AGENT_07 工具件**（[issue #9](https://github.com/Suaiii/LIGHTCHASER/issues/9)）：三平台私信模板/台账/访谈提纲/7.28 实拍路线 + 可颂采集 SOP（[#11](https://github.com/Suaiii/LIGHTCHASER/issues/11) 已关：Playwright 可用）。**发送是人的活，今天就能开始。**
- 🎥 **AI 相机系统（队友，main）**：vision-engine + photo-renderer worker + 授权滤镜 + capture demo（`/ai-camera.html`）。

**仓库合流（7.12）**：zhuiguang-2.0 已废弃归档，全部内容经 `feat/zhuiguang-2.0-import` 分支并入 LIGHTCHASER（本目录即其 clone）；issue 迁移为 [#9–#13](https://github.com/Suaiii/LIGHTCHASER/issues)。[PR #8](https://github.com/Suaiii/LIGHTCHASER/pull/8)（zys→main，2 个初赛提交）仍**待人工处理**。

**当前遗留问题（open）**
| # | 问题 | 状态 | 归属 |
|---|---|---|---|
| 1 | 30m 级站位 + 步导图 | 待 **7.28 实拍**（路线表已备） | 实拍窗（既定） |
| 2 | C6 主观打分 / C2 日落截图归档 | 各 5 分钟人工 | H1/H2 |
| 3 | 样张三件套（25/25 空） | 模板已备，**待发送外联** | H2 主抓 |
| 4 | AGENT_03 ⑤⑥语气人工盲评 | ~20 分钟，两人对 blind_test_results | H1/H2 |
| 5 | 可颂采集 | 工具链✅(Playwright)；**待 scrape_targets.txt 首批分享链接** | 人收链接→AI 走查 |
| 6 | 天气 A/B 选型、豆包平台内复测 | 待 **AGENT_06 7.24 测绘** | AGENT_06 |
| 7 | 待人工 merge：合流 PR（import）、PR #8 | AI 不自行合并 | H1/H2 |

**下一步候选**：AGENT_04 体验规格（Gate 0 关键路径，需 H1 结对，含光引擎 UI 可行升级）→ AGENT_05 需求包 ／ AGENT_08 叙事起草 ／ 可颂首批采集（拿到链接即做）。

> 完整 dated 流水见 `DEVLOG.md`。关键日历见 `Thoughts/AGENT_00_总控.md §4`（7.23 Gate 0 / 7.24 平台开放 / 7.27 Gate 1 / 7.30 Gate 2）。
