# Figma 链接（B-Figma 子项）

> DoD：转换+整理后的 Figma 链接可访问、页面命名规范；可后置至 7.23（本次 Gate 0 窗口已过，实际后置到 Figma MCP 可用的下一个 session）、不阻塞本 PR。

**状态：✅ 已交付（0725，AI 经 Figma MCP 生成，路线 A）**

- **链接**：https://www.figma.com/design/LlblsSeYUHAPfiXdUBH0C7
  ⚠️ 文件在决策者 Figma 草稿箱内，对外访问需人工在 Figma UI 里 Share → "Anyone with the link · can view"（MCP 无法设置分享权限）。
- 页面：`feed 两页定稿 (R-0724-B)`，两帧各 402×874：
  - `p1/封面卡 feed-card`（node 2:2）：**矢量重建**——天空渐变（tokens 8 锚点取晚霞段 4 锚点）、太阳盘+光晕、城市剪影、评分大数字 96px Fraunces（"87"）、等级标签暖红橘 pill、峰值行 JetBrains Mono、机位名/AI 行动句、两页页点 pill + 左滑微光箭头；图层按 `fidelity_checklist.md` 条目编号命名（`p1/09-payload-static` 等）。
  - `p2/追·光地图 map`（node 4:9）：GL 3D 场景不可矢量化 → `screenshots/p2.png` 截图作底图（image fill），HUD 为真实可编辑图层覆盖：倒计时 pill、太阳读数 mono、**"演示数据 · 非真实用户"可见标注（F6）**、机位 chips、底部三态结论句（已过峰值态）。
- 字体核验：Fraunces / JetBrains Mono / Noto Sans SC 三款 Figma 全部可用，**零字体降级**。

## 已知失真（如实记录，非隐藏）

1. p2 底图为位图截图，底图内烙有原 HUD 像素——覆盖层与其同位遮盖，但边缘可能露出残影；底图含 iPhone 模拟器状态栏与调试文字行（原型 Tweaks 痕迹）。
2. p1 天空渐变为 8 锚点色卡的晚霞段 4 锚点节选（#2A3450→#8A4068→#C84858→#E0A060→#0a0a0d），非全 8 锚点插值。
3. p1 显示"19:08 峰值 · 还有 86 分钟"（checklist canonical 示例态），p2 底图为 18:40 已过峰值演示态——两帧代表两个演示时刻，非同一瞬间。
4. 峰值行中文字符在 JetBrains Mono 下走系统回退渲染（原型同款行为，非新失真）。
5. 城市剪影为 8 个矢量楼块的示意重建，非原型 canvas 剪影逐像素还原。

## 用途（平台测绘 #19）

平台 Figma 导入**未试**——拿本链接（开分享后）去 douyin-ai.bytedance.net 试导入，能/不能的结论回填 issue #19。即使导不了，本稿也作为"给平台 AI 看的高保真参照"使用（配 `fidelity_checklist.md` 逐条口述）。

- 转换路线：A=AI 经 Figma MCP 生成 ✅（本次采用）/ B=html.to.design 插件像素捕获（未动用）
- 扩展判定：平台能导入且效果好 → 再扩 5 个状态帧（素材 `../motion/media/` 详情卡/筛选/发布/时间流/定位降级截图）
- 删教学浮层图层（HERMES-06/#21 裁定）：本稿从零生成，无历史浮层图层
