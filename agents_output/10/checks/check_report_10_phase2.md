# HERMES-10 Phase 2 验收补充

日期：2026-07-23 ｜ 分支：`feat/hermes-10-photo-map-merge`

本补充对应 `public/photo-map.jsx` 的地图社区实现；Phase 1 的数据/schema 结论仍见 `check_report_10.md`。

| 验收项 | 结论 | 证据 |
| --- | --- | --- |
| 实时定位与失败降级 | 通过 | 浏览器验收截图 `media/12-geo-live-header.png`、`media/13-geo-fallback-map.png`。 |
| 今天/本周筛选 | 通过 | 气泡数分别为 6 / 8；`media/02-filter-today.png`、`media/03-filter-week.png`。 |
| 详情卡与示例标识 | 通过 | 作者、时间、地点、文案、互动占位及「示例数据」均可见；`media/04-detail-sheet.png`。 |
| 按需路线 | 通过 | 默认无路线；点击详情按钮后出现路线；`media/05-route-on-demand.png`。 |
| 右滑附近时间流 | 通过 | 边缘左滑打开时间流且不切换外层 feed；`media/06-edge-timeline.png`、`media/07-timeline-to-detail.png`。 |
| 发布与实时冒泡 | 通过 | 发布演示内容无需刷新即浮现，带「刚发布·演示」；`media/08-publish-sheet.png`、`media/09-live-bubble.png`、`video-01-bubble-pop.webm`。 |
| 三列结构 | 通过 | 封面 → 追·光地图 → 拍摄可往返；`media/10-swipe-camera.png`、`media/11-swipe-back-map.png`。 |

本次数据刷新后，`node agents_output/10/validate_photos.mjs` 为 0 error；垫图时间在 D-7 至 D0，今天 3 条、本周 18 条。

已知环境限制：临时干净工作树未安装 `node_modules`，因此 `npm run test:api` 无法加载 `suncalc`；Kimi 的原工作树中该测试已通过，浏览器完整日志存于 `checks/media/browser-verify.log`。
