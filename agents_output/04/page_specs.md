# 四页逐页规格（page_specs · AGENT_04）

> 结构：P1 封面详情 → P2 轻导航 → P3 机位攻略 → P4 快拍（左右滑切换；社区内容并入 P3 样张流）。
> 每个元素标注**字段绑定**（`spots` / `sun_events` / `weather_daily` / 引擎输出）或"静态"。边界态四种全部有规格，不允许"到时候再说"。
> 视觉值查 `tokens.md`；时序查 `first5s_spec.md`；判断规则查 `zhuiguang-design` skill。

## P1 封面详情（feed 卡本体，前 5 秒的战场）

> **⚠️ 口径变更（2026-07-12 用户拍板，覆盖旧文档）**：**P1 封面保持 1.0 现状，不动**；**时间条交互弃用**——推翻 `AGENT_00 §2`"时间条色卡互动"与 v2 蓝图"时间条=初赛灵魂，一帧不能丢"的旧口径。平台 vibecoding 时 P1 按 1.0 封面原样还原，无时间条。

| 区块 | 内容 | 字段绑定 |
|---|---|---|
| 背景 | 天空渐变（随当前时刻插值）+ 城市剪影 | `skyColor(t)`，t 由 now 相对 `sun_events.golden_start→blue_end` 归一 |
| 主信息 | 评分大数字 + 等级标签 | `light_engine.score()` / `score_label` |
| 副信息 | 峰值时刻 + 倒计时 + 场景标签 | `sun_events.sunset`(+offset)、now 差值、`spots.scene` |
| 行动句 | AI 一句话（≤26字） | 豆包(prompt_pack) / 兜底 `fallback_matrix[scene][bucket][weather]` |
| 交互暗示 | 左滑暗示 + 页点 | 静态 |

**遗留待拍板**：`first5s_spec.md §3` 找出的三处前 5 秒违规（cardFloatIn 动画化评分/ScrollHint 挡首屏/加载分数跳变）属 bug 级修复，但"封面不动"的边界是否含它们——**待用户确认后再动**，未确认前 1.0 原样。

## P2 实时 3D 光影地图（v1.1 主升级 · 用户指定的主战场 · **原型已实现** `public/light-map-3d.jsx`）

> issue #12 愿景的第一落地：真实太阳方位驱动光影。经典地图版（1.0）保留为 Tweaks 切换项 + WebGL 失败自动兜底。

| 区块 | 内容 | 字段绑定 |
|---|---|---|
| **3D 场景** | 城市体块 + 地面网格，**DirectionalLight 从真实太阳方位/高度角投光**，建筑投影自然切出"此刻能看到光的区域" | `meta.sun.current.azimuthDeg/altitudeDeg`（初赛 API 已有；平台版走 `sun_events.azimuth_10min`） |
| 路线发光带 | OSRM 真实几何 → 3D 发光管（追光橘） | route `geometry[]`（降级：起终点直线） |
| 太阳盘 + 光晕 | 天空中可见的光源锚点，颜色随当前天色 | `currentSkyColor` + 方位向量 |
| 机位信标 | 终点光柱（脉动）+ 起点白点 | `recommendation.coordinates` / `meta.coordinates` |
| **附近追光者** | 4 个脉动光点，**HUD 明确标注"演示"**（不冒充真实数据） | 演示数据（真实版待社交数据接入） |
| 顶部 HUD | 倒计时 pill + 太阳读数"☀ 289° · 高 5.2°"（mono） | `peakTime` − now；`meta.sun.current` |
| 底部结论句 | 三态："正好赶上 / 抓紧或看明晚 / 已过峰值·明晚见" | 步行分钟 + now 推算 vs peak |
| 机位切换 chips | 横滑切换，切换即重算路线与场景 | `nearbySpots` + `onSelectSpot` |

