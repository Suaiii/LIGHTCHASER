# 「追·光对谈」Kimi 独立页验收报告

- 日期：2026-07-19（CST）
- 构建者：Kimi K3（thinking: max），全新独立构建
- 交付物：
  - `public/interview-story-kimi.html`（页面，60,758 B，单文件、内联 CSS/JS、静态直开）
  - `scripts/check-interview-story-kimi.js`（静态检查，15 项）
  - `scripts/e2e/interview-story-kimi-render-check.js`（真实渲染与交互检查，38 项）
  - `docs/checks/interview-story-kimi-check.md`（本报告）
- 页面预览：`PORT=5199 node scripts/dev-preview.js` → `http://127.0.0.1:5199/interview-story-kimi.html`

## 来源隔离声明

- 任务全程未读取、未复制、未改写、未引用 `public/interview-story.html` 的 HTML/CSS/JS/布局/文案/视觉实现；页面从四个只读 subagent 的独立方案（内容策划、素材策展、视觉导演、工程验收）汇总后由主 coder 从零编码。
- 该文件未修改：任务开始时 SHA256 = `316b645c2fac8b9f0f57c1d346abb47c344fd56f841ef648c4d1495ff996253e`，验收结束时再次计算**完全一致**。
- 该文件与 `docs/checks/interview-story-check.md` 在 git 中的 dirty 状态（mtime 18:02 / 18:12）早于本次会话开始（18:18），属此前会话遗留，非 Kimi 产物。

## 测试方法与环境

- 静态检查：`node scripts/check-interview-story-kimi.js`，Node 原生 fs/path + 正则，零依赖，退出码 0。
- 渲染/交互检查：`node scripts/e2e/interview-story-kimi-render-check.js`，通过 npx 缓存中的 playwright@1.61.1 驱动 Chrome for Testing（chromium-1228）headless；静态服务器为项目自带 `scripts/dev-preview.js`（支持 Range 请求）；**未安装任何新依赖**。
- 视口：桌面 1280×800、移动 390×844（isMobile + touch）、桌面 reduced-motion（`reducedMotion: "reduce"` 仿真）、移动 reduced-motion 共四套情景。
- 环境：macOS arm64、Node v24.16.0。

## 静态检查结果（S1–S15，全部 PASS）

| 项 | 内容 | 结果 |
|---|---|---|
| S1 | 交付物存在与来源隔离（无旧页/相机/后端/外链引用） | PASS |
| S2 | 基本 HTML 合法性（doctype/lang/charset/viewport/title、id 唯一、标签配平） | PASS |
| S3 | 全部 33 个引用媒体存在于磁盘（大小写敏感比对） | PASS |
| S4 | credits 双向对账（76 件磁盘素材 = media_count；页面引用均已授权登记） | PASS |
| S5 | 6 位有素材访谈者展示数量均在 3–5 件 | PASS |
| S6 | 纯文字访谈者（Tmj、深圳豪宅小谭）章节零影像 | PASS |
| S7 | 无跨作者素材误用（章节/旁听席格子内素材必属本人文件夹） | PASS |
| S8 | 8 位访谈者章节齐全且导航锚链接可达 | PASS |
| S9 | 5 位旁听席作者齐全；13 位作者署名精确字符串均出现 | PASS |
| S10 | 全部 22 个内容 img 有准确 alt（灯箱占位 img 由 JS 同步 alt，I1 断言） | PASS |
| S11 | 全部 11 个 video：muted + playsinline + preload="none"、无 autoplay、有辅助文本 | PASS |
| S12 | 首屏直载媒体 1 件（hero）≤3，其余 21 图 data-src + 全部视频延迟加载 | PASS |
| S13 | reduced-motion 静态证据（CSS 媒体查询 + JS matchMedia） | PASS |
| S14 | 结尾保留句与「值不值得」「现在出发，还来得及」语义锚点，非 PRD 口吻 | PASS |
| S15 | 无任何 http(s) 外链引用 | PASS |

## 渲染与交互检查结果（38 项，全部 PASS）

