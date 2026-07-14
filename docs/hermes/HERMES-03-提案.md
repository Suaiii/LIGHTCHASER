# HERMES-03 光区提案与实测记录

## 先看哪个

本次保留两个默认关闭的方案，供决策者直接对照：

1. `?lightZone=axis`：太阳轴。以当前视口中心为锚点，按 SunCalc 方位角画出虚线和“日落方向”端点。
2. `?lightZone=spots`：路线光位。优先标注视口内的正式机位，不足时从真实步行路线取样，显示“见光 / 受挡 / 待数据 / 已日落”。
3. `?lightZone=both`：两种方案同时打开。

演示地址：

- `http://127.0.0.1:5174/?tweaks=1&lightZone=axis`
- `http://127.0.0.1:5174/?tweaks=1&lightZone=spots`
- `http://127.0.0.1:5174/?tweaks=1&lightZone=both`

进入后点击“一键大区赛演示”。截图在 `e2e-out/light-zone-axis.png`、`light-zone-spots.png`、`light-zone-both.png`。默认 URL 不创建任何光区 source 或 layer。

没有做全屏光照网格。网格的开销是“采样点数 × 建筑数”，拖动时还要反复更新。当前方案每次只判断 4 个光位，650 上限仅用于射线真正命中的建筑，不进入逐帧循环。

## 计算方法

数据流如下：

`SunCalc 方位/高度` + `当前视口候选点` + `openmaptiles 建筑 footprint/高度`
→ 地理坐标换算为候选点局部米制坐标
→ 太阳射线与建筑边求交
→ `horizonDeg = atan2(buildingHeight, distance)`
→ `sunAltitudeDeg > horizonDeg + 1.5°` 时标为见光。

射线最长 700 m。每次移动、缩放或明显旋转都会创建新的 camera generation；只有该 generation 的 `openmaptiles` source 完整后才发布结论。原始 footprint 先按候选点到太阳方向的地理走廊筛选，再做精确射线相交，最后才应用 650 上限。射线端点离开当前画面、瓦片未完成或命中数被截断时都显示“待数据”。太阳低于地平线时显示“已日落”。

时刻选择会改变 `sun.azimuthDeg` 和 `sun.altitudeDeg`，现有 React effect 随这两个值重建地图，因此太阳轴和光位结论会一起更新。

## 开源取舍

MapLibre 官方的 Three.js 示例和 `CustomLayerInterface` 文档说明了共享地图相机与 GL context 的标准做法。本任务没有再加 custom GL layer，只用了 GeoJSON line、circle、symbol layer。

Turf 是 MIT 许可，但仓库没有打包器。这里只有 4 个候选点，引入完整浏览器 bundle 比一段可测试的射线与线段相交公式更重。因此几何放在 `public/light-zone.js`，同一份代码由浏览器和 Node 测试调用。

参考：

- https://maplibre.org/maplibre-gl-js/docs/examples/add-a-3d-model-using-threejs/
- https://maplibre.org/maplibre-gl-js/docs/API/interfaces/CustomLayerInterface/
- https://github.com/turfjs/turf

## 实测

| 项目 | 结果 |
|---|---|
| 几何单测 | `light-zone geometry: PASS` |
| 四模式 E2E | off / axis / spots / both 全部通过；覆盖方位、屏内候选、partial data、移动 generation 与 19:20 日落状态；0 个 page error |
| 真实建筑输入 | 走廊内 779 个 footprint，精确射线命中 4 个，未触发 650 截断 |
| 计算耗时 | 查询、筛选、求交和 setData 全部计入，静止开场多轮 46–70 ms；仅在 source 完成或交互停稳后执行 |
| 塔楼步进，功能关闭 | 最终 1.1x，0 个 JS 错误 |
| 塔楼步进，both | 最终 1.1x，多轮最高 1.3x，0 个 JS 错误 |
| 旋转回位，both | 0 / 148000 像素，diff 0.000%，0 个 JS 错误 |
| API 与 AI 相机 | `npm test` 通过 |

取色来自 `e2e-out/light-zone-both.png` 的地图区域。路线亮芯仍是最高亮度：

| 采样 | 像素 | 亮度 |
|---|---:|---:|
| 路线亮芯 | (255, 212, 154) | 217.0 |
| 见光点 | (242, 196, 123) | 200.5 |
| 太阳轴 | (147, 208, 202) | 194.6 |
| 路线暖光 | (255, 138, 61) | 157.3 |
| 受挡点 | (88, 97, 115) | 96.4 |

## 防退化核对

- Three render、PMREM 和 WebGL 恢复逻辑未改，`renderer.resetState()` 仍在。
- 原生 extrusion 与 Three 的单层所有权未改，没有增加重合 3D 面。
- 阴影只在换装或满高时更新，立面仍不接收阴影。
- 合批 mesh 的 `frustumCulled=false` 未改。
- Three 的 `sourcedata`、pendingMove、先建后拆和分帧预算未改。
- 新方案仅监听瓦片完成和 `moveend`，不增加 rAF、阴影贴图或 Three 重建。

## 还需要人做什么

自动化部分已经结束。合并前还差两项人工决策：

- 找 1 位未参与开发的人做无说明 3 秒测试，记录他能否答出“往哪里走能看到光”。
- 决策者在 axis、spots、both 中选一个。落选代码随后删除，不把三套试验长期留在主分支。