**交互**：canvas 拖拽=旋转视角（snap 跟手）、滚轮缩放、闲置 2.6s 后慢速自转（silk）；`prefers-reduced-motion` 关自转与脉动。**手势边界**：仅 canvas 锁滑动（`data-swipe-lock`），底部结论卡区域保留换页通道，防导航陷阱。
**边界**：太阳高度角 ≤0 → 微光模式 + HUD 标"已日落"（不假装有太阳）；到达晚于峰值 → 结论句转明晚。
**"随行走旋转"**（愿景第 2 项）：原型用拖拽/自转近似；真机版接 DeviceOrientation（平台能力待 AGENT_06 测绘）。

## P3 机位攻略（吸收社区页；"最后 100 米"主战场）

| 区块 | 内容 | 字段绑定 |
|---|---|---|
| 样张大图 | 机位参考图 + 作者署名 | `spots.sample_img` / `sample_credit`（三件套） |
| 站位卡 | 站位描述 + 最佳时段 + 焦段 | `stand_desc` / `best_window` / `focal` |
| **朝向罗盘** | 指针=拍摄朝向；光标=此刻太阳方位；两者夹角→光位文案 | `spots.bearing` vs `azimuth_10min[now]` → `lightRelation()`（顺/侧/逆光+一句描述） |
| 图文步导 | 最后 100 米 3–5 步 | `walk_steps[]`（步导图 7.28 实拍后挂载） |
| **导航悬浮窗** | P2 地图缩为画中画角落小窗 | 同 P2 数据；降级：顶部收起式地图条 |
| 样张参考流 | 底部横滑：附近机位样张聚合 | 邻近 `spots.sample_img`（复用单样张聚合，不扩 schema） |

**空态（AGENT_07 降级预案联动）**：`sample_img` 为空 → 样张位显示天空渐变底 + "待你来拍下第一张"（UGC 叙事，不是缺陷是邀请）。

## P4 快拍（**已直接嵌入 vision-engine** · 用户拍板：嵌入而非跳转）

| 区块 | 内容 | 实现状态 |
|---|---|---|
| **AI 场景识别 chip** | `window.LightchaserVision.init()/.detect()` 对取景画面跑 COCO-SSD → "AI 识别 87% · 街景：引导线交给车流"；**失败静默回退"构图引擎"口径（不冒充 AI）** | ✅ 已嵌（`subpanels.jsx` SceneQuickShoot） |
| **滤镜排** | 4 档（原生/柯达金/维尔维亚/经典负片），缩略图复用 AI 相机授权胶片资产 `filter-thumbnails/`，取景层 CSS 实时预览（snap 150ms） | ✅ 已嵌；正式成像走 filterous2（与 ai-camera.html 同语言） |
| AI 建议 | tips 三条 | 沿用 `shootingTips`（豆包/兜底） |
| 快门→发布 | 快门 → 成片视频 → 发布浮层（演示闭环） | 1.0 已有，保持 |
| 构图模板线 | `spots.compose_template` → 模板线叠加 | ⏳ 平台版实现（原型 ViewfinderOverlay 已有九宫格） |

**场景→构图映射**（与 AI 相机 8 场景口径一致）：portrait→剪影压天空 / street→引导线车流 / food→贴近留天色 / landscape→地平线下三分 / general→三分线锁天际。

## 边界态总表（四种，每页都要能渲染）

| 态 | P1 | P2 | P3 | P4 |
|---|---|---|---|---|
| 低分劝退(<45) | 灰蓝色卡+明日预告行动句 | 结论句"今晚不值得跑" | 照常（攻略是资产） | 建议改"收藏机位，明晚拍" |
| 雨天 | 雨天卡面+安抚文案 | 加"雨天路滑"微标 | 照常 | 滤镜排置灰+雨窗拍法 tip |
| 夜间(21:00后) | 明日预告版 | 显示明晚 golden 时刻 | 照常 | "定个傍晚闹钟" |
| 无数据/断网 | 骨架数字位或缓存+更新中（禁跳变） | 直线路线+估算 | 本地缓存样张 | 相机功能不依赖网络，照常 |
