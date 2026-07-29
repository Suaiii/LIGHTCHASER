# 开发日志 · 追·光 2.0

> Dated 流水，记录每次开发做了什么、关键决策、遇到的问题、下一步。稳定的工程约定见 `CLAUDE.md`。新条目置顶。

---

## 2026-07-29 · GL 3D 地图完全迁移包（round5）+ 六场景包并入 platform-prompts

- **素材包归位**：六场景封面卡包从 `agents_output/09/design/` **整体迁到 `platform-prompts/materials/feed-six/`**（git rename 识别，无重复副本），R2-07 提示词路径同步。理由：平台上传件应集中在 platform-prompts 下，agents_output 留给交付物本体。
- **GL 全量迁移包**（新）：`platform-prompts/round5-GL全量迁移/` 总纲 + 6 步提示词（01 地图上机 / 02 夜幕调色板 / 03 3D楼群与太阳光 / 04 照片气泡与聚合 / 05 路线金线与终点 / 06 HUD与真实性徽标），每步带时间盒、验收二元表、失败分支与掉档动作。
- **迁移规格**（`materials/gl/gl-migration-spec.md`，新）：四档目标（A Three真光影 / **A− fill-extrusion 招牌线** / B 平台地图 / C 录屏）+ 相机与 LOD + 确定性调色板全表 + 太阳几何与 7 锚点光色 + 3D 两条路线 + 气泡聚合 + 路线层 + HUD + **16 条真机坑清单** + 实测基线。坑清单是全包最值钱的部分——全部来自源码注释里记录的真实故障，不是预防性猜测。
- **真源码进包**：`materials/gl/source/light-map-gl.jsx`（1038 行 v4.9）+ 抽出的依赖 `zg-sun-helpers.js`（太阳几何 + 光色插值）。打法定为"**能传源码就先传源码**"——注释里写满了每个数值为什么是这个数。
- **真机四态截图**（`materials/gl/screenshots/`）：Playwright 抓本地原型真实渲染（开场 z14.65 / 拉远 z12.6 剪影 / 拉近 z15.3 立体楼群受光背光分明 / 高俯角 pitch70 天际光晕），相机参数逐张记入规格 §11 供平台对照。非合成图。
- **打包** `gl-migration-kit.zip`（2.1MB，21 件，含目录映射说明 README.txt；包内文件名改英文避免压缩包乱码）。
- 定调写进总纲：**招牌线是 A−，不是 A**。Three 自定义层的风险全在共享 WebGL 上下文（坑 4–10），做不动立刻停手，别为 A 赌掉已经成立的 A−。

---

## 2026-07-29 · PR#45 六场景封面卡 → 平台素材包 + R2-07 提示词

- **PR 归并**：#45（队友六种城市光线首页稿）合入 main；合前扫过那个 2.38MB SVG（`<script`/`foreignObject`/`javascript:`/`onload=`/外链 href 全 0 命中）。顺手发现 #43 合于 `b46804b`、**`6ccde07`（聚合搬平台三件套）从未进 main**——另开 #46 补合。两个 PR 均已合，open 清零。
- **素材包**（`agents_output/09/design/feed-six-scenes/`）：把 1450×1994 的六卡拼版拆成平台吃得下的件——6 张单卡 SVG（430×860 自包含）、6 张 2x PNG（Playwright 渲染，860×1720，**首选上传件**）、6 张纯背景 JPEG、`scenes.json`（文案槽位结构化）、`card_spec.md`（坐标/色值/字号全表 + 数据绑定 + 已知偏差）。同步进 `materials/feed-six/`，打包 `feed-six-scenes-kit.zip`（12MB，22 件）。
- **提示词**（`platform-prompts/round2-B档打磨/07-封面卡六场景.md`）：**三段分发**——①照着一张 PNG 做单卡版式（三层遮罩顺序是重点，那层 0.10 紫橙调是六张异源照片统一色温的关键）②给 scenes.json 换数据复用成六张 ③单独发「示例数据」角标。一次贴完它会把六张平均成四不像。
- **如实记录三处问题**（写进 spec §5 与 README，未擅改队友的稿）：①强调色 `#ff9f40` 与 token 追光橘 `#ff8a3d` 冲突、另引入酒红系，与"唯一强调色"相悖；②**六张卡零「示例/演示」角标**，而分数/倒计时/距离全是编的值（F6 红线，上平台前必补）；③6 张照片 credit/consent_ref 全空，场景 06 夜市图含可辨认人脸 + 招牌手机号，对外前须换图或打码；六个机位名不在 spots.v1.json 的 25 条内。
- 场景面覆盖：光线 3（蓝调/云隙/日出）+ 生活 3（慢行/围炉/夜市）——scene 枚举解冻扩展的第一份视觉证据。

---

## 2026-07-26 · 聚合上平台：规格订正 + R2-06 提示词 + 真交互录屏

- 决策者验收通过后追问"怎么搬上抖音 AI 平台"。三件套落库：
  1. **规格订正**（`agents_output/10/bubble_spec.md §2`，materials 副本同步）：原文写"用屏幕距离聚合"——平台 AI 照抄会**复现我们刚修掉的两个坑**。改为地面米数换算公式 + 不可见点剔除（60km/地平线带/投影翻折）+ **★定位与动画分层**红字警告（`animation-fill-mode: both` 覆盖 Marker 定位，最易复发）。
  2. **提示词**（`platform-prompts/round2-B档打磨/06-气泡聚合.md`，按现有 R2 体例）：第一段做聚合（含换算公式与外观数值）、**第二段单发避坑**（分层 + 不可见点剔除）、验收 5 条含"没有任何一堆叠在角落"、附我方实测基线表。
  3. **真交互录屏**（`agents_output/09/motion/media/video-04-cluster-zoom.webm`，18s，ffmpeg 压至 1.2MB）：缩小合簇→放大散簇→点击展开；motion_spec 补第 10 条（招牌档，已录）。同步进 materials 上传包。
- 用法：录屏 + bubble_spec 一起上传，让平台"照着视频做"，比纯文字管用（R2-01 同款打法）。

---

## 2026-07-26 · 真机验收打回：气泡定位隐性缺陷修复（聚合二版）

