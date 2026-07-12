# LIGHTCHASER

A repository for the Douyin hackathon project.

## Role B Bootstrap

This branch adds the initial Role B data layer:

- `/api/sunset` serverless endpoint
- Open-Meteo live weather integration
- SunCalc golden hour and sunset timing
- Sunset scoring logic
- `high / mid / low` demo datasets
- Shanghai POI recommendation set, with Los Angeles kept as backup
- Fallback demo payload when live fetch fails

## Quick Start

```bash
npm install
npm test
npm run dev:preview
```

Open the integrated frontend and backend preview:

```text
http://127.0.0.1:5174/
```

Open the AI camera:

```text
http://127.0.0.1:5174/ai-camera.html
```

The AI camera uses the browser camera as the primary input. It presents a full-screen viewfinder with instant shutter capture, grid and ratio controls, camera switching when available, local recent-photo review, and AI composition/filter variants generated after the shot. Developer-only media upload and `metadata.json` export are available with:

```text
http://127.0.0.1:5174/ai-camera.html?debug=1
```

The same local server also handles:

```text
http://127.0.0.1:5174/api/sunset?city=shanghai
http://127.0.0.1:5174/api/sunset?demo=high
```

## API Examples

```bash
/api/sunset
/api/sunset?city=shanghai
/api/sunset?lat=31.2304&lng=121.4737
/api/sunset?demo=high
/api/sunset?demo=mid
/api/sunset?demo=low
```

See [docs/role-b-handoff.md](/E:/aNB/Hackson/LIGHTCHASER/docs/role-b-handoff.md) for the Role B handoff details.

Frontend integration details are in [docs/frontend-api-guide.md](/E:/aNB/Hackson/LIGHTCHASER/docs/frontend-api-guide.md).

The current frontend prototype lives in [public/追·光.html](/E:/aNB/Hackson/LIGHTCHASER/public/追·光.html) and loads the React/Babel JSX files in [public/](/E:/aNB/Hackson/LIGHTCHASER/public). Local video assets are under [public/assets/videos](/E:/aNB/Hackson/LIGHTCHASER/public/assets/videos).

Deployment and roadshow notes:

- [docs/deployment-runbook.md](/E:/aNB/Hackson/LIGHTCHASER/docs/deployment-runbook.md)
- [docs/roadshow-tech-script.md](/E:/aNB/Hackson/LIGHTCHASER/docs/roadshow-tech-script.md)

---

## 追·光 2.0 · 大区赛导航

> 抖音大区赛 **赛道三｜AI体验：刷到懂你的瞬间**（深圳 · 40 小时黑客松）参赛项目。
> 一句话：一张真实出现在抖音信息流里的卡片，让人刷到的那一瞬间就被"今晚深圳值不值得为天空出门"打动，并顺手完成一次互动——**发现→判断→抵达→拍摄→发布，全程不离开信息流**。

---

## 从哪读起

| 想了解… | 读这个 |
|---|---|
| **项目是什么、立意** | `docs/立意/思路.md` · `docs/立意/中文故事.md` |
| **赛道规则/评审维度** | `docs/赛道细则/instruction.md`（正文为截图） |
| **怎么开发、规范** | `docs/追光_Agent开发规范.md`（16 节流程与治理）· `CLAUDE.md`（工程约定/技术栈/怎么跑） |
| **作战计划** | `Thoughts/AGENT_00_总控.md`（宪法）· `Thoughts/追光_总设计蓝图_v2.md`（蓝图） |
| **已交付的数据/算法** | `agents_output/01/`（机位库）· `agents_output/02/`（光线引擎） |
| **进度流水** | `DEVLOG.md` |

## 快速跑

```bash
# 原型预览（仓库根即原型根）
npm install && npm run dev:preview   # → http://127.0.0.1:5174/

# 数据/算法弹药自检（仓库根执行）
PYTHONUTF8=1 /e/anaconda/python.exe agents_output/01/validate_spots.py agents_output/01/spots.v1.json
node agents_output/02/light_engine.js --selftest
node agents_output/02/gen_sun_events.mjs
```

## 现状（2026-07-12）

- ✅ 已交付：`AGENT_01 机位库`（深圳 25 机位，坐标经反查核验）、`AGENT_02 光线引擎`（评分公式 v2 + 太阳预计算 + 天气双预案）。
- ✅ 已产：`docs/追光_Agent开发规范.md`（16 节开发规范）。
- 🔜 下一步候选：`AGENT_03 文案引擎` / `AGENT_04 体验规格`。详见 `DEVLOG.md` 与开发规范 §16。
- ⏳ 关键节点：**7.24 抖音AI平台开放** → 现场 40h 黑客松。最终产品在平台上以 vibecoding 产出（feed 卡 + 小程序），本仓库产出的是"让平台 AI 写对代码的话"。
