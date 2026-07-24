# HERMES-11 ｜ 板块二 GL 招牌：3D 光影地图上的照片气泡社区层

> **补票任务书（retroactive）**——实现先行（5358349 决策者指示直入 main），本书事后固化 DoD 与验收口径。审计与修复走 `feat/hermes-11-f6-badge-tails`，证据见 `agents_output/11/checks/check_report_11.md`。

- **受众**：AI 编码代理
- **状态**：已交付（补票验收，check_report_11）
- **时间窗**：原相位二 committed；实际 7.24 直入 main + 同日补票审计修复
- **占用文件**：`public/light-map-gl.jsx`（气泡层全部逻辑）+ `public/app.jsx`（仅 Row1 子页二接线处）；数据复用 HERMES-10 的 `agents_output/10/photos.v1.json` 与 `/api/photos`（本任务零改动 api/lib）

## 0. 为什么做

板块二招牌 = GL 3D 光影楼群，社区 = 照片气泡。HERMES-10 p2 已在 2D Leaflet 版把"实时冒泡"跑通，但演示主视图是 GL 版——气泡不上 GL，评委看到的招牌页就没有社区。本任务把气泡层移植进 `SceneLightMapGL`，让"光影楼群 + 附近的人刚拍到什么"在一页内成形。

## 1. 目标

- GL 地图内建 3s 轮询 `/api/photos`，照片气泡直接落在 3D 楼群上（冒泡/退出动效、is-live 高亮、点击 easeTo 聚焦）。
- `app.jsx` Row1 子页二切换为 GL 版；GL 不可用时兜底链保持可达。
- 视觉与红线同规 2D 版：追光橘配色、swipe-lock 隔离、XSS 转义、F6"示例"可见角标（`agents_output/10/bubble_spec.md` §7）。

## 2. DoD（验收标准，二元）

1. [ ] 3s 轮询 `/api/photos`：新条目 ≤3s 冒泡上图（pop 动效，无整页重载）。
2. [ ] 已见 id 去重 + 首拉不集体标新（primed 机制，种子不上演"刚发布"）。
3. [ ] 签名未变跳过重渲染（id+is_live 签名比对，轮询不抖动 DOM）。
4. [ ] `document.hidden` 时跳过拉取，且轮询链继续排程、回前台自动恢复。
5. [ ] 气泡带始终可见"示例 / 刚发布·演示"角标（F6 / bubble_spec §7：不得只靠 hover/title 披露）。
6. [ ] 地图容器与横滑控件 `data-swipe-lock` 隔离，拖地图不切 feed 页。
7. [ ] 兜底链可达：GL 失败 → Three 自研版 → SceneRoute（app.jsx 侧 GL 组件缺失也直落 SceneRoute）。
8. [ ] 配色守追光橘体系（`var(--accent)` / `rgba(255,138,61,*)`），无蓝色残留。
9. [ ] consent `image_only` 双过滤（lib/photos-service 服务端 + GL 客户端各一道）。
10. [ ] 注入字段全部经 `zgEscapeHtml` 转义（place/caption/时间文案），无 XSS 通路。
11. [ ] cleanup 无泄漏：卸载时清 timer/RAF/markers/map 实例。
12. [ ] `npm run test:api` 绿 + Babel JSX 转译门（app.jsx / light-map-gl.jsx）绿。

## 3. 已知后置项（如实列，不算本任务失败）

- 兜底路径（Three 自研版 / SceneRoute）无照片气泡层——只保招牌 GL 路径有社区。
- 2D `photo-map.jsx` 成死代码待裁决（保留=A/B 对比素材，裁撤=另开切片）。
- 聚合簇（bubble_spec §2）后置，GL 版当前上限 20 条直铺。
- 存量气泡的时间角标不随轮询刷新（marker 复用只更新 class/位置，不重建 HTML）。
- e2e（`scripts/e2e/light-map-route-page.mjs`）需网络瓦片 + Playwright 依赖，CI 内不稳定。

## 4. 红线（同 AGENT_00 F6 / bubble_spec）

- 垫图/演示记录必须带可见"示例"标注；不得把种子冒充真实 UGC。
- 演示前必跑 `refresh_photo_times.mjs` + `validate_photos.mjs` 0 error。
- 不碰评分引擎、路由链路、api/lib（本任务只消费 `/api/photos`）。