- 决策者真机截图：气泡叠在屏幕左上角、完全不在地点上。排查出**三层问题**（前两层是我这次聚合引入，第三层是 HERMES-11 移植以来一直存在的隐性缺陷）：
  1. **聚合口径错**：按 `map.project` 屏幕像素合簇，pitch 62° 下地平线带几公里被压成几像素 → 相隔十几公里的照片误并、簇心落到无意义位置。改为**按地面米数合簇**（`CLUSTER_PX × metersPerPixel(zoom,lat)`，与俯角无关），阈值 58→72px（含下方地名标签宽度，真机调）。
  2. **远景不剔除**：照片种子全在深圳（22.47–22.59°N），地图落在上海兜底 payload（30.71°N）时气泡糊在地平线上"假装有内容"。新增 60km 剔除 + 地平线带剔除（投影点低于画面 16% 高度 + `project→unproject` 往返 <60m 判未翻折）。
  3. **★ 定位失效（真凶）**：气泡入场动画 `animation: zgPhotoIn … both` 带 transform 关键帧，**fill-mode both 让动画终态 transform 永久覆盖 MapLibre 写在同一元素上的定位 transform** → 自 HERMES-11 移植进 GL 起，所有气泡一直叠在地图容器左上角，从未落到真实坐标（2D 版无此问题）。修法：**定位与动画分层**——外层 `.zg-photo-holder` 只承 Marker 定位（无动画），内层按钮只承动画。
- 验证（Playwright 真浏览器，逐个量 rect 而非只看 style）：修复前 10 个气泡 rect 全部 (0,0) 重叠；修复后 z12.6 → 4 个气泡分别落在蛇口/深圳湾体育中心/华侨城真实位置、含 1 个"2 张照片"聚合泡；z10.5 → 6 标记（含 5 簇）铺开；上海视角 → 0 气泡。pageerror 0；JSX 门 OK；`test:api` EXIT=0。
- 已知取舍：开场 zoom 14.65 视野只有几百米深、照片云在 7–13km 外，故开场几乎看不到气泡（诚实行为，非 bug）。若要开场即见社区感，需另议开场机位（拉远或把镜头放在照片云上方）——**未擅改，待决策者定**。

---

## 2026-07-26 · GL 照片气泡聚合（Apple 相册地图式，决策者提需）

- 痛点：缩小地图时气泡不缩不合，20 个原尺寸气泡压叠在一起"太古怪"。
- 方案：**屏幕空间贪心聚合**（`light-map-gl.jsx`）——每次 moveend 后把投影距离 <58px 的气泡合成"照片叠"聚合泡（两张错角白卡垫底 + 追光橘计数角标 + `N 张照片`标签），点击放大 1.6 级自动散簇；不用 MapLibre 原生 cluster source（会丢 DOM Marker 的 F6 角标与冒泡动效；20 条数据 O(n²) 足够便宜）。闲置自转每帧发 moveend 用中心/缩放变化门槛过滤。
- **F6**：聚合不消灭"示例/演示"标注——聚合泡角标=`示例 · N 张`（含 live 时 `演示 · N 张`）。
- 验证（Playwright 真浏览器）：z14.65 → 17 标记(2 簇)；z10.5 → **6 标记(5 簇)**；放大回 z15.2 → 17 标记复原；点聚合泡 zoom 10.5→12.1；pageerror 0；JSX 门 OK；`test:api` EXIT=0。
- 平台侧移植提示：该行为写进 09 包 p2 重建指令时作为动效/交互规格之一。

---

## 2026-07-25 · 真封面纠偏：p1-cover 三件套 + 背景图素材入包

- 决策者二次纠偏：Figma 捕获的仍是 Row0 抖音壳首屏，**真封面=下刷一条的打分+背景图卡（SceneSunsetCard，静安寺底图+87徽章+大标语）**。
- 交付（`agents_output/09/design/`）：`p1-cover.png` 干净版 / `p1-cover-annotated.png` **元素自动圈注版**（9 标注：评分徽章/等级标签/AI标语/峰值行/机位名/距离/左滑引导/导航按钮/背景图区）/ `p1-cover-annotations.json` 坐标 / `p1-cover-annotation.md` 逐元素数据绑定清单 / `assets/jingansi-card-bg.jpeg` 背景图素材（平台缺此素材，需单独上传）。
- 定位：平台 Figma 导入路线之外的主参照——标注图+清单直接发平台 AI 照着搭；Figma 真封面重捕获待 MCP 额度恢复（figma_link.md 现版本仍为 Row0 壳，已知偏差）。

---

## 2026-07-25 · B-Figma 子项交付（重做版）：真原型像素捕获进 Figma

- 背景：#19 测绘发现平台吃 zip 只能简单组装、完成度差 → 补 Figma 稿走导入路线。**首版 AI 手搓矢量重建被决策者否决**（观感不达标；原型有现成渲染没理由不用）——路线更正为真原型像素捕获。
- 交付：Playwright 把原型开到「高分87 · 南科大 · 深圳」态 → 注入 html-to-design capture.js（浏览器走本机代理）→ 捕获进 Figma `LlblsSeYUHAPfiXdUBH0C7?node-id=9-2`，像素级还原原型封面本尊。
- **p2 追·光地图退出 Figma 路线**（决策者裁定：GL 场景平台横竖自渲染，Figma 中转截图无意义）；p2 参照物=截图+录屏。
- 遗留（figma_link.md §路线更正 3/4 条）：手搓旧两帧待决策者在 Figma UI 手删；Figma MCP Starter 额度恰在捕获完成后用尽，AI 侧验收截图未出，请决策者开链接肉眼验收。人工两步不变：开 Share 权限 → 平台试导入回填 #19。

---

## 2026-07-24 · R-0724-B 落地：feed 两页化

- `public/app.jsx` Row1 摘除 SceneQuickShoot 挂载、colLabels 收为「封面 / 追·光地图」，feed 定稿两页（封面钩子卡 + 追·光地图，拍摄页出局；组件定义留 subpanels.jsx 不删，`publishedVideoMode` 成死变量仅注释暂留）。
- 口径连锁：HERMES-09 任务书 B 包全部改两页口径（feed/p1/p2，D-b 开关落定 R-0724-B，四页/三页作废）；看板 06 行清相机（R-0724-A，PR #29 已关）。
- 本分支基于 `feat/hermes-11-f6-badge-tails` 叠放，合并顺序：先合 #39。

---

## 2026-07-24 · 负责人三连裁定：相机挂死 / feed 定稿两页 / GL 不承诺（master-plan-0723 §7）

- **R-0724-A** 追光相机动不了、不回装（7.18 P-3 终局确认）；**R-0724-B** feed 最终样式=两页（封面钩子卡+追·光地图），拍摄页出局，B 包截图/Figma 口径随改（四页→三页→**两页**定稿）；**R-0724-C** GL 3D=尽力而为不承诺，判定点=#19 测绘真机，跑不动则 ripcord 回装 2D ScenePhotoMap，叙事以 2D 也成立为底。
- 同步动作：原型两页化+09 任务书口径改写=派发工作流出 PR；#25/#19 issue 已留对齐注记；本节裁定原拟随 PR #37 合流，因 #37 先行合并改随 PR #39 搭车。

---

## 2026-07-24 · HERMES-11 补票：F6 示例角标+hidden 守卫+死键修复+种子刷新

