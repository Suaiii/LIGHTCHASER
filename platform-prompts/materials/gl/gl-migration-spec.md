# 追·光 GL 3D 地图 · 完全迁移规格（唯一真值源）

> 目标：把原型 `public/light-map-gl.jsx`（v4.9，已验收）整页搬到抖音AI平台。
> 所有数值抄自源码，不是估算；所有"坑"来自真机踩过的记录，不是预防性猜测。
> 配套：`source/`（可上传的真源码）、`screenshots/`（真机四态）、`bubble_spec.md`（气泡细则）、
> `../motion/media/video-04-cluster-zoom.webm`（18s 真交互）、`../lib/suncalc.js`、`../data/`（真实数据）。

---

## 0. 四档目标：先说清楚"迁移成功"是什么

| 档 | 内容 | 判定 | 掉档动作 |
|---|---|---|---|
| **A** | MapLibre + **Three 自定义层**：每面真实受光/背光 + 楼间投影 + 金属反光 | 真机 FPS ≥25 且无残影 | 掉 A− |
| **A−** | MapLibre + `fill-extrusion` 3D 楼群 + 夜幕调 + 太阳定向光 | 真机看到成片立体楼群，FPS ≥25 | 掉 B |
| **B** | 平台内置地图组件 + 光位罗盘 + 照片气泡（2D） | 地图能显示 + 自定义标记可用 | 掉 C |
| **C** | 录屏内嵌 + 2D 照片时间流 | —— | 无 |

**招牌是 A−，不是 A。** A 档的 Three 层是加分项，风险集中在共享 WebGL 上下文（见 §9 坑 1–8）。
先把 A− 打穿再谈 A：A− 已经能给出"深蓝夜幕 + 立体楼群 + 橙色天际 + 金线"的完整观感。

---

## 1. 依赖与许可（开源优先，全部可商用）

| 件 | 版本/来源 | 许可 | 说明 |
|---|---|---|---|
| maplibre-gl | vendored 于原型 `public/vendor/` | BSD-3 | 地图引擎，**必需** |
| 矢量瓦片 | `https://tiles.openfreemap.org/styles/liberty` | 数据 ODbL | 免费无 key；备选 cartocdn dark-matter |
| suncalc | `../lib/suncalc.js`，约 300 行 | BSD-2 | 太阳几何，**可整段内联** |
| three.js | r128 | MIT | **仅 A 档需要**；A− 不装 |

**红线**：OSM 署名必须保留（原型用 `attributionControl: { compact: true }`）。这不是可选项，是 ODbL 要求。

---

## 2. 相机与 LOD

| 项 | 值 |
|---|---|
| pitch | **62°**（`maxPitch: 70`） |
| 初始 zoom | `14.65`（= LOD 起点 14.6 + 0.05） |
| bearing | **太阳方位角 − 60°**（受光面入画） |
| 中心 | 路线中点；无路线时用机位坐标 |
| LOD 区间 | `ZG_LOD_START=14.6` → `ZG_LOD_END=15.4` |
| LOD 曲线 | `t = clamp((zoom−14.6)/0.8)`，再 `t*t*(3−2t)`（smoothstep） |
| 开场动画 | `cameraForBounds` 适配路线，padding 上190/下230/左右70，`easeTo` 900ms；**zoom 下限钳在 14.65**——长路线全览会掉到 z≈12.8，开场只剩剪影楼，与"第一眼=立体楼群"的叙事相悖 |

---

## 3. 夜幕调色板（确定性给死，**不做任何混色换算**）

对拉下来的 liberty style JSON 逐层改写。通用混色公式已废除——它曾把绿地混成深青、品红混成紫。

**① 先整层移除原生 `fill-extrusion`**：3D 建筑只保留我们自己那一层，否则两套楼 z-fight。

**② 按图层类别给死颜色**（用 `图层id + source-layer` 一起做正则判定）：

| 判定 | 正则 | 颜色 |
|---|---|---|
| background | `type==='background'` | `#141824` |
| 水域 | `/water/` | `#17203a` |
| 绿地 | `/landcover\|park\|grass\|wood\|forest\|vegetation\|golf\|cemetery\|scrub\|meadow/` | `#1a2230` |
| 建筑(2D) | `/building/` | `#1e2536` |
| 主干道 | line 且 `/motorway\|trunk\|primary/` | `#5d6884` |
| 次级道路 | line 且路网类 | `#3b4560` |
| 其他 line | —— | `#242d44` |
| 其他 fill | —— | `#161d2c` |
| circle | —— | `#3a4358` |
| 兜底 | —— | `#1c2333` |
| 文字 | `text-color` | `#c0c8dd` |
| 文字描边 | `text-halo-color` | `#0d1017`，`text-halo-width: 1.4` |

