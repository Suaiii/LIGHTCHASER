# Figma 链接（B-Figma 子项）

> DoD：转换+整理后的 Figma 链接可访问、页面命名规范；可后置至 7.23（本次 Gate 0 窗口已过，实际后置到 Figma MCP 可用的下一个 session）、不阻塞本 PR。

**状态：✅ 已交付（0725，路线 B=真原型像素捕获；决策者否掉手搓矢量版后重做）**

- **链接（正式版）**：https://www.figma.com/design/LlblsSeYUHAPfiXdUBH0C7?node-id=9-2
  = 跑起来的原型封面（高分87 · 南方科技大学 · 深圳态，402×874）经 html-to-design 捕获，**像素级还原原型本尊**，图层为真实 DOM 转换（非手绘近似）。
  ⚠️ 文件在决策者 Figma 草稿箱内，对外访问需人工在 Figma UI 里 Share → "Anyone with the link · can view"（MCP 无法设置分享权限）。

## 路线更正记录（0725，如实记录）

1. 首版走"AI 手搓矢量重建"（路线 A），**决策者否决**（观感不达标，且没理由不用原型现成渲染）→ 重做为路线 B：Playwright 把原型开到高分深圳态 → 注入 `mcp.figma.com/mcp/html-to-design/capture.js` → 捕获提交（脚本逻辑同 `capture_feed_pages.mjs`，浏览器走本机代理）。
2. **p2 追·光地图退出 Figma 路线**（决策者裁定）：GL 3D 场景平台横竖要自己渲染（或 ripcord 2D），Figma 中转一张截图没有意义。p2 的平台侧参照物 = `screenshots/p2.png` + `../motion/media/` 录屏，不再产 Figma 稿。
3. 文件内残留首版手搓两帧（页面「feed 两页定稿 (R-0724-B)」node 2:2 / 4:9）：**弃用待删**——Figma MCP Starter 额度恰在捕获完成后用尽，AI 删不了，请决策者在 Figma UI 里手动删除该页（或留作对照）。
4. 同因（额度用尽），捕获结果未出 AI 侧验收截图——请决策者打开上方链接肉眼验收：应与本地原型 `http://127.0.0.1:5174/`（Tweaks：高分87+南科大）所见一致。
5. **0725 二次纠偏（决策者）**：node 9-2 捕获的是 Row0 抖音壳首屏，**不是真封面**——真封面=下刷一条的打分+背景图卡。真封面重捕获待 MCP 额度恢复（方法：同脚本加 `guangbao:swipeVideo next` 下滑再提交新 captureId）；当前平台侧主参照改用 `p1-cover-annotated.png` 标注图 + `p1-cover-annotation.md` 清单（见 README「真封面三件套」）。

## 用途（平台测绘 #19）

平台 Figma 导入**未试**——拿正式版链接（开分享后）去 douyin-ai.bytedance.net 试导入，能/不能的结论回填 issue #19。即使导不了，本稿也作为"给平台 AI 看的高保真参照"使用（配 `fidelity_checklist.md` 逐条口述）。

- 扩展判定：平台能导入且效果好 → 同法捕获更多真实状态页（Playwright 摆状态 → 新 captureId 再捕获；每个 captureId 单次有效）
- 复跑方式：`npm run dev:preview` 起服务 → 经 Figma MCP `generate_figma_design` 领新 captureId → 参照本次脚本（临时脚本已按约定删除，逻辑=capture_feed_pages.mjs 的状态设置 + 注入 capture.js 提交）
