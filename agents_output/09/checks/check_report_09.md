# check_report_09 · HERMES-09 迁移资产包（Migration Kit）

> 对应任务书 `docs/hermes/HERMES-09-migration-kit.md`（含 7.20 Gate 0 减法裁定横幅 + R-0724-B 两页化裁定）、issue #25。
> **交付背景**：7.20/7.23 两道原定死线已过（今日 2026-07-24，平台开放当天）。7.24 晨体检确认 `agents_output/09/`、分支、PR、check_report 全部不存在——本报告是该任务的**首次真实交付**，非补交或返工。
> 分支 `feat/hermes-09-migration-kit`（基于 `feat/feed-two-pages`，含两页化 R-0724-B 与三连裁定最新代码状态）。

## DoD 逐条（二元 + 证据）

### A 数据包 ✅

| 检查项 | 结果 | 证据 |
|---|---|---|
| 六表齐（D-a=加，photos 第 6 表） | ✅ | `agents_output/09/data/{spots,sun_events,weather_daily,copy_corpus,user_prefs,photos}.v1*.json` |
| `validate_spots.mjs` 对 spots 副本跑绿 | ✅ | 见下方命令输出：`记录数:25 Errors:0 Warnings:0 === PASS ===` |
| `sun_events` 行数=450 | ✅ | `node -e "console.log(JSON.parse(...).length)"` → `450` |
| 建表话术 6 段，各 ≤3 句 | ✅ | `data/README.md`"建表话术"节逐段人工计句核对（`。`计数：spots=3/sun_events=3/weather_daily=3/copy_corpus=3/user_prefs=3/photos=3） |
| §2b①导出文件剥离 meta，纯数组 JSON | ✅（spots/sun_events/photos） | `head -c 1` 三文件均为 `[`（见下方命令输出） |
| §2b②README 声明联接键+azimuth_10min 嵌套列处理 | ✅ | `data/README.md`"联接键"+"alt 字段定案"两节 |
| §2b③weather_daily 日期参数化+一键脚本+D0/D+1+"是否有雨"字段+标注演示假数据 | ✅ | `gen_weather_daily.mjs` 已执行，输出 2026-07-24/2026-07-25 两行，`has_rain`+`_demo_note` 字段齐 |
| §2b④copy_corpus 显式取格键+README 取格规则 | ✅ | 27 行 `{scene,bucket,weather,hook}`，`data/README.md`"取格规则"段 |
| §2b⑤sun_events 切片脚本备用 | ✅ | `slice_sun_events.mjs` 已执行，产出 `sun_events.slice-2d.v1.json`（50 行，25 机位全覆盖） |

**alt 字段实测更正**（如实记录）：任务书横幅称"alt 字段 az-only 版定案"，但直接读取 `sun_events.v1.json` 任意记录，`azimuth_10min[]` 每个采样点本就同时含 `az` 与 `alt` 两个数值——"az-only/待补alt"是 HERMES-02 遗留的悬置话术，字段现状即最终态，已在 `data/README.md`"alt 字段定案"节写明并附证据路径。

**命令输出摘录**：
```
$ node agents_output/01/validate_spots.mjs <spots副本包裹版>
记录数: 25 / 场景计数: {"sunset":14,"skyline":4,"exhibition":5,"cafe":2} / Errors: 0 / Warnings: 0 / === PASS (0 error) ===

$ head -c1 agents_output/09/data/{spots,sun_events,photos}.v1.json
[ [ [
```

### B 设计包 ①②✅ · Figma 🟡待补（不阻塞）

| 检查项 | 结果 | 证据 |
|---|---|---|
| 保真元素清单每页 ≥8 条且引用 tokens 具体值 | ✅ | `design/fidelity_checklist.md`：feed 10 条/p1 9 条/p2 10 条，均含具体色值/字号/圆角/时长 |
| 截图集覆盖 feed+两页，1x 一套（Gate 0 裁定：2x 砍） | ✅ | `design/screenshots/{feed,p1,p2}.png`（402×874 viewport，deviceScaleFactor:1） |
| 命名按 §2c D-b 现状（feed/p1/p2，两页定稿） | ✅ | 文件名即 `feed.png`/`p1.png`/`p2.png` |
| 截图内容真实性（F6：不得用初赛上海遗留兜底数据顶替深圳产品） | ✅（已修正） | 首版误用默认 `demoLocation=gps`（无定位权限超时降级到硬编码"金山城市沙滩"上海兜底），已改用 Tweaks 显式切"高分87"+"南方科技大学"，复跑后 p1/p2 均为深圳真实机位（"塘朗山郊野公园·观景平台"），过程记录见 `design/README.md`"截图内容修正记录" |
| B-Figma：链接可访问 | 🟡 待补 | `design/figma_link.md` 已如实标注"待补"——Figma MCP 本 session 才注册（`claude mcp add`），工具清单需 session 重载才加载，本 session 未能实际调用 MCP 生成/整理 Figma 稿。DoD 原文"可后置至 7.23、不阻塞本 PR"——按此条款不阻塞，留给下一 session 用已产出的 `screenshots/`+`fidelity_checklist.md` 完成 |