- **F6 红线修复**：GL 气泡角标改为与 2D 同规——live=「刚发布 · 演示」、垫图种子=「示例 · X小时前」，"示例"始终可见不再只靠 title hover（bubble_spec §7；`light-map-gl.jsx` zgPhotoBubbleHtml，角标 max-width 64→96px 防时间截断，无新增配色）。
- **hidden 守卫**：GL 版 pullPhotos 头部加 `document.hidden` 早退且续排 3s setTimeout 链（后台省请求，回前台下一 tick 自动恢复，对齐 2D 版）。
- **死键修复**：`app.jsx` 不再给 SceneLightMapGL 传空 `onSwitchClassic`；GL HUD"快导航"按钮改条件渲染（无 handler 即不出现）。
- **种子刷新**：`refresh_photo_times.mjs` 改写 photos.v1.json 至今日窗口（placeholders=20 today=3），validate 0 error。
- **补票文档**：`docs/hermes/HERMES-11-gl-bubble-community.md`（retroactive 任务书，12 条二元 DoD+后置项如实列）+ `agents_output/11/checks/check_report_11.md`（12/12 ✅，e2e 因 Playwright 依赖缺失如实标跳过）。自验：JSX 门/test:api/validate 全 EXIT=0。

---

## 2026-07-24 · HERMES-11 提前落地：气泡层移植 GL 3D 地图，合流入 main

- 照片气泡层从 2D `photo-map.jsx` 移植进 `SceneLightMapGL`：GL 组件内建 3s 轮询 `/api/photos`，气泡直接落 3D 光影楼群上（冒泡/退出动效、is-live 高亮圈、点击 easeTo 聚焦），`app.jsx` Row1 第二子页切换为 GL 版（GL 不可用兜底 SceneRoute）。板块二"GL 光影地图 × 照片社区"至此在一页内成形，HERMES-11（原相位二 committed）视为提前交付。
- 开场 zoom 钳到 LOD 起点上方，修掉长路线全览只剩剪影楼的开场；新增 e2e 冒烟 `scripts/e2e/light-map-route-page.mjs`。
- 决策者指示直接合入 main（726da2d，含 HERMES-10 p2 全量）；`npm run test:api` EXIT=0。
- 剩余：聚合簇后置；GL 版三段动效录屏（生长+冒泡+光照切换，供 HERMES-09 C 包）；cartocdn/openfreemap 真机可达性今天顺 HERMES-04 验证。

---

## 2026-07-23 晚 · HERMES-10 p2 收尾：实时冒泡+种子接线+日夜双主题

- 新增 `lib/photos-service.js` + `api/photos.js`：GET 按 `taken_at` 降序返回种子 20 条（spot_name 联表非空），POST 追加 live 照片（深圳坐标围栏，异地 400 `photos_api_invalid_coords`），`scripts/dev-preview.js` 挂载路由。
- `public/photo-map.jsx` 3s 轮询 `/api/photos`，新照片 `is_live` 冒泡上图；`scripts/post-demo-photo.mjs` 供演示/录屏手动触发投稿。
- 日/夜双主题落地：负责人拍板"暗+橘主视觉、日间白、蓝改橘"。
- 验证结论：validate_photos 0 error（基准 2026-07-23，今天 3/本周 18）；端点 GET/POST/围栏/UTF-8 全 PASS（POST 后 count 20→21 且首条即 live 记录）；Babel JSX 门 OK；CJS require OK；`npm run test:api` 8 组全绿 EXIT=0。证据全文见 `agents_output/10/checks/check_report_10.md`「p2 收尾（2026-07-23 晚）」。
- 剩余：聚合簇后置；动效三段录屏待人工触发；cartocdn 真机可达性 7.24 验证。

---

## 2026-07-23 · 官方兴趣卡方法论对表 + 竞猜卡升级提案 + 重排（master-plan-0723）

### 输入
负责人提供抖音官方「AI 兴趣卡」业务分享 + 平台创作教程截图 ×30（`docs/7.23细分/`，feat/docs-0723-notes 分支）——评委自己的产品方法论、判卷标准与操作手册。

### 判定三连
- **方向：对，且被加强**。两轴与官方"首卡抓停留→落地页延展"同构；生活方式/旅游文旅在官方推荐选题表内；离线预计算/规则评分/评测链恰是官方方法论逐条要求的资产。
- **落后：是，约两天**。09 五包未落库、10-p2 零代码、plan 文档停在未合流分支；7.22 权限/测绘仓库无痕。但教程把测绘变"照单执行"，7.24 起平台内动手可追。
- **升级提案 ★P-1**：钩子卡 → 「今晚烧天竞猜卡」（AI 概率+押注点击+当晚开奖+明日回访）——「今晚这场日落」=天然"单场比赛"信息单元，光线引擎=胜率预测同构物。★P-2：叙事切换为评委自己的框架。

### 新硬约束（写进任务书）
标题 ≤10 字／行动按钮 ≤5 字／卡上交互仅点击／性能红线／1 队 1 作品／**发布审核有周期 → 7.30 提交死线**（48h 缓冲）。

### 遗留
§5 六问待负责人今晚作答（7.22 权限实况/竞猜卡拍板/审核时长/扫码授权数据边界/对谈站授权/队友气泡下落）；两文档分支待开 PR 合流 main。

---

## 2026-07-18 · v4 战略转向：从「晚霞导航工具」到「实时地理小社区」

### 负责人 office hour 拍板
晋级第一性原理重定义＝**产品能不能真进抖音 feed 流、面对全国真实用户持续运转（进不去一切白搭）**。产品从"晚霞导航工具"转为**实时地理小社区**——对的时间点用"此刻此地正好有人/有事值得"轻拽你"这地方现在挺好玩，想去吗？"。结构**三板块→两轴**：①钩子 feed 卡 ②GL 3D 地图实时社区（招牌+核心，Campus 式附近内容气泡，导航降为轻功能）。

### 六裁定（P-1…P-6）
P-1 晚霞降差异化锋刃（天时过滤 UGC，02/05/08 重定位不废）｜P-2 demo 密度=条件题非死结（附近视频自带定位，双分支 A 真实密度/B 单城造密度，枢纽 HERMES-04 #13 探针）｜P-3 追光相机移出产品（连不到抖音内容生产界面，PR#29/06a-P4 归档，06a-P1 保留）｜P-4 核心是 GL 3D 地图非导航（HERMES-07 升关键路径 P0，HERMES-11 前移）｜P-5 商业故事保留为未来 roadmap、本期产品不做（非删除；本期价值叙事＝内容/流量/本地发现）｜P-6 GL 优先+2D 保底并行（覆盖 v3 纯 2D 先行）。

### 两路侦察实证（转向是顺势非推倒）
地图/天气/SunCalc/OSRM 已坐标无关全国可用；photos 自由散点全国就绪；焊死的只有 poi.js 机位库/light_engine 晚霞耦合/场景枚举 4 值锁+深圳 szw 前缀。全国化靠 UGC 自带定位天然覆盖，不人工穷举。

