# B 设计包 · 截图集说明（HERMES-09 §2/Gate 0 裁定）

## 内容

- `fidelity_checklist.md`：feed/p1/p2 三视角像素级保真元素清单（①）
- `screenshots/feed.png` `screenshots/p1.png` `screenshots/p2.png`：**1x 一套**（Gate 0 裁定书 G-3：2x 砍）（②）
- `capture_feed_pages.mjs`：产出上述截图的可复跑脚本
- `figma_link.md`：Figma 转换/整理产出的可访问链接（B-Figma 子项，人工+AI 经 MCP，另一 session 补齐，见下）

## 截图命名口径

按 R-0724-B 定案：**两页**，`feed`（feed 卡）/ `p1`（封面钩子卡）/ `p2`（追·光地图）。原 4/3 页口径均作废。

## feed 与 p1 为何是同一张图

`page_specs.md` 标题原文："P1 封面详情（**feed 卡本体**，前 5 秒的战场）"——P1 在产品定义里本来就是 feed 卡本身，不是 feed 卡内部再嵌一层不同的东西。`feed.png`/`p1.png` 因此是**同一次截图落两个文件名**，满足 §2b 命名硬规格的字面要求（各触点按各自习惯引用其中一个文件名），而不是编造一个原型里不存在的"折叠态feed卡"视图。

## 截图内容修正记录（如实记录，非隐藏）

首次生成的截图默认走 `demoLocation="gps"`——在无浏览器定位权限的自动化环境下会 4.5s 超时降级到 `FALLBACK_SUNSET_PAYLOAD`（`public/app.jsx` 硬编码兜底，`meta.city==="Shanghai"`，机位名"金山城市沙滩"，**初赛上海遗留兜底数据**，非本产品深圳内容）。已改用 Tweaks 面板显式切到「评分场景=高分87」+「当前位置=南方科技大学（大区赛场地）」两个下拉项，`/api/sunset?demo=high&city=shenzhen` 返回真实深圳机位（"塘朗山郊野公园 · 观景平台"，经 `curl` 核验），复跑后 p1/p2 均为深圳内容。

**已知留痕、未修的装饰性瑕疵**：`public/chrome.jsx` 顶部 tab 栏硬编码文案含"上海"一词（`["点","直播","团购","上海","关注","商城","推荐"]`，模拟抖音"同城"tab 的装饰性占位字符串，与评分/机位等真实数据无关联）。按本任务红线"不改动任何现有文件"（占用文件仅限 `agents_output/09/**`），未在此修正，如实标注留给后续 UI 收尾处理；不影响 p1/p2 核心内容（评分、机位、地图）的深圳真实性。

## 复跑方式

```bash
npm run dev:preview   # 另开终端，起 http://127.0.0.1:5174/
node agents_output/09/design/capture_feed_pages.mjs
# 可选：ZG_E2E_OUT=自定义目录 ZG_PROXY=http://127.0.0.1:7897（走系统代理时）
```
