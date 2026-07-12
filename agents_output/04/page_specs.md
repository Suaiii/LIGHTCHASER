# 四页逐页规格（page_specs · AGENT_04）

> 结构：P1 封面详情 → P2 轻导航 → P3 机位攻略 → P4 快拍（左右滑切换；社区内容并入 P3 样张流）。
> 每个元素标注**字段绑定**（`spots` / `sun_events` / `weather_daily` / 引擎输出）或"静态"。边界态四种全部有规格，不允许"到时候再说"。
> 视觉值查 `tokens.md`；时序查 `first5s_spec.md`；判断规则查 `zhuiguang-design` skill。

## P1 封面详情（feed 卡本体，前 5 秒的战场）

| 区块 | 内容 | 字段绑定 |
|---|---|---|
| 背景 | 天空渐变（随当前时刻插值）+ 城市剪影 | `skyColor(t)`，t 由 now 相对 `sun_events.golden_start→blue_end` 归一 |
| 主信息 | 评分大数字(96px display) + 等级标签 | `light_engine.score()` / `score_label` |
| 副信息 | 峰值时刻 + 倒计时 + 场景标签 | `sun_events.sunset`(+offset)、now 差值、`spots.scene` |
| 行动句 | AI 一句话（≤26字） | 豆包(prompt_pack) / 兜底 `fallback_matrix[scene][bucket][weather]` |
| **核心交互** | **时间条拖动**：拖动 → 背景沿 8 锚点色卡连续变化 + 显示对应时刻与光况文案 | 拖动 t → `skyColor(t)` + `azimuth_10min` 最近采样的高度角→光况 |
| 交互暗示 | 左滑微光箭头 + 页点 | 静态（时序见 first5s §1） |

**交互**：时间条 snap 跟手（120ms）；松手回弹到"现在"用 silk。**降级链**（平台动效受限时，AGENT_06 测绘后落子）：完整拖动 → 点按分段切换（golden/日落/峰值/蓝调 4 档）→ 自动播放色彩过渡+关键帧停留。三种形态"光在变化"的叙事都成立。

## P2 轻导航

| 区块 | 内容 | 字段绑定 |
|---|---|---|
| 地图 | 当前位置→机位 步行路线 | 起点=GPS（降级：默认深圳+城市选择器）；终点=`spots.lat/lng`；线=route API `geometry`（降级：直线+距离） |
| 顶部 | 倒计时"距峰值 XX 分钟" | `sun_events.sunset` − now |
| 底部结论句 | "步行 12 分钟 · 18:31 到达 · 正好赶上" | route `durationSeconds` + now 推算到达 vs `golden_start`（三态：赶得上/正好/来不及→建议明晚） |
| 机位切换 | 附近机位横滑选择 | `getNearbyPois()` 前 4 + `spots.name/distance` |

**边界**：到达时刻晚于 `blue_end` → 结论句转"今晚来不及，明晚 `golden_start` 见"并给收藏。

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

## P4 快拍（与队友 AI 相机系统的接合点）

| 区块 | 内容 | 字段绑定 / 能力接入 |
|---|---|---|
| 取景层 | 构图模板线（三分/引导线/剪影/框景 按机位自动选） | `spots.compose_template` → 模板线叠加 |
| 滤镜排 | 3 预设缩略图横排切换 | `spots.filters[]` → **AI 相机滤镜系统**（`vision-engine.js` + `filter-thumbnails/`，main 已有授权滤镜） |
| AI 建议 | 一句拍摄建议（≤15字×最多3条） | 豆包 tips / `copy_slots.tip1-3` 兜底；光位描述来自 `lightRelation()` |
| 快门→发布 | 拍摄 → 预览 → "发布"带话题与定位浮层 | **AI 相机 capture 流**（`/ai-camera.html` 的取景/快门/AI 构图变体能力）；发布到浮层为止（演示不真发） |

**整合原则**：P4 不重造相机——原型 v1.1 里 P4 是"带机位上下文的 AI 相机"：机位数据（模板/滤镜/建议）注入队友的相机壳。接口：`?spot=<id>` 进入相机时预载该机位的 compose_template/filters/tips。

## 边界态总表（四种，每页都要能渲染）

| 态 | P1 | P2 | P3 | P4 |
|---|---|---|---|---|
| 低分劝退(<45) | 灰蓝色卡+明日预告行动句 | 结论句"今晚不值得跑" | 照常（攻略是资产） | 建议改"收藏机位，明晚拍" |
| 雨天 | 雨天卡面+安抚文案 | 加"雨天路滑"微标 | 照常 | 滤镜排置灰+雨窗拍法 tip |
| 夜间(21:00后) | 明日预告版 | 显示明晚 golden 时刻 | 照常 | "定个傍晚闹钟" |
| 无数据/断网 | 骨架数字位或缓存+更新中（禁跳变） | 直线路线+估算 | 本地缓存样张 | 相机功能不依赖网络，照常 |