| 项 | 桌面 | 移动 | reduced-motion |
|---|---|---|---|
| R0 控制台/页面错误为 0 | PASS | PASS | PASS |
| R1 无横向溢出（顶/中/底） | PASS ×3 | PASS ×3 | PASS（桌面+移动） |
| R2 首屏媒体请求 | 2 件，mp4 0 | 2 件，mp4 0 | — |
| R3 滚通后媒体兑现（img/video 未加载数） | 0 / 0 | — | — |
| R4 章节导航（11 链接、3 次点击跳转落点 <400px、aria-current 指示、移动顶条/桌面侧轨） | PASS | PASS | — |
| R5 滚通后未揭示元素数 | 0 | — | — |
| I1 灯箱打开（Enter / Space / 移动点按） | PASS ×2 | PASS | — |
| I2 Esc 关闭 + 焦点回归触发元素 | PASS | — | — |
| I3 背景滚动锁定（scrollY 1740 锁定）与解锁（恢复滚动） | PASS | — | — |
| I4 ArrowRight 切换、计数 2/19、Tab 焦点圈、背景 inert | PASS | — | — |
| I5 视频互斥（三次采样同时播放峰值） | 1 个 | — | — |
| I6 近视口才加载（首屏 0 视频带 src）/ 离视口暂停（起播后滚离 2 屏即停） | PASS | — | — |
| I7 全程静音 | PASS | — | — |
| I8 reduced-motion：仿真生效、滚通后播放中视频 0、揭示元素 opacity=1 无位移、过渡时长 0s、10 章文本完整（每章 >60 字） | — | — | PASS ×5 |

## 内容对账（13 位作者）

| 作者 | 角色 | credits 登记 | 页面展示 | 署名核对 |
|---|---|---|---|---|
| Calm Breeze | 访谈 | 13 图 | 4 图 | © Calm Breeze ✓ |
| Peng | 访谈 | 11 图 | 5 图（含终章全屏 1） | © Peng ✓ |
| 凯利斯映像 | 访谈 | 5 视频 | 4 视频 | © 凯利斯映像 ✓ |
| zhao-lives | 访谈 | 8 视频 | 4 视频 | © zhao-lives ✓ |
| Xuan long vacation | 访谈 | 4 图 | 4 图（含章首全屏 1） | © Xuan long vacation ✓ |
| 崔维斯 | 访谈 | 3 图 | 3 图 | © 崔维斯 ✓ |
| Tmj | 纯文字访谈 | 0 | 0（录音转写制式） | ✓ |
| 深圳豪宅小谭 | 纯文字访谈 | 0 | 0（录音转写制式） | ✓ |
| 拿破仑大眼糊 | 旁听席 | 7 图 | 3 图（含首屏 hero 1） | ✓ |
| 漫游kaka | 旁听席 | 12 图 | 3 图 | ✓ |
| 抖音创作者：xiaobai📷 | 旁听席 | 1 视频 | 1 视频 | ✓ |
| 抖音创作者：小叶同学 | 旁听席 | 1 视频 | 1 视频 | ✓ |
| 摄影师：Tim | 旁听席 | 11 视频 | 1 视频 | ✓ |

- 素材共展示 33 件，全部来自授权清单（consent_ref: project-owner-confirmation-2026-07-19）；源素材 76 件一件未删，credits.json 未改写。
- 受访者引语与 `kimi-build-package/INTERVIEWS.md` 逐句比对忠于原文（复核后已将 zhao-lives、peng、凯利斯映像三处标点级润色复原为原文措辞）；主持人衔接语为允许的润色创作。

## Reviewer 复核与修复记录

成品完成后由只读 reviewer 复核（需求符合度、事实署名、视觉品质、文案、工程隐患），结论「接近达标」。已修复：