**③ 符号层三条特殊处理**（每条都对应一个真机缺陷）：
- 只给**点状**地名设 `text-pitch-alignment/text-rotation-alignment = viewport`。沿线标签（`symbol-placement` 是 `line`/`line-center`）**不能设**，否则字母沿路堆叠成乱码。
- 纯文字点状层字号保底 `12.5`（原 <12 的）；带 `icon-image` 的路牌盾徽不动。
- POI/站点减密度：`/poi|station|transit|bus|aerodrome|housenum/` 的层 `minzoom` 抬到 **15.4**（门牌号抬到 **17**），`text-padding: 6`，有图标的设 `text-optional: true`。否则某些角度标签与楼穿插堆叠。

**④ 天际光晕**：页面顶部 30% 高度叠一层 `linear-gradient(180deg, <当前太阳色>52 0%, transparent 100%)`，`pointerEvents: none`。`52` 是十六进制透明度 ≈32%。

---

## 4. 太阳几何与主题光色

**方位角/高度角**：`SunCalc.getPosition(date, lat, lng)`；方位角换算 `(azimuth*180/π + 180 + 360) % 360`，高度角 `altitude*180/π`。
无法实时算时用预计算表 `../data/sun_events.v1.json`（450 条），**不许编造**。演示兜底光位 = 方位角 283°、高度角 7°，且 HUD 必须写「演示光位」。

**主题光色 = 高度角 → 7 锚点插值**（`source/zg-sun-helpers.js` 的 `zgSunPalette`）：

| 高度角 | 色 | 语义 |
|---|---|---|
| −6° | `#5A3870` | 暮光紫 |
| 0° | `#8A4068` | 消散紫红 |
| 3° | `#C84858` | 晚霞峰值深红 |
| 8° | `#DE6B48` | 日落橘红 |
| 16° | `#E0A060` | Golden Hour 橘黄 |
| 30° | `#EBC28E` | 暖金 |
| 55° | `#F2E2C4` | 正午白金 |

锚点间线性插值（`zgHexLerp`）。这条色带同时喂给：天际光晕、HUD 太阳圆点、A 档的 envMap 与平行光。

**MapLibre 内置光照**（A− 就靠这个给楼分明暗）：
```
map.setLight({ anchor: "map", color: "#ffe3c4", intensity: 0.55,
               position: [1.5, 太阳方位角, Math.min(88, 90 − 太阳高度角)] })
```
`anchor: "map"` 让光随地图旋转保持地理正确。光色用**暖白**不用主题色——彩色光与底色相乘会产生不可控的青/紫怪块。主题色交给天际光晕和建筑渐变承担。

---

## 5. 3D 建筑

### A− 档（必做）：`fill-extrusion`
```
id: "zg-3d-buildings", source: "openmaptiles", source-layer: "building", minzoom: 12.5
fill-extrusion-color: "#1d2436"
fill-extrusion-height: ["coalesce", ["get","render_height"], 12]
fill-extrusion-base:   ["coalesce", ["get","render_min_height"], 0]
fill-extrusion-opacity: 0.62
fill-extrusion-vertical-gradient: true
fill-extrusion-opacity-transition: { duration: 0 }   // zoom 本身连续，不叠加滞后动画
```

### A 档（可选加强）：Three.js 自定义层
`renderingMode: "3d"` 的 `CustomLayerInterface`，与 MapLibre **共享同一个 WebGL 上下文**（`new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl })`）。
- 材质：`MeshStandardMaterial({ color:"#333c54", metalness:0.5, roughness:0.55, envMapIntensity:0.35, transparent:true, opacity:0.68, depthWrite:true })`——楼是配角不抢戏。
- 平行光：方向 = 太阳方位角/高度角，颜色 = 主题光色向 `#ffc98f` 混 25%，强度 **0.95**；`shadow.mapSize 1024`，`normalBias 3`，`bias −0.0002`，正交范围 ±2600m。
- 接影地面：透明 `ShadowMaterial`，opacity 随楼生长 0→**0.3**，`depthWrite: false`。
- 环境光：`HemisphereLight("#242c44","#14171f",0.42)` + `AmbientLight("#2c3450",0.28)`。
- envMap：512×256 canvas 画竖向渐变（`#07090f` → `#141b2c`@47% → 主题光色@54% → `#0c0f16`@60% → `#07090f`），`EquirectangularReflectionMapping` + PMREM。**不要在里面画太阳亮斑**——金属面镜面反射它会成片过曝白噪。
- 生长动画：`scale.y` 从 0 到 1，长 **750ms** / 缩 **480ms**，smoothstep，**绝对时间轴插值**（低帧设备自动追赶，时长恒定）。
- 数据源：`map.querySourceFeatures("openmaptiles",{sourceLayer:"building"})` 视口实时，单次上限 **650 栋**。