### C 动效包 ✅（录屏按 Gate 0 红线裁定，两段硬 DoD 已解除）

| 检查项 | 结果 | 证据 |
|---|---|---|
| 动效清单 ≥8 条，五要素+优先级齐 | ✅ | `motion/motion_spec.md` 9 条，含名称/位置/时长/缓动/触发/优先级 |
| 录屏文件本机可播放 | ✅ | 3 段 `.webm`（来自已过验收的 `agents_output/10/checks/check_report_10_phase2.md`），`ffprobe` 实测时长 6.40s/7.44s/5.88s，非估算 |
| 首个动效起止清晰可辨（§2b） | ✅ | `motion_spec.md` 末节：`video-01-bubble-pop.webm` 起止描述+ffprobe 时长 |
| "内容含 P2 生长动画与光照时刻切换两段" | 🟡 不再是硬 DoD | Gate 0 裁定书 G-4"09 内部三处互斥"条：DoD 硬性两段 vs §2c"视GL解锁而定" vs 红线"不稳定不许录"——**裁定=红线优先**，两段录屏不再是硬 DoD。本仓库全文搜索确认无任何 GL 生长动画/光照切换录屏文件存在（`find . -iname "*.webm"` 仅 3 个 2D 文件），已在 `motion_spec.md` 条目3/4 用文字五要素顶格写并标注"待录"，未拼凑 |

### D 提示词包 ✅

| 检查项 | 结果 | 证据 |
|---|---|---|
| 三块齐（行动文案/拍摄建议/评分解释） | ✅ | `prompts/{01-action-copy,02-shooting-tips,03-score-explanation}.md` |
| 硬规则与 `agents_output/03/` 原文 diff=仅排版差异 | ✅ | Node 脚本逐字符比对：CRLF/LF 差异是唯一不同，`.replace(/\r\n/g,'\n').trim()` 归一化后 `===` 为 `true`（01/02 两文件均验证） |

### E Skill 草案 ✅

| 检查项 | 结果 | 证据 |
|---|---|---|
| 草案三节齐（何时触发/规则正文/校验清单） | ✅ | `skill/追光设计系统.md` 一、二、三节 |
| 检索清单 ≥5 关键词 | ✅ | 文末 6 个关键词（frontend-design / design system / ui review / style guide / motion design tokens / brand consistency checker） |
| §2b 文件名固定《追光设计系统》 | ✅ | 文件名 `追光设计系统.md`，文档标题含书名号 |
| §2b 必守三条顶格 | ✅ | 文档开篇即"必守三条"节（主色`#ff8a3d`/文案字数上限/动效第一规则） |
| §2c E 包图层亮度纪律更新（D-c 裁定） | ✅ | "2.5 图层亮度纪律"节已替换为"气泡为主体，按需路线压过气泡"，旧"金线>见光点>气泡"标注作废 |

## 红线自查

- F6 假数据标注：`weather_daily.v1.json` 每行含 `_demo_note:"演示用假数据..."`；`photos.v1.json` `data_nature` 字段声明"非真实UGC"；截图内容修正记录已如实写明发现-修正过程，未隐藏。
- 样张三件套：本包不新增任何图片素材（截图=产品截图非"样张"，webm/png 动效素材=已过 HERMES-10 验收的产品交互录制，非外部图片）。
- A 包字段 `snake_case` 且与 01/02 现有 schema 一致：spots/sun_events 为原样导出（仅剥 meta），未改字段；`user_prefs` 为全新空表草案（无既有消费方，不受"schema 不擅改"红线约束，已在其 README 段注明）。
- 未修改任何现有文件（`git status` 确认仅 `agents_output/09/**` 为新增，见下方产物清单，无其他路径改动）。

## 遗留（如实列出，不隐藏）

1. **B-Figma 链接**：下一 session（Figma MCP 工具清单加载后）补齐，DoD 允许后置不阻塞。
2. **GL 3D 生长动画/光照时刻切换录屏**：按 Gate 0 红线裁定非硬性 DoD，待 #19 GL 稳定性测绘判定后补录。
3. **`interviews/manifest.md`**：本任务开始前已存在于 `agents_output/09/`（另一素材盘点交付，非本次五包范围），未改动，如实保留。

## 产物清单

35 个文件，`agents_output/09/{data,design,motion,prompts,skill,checks}/**`（`interviews/` 为前置存量，不计入本次交付）。完整列表见本 PR diff。