| 编号 | 问题 | 修复 |
|---|---|---|
| P1（严重） | 验收文档缺失 | 本报告补齐 |
| P2（严重） | hero 标题压亮楼群可读性不足 | hero-shade 渐变暗段上移（58% 处 0.55 → 底部 0.9）+ hero-inner 局部径向压暗 + 文字阴影 |
| P3（严重） | 小谭章主持人语「最后一位访谈者」与页面事实矛盾 | 改为「也有人，想到的是『大家』」 |
| P4 | 桌面竖版视频卡超 1.5 视口高 | `.plate-v .vwrap` 限宽 400px，与竖图卡制式统一 |
| P5 | 左竖轨在全屏影像上不可读 | 轨道链接加深色半透明胶囊底衬、节点加暗底与阴影 |
| P6 | 两处主持人概括与访谈内容不符（「同一个问题」「前面几位都在提前规划」） | 分别改为「同一类问题：一道光，你等不等，又等多久？」「有人提前规划，有人到场再看。也有人，完全不等。」 |
| P7 | Tim 两段视频题材跳脱 + 旁听席 9 格末行单格 | Tim 减至 1 段（8 格 = 两行整）；全屏图顶部加渐变压暗缓冲硬切 |
| S2（建议） | 三联格同屏轮番抢播闪烁 | 已有视频在播时不再抢播（互斥逻辑不变） |
| S3（建议） | 三处引语标点级改写 | 复原为 INTERVIEWS.md 原文措辞 |
| S4（建议） | 灯箱取 src 空值守卫缺失 | lbRender 增加空值关闭兜底 |
| S5（建议） | 1024–1100px 窄桌面轨道压图 | 侧轨断点上调至 1200px |
| S1/S6（建议） | colophon 位于末句之后；Xuan 全屏色温偏灰 | 保留（版式元信息，见剩余风险；素材限制） |

修复后静态 15 项与渲染 38 项全部复测通过。

## 截图清单（`docs/checks/shots/interview-story-kimi/`）

| 文件 | 内容 |
|---|---|
| desktop-01-hero.png | 桌面首屏 hero（蓝调城景 + 标题可读性修复后） |
| desktop-02-chapter-calm-breeze.png | 桌面 Calm Breeze 章（对白制式、侧轨当前项） |
| desktop-03-chapter-kellys.png | 桌面凯利斯映像章（暮金光色、视频章） |
| desktop-04-text-only.png | 桌面 Tmj 录音转写章（零影像证明） |
| desktop-05-gallery.png | 桌面旁听席（8 格画廊 + 署名） |
| desktop-06-epilogue.png | 桌面终章全屏暮色图 |
| desktop-07-lightbox.png | 桌面灯箱打开态（大图 + 图注 + 1/19 计数 + 三键） |
| desktop-08-nav-active.png | 桌面侧轨当前位置指示态 |
| desktop-full.png | 桌面全页存档 |
| mobile-01-hero.png … mobile-06-lightbox.png | 移动 390px：首屏/章节/转写章/旁听席/终章/灯箱 |
| mobile-full.png | 移动全页存档 |
| rm-desktop-01.png / rm-mobile-01.png | reduced-motion 降级态（内容完整直出） |

## 剩余风险与已知限制

1. 渲染检查依赖本机 npx 缓存中的 playwright@1.61.1 + chromium-1228；缓存被清理后脚本会报 `FAIL ENV`（页面与静态检查不受影响），届时可用系统 Chrome 后备（playwright-core + executablePath）重跑。
2. 真实渲染仅覆盖 Chromium（桌面/移动/reduced-motion）；Safari、Firefox 未实测（页面只用标准特性：IntersectionObserver、inert、100svh、aspect-ratio、backdrop-filter，均为主流支持）。
3. 视频无字幕轨（素材本身无音轨内容，辅助文本以 `aria-label` 提供内容描述）。
4. Xuan 章首全屏图为素材库中最接近金色时刻的横图，色温略偏灰蓝（素材限制）。
5. 末句「访谈到这里结束，追光才刚刚开始。」之后保留两行 mono 小号 colophon（授权与制作信息），属版式元信息；如需字面意义「最后一句」，删 `.colo` 两行即可。
6. `prefers-reduced-motion` 下视频仅可手动点播（设计如此）；BGM 未采用。

## 产物清单（Kimi 独立创建）

- `public/interview-story-kimi.html`
- `scripts/check-interview-story-kimi.js`
- `scripts/e2e/interview-story-kimi-render-check.js`
- `docs/checks/interview-story-kimi-check.md`
- `docs/checks/shots/interview-story-kimi/`（18 张验收截图）

未修改任何既有文件（含 `public/interview-story.html`、相机前端、后端、源素材与 credits.json）。