坑全在 §9。**做不动就退 A−，不要硬啃。**

---

## 6. 照片气泡与聚合

完整细则见 `bubble_spec.md`；这里只列迁移必须知道的：

- 尺寸按新鲜度：<1h **80px** / <24h **64px** / 更早 **48px**；白边 3px，圆角 10。
- 角标常显：新发布「刚发布 · 演示」，种子「示例 · X小时前」；聚合泡「示例/演示 · N 张」。**F6 红线，不许 hover 才出。**
- 聚合判距离用**地面米数**：`mergeMeters = 72px × 40075016.686 × cos(lat) / (512 × 2^zoom)`。
- 不可见点剔除：离中心 >60km、投影落在画面顶部 16%、`project→unproject` 往返误差 >60m —— 三条任一命中即不渲染。
- 点单泡：`easeTo({ zoom: max(当前,15.2), pitch:62, duration:420 })`；点聚合泡：`zoom + 1.6`（上限 17）。
- 重排时机：`moveend` 后 90ms 防抖；**必须先过滤"中心/缩放未变"的空事件**（闲置自转每帧都发 moveend）。
- 为什么不用 MapLibre 原生 cluster：气泡是带角标/标签/动效的 DOM Marker，走 GeoJSON symbol 层会丢掉整套 F6 标注和冒泡动效。20 条数据贪心聚合 O(n²) 足够便宜。

---

## 7. 路线层与标记

| 层 | 参数 |
|---|---|
| 辉光 | line `#ff8a3d`，width 16，blur 8，opacity 0.5，round cap/join |
| 芯线 | line `#ffd49a`，width 4.5 |
| 脉冲 | circle r5，`#ffffff`，blur 0.35；两个点沿路线 `(t*0.045 + {0, 0.5}) % 1` 循环 |
| 起点 | 14px 白圆点 + 3px 半透明白环 + 白色外发光 |
| 终点 | 16px `#ffd49a` 圆点（发光 18px）+ 下挂机位名胶囊（底 `rgba(14,17,26,0.82)`，字 `#ffd49a` 11px 700） |
| 演示光点 | 4 个 `#ff8a3d` 10px 圆点，**确定性随机**（种子 20260713）散布在路线周边 ±0.004°，2.2s 呼吸动画 |

**脉冲必须隔帧更新**（每 4 帧一次）：`setData` 会强制整图重绘，60fps 更新等于静止时 GPU 也全速跑。

---

## 8. HUD 与真实性徽标（F6，不可省）

顶部（top 96，左右各 14）两个胶囊，底 `rgba(14,17,26,0.72)` + `blur(10px)` + 1px 白边 12%：
- 左：「距峰值 **N** 分钟」，数字 15px 700 `#ffd49a` 等宽字体
- 右：太阳圆点（填当前主题光色 + 同色发光）+「☀ 283° · 高 7.0°」10.5px 等宽

左侧真实性徽标列（top 140，字号 9.5，等宽）：
1. `道路·瓦片实时 ｜ 建筑·视口实时 N 栋`（离线兜底时写「建筑·离线包兜底 N 栋」）—— **绿色 `#8fd9a8`**
2. `太阳·实时方位 ｜ 路线·真实路网`（演示光位时写「演示光位」）
3. 橙点 + `附近追光者（演示）` —— **这四个光点是演示数据，字样必须常显**
4. 操作提示 + 构建号（用户截图即可确认运行版本）

底部（bottom 96）：机位 chips 横滑条 + 结论卡（`rgba(14,17,26,0.74)` + `blur(14px)`，18 圆角）。
结论文案三态：`步行 N 分钟 · HH:MM 到 · 正好赶上` / `… 到时峰值已过 N 分钟 · 抓紧` / `今晚已过峰值 · 明晚黄金时刻见`。

---

## 9. 已知坑清单（真机踩过，按复发概率排序）