### 落地（本次提交）
新母文档 `docs/hermes/product-arch-v4.md`（v3 标注被取代）；README 看板/全景版图换两轴；HERMES-04/05/06/07/10 加 v4 增补横幅（04 探针提级/05 全国+生活场景升 P1/06 拆 06a-P1 保留·相机归档/07 升关键路径/10 score 通用化+坐标放宽）；商业口径"故事留作未来 roadmap、本期产品不做"横幅落 CLAUDE.md/AGENT_00 宪法/AGENT_08/思路.md（非删除，加标注）；decisions 置顶 P-0…P-6；first_prompt v1.4 delta 预告；open_questions #7 激活/#13 枢纽化/#17 降级/新增 #18。

### 未闭环 / 残留
- 商业故事按负责人 7.18 澄清＝**保留为未来 roadmap、本期产品不做（非删除）**，故不做"grep 净化"；中文故事.md、蓝图 v2 等历史立意档的商业段落由 CLAUDE/AGENT_00/思路.md/product-arch-v4 §5 权威横幅统一覆盖为"未来延展"，如需可再逐档补标注。
- GL 序（P-6）、商业替代叙事、两轴结构三项已随 plan 经负责人批准；7.22 用户信息边界 / 7.24 平台测绘定档双分支。
- first_prompt v1.4 只出预告，随 AGENT_05 第二轮一次改齐并重跑 K5/C1。

---

## 2026-07-14 深夜 · first_prompt v1.2（开局序列）+ 人工池残留归位

### C1 朗读裁定（负责人）
"仅凭这一份（v1.1）完全不行" → v1.1 作废盖戳，**v1.2 重构发布**（`agents_output/05/first_prompt.v1.2.md`）：R0 资产轮 8 次小粘贴（建表×5+挂规则+传参考，每步回声检查不过不进）→ R1 只做 feed 卡（照片底+信息浮层+@图片生成垫图+防硬编码验收）。K5 新口径=单次粘贴 ≤450 字。

### 状态更正与流程补洞
- 外联 7.13 已开始发送（负责人确认，快于台账）——CLAUDE.md §6 遗留表更正。
- **流程洞**：agent 侧 issue 结案时，人工执行残留失去 GitHub 追踪（负责人指出）→ 开人工池残留 issue 统一挂检查项（外联回收/盲评/C6+C2/可颂链接/7.28 实拍/PR#8）。

### 遗留
v1.2 的 C2/K3 双质检复跑；iteration_playbook（第二轮）；HERMES-09（#25）待领。

---

## 2026-07-14 晚 · 战法转向"资产先行"：平台六通道确认 + HERMES-09 迁移资产包

### 负责人输入（截图 3 张 = 平台官方《其他功能说明》）
Skills（数百预置+可自建）／工具／@生成模型（**含图片生成**）／知识库／数据库（**JSON 附件导入**）／上传文件（**文件图片视频**）／**Figma 链接导入**／扫码授权／协作权限（仅创建者可编辑发布；**评委随时可访问**）。提炼固化至 `docs/hermes/platform-capabilities.md`（7.24 回填边界数值）。

### 拍板（agents_output/05/decisions.md 条 5–8）
纯 prompt 路线**否决** → 资产先行+对话编排（R0 资产轮先于页面生成）；feed 卡**照片底 pivot**（剪影渐变=老黄历，素材链：授权样张>7.28 自摄>@图片生成垫底）；动效**一等公民**（规格清单+原型录屏直传平台）；六通道全纳入战法。

### 落地
1. **HERMES-09 迁移资产包**（`docs/hermes/HERMES-09-migration-kit.md`）：A 数据（五表 JSON+建表话术）/B 设计（保真清单+截图集+Figma 待拍板）/C 动效（规格清单+录屏）/D 提示词（平台可贴重排）/E Skill 草案（追光设计系统）——7.23 Gate 0 硬截止，开箱即传。
2. HERMES-04 增补 **§4b 迁移通道实弹清单**：6 通道拿 09 真资产测边界，不许口头问答代替。
3. README 看板 +09 行、新增"平台协作纪律"（单驾驶员/评委随访/沙盒前缀）；open_questions +4 条（#11 feed 卡能否动效=定上限之问）。

### 遗留
Figma 稿路线待负责人拍板（html.to.design 转换/人工重排/截图顶）；外联三件套升为 feed 卡素材刚需（模板已备待发送）；first_prompt v1.2 改稿+playbook 资产编排重构=第二轮结对。

---

## 2026-07-14 · P2 光影地图 v4.9：取消重叠层 + 快速移动降载

- 用户确认 v4.8 基本达成，但指出低 zoom 仍残留透明建筑、快速移动时偶发卡顿。
- 取消原生 `fill-extrusion` 与 Three 的重叠承接：低 zoom 只保留底图二维建筑，Three 缩回后完全不可见；高 zoom 的生长/缩回仅由 Three 负责。
- 单次 Three 构建上限由 1100 降为 650 栋，分帧批次由 80 降为 40；阴影贴图由 2048 降为 1024。
- `moveend` 重建等待由 450ms 降为 120ms，首建由 500ms 降为 240ms；路线脉冲重绘由隔帧降为每 4 帧一次。
- 低 zoom 截图已确认无透明 3D 残留，拉回高 zoom 后仅存在一套 Three 建筑。

---

## 2026-07-14 · P2 光影地图 v4.8：近距离 LOD + 去除双层残差

- 真机视频显示原生 `fill-extrusion` 与 Three 建筑在过渡期同时达到可见高度，两套瓦片批次不完全相同，形成重影、残差和错位。
- Three 生长区间由 `13.2–14.4` 推近到 `14.6–15.4`，减少单次视口建筑量，并让低 zoom 交回 MapLibre 原生层。
- 原生建筑只在 Three 生长最初 15% 内快速退场；Three 达到明显高度前已经结束双层叠加。
- 保留 zoom 直接驱动、视口半径过滤、近景优先、异步重建桥接和 WebGL 恢复机制。

---

## 2026-07-14 · P2 光影地图 v4.7：zoom 直接驱动建筑生长/缩回

- 真机反馈：范围稳定后，生长动画仍不能跟随手势，独立计时动画会追赶、延迟或在频繁缩放时重新起步。
- 根因：v4.6 仅以 `13.8` 为二元阈值，再播放 750/480ms 动画；动画时间轴与用户手指位置不是同一个状态源。
- 修复：建立 `13.2–14.4` 连续 LOD 过渡带，zoom 直接映射到建筑高度；原生剪影同步反向交叉淡化。手指停在哪里，建筑就停在对应高度。
- 保留：异步 Three 重建期间的原生建筑桥接层、视口范围过滤、近景距离优先和 WebGL 恢复机制。

---

## 2026-07-14 · 开源杠杆审计落地 + HERMES-08 历史回测重启（负责人拍板）

