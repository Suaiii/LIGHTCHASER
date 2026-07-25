# check_report_11 ｜ HERMES-11 GL 气泡层（补票验收 · 2026-07-24）

> 对应任务书：`docs/hermes/HERMES-11-gl-bubble-community.md`（补票）。
> 实现已入 main（5358349 / 726da2d）；本报告在 `feat/hermes-11-f6-badge-tails` 上完成审计确认 + 4 项修复后出具。
> 行号基线：本分支当前工作树（修复后）。

## DoD 逐条判定

| # | DoD | 判定 | 证据 |
|---|---|---|---|
| 1 | 3s 轮询，新条目 ≤3s 冒泡 | ✅ | 代码审阅确认：`public/light-map-gl.jsx:524`（pullPhotos）+ `:554`（finally 中 `setTimeout(pullPhotos, 3000)` 链式排程）+ `:790`（map load 后首拉）；新 id 走 `is-live` pop 动效（`:541` isLive 判定，`:870` zgPhotoPop keyframes） |
| 2 | 已见 id 去重 + 首拉不集体标新 | ✅ | 代码审阅确认：`light-map-gl.jsx:464`（seenPhotoIds Set）、`:541`（`isLive = photosPrimed && !seenPhotoIds.has(id)`——首拉 photosPrimed=false 全部非 live）、`:544-545`（拉后统一记已见 + primed=true） |
| 3 | 签名未变跳重渲染 | ✅ | 代码审阅确认：`light-map-gl.jsx:72-74`（zgPhotoSignature = id+is_live 拼接）、`:546-549`（`nextSignature !== photoSignature` 才 renderPhotoMarkers） |
| 4 | document.hidden 跳过拉取且轮询恢复 | ✅（本次修复） | `light-map-gl.jsx:526-531`：hidden 早退前先 `photoPollTimer = setTimeout(pullPhotos, 3000)` 重新排程——只跳 fetch 不断链，回前台下一 tick 自然恢复（与 2D 版 `photo-map.jsx:318` 同规；2D 用 setInterval 天然续排，GL 是 setTimeout 链故须显式续排） |
| 5 | 气泡可见"示例/刚发布·演示"角标 | ✅（本次修复） | `light-map-gl.jsx:79-84`：`badge = post.is_live ? "刚发布 · 演示" : \`示例 · ${zgPhotoTime(...)}\``——"示例"置于文案头部始终可见，时间为次要信息；不再只写时间、不依赖 title 属性（F6/bubble_spec §7）。角标沿用 `.zg-photo-badge` class（`:878`，仅 max-width 64→96px 防时间被截，无新增配色）。与 2D 版同规（`photo-map.jsx:200` 「刚发布·演示/示例」） |
| 6 | swipe-lock 隔离 | ✅ | 代码审阅确认：`light-map-gl.jsx:864`（地图容器 `data-swipe-lock="true"`）、`:919`（机位 chips 横滑区同标） |
| 7 | 兜底链可达（GL→SceneRoute） | ✅ | 代码审阅确认：`light-map-gl.jsx:858-859`（mode=three → Scene3DLightMap）→ `light-map-3d.jsx:511-512`（failed → SceneRoute）；app.jsx 侧 `:540/:549`（SceneLightMapGL 非函数直落 SceneRoute）。注：兜底路径无照片层，任务书已列后置项 |
| 8 | 配色追光橘无蓝残留 | ✅ | 代码审阅确认：气泡/按钮体系全部 `rgba(255,138,61,*)`（`light-map-gl.jsx:873,874,896,911`）+ chips `var(--accent)`（`:923`）；角标底 `#303848` 为既有深灰非蓝主色调残留 |
| 9 | consent image_only 双过滤 | ✅ | 代码审阅确认：服务端 `lib/photos-service.js:41` + GL 客户端 `light-map-gl.jsx:538` 各一道 `consent_scope !== "image_only"`；当前种子 20 条全为 `feed_card_ok`（规则性预埋） |
| 10 | XSS 转义 | ✅ | 代码审阅确认：`light-map-gl.jsx:28-34`（zgEscapeHtml 转 & < > "）；注入字段 place/caption/时间文案均过转义（`:77,78,81`），innerHTML 消费点 `:497` 只吃转义后模板 |
| 11 | cleanup 无泄漏 | ✅ | 代码审阅确认：`light-map-gl.jsx:847-854`：disposed 置位 + clearTimeout(failTimer/idleTimer/photoPollTimer) + cancelAnimationFrame + clearPhotoMarkers()（`:474-477`）+ map.remove() |
| 12 | test:api 绿 + JSX 门绿 | ✅（本次实跑） | 见下方"自验命令实录" |

**DoD 12/12 ✅**

## 本次修复清单（4 项）

1. **F6 示例角标**：`light-map-gl.jsx:76-87` zgPhotoBubbleHtml——角标从「仅时间/刚发布」改为「刚发布 · 演示」/「示例 · X小时前」，"示例"始终可见（修前只在 title 属性有 caption，属 hover 披露，违 bubble_spec §7）。
2. **hidden 守卫**：`light-map-gl.jsx:526-531` pullPhotos 头部加 `document.hidden` 早退 + 续排 3s。
3. **死键**：`app.jsx:541-548` 删除 `onSwitchClassic={() => {}}` 空传；`light-map-gl.jsx:893-901` "快导航"按钮改条件渲染（`typeof onSwitchClassic === "function"` 才出现）。SceneLightMapGL 全仓唯一使用点即 app.jsx:541（grep 确认），其余 mount 场景不存在，行为不变。
4. **种子刷新**：`node agents_output/10/refresh_photo_times.mjs` 改写 `photos.v1.json` taken_at 至今日窗口。

## 自验命令实录（2026-07-24，仓库根）

```text
$ node agents_output/10/refresh_photo_times.mjs
refresh_photo_times: date=2026-07-24 placeholders=20 today=3 real_unchanged=0
EXIT=0

$ node agents_output/10/validate_photos.mjs agents_output/10/photos.v1.json
记录数: 20 / 引用 spot 数: 20 / 时间基准: 2026-07-24; 今天: 3; 本周: 18
Errors: 0  Warnings: 0  === PASS (0 error) ===
EXIT=0

$ node <scratchpad>/jsx-gate.mjs   # vendored public/vendor/babel.min.js, preset react
OK  public/app.jsx (32859 chars)
OK  public/light-map-gl.jsx (52131 chars)
EXIT=0

$ npm run test:api
default-shanghai / demo-high / demo-high-jinshan-gps / demo-mid / demo-low /
live-shanghai / live-la / route-jinshan 全部输出形状正常（route: osrm-foot 1478m）
EXIT=0
```

## 未跑 / 跳过（诚实标注）

- **浏览器运行时 e2e 未跑**：`scripts/e2e/light-map-route-page.mjs` 依赖 Playwright，`node_modules` 无 playwright/puppeteer，且本次禁止安装依赖——跳过：依赖缺失。气泡 DOM/动效未在真浏览器复核，靠代码审阅 + JSX 门 + 2D 版同构逻辑背书。
- 存量气泡角标文案不随轮询刷新（marker 复用只改 class/位置）——任务书后置项，非本次修复范围。
