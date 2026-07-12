# 追·光 LIGHTCHASER

> **抖音大区赛 · 赛道三「AI体验：刷到懂你的瞬间」参赛作品**（深圳 · 7.31–8.2 · 40h 黑客松）
>
> 一张出现在抖音信息流里的卡片：刷到的那一瞬间，你就知道**今晚值不值得为天空出门**——评分、机位、路线、拍法一次给齐。发现 → 判断 → 抵达 → 拍摄 → 发布，全程不离开信息流。

**产品结构**：抖音制造心动 → 追·光判断此刻是否值得行动并给最短路径 → 可颂承接机位/攻略/作品沉淀。
**最终交付形态**：抖音AI平台（douyin-ai.bytedance.net）Vibecoding 产出的 **feed 卡 + 小程序**（7.24 平台开放）。本仓库承载两件事：**① 初赛原型**（React 网页模拟，作为体验蓝本）；**② 大区赛弹药**（数据 / 算法 / 规格 / 提示词——"让平台 AI 写对代码的话"）。

---

## 快速开始

```bash
npm install
npm run dev:preview        # http://127.0.0.1:5174/  抖音 feed 模拟（上下滑视频/左右滑卡片）
npm run test:api           # API 响应形状断言
```

| 入口 | 地址 |
|---|---|
| 追·光 feed 原型 | `http://127.0.0.1:5174/` |
| **AI 相机** | `http://127.0.0.1:5174/ai-camera.html`（开发调试加 `?debug=1`） |
| 晚霞评分 API | `/api/sunset?city=shanghai` · `/api/sunset?lat=…&lng=…` · `/api/sunset?demo=high\|mid\|low` |
| 步行路线 API | `/api/route?startLat=…&startLng=…&endLat=…&endLng=…` |

**数据/算法弹药自检**（仓库根执行）：

```bash
# 机位库校验（25 个深圳机位）
PYTHONUTF8=1 python agents_output/01/validate_spots.py agents_output/01/spots.v1.json
# 太阳事件预计算（25 机位 × 18 天）
node agents_output/02/gen_sun_events.mjs
# 光线评分引擎自检（高/中/低三档 + 顺逆光判定）
node agents_output/02/light_engine.js --selftest
# 文案引擎盲测（需 agents_output/03/ark.env，见下"密钥"）
node agents_output/03/blind_test.mjs
```

---

## 仓库结构

```
├── api/  lib/  public/  scripts/    # 原型：feed 模拟、sunset/route API、AI 相机、光线演算
├── agents_output/                   # 大区赛弹药（每份交付带 checks/ 检查报告）
│   ├── 01/   机位库    深圳 25 机位 JSON + 校验脚本 + 坐标核验
│   ├── 02/   光线引擎  太阳预计算表 + 评分公式 v2 + 天气双预案
│   ├── 03/   文案引擎  豆包提示词 + few-shot + 27 格兜底 + ARK 盲测
│   └── 07/   外联工具  授权模板 + 台账 + 7.28 实拍路线 + 可颂采集 SOP
├── Thoughts/                        # 作战计划：AGENT_00–08 任务卡 + 总设计蓝图 v2（源头真理）
├── docs/                            # 文档（见下"文档导航"）
├── assets/                          # 初赛素材（大 zip 不入库）
├── _archive/                        # 已取代的历史文件（只读参考）
├── CLAUDE.md                        # 工程约定：技术栈/编码规范/检查清单/当前状态快照
└── DEVLOG.md                        # 开发日志（dated 流水，新条目置顶）
```

## 文档导航

| 想了解… | 读这个 |
|---|---|
| 产品立意 / 商业分析 | `docs/立意/思路.md` · `docs/立意/中文故事.md` |
| 赛道规则 / 评审维度 | `docs/赛道细则/instruction.md`（评审五维：体验完整性 30% 最高） |
| 开发流程 / 治理规范 | `docs/追光_Agent开发规范.md`（16 节） |
| 作战总纲 / Gate 判定 | `Thoughts/AGENT_00_总控.md` · `Thoughts/追光_总设计蓝图_v2.md` |
| 各切片任务卡 | `Thoughts/AGENT_01…08_*.md`（目标/交付物/DoD/检查任务/红线） |
| 初赛交接 / 部署 | `docs/role-b-*.md` · `docs/deployment-runbook.md` 等 |
| 工程约定 / 环境 | `CLAUDE.md` |
| 进度 / 历史决策 | `DEVLOG.md` + [Issues](../../issues) |

---

## 开发工作流

```
GitHub issue → feat/* 分支 → 产出 + checks/检查报告 → PR(main) → 人工审阅合并
```

- 每个切片对应一个 issue；PR body 链接检查报告；**AI 不自行 merge**。
- 动原型代码（`api/ lib/ public/ scripts/`）必须 `npm run test:api` 绿。
- **红线**（详见规范 §2）：不编造地点/数据；不搬他人样张/文案（授权三件套制度）；密钥不入库；交付无检查报告 = 未交付。

**密钥**：`agents_output/03/ark.env`（火山 ARK API key）已被 gitignore，**不在仓库里**——需要跑盲测的队友找 key 持有人私下获取，格式见 `agents_output/03/blind_test.mjs` 头部注释。

## 关键日历

| 节点 | 日期 | 内容 |
|---|---|---|
| Gate 0 | **7.23** | 弹药齐备（AGENT_01/02/03/04/05 DoD 全勾 + 授权 ≥15 或降级） |
| 平台开放 | **7.24** | 抖音AI平台权限开放；当天完成十二问能力测绘（AGENT_06） |
| Gate 1 | **7.27** | 真机抖音扫码四页跑通（一票否决） |
| 抵深实拍 | **7.28** | 深圳湾—人才公园线 5 机位（路线：`agents_output/07/reshoot_plan_0728.md`） |
| Gate 2 | **7.30** | 陌生人盲测：5 秒看懂、60 秒完成一次互动 |
| 现场赛 | **7.31–8.2** | D1 20:00 开赛 → D2 18:00 海报截止 → D3 12:00 提交、14–17 游园会 |

## 团队

2 人协作（H1 工程线 / H2 数据内容线）+ AI agent 编队产弹药。分工与运行规则见 `Thoughts/AGENT_00_总控.md §3/§5`。