### 背景
负责人定调"**开源优先**"（例证：MapLibre GL 让 3D 地图一步到位），升格为工程原则（CLAUDE.md §3 新增节：先找轮子/许可三步/自研须说明缘由）。据此对全部在途任务做了一轮开源杠杆审计。

### 审计成果（已写进对应任务书）
- **HERMES-02 最大发现**：Open-Meteo **Ensemble API 集合预报**——成员离散度(spread)是气象学标准不确定性度量，免费、与现有数据源同生态，替代手拼多源成为置信度首选路线（多源交叉降为保底 A2）。
- HERMES-01：路由候选扩充 Valhalla（FOSSGIS）、openrouteservice——三条免费公共步行路由可轮换。
- HERMES-03：turf.js（BSD）做视线遮挡几何 + 先搜现成阳光地图项目，自研降为最后手段。
- HERMES-06：本地 HTTPS 证书改用 mkcert。
- **HERMES-04 追加"平台能否用开源库"三问**（CDN 引用/源码内联/内置地图组件），探针=suncalc（300 行 BSD）内联真机验证——答案直接决定 P2 迁移 A/B/C 档与需求包"开源件内联"策略（能内联=评分引擎/太阳几何原样进最终产品，算法零重写）。

### HERMES-08 历史爆发日回测重启（[#23](https://github.com/Suaiii/LIGHTCHASER/issues/23)）
负责人拍板："开源检测的效果不错，可以低成本重启。" 依据：Open-Meteo Historical API 免费提供 1940 至今逐小时历史天气（ERA5），成本只剩 H2 人工收集真值日期（爆发日 ≥15 + 哑火日 ≥10，逐条社媒证据）。与 HERMES-02 互补成完整可信度叙事：置信度答"这次多大把握"，回测答"历史上到底准不准"——评委问"算法准吗"的硬数字。已知风险预埋：ERA5 的 visibility 可能缺失，走引擎既有缺省路径并在报告注明。

### 当前 open 面板
Issues：HERMES #16–#23（#22 工作者进行中）；agent 系列 #9/#10/#12 已结案关闭。PR：仅 #8 待人工。

---

## 2026-07-14 · Hermes-07：GL 楼群消失捕获与动画恢复

### 当前问题
- v4.6 的 zoom-LOD 自动回归通过，但真实机器仍偶发整片 3D 楼群消失。
- 交接文档列出的首要嫌疑是 MapLibre 与 Three.js 共享 WebGL context 后发生 `webglcontextlost`；其次是瓦片长期未齐导致 `pendingMove` 等待。

### 本轮处理
- `public/light-map-gl.jsx` 增加 `window.__zgWebgl` 状态钩子：`ready`、`lost`、`restored`、`restore-failed`。
- 捕获 WebGL 丢失并在恢复时重置 Three 状态、刷新阴影；按当前 zoom 重新设置动画目标，从当前 `grow` 高度继续绝对时间轴，避免楼群永久停在地下。
- 新增 `scripts/e2e/webgl-recovery.mjs`：headed 浏览器记录恢复前后的 `__zgGrow`、`__zgB`、页面错误和截图。
- 新增 `docs/hermes/HERMES-07-webgl-recovery.md`，并登记到 `docs/hermes/README.md` 看板。
- 修正范围根因：`querySourceFeatures` 返回已加载瓦片而非仅当前屏幕建筑，旧代码无序截取前 1100 栋，远处瓦片会挤占前景名额；现在按视口半径过滤、按相机中心距离排序后再进入 Three 构建上限。

### 验证
- `node scripts/e2e/zoom-lod.mjs`：高 zoom 建筑存在，拉远/拉回动画连续通过。
- `node scripts/e2e/webgl-recovery.mjs`：合成 context lost/restored 后 `webgl=restored`，恢复后建筑 `1100` 栋/`122820` 顶点；连续一分钟交互后 `130548` 顶点；页面错误 `0`。
- `npm run test:api`：通过。

### 未闭环
- 仍需在真实 GPU 机器捕获一次自然发生的 context lost，并保存 `e2e-out/webgl-recovery.json` 与截图。
- 若真实机未发生 context lost，则继续取证 OpenFreeMap 瓦片 Network pending/失败和 `pendingMove` 是否长期未清除。

---

## 2026-07-14 · Hermes 工程开张：任务分发体系 + "恰到好处"质量线

### 用户拍板（工作模式重定义）
主会话 AI（Hermes）只做：需求对齐 → 自包含任务书 → issue 分发 → DoD 验收，**不亲手做细节开发**；工作者=AI 代理/人（混合）。第一性原理=赛题评审锚点（"刷到的一瞬间被打动、被满足"）。规划管理常驻仓库 `docs/hermes/`。

### 补上的主干："怎么确定足够'恰到好处'"四问
①平台能给什么上下文 ②晚霞算法准不准 ③行动路径够不够短（3D"哪里有光"不够 + 出片场景密度不够）④导航走反路。探索核实关键事实：**走反路头号嫌疑=官方 demo OSRM 服务器通常只有 car profile**（代码本身无 bug）；评分引擎无置信度输出；AGENT_06 问 8 未拆字段级；AGENT_05 无场景扩展条目。