| # | 坑 | 症状 | 正解 |
|---|---|---|---|
| 1 ★ | **Marker 定位与动画同元素** | 所有气泡叠在地图左上角，永不落到坐标上 | 外层容器只承定位（无动画），内层元素只承动画。带 transform 关键帧 + `fill-mode: both` 的动画会永久覆盖地图库写的定位 transform |
| 2 ★ | 用屏幕像素距离聚合 | pitch 62° 下十几公里外的照片被误并成一簇 | 换算成地面米数再判距（§6 公式） |
| 3 ★ | 不可见点照渲染 | 气泡糊在天边"飘在天上" | 三条剔除规则（§6） |
| 4 | 共享上下文不复位 | 帧级乱码残影 | Three 每帧 `renderer.resetState()`；PMREM 生成后也要复位一次 |
| 5 | Three 剔除误杀 | 特定角度整片楼消失 | 合批 mesh 设 `frustumCulled = false`（MapLibre 裸相机无正确视锥） |
| 6 | 瓦片是异步流 | 楼群以残缺状态（如 136 栋）永久定格 | 拿 `sourcedata` 且 `isSourceLoaded` 当"数据到齐"信号自动补建；已有完整楼群时残缺数据不上桌 |
| 7 | 先拆旧再建新 | 构建失败瞬间"楼全没了" | **先建新再拆旧**，查空保留旧楼——宁可旧不可空 |
| 8 | 同步构建上千栋 | 一次卡主线程约 200ms | 分帧构建，每帧 ≤40 栋；新重建到来时用 token 作废进行中的旧构建 |
| 9 | 掠射角自阴影 acne | 立面白噪竖纹抖动 | `normalBias 3` + `bias −0.0002`，且**立面 `receiveShadow = false`**（明暗交给 N·L，楼间遮挡感留在地面投影） |
| 10 | 阴影每帧重采样 | 旋转时光照抖 + 掉帧 | `shadowMap.autoUpdate = false`，只在楼长到满高时烘一次 |
| 11 | 硬切显隐 | 楼"突然蒸发"，像故障 | 生长动画（§5），双向共用 smoothstep 曲线，中途反转不跳变 |
| 12 | 闲置自转发 moveend | 每帧重排气泡/重建楼 | 比中心与 zoom，未变就 return |
| 13 | 脉冲每帧 setData | 静止时 GPU 也满载 | 隔 4 帧更新一次 |
| 14 | `querySourceFeatures` 含屏外瓦片 | 远处瓦片吃满建筑预算，近景反而空 | 先按到中心距离过滤（视口半径 ×1.25）并排序，再截断 |
| 15 | 沿线标签设 viewport 对齐 | 路名字母沿路堆叠成乱码 | 只给点状地名设（§3-③） |
| 16 | 每帧 new Matrix4 | GC 停顿 | 复用矩阵对象 |

---

## 10. 动效清单

| 名称 | 参数 |
|---|---|
| 气泡入场 `zgPhotoIn` | 0.4s `cubic-bezier(.16,.85,.25,1.12)`，上浮+缩放+去模糊，逐个错峰 ≤180ms |
| 新照片冒泡 `zgPhotoPop` | 0.68s `cubic-bezier(.16,.85,.25,1.25)`，0.2→1.16→1，带橙色高亮圈 |
| 气泡退场 `zgPhotoOut` | 0.24s ease-in，下沉+缩小+模糊 |
| 光点呼吸 `zgChaserPulse` | 2.2s ease-in-out 无限，scale 1→1.5→1 |
| 楼群生长 | 长 750ms / 缩 480ms，smoothstep |
| 闲置慢旋转 | bearing 每帧 +0.018；触摸立即停，松手 **4s** 后恢复 |
| 无障碍 | `prefers-reduced-motion` 时关闭全部循环动效 |

---

## 11. 验收数值基线（本地原型实测，平台复现时对照）

| 视角 | zoom | pitch | 视口建筑数 | 生长值 | 现象 |
|---|---|---|---|---|---|
| 开场 | 14.65 | 62 | 650 | ≈0.01 | 楼刚出地面，路网+金线为主 |
| 拉远 | 12.60 | 62 | —— | 0 | 楼缩回地里，只剩 2D 剪影；气泡合簇 |
| 拉近 | 15.30 | 62 | 650 | ≈0.96 | **成片立体楼群，受光面暖、背光面深** |
| 高俯角 | 14.90 | 70 | 650 | ≈0.32 | 天际光晕占满上部 |

四态截图见 `screenshots/`（本地原型真实抓取，非合成图；软件渲染下抓的，真机 GPU 只会更好）。

---

## 12. 上传件清单

| 件 | 何时传 |
|---|---|
| `source/light-map-gl.jsx` | 平台支持读源码时**第一件**就传——1038 行里注释写满了"为什么"，比任何转述都准 |
| `source/zg-sun-helpers.js` | 同上，这是它的依赖 |
| `../lib/suncalc.js` | 做太阳几何时 |
| 本文件 | 全程 |
| `bubble_spec.md` | 做气泡/聚合时 |
| `screenshots/*.jpg` | 每步验收对照 |
| `../motion/media/video-04-cluster-zoom.webm` | 做聚合时（让它照着视频做） |
| `../data/spots.v1.json`、`sun_events.v1.json` | 接真实数据时 |
