# AGENT_04 检查报告（体验规格 + 原型 v1.1）

产出物：`tokens.md`、`first5s_spec.md`、`page_specs.md`、`fidelity_scorecard.md`、`.claude/skills/zhuiguang-design/SKILL.md`（设计判断引擎，MIT 改编）+ **原型 v1.1 代码**（`public/light-map-3d.jsx` 新增、`app.jsx`/`subpanels.jsx`/`追·光.html` 改动、`public/legacy-v1/` 1.0 快照、`vendor/three.min.js`）。
执行者：人机结对（用户已拍板三方向）｜ 日期：2026-07-12 ｜ H1 验收 ｜ issue #13。

## 用户拍板记录（2026-07-12，覆盖旧文档口径）
1. **P1 封面不动；时间条交互弃用**（推翻 AGENT_00 §2 / v2 蓝图"时间条=灵魂"旧口径）。
2. **P2 = 主战场**：实时 3D 光影地图（issue #12 愿景提前落地）。
3. **P4 直接嵌入 vision-engine**（非跳转）。
4. **改 UI 必须保留 1.0**：已双保险——`public/legacy-v1/` 物理快照 + GitHub Release [`lightchaser-v1.0`](https://github.com/Suaiii/LIGHTCHASER/releases/tag/lightchaser-v1.0)（tag 于合流前节点 347b4d9）。

## 交付条件（DoD）自评
| 条目 | 结论 | 证据 |
|---|---|---|
| C1 原型 v1.1 四页真机可走 | ◐ 编译级通过 | 7 个 jsx 经 vendored Babel 预编译全过 + `test:api` 绿；**真机浏览器走查待人工**（`npm run dev:preview`）。"时间条手感保留"条款随口径变更作废 |
| C2 tokens 表可让陌生人复述关键值 | ✅ | `tokens.md`：主色 #ff8a3d / 8 锚点色卡全表 / 卡片圆角 18 / 时间条相关动效已弃用、三档动效 120/350/420ms |
| C3 first5s 与原型逐帧无冲突 | ◐ | 规范已定稿；P1 未动（用户指示），§3 三处违规**修复与否待用户确认边界**；录屏逐帧核待人工 |
| C4 page_specs 字段绑定零缺口 | ✅ | 每个页面元素均指向 `spots`/`sun_events`/引擎输出或标注"静态/演示"；P2 3D 的 `meta.sun.current` 原型 API 已供给 |
| C5 边界态四种全规格 | ✅ | page_specs 边界态总表（低分/雨天/夜间/断网 × 四页）+ 3D 的"已日落"微光模式 |
| C6 评分卡模板无歧义 | ⏳ 待人工 | `fidelity_scorecard.md` 就绪，需 H1/H2 各试填一次 |

## 检查任务
- **K1 真机录屏**：⏳ 待人工（dev-preview → 四页走查 + 3D 拖拽/缩放/自转 + P4 滤镜切换/AI chip）。
- **K2 陌生人复述测试**：⏳ 待人工（只给 tokens+first5s 文档）。
- **K3 字段咬合矩阵**：✅ 内嵌于 page_specs 各表（元素→字段逐行对应）。
- **K4 新组件降级方案**：✅ 3D 地图三层降级（WebGL失败→自动回退经典 SceneRoute；reduced-motion→关自转脉动；Tweaks 可手动切 classic）；P3 悬浮窗/罗盘降级仍在 page_specs（顶部收起条/静态箭头）。
- **K5 用 first5s 反检初赛封面**：✅ 找到 **3 处**违规（cardFloatIn 动画化评分 / ScrollHint 挡首屏 4.5s / 加载分数跳变），证据行号在 `first5s_spec.md §3`——修复动作待用户确认"封面不动"的边界。

## 技术说明与风险
- **Three.js r128 UMD**（vendored 603KB, MIT）：拖拽自实现（未引 OrbitControls）；shadow map 1024、dpr≤1.5、体块 ≤46 个（控性能）。
- **vision-engine 依赖**：COCO-SSD 模型 init 可能需网络加载（tfjs）；P4 的 AI chip 失败时**静默回退"构图引擎"口径**，演示永不空/永不假。
- **附近追光者光点 = 演示数据**，HUD 明确标注"演示"（F3 红线：不冒充真实）。
- **手势**：仅 canvas 锁滑动，底部结论卡为换页通道——防导航陷阱（Gate 2 走查 #2）。
- 设计 skill 迁移自 StyleSeed/UI Craft（均 MIT，已注明出处），按 F1 重加权：前 5 秒信息效率占 30 分 + payload 永不动画化为最高反规则。

## 遗留（open）
1. P1 三处前 5 秒违规修复边界——**待用户一句话确认**（修 or 连 bug 级也不动）。
2. C1/C3/C6/K1/K2 人工项（真机走查约 15 分钟）。
3. Figma 四页高保真稿（AGENT_04 §5 交付物之一，供平台导入）——建议以 v1.1 原型截图为底另排。
4. P3 罗盘/悬浮窗组件未在原型实现（规格已备，平台版 R7 轮实现）。