### 做了什么
1. `docs/hermes/README.md`：角色/流程（任务书→issue→feat/*→PR→DoD 验收→用户 merge）、任务书模板（受众/背景自包含/二元 DoD/红线/占用文件防并行冲突）、看板。
2. 六份任务书 + issues [#16–#21]：01 导航走反路根治(P0/AI)、02 算法置信度+多源+竞品对标(P0/AI，评分公式零改动红线)、03 3D 光域高亮提案制(排队/AI，3秒看懂+不喧宾夺主)、04 平台上下文字段级测绘(P0/人+AI/7.24 一次性窗口，降级方案列直接喂 AGENT_05)、05 出片场景扩展先导(P2 不急/混合，schema v2+出片指数分层设计稿)、06 原型收尾包(P1/AI)。
3. CLAUDE.md 增补工作模式 + §6 快照；记忆 hermes-work-mode。

### 遗留/下一步
Hermes 主线=AGENT_05 需求包（与用户结对，7.14–7.22）+ AGENT_08 叙事；3D 真机楼消失=存量交接任务进行中（工作者在 feat/agent-04 改 context-lost 处理，本批提交未含其未提交改动）。

---

## 2026-07-13 · P2 光影地图 v4.6：建筑生长动画（用户定调"不舒服的关键"）

### 用户需求
LOD 硬切显隐=楼瞬间出现/蒸发，这是"很不舒服"的病灶。要求：放大到有建筑数据时楼**生长**出来，缩小**缩回**地里，由 zoom 控制、按数据源来。

### 实现
- 合批 mesh `scale.y` = 生长因子 grow（ExtrudeGeometry 原点在地面，天然从地里长出）；侧面法线水平不受 Y 缩放影响，光照安全。
- **绝对时间轴插值**（长 750ms / 缩 480ms，smoothstep 双向同曲线）：zoom 中途反转从当前高度接着走、零跳变——连续量天然抗临界抖动，滞回都不需要；低帧率设备掉帧自动追赶（增量式曾在 8fps 测试环境被拉长 2.5 倍）。
- 动画在 CustomLayer render() 里步进，`triggerRepaint` 自续；楼影 `ShadowMaterial.opacity = 0.3×grow` 同步淡入淡出；满高时才烘一次阴影贴图。
- 剪影层同步 450ms 透明度交叉淡化（替代 visibility 硬切）；首建登场走同一条生长曲线；缩到 0 才真正 `visible=false` 退场。
- 测试钩子 `window.__zgGrow`；采样改页面内 rAF 打点（headless 8fps 下跨进程采样漏帧）。

### 验证
zoom-lod：缩回 12 中间帧连续（0.98→0）、生长 16 中间帧连续（0.01→1）、低z旋转20次/高z旋转12次稳态正确、剪影交叉淡化状态全对；三项回归全绿；0 JS 错误。

---

## 2026-07-13 · P2 光影地图 v4.5：拉远/旋转消失根治——LOD 分级 + 未齐不换

### 用户反馈（v4.4 后）
稳定了一些，但拉远 + 旋转多了楼还是会消失。问：频率问题还是算法问题？→ **算法问题**（两个盲区）。

### 根因
1. **缺 LOD 分级**：矢量瓦片建筑数据只在 z≥13 存在、z13-14 稀疏。拉远后重建拿稀疏数据换装（1100→几十栋），旋转多了缓存瓦片逐出 → 全空。Three 精品层不该负责全城。
2. **残缺换装**：旋转到新扇区 450ms 就重建，瓦片未齐时部分数据也会替换完整楼群。

### 修复（v4.5）
- **双层 LOD**：z<13.8 剪影 extrusion 层上台（全 zoom 有数据、MapLibre 自动管瓦片），Three mesh `visible=false` 但**不销毁**——拉回 1.2s 内零重建恢复；显隐切换重烘一次阴影（否则贴图留旧影像=楼没影还在）。
- **未齐不换（pendingMove）**：已有完整楼群时，`areTilesLoaded` 未过不动旧楼，挂起等 sourcedata 到齐一次换准；仅首建与**远跳(>2km，旧楼已全在视口外，残缺也比空场强)**允许部分数据先立。
- **演示开场 zoom 钳制**（回归测试揪出的产品级 bug）：长路线 fitBounds 全览会落到 z≈12.8——开场只剩剪影楼，与"第一眼=光影楼群"叙事相悖。cameraForBounds+zoom 下限 14.05，路线出画交给缩略图。
- 离线包兜底加 z<LOD_Z 跳过；测试脚本改用 `__zgB` 真信号（HUD 徽标是 React 旧值，曾致假绿）。

### 验证（Playwright）
新增 zoom-lod.mjs：高z就位→拉远z12.6剪影上台→低z旋转20次+平移→拉回1.2s内楼群1100栋恢复→高z再旋12次稳定，全链路 PASS；三项回归（五连跳/旋转不变性/步进）复跑全绿；0 JS 错误。

---

## 2026-07-13 · P2 光影地图 v4.4：楼群消失根治 + 瘦身 + 半透明降调（图九反馈）

### 用户反馈（图九）
不抖了 ✓，但①有时 3D 楼整片刷没；②不丝滑；③代码要瘦身；④太亮太抢眼，要提高透明度。

### 根因（第一性排查，非表面修补）
1. **楼消失三连环**：moveend 600ms 后就 `querySourceFeatures`，但新视口**瓦片还没下完**=查空；查询前就记账 `lastCenter`，400m 门槛判"此处已建"永不重试；`setBuildings` 先删旧再建新，空数据=旧楼已删新楼为零。
2. **更深一层（诊断实测）**：`areTilesLoaded()` 有瞬时真值间隙，部分瓦片时查到 136 栋就建楼定格——瓦片是异步流，"到齐"必须听 `sourcedata(isSourceLoaded)` 事件，轮询是错误抽象。
3. **不丝滑**：r128 ExtrudeGeometry 本就非索引，`toNonIndexed()` 每栋打一条 console.warn（1100 条/次）；1100 栋几何主线程同步硬算 ~200ms；脉冲 `setData` 60fps 强制整图重绘。

### 修复（public/light-map-gl.jsx → v4.4）
- **事件驱动重建**：moveend 快速首响应 + `sourcedata` 到齐自动补建（带 `isMoving` 守卫，手势中不换装）；**只有建成才记账，查空保留旧楼**；先建后拆；离线包降为 12s 无楼兜底（按视口就近筛，曾整包顺序取楼挂错城区）。
- **丝滑**：删 toNonIndexed；几何分帧构建（80 栋/帧≈16ms，220 栋曾丢帧跳变）；脉冲隔帧更新；render() 复用 Matrix4；死 map 判活（分帧完成撞上组件重挂曾炸 getLayer）。
- **瘦身**：删 v3 起已无引用的 zgParseColor/zgRgbToHsl/zgHsl（~40 行）与失效 antialias 参数；历史注释压缩。
- **降调**：楼半透明（opacity 0.68，depthWrite 保持=前楼正常遮后楼、透出底图路网）；主光 1.25→0.95；envMap 0.5→0.35；地面影 0.42→0.30。画面最亮元素回归路线金线。

### 验证（Playwright 自动化，v4.4）
五连跳（塘朗→深大→后海→人才公园→回塘朗）楼群常驻、每跳真重建、回跳顶点数逐位一致（确定性）；旋转不变性 0.000%；步进 12 帧峰/均 1.3x 无闪烁；0 JS 错误。测试钩子 `window.__zgB`（换装时报告栋数/顶点数）。

### 遗留
医院区 fill-pattern 彩色残斑（需删层）；手机真相机需 HTTPS；PR #8 与 feat/agent-04 PR 待人工 merge。

---

## 2026-07-12 (三) · AGENT_04 体验规格 + v1.1 原型（3D 光影地图）

### 用户拍板（口径变更，覆盖旧文档）
- **P1 封面不动，时间条弃用**——推翻 AGENT_00 §2/v2"时间条=初赛灵魂"旧口径。
- **P2 = 主战场**：实时 3D 光影地图（backlog #12 愿景提前落地）。
- **P4 直接嵌 vision-engine**。改 UI 必须保留 1.0。

### 做了什么
1. **v1.0 释出**：GitHub Release `lightchaser-v1.0`（tag 于合流前 347b4d9）+ `public/legacy-v1/` 物理快照——1.0 双保险可回。
2. **设计 skill 迁移**：按用户指引考察 awesome-claude-code，从 StyleSeed（74规则/连贯性法则/评分门）与 UI Craft（Nielsen评分）精选改编为 `.claude/skills/zhuiguang-design`（MIT 注明出处）；按 F1 重加权——前5秒信息效率 30 分、payload 永不动画化。
3. **规格四件套**：tokens.md（8锚点色卡实测/字阶/圆角6级/动效三档）、first5s_spec.md（时序表+K5 反检出初赛封面 3 处违规）、page_specs.md（四页字段绑定+边界态）、fidelity_scorecard.md（逐页10项×3档）。
4. **P2 3D 光影地图**（`public/light-map-3d.jsx`，Three.js r128 vendored）：真实太阳方位/高度角驱动 DirectionalLight，建筑投影切出光可见区；OSRM 路线发光带；机位信标+演示光点（标注"演示"）；拖拽旋转/缩放/闲置自转；三层降级（WebGL失败→经典版/reduced-motion/Tweaks 手动切）。
5. **P4 嵌 vision-engine**：AI 场景识别 chip（失败回退"构图引擎"口径不冒充）+ 滤镜排 4 档（复用队友授权胶片缩略图，CSS 实时预览）。
6. **验证**：7 jsx Babel 预编译全过、test:api 绿。

### 遗留
P1 三处前5秒违规修复边界待用户确认；真机走查/评分卡试填等人工项（~15min）；Figma 稿待排。

---

## 2026-07-12 (二) · 仓库合流：唯一仓库 = LIGHTCHASER

### 背景
用户明确："永远只用一个仓库 github.com/Suaiii/LIGHTCHASER，所有改动都在上面体现"。此前同日建的 zhuiguang-2.0 双仓方案作废。

### 做了什么
1. **拉取队友工作**：main 领先的 7 个提交 = 完整 **AI 相机系统**（vision-engine.js 318行 + photo-renderer.worker + 授权滤镜缩略图 + test-ai-camera.js 446行 + `/ai-camera.html`，~11.8k 行）。
2. **submodule 反转**：absorbgitdirs 逆操作（.git/modules/prototype → prototype/.git，删 core.worktree），prototype 恢复独立仓库并切到最新 main。
3. **内容迁移 + 压平**：Thoughts/ agents_output/(01/02/03/07) assets/ _archive/ docs(子目录合并) CLAUDE/DEVLOG 迁入仓库；README 合并（LIGHTCHASER 原文+2.0导航）；.gitignore 合并（补 ark.env/zip/.claude）；prototype/* 整体上移，**本目录即 LIGHTCHASER clone 根**。douyin.pem 被 ACL 锁（owner 只读），icacls 授权后移出。
4. **路径修复**：gen_sun_events.mjs suncalc 路径 → `../../node_modules/suncalc`；README/CLAUDE 全部去 prototype 引用。
5. **GitHub 收尾**：5 个 issue 迁到 LIGHTCHASER（**#9 外联 / #10 文案 / #11 可颂[闭] / #12 3D光影backlog / #13 体验规格**）；旧 PR #6/#7 关闭注明去向；**zhuiguang-2.0 归档**（可逆，未删）。
6. **验证**：压平后全绿——sun_events 450/idMatch、validate 0 error、light_engine 三档、`npm run test:api` 过（队友代码无冲突）。

### 遗留
合流 PR（feat/zhuiguang-2.0-import → main）与 PR #8 待人工 merge。

---

## 2026-07-12 · git 基建 + AGENT_07/03 双交付 + 可颂工具链验证

### 做了什么
1. **git 基建（Step 0）**：根目录 git init → 推 [zhuiguang-2.0](https://github.com/Suaiii/zhuiguang-2.0)（private）；prototype 转 **submodule**（absorbgitdirs，保留 LIGHTCHASER 独立历史）；.gitignore 挡密钥/大 zip/node_modules；建 5 个跟踪 issue；规范§15 升级为 issue→branch→PR→merge 流程；LIGHTCHASER zys→main 复用既有 [PR #8](https://github.com/Suaiii/LIGHTCHASER/pull/8)（干跑无冲突，body 已补，**待人工合并**——合并动作被权限层正确拦下，AI 不自行 merge）。
2. **AGENT_07 外联工具件**（[PR #6](https://github.com/Suaiii/zhuiguang-2.0/pull/6)）：三平台私信模板+台账+访谈提纲+7.28 实拍路线（golden 18:37/日落 19:08 实测值）。
3. **AGENT_03 文案引擎**（[PR #7](https://github.com/Suaiii/zhuiguang-2.0/pull/7)）：**用用户提供的火山 ARK API 真跑豆包盲测**。三轮迭代：R1 4/10（发现 few-shot 自带幻觉源——样例里的 18:37 不在输入 JSON，模型学会编时刻；rubric① 对劝退场景误判）→ R2 5/10（幻觉清零，失败收敛为缺具体时间）→ R3 **8/10 C1 达标**；n40 终判**幻觉 0/40 C2 达标**（判分器修正：海堤/城市等通用词不作跨机位幻觉信号，误报核实后清零）。
4. **可颂采集工具链探测**（issue #3 已关）：无浏览器 MCP，但 Playwright 1.61.1+chromium 缓存可用 → SOP 交付（只取事实不搬图），待人收首批分享链接。

### 关键决策
- 2 人口径（H1/H2）正式确认；AGENT_02 改口径"数据层✅/UI 待升级"，3D 光影地图愿景入 issue #4 backlog。
- ARK key 存 `agents_output/03/ark.env`（gitignore 验证未入库）；本地盲测 seed-2.0 vs 平台 seed-2.1 差异显式标注，复测挂 AGENT_06 K3。
- AGENT_03 §9"连续两轮<8/10"曾形式触发：因失败模式已收敛至单一修复点，执行一轮定向修复后达标，全程留痕（check_report K2）。

### 遗留（open）
待人工：merge 三个 PR（LIGHTCHASER#8 / zhuiguang#6 / #7）、⑤⑥语气盲评（~20min）、外联发送启动（**最急**）、可颂 scrape_targets 首批链接。详见 CLAUDE.md §6。

---

## 2026-07-12 · 项目结构完整重整

### 做了什么
把有机生长出来的散乱结构完整重整为清晰目录（**归档不删、可回退**）：
- **docs/**：集中所有文档——`docs/追光_Agent开发规范.md`、`docs/立意/{思路,中文故事}.md`、`docs/赛道细则/{instruction.md,.pdf,image/}`。
- **prototype/**：初赛原型（原 `追·光/LIGHTCHASER/`，含自身 git repo）。
- **assets/**：初赛原始素材（视频/头像/静安寺 + zip、mmexport 图、uploads/scraps）。
- **_archive/**：`agent.md`（外部模板）、`追光_大区赛转型升级计划.md`（已被 v2 取代）、`光报/分工.pdf`、初赛散落 jsx + `追·光.html`（已被 prototype/public 取代）。
- **保留不动**：`Thoughts/`、`agents_output/`（规范已固化、脚本依赖），`CLAUDE.md`/`DEVLOG.md` 留根。
- 新增 **README.md** 导航入口；`追·光/` 空壳目录已删除。

### 遇到的问题与处理
- `set -e` 下移动 `思路.md` 遇 Git Bash 中文编码报错，一度只剩一份副本——核对为 5986 字节原内容无丢失（根与 Thoughts 两份原本相同），已放回 `docs/立意/思路.md`。
- `gen_sun_events.mjs` 有 3 处硬编码绝对路径（suncalc 指向旧 LIGHTCHASER）——改为**相对路径**（`../../prototype/node_modules/suncalc`、`../01/spots.v1.json`、`./sun_events.v1.json`），位置无关。
- 同步更新所有旧路径引用：`CLAUDE.md`（结构/运行/技术栈）、`docs/追光_Agent开发规范.md`（§1/§10/§15）、两份记忆文件（suncalc 路径 + 原型位置）。

### 验证
重整后重跑全部脚本仍绿：`gen_sun_events` 450 条 idMatch=true、`validate_spots.py` 原生 0 error、`light_engine --selftest` 100/66/29；agents_output 脚本无旧路径残留。

---

## 2026-07-12 · 适配《追·光 Agent 开发规范》

### 做了什么
- 派一个 general-purpose 子代理，把外部项目模板 `agent.md`（剧本工具的 16 节《Agent 开发规范》）的**结构骨架**适配到追·光，产出 `追光_Agent开发规范.md`（新文件，未覆盖 `agent.md`，未建外部目录树）。
- 内容取自 `Thoughts/AGENT_00`（宪法）+ `追光_总设计蓝图_v2`（Parts/阶段/Gate）+ `CLAUDE.md`（约定）+ AGENT_01–08。逐节核对关键事实，全部对齐源文件，验收通过。

### 关键判断 / 冲突处理（如实标注，未强行统一）
- **团队 2 vs 3 人**：AGENT_00 说"两人 H1/H2、A/B/C 作废"，v2 用"三人五 Part"。规范保留五 Part（任务域非人头），落到人以 H1/H2 为准，人数标「待确认」。
- **真理源优先级**：规则(instruction) > 宪法(AGENT_00)/蓝图(v2) > 其余；转型升级计划 + LIGHTCHASER Vite/Vercel 路线归"仅追溯"。
- **D1 日期**（7.31 vs 7.28）、迭代轮数（取 AGENT_05 的 R1→R13）、instruction.md 为截图无正文——均保守处理。

### 决策
- 输出为新文件不覆盖 `agent.md`（保留外部模板作参照）；只产规范文档，不物理 scaffold issues/、docs/final/ 等（映射到已有 Thoughts/、agents_output/）。**可逆，用户可要求改为覆盖或建目录。**

### 下一步候选
规范 §16 推荐：AGENT_03 文案引擎（首选，纯 AI，Gate 0 必需）／ AGENT_04 体验规格（冲 30% 权重，需结对）。

---

## 2026-07-11 · 大区赛转型启动 + 数据地基交付

### 做了什么
1. **通读工作区**：思路.md / 中文故事.md / 初赛 LIGHTCHASER 前后端源码 / instruction.md（赛道三细则截图 ×11）/ Thoughts 编队 AGENT_00–08 / 转型升级计划。
2. **校准赛道认知**（重大）：赛道三是「AI体验·刷到懂你的瞬间」，评审锚点"刷到一瞬间是否被打动/满足/自然互动"。评审五维：场景洞察20 / AI×产品15 / **体验完整性30(最高)** / 用户价值20 / 延展15。**大区赛必须用抖音AI平台做 feed卡+小程序**（初赛的 React 网页只算交流赛模拟）。确认赛期 **7.31–8.2 深圳**（非转型计划里写的 7.28）。
3. **交付 AGENT_01 机位库**：`spots.v1.json` 深圳 25 机位（配比 14/4/5/2）+ `validate_spots.py`（+ Node 平价版）+ `spots_readme.md` + 检查报告。
4. **交付 AGENT_02 光线引擎**：`sun_events.v1.json`（suncalc 预计算 25×18=450 条）+ `light_engine.js`（评分公式 v2 + 顺逆侧光判定，自检 100/66/29）+ `score_spec.md` + `weather_ops.md` + 检查报告。
5. **补齐工程文档**：写 `CLAUDE.md`（技术栈/规范/结构/运行/清单/状态）+ 本 `DEVLOG.md`。

### 关键决策
- 现有 LIGHTCHASER **不作废，转为设计蓝本 + 素材库**（评分逻辑/机位/色卡/动画平移进平台 Vibecoding）。
- 机位库主城市 = **深圳**（评委即用户即深圳）；晚霞 sunset 机位 bearing 锁 240–300。
- 评分公式 v2 锁 **5 因子**（云分层/湿度/能见度/时窗/天气码），可解释优先，算例可手工复算。
- Python 用 **anaconda 3.12.7**；脚本网络请求走 Node global fetch。

### 遇到的问题与处理
- **本机系统 python 损坏**（`py`→Python313 缺失、Store 版空壳）→ 改用 anaconda 全路径 `E:\anaconda\python.exe` + `PYTHONUTF8=1`，`validate_spots.py` 原生跑绿。
- **飞书细则文档需登录抓不到** → 用户已把截图存入 `instruction.md`，据此校准。
- **坐标核验捕获真错误**：`szw-012 春茧` 原坐标 (22.4870,113.9740) 经 OSM 反查落**香港元朗**；用 Nominatim 正向搜索取权威坐标 **(22.5213,113.9448) 南山区粤海街道** 修正，sun_events 已重生成，复查 25/25 落正确深圳区县。
- **两处 DoD 遗留已推进**：C3/K2 坐标核验从"待浏览器"→ **OSM 反查 25/25 区县级闭环**；C6 回测用**真实 Open-Meteo 深圳天气**跑出客观排序（晴空日正确判中档、雷暴日正确降档），仅剩主观打分人工半。

### 当前遗留（open）
1. 30m 级精确站位 + 步导图 → 7.28 实拍（既定）。
2. C6 主观打分比对 → 5 分钟人工。
3. C2 权威日落截图归档 → 1 张存证。
4. 样张三件套 25/25 留空 → AGENT_07 授权外联回填。
5. 可颂数据源接入方式未定 → 确认浏览器爬虫工具链 + 数据可授权性；列入 7.24 平台答疑。
6. 天气 A/B 选型 → AGENT_06 7.24 平台测绘。

### 下一步候选
AGENT_03 文案引擎（已解锁，纯 AI）／ AGENT_04 体验规格（首屏 first5s，需结对）／ AGENT_05 需求包（需 04）／ 可颂浏览器爬虫工序。
