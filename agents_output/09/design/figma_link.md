# Figma 链接（B-Figma 子项）

> DoD：转换+整理后的 Figma 链接可访问、页面命名规范；可后置至 7.23（本次 Gate 0 窗口已过，实际后置到 Figma MCP 可用的下一个 session）、不阻塞本 PR。

**状态：待补**——Figma MCP 已在本工作区注册连通（`claude mcp add --transport http figma https://mcp.figma.com/mcp`，`claude mcp list` 显示 Connected），但工具清单需 session 重载才能加载，本 session 未实际生成 Figma 稿。下一 session 用 `screenshots/`（1x 三图）+ `fidelity_checklist.md` 作整理对照，经 Figma MCP 从原型代码生成/或 html.to.design 插件转换，整理后把可访问链接回填本文件。

- 转换路线：A=AI 经 Figma MCP 从原型代码直接生成 / B=html.to.design 插件像素捕获（两条并行择优，见 `docs/hermes/gate0-subtraction-0720.md` G-3）
- 整理优先级：feed 卡 → p2 地图 → 其余
- 图层命名对照：`fidelity_checklist.md` 末节"图层命名/整理对照"
- 删教学浮层图层（HERMES-06/#21 裁定）
