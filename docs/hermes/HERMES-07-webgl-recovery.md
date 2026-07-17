# HERMES-07 - GL 楼群消失捕获与动画恢复

> **⚠️ 7.18 v4 战略转向增补（母文档 [product-arch-v4.md](product-arch-v4.md)）**：GL 3D 光影地图从"相位二锦上添花"**升为产品招牌兼核心底座**（负责人 P-4 原话："核心不是导航本身，是这张 GL 3D 地图，它才是能做本地生活的部分"）。因此本任务从普通 P0 **升为关键路径 P0＝招牌能否兑现的命门**：GL 真机稳定不了，轴二核心就立不住。序也改了——v3 的"纯 2D 先行、GL 后加"改为 **GL 优先 + 2D Leaflet 保底并行**（真机 bug 已部分解决）。本任务**继续推进不搁置**；D2 此前"光影搁置"仅指已取消的 HERMES-03 光域方向，与本任务无关。

- **受众**：AI 编码代理
- **状态**：进行中（**v4 关键路径·招牌命门**）
- **优先级**：**P0（关键路径）**
- **Issue**：[#22](https://github.com/Suaiii/LIGHTCHASER/issues/22)
- **占用文件**：`public/light-map-gl.jsx`、`scripts/e2e/webgl-recovery.mjs`

## 0. 为什么做

当前问题不是仅仅 LOD 阈值不合适：真实机器仍会出现 3D 楼群偶发消失，而 headless 回归无法稳定复现。任务必须把消失瞬间的 WebGL 上下文、建筑批次、LOD 生长状态和页面错误记录下来，并在上下文恢复后继续动画，避免楼群永久停在地下或保持空场。

## 1. 当前判断

- MapLibre 与 Three.js 共享同一个 WebGL context。
- 交接文档已列出 `webglcontextlost/webglcontextrestored` 为首要嫌疑。
- v4.6 的生长动画依赖 `render()` 持续 `triggerRepaint()`；上下文丢失后必须显式恢复动画时间轴。

## 2. 已实现

- `public/light-map-gl.jsx` 记录 `window.__zgWebgl = ready|lost|restored|restore-failed`。
- 捕获 `webglcontextlost`，阻止默认销毁流程。
- 在恢复事件中重置 Three 渲染状态、标记阴影更新，并从当前高度重启绝对时间轴；目标值由当前 zoom 决定。
- `scripts/e2e/webgl-recovery.mjs` 以 headed 浏览器记录恢复前后的 `__zgGrow`、`__zgB`、页面错误和截图。
- 修正建筑范围选择：`querySourceFeatures` 会返回已加载瓦片中的屏幕外建筑，旧实现直接截取前 1100 栋，导致远处建筑占满名额、前景空白。现按当前视口半径过滤并按相机中心距离排序后再构建。
- v4.7 将生长/缩回从阈值触发的独立计时动画改为 zoom 连续映射：`13.2–14.4` 内建筑高度随手势变化，原生剪影反向交叉淡化。
- v4.8 根据真机视频将过渡带推近至 `14.6–15.4`；原生层只在 Three 生长前 15% 快速退场，避免两套不完全相同的建筑批次形成残差和错位。
- v4.9 完全取消原生 3D/Three 重叠：低 zoom 只保留二维底图。Three 构建上限降至 650、分帧批次降至 40、阴影降至 1024，并缩短交互停稳后的重建等待。

## 3. DoD

- [x] `zoom-lod.mjs`：高 zoom 建筑存在，拉远和拉回均经过连续生长值。
- [x] `webgl-recovery.mjs`：恢复后 `webgl=restored`、建筑顶点数大于 0、无页面错误。
- [ ] 真实 GPU 机器录制一次自然发生的 context lost，并将 `e2e-out/webgl-recovery.json` 与截图附在 issue/PR。
- [ ] 真实机器连续旋转、平移、缩放至少 60 秒，楼群不永久消失；若瓦片请求失败，记录 Network 证据并区分网络根因。

## 4. 验证命令

```powershell
npm run dev:preview
$env:ZG_PROXY = "http://127.0.0.1:7897"
node scripts/e2e/zoom-lod.mjs
node scripts/e2e/webgl-recovery.mjs
```

`webgl-recovery.mjs` 当前还包含合成事件注入，用于验证恢复状态机；它不能替代真实 GPU 丢失证据，真实机器验收仍是必需项。

## 5. 交付

分支建议：`feat/hermes-07-webgl-recovery`。PR 必须附本任务书、测试 JSON、截图和真实机器复现结论；未完成真实机器 DoD 不得标记为已验收。
