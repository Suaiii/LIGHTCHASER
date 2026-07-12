# 开发日志 · 追·光 2.0

> Dated 流水，记录每次开发做了什么、关键决策、遇到的问题、下一步。稳定的工程约定见 `CLAUDE.md`。新条目置顶。

---

## 2026-07-12 (二) · 仓库合流：唯一仓库 = LIGHTCHASER

### 背景
用户明确："永远只用一个仓库 github.com/Suaiii/LIGHTCHASER，所有改动都在上面体现"。此前同日建的 zhuiguang-2.0 双仓方案作废。

### 做了什么
1. **拉取队友工作**：main 领先的 7 个提交 = 完整 **AI 相机系统**（vision-engine.js 318行 + photo-renderer.worker + 授权滤镜缩略图 + test-ai-camera.js 446行 + `/ai-camera.html`，~11.8k 行）。
2. **submodule 反转**：absorbgitdirs 逆操作（.git/modules/prototype → prototype/.git，删 core.worktree），prototype 恢复独立仓库并切到最新 main。
3. **内容迁移 + 压平**：Thoughts/ agents_output/(01/02/03/07) assets/ _archive/ docs(子目录合并) CLAUDE/DEVLOG 迁入仓库；README 合并（LIGHTCHASER 原文+2.0导航）；.gitignore 合并（补 ark.env/zip/.claude）；prototype/* 整体上移，**本目录即 LIGHTCHASER clone 根**。douyin.pem 被 ACL 锁（owner 只读），icacls 授权后移出。
4. **路径修复**：gen_sun_events.mjs suncalc 路径 → `../../node_modules/suncalc`；README/CLAUDE 全部去 prototype 引用。
5. **GitHub 收尾**：5 个 issue 迁到 LIGHTCHASER（**#9 外联 / #10 文案 / #11 可颂[闭] / #12 3D光影backlog / #13 体验规格**）；旧 PR #6/#7 关闭注明去向；**zhuiguang-2.0 归档**（可逆，未删）。
6. **验证**：压平后全绿——sun_events 450/idMatch、validate 0 error、light_engine 三档、`npm run test:api` 过（队友代码无冲突）。

### 遗留
合流 PR（feat/zhuiguang-2.0-import → main）与 PR #8 待人工 merge。

---

## 2026-07-12 · git 基建 + AGENT_07/03 双交付 + 可颂工具链验证

### 做了什么
1. **git 基建（Step 0）**：根目录 git init → 推 [zhuiguang-2.0](https://github.com/Suaiii/zhuiguang-2.0)（private）；prototype 转 **submodule**（absorbgitdirs，保留 LIGHTCHASER 独立历史）；.gitignore 挡密钥/大 zip/node_modules；建 5 个跟踪 issue；规范§15 升级为 issue→branch→PR→merge 流程；LIGHTCHASER zys→main 复用既有 [PR #8](https://github.com/Suaiii/LIGHTCHASER/pull/8)（干跑无冲突，body 已补，**待人工合并**——合并动作被权限层正确拦下，AI 不自行 merge）。
2. **AGENT_07 外联工具件**（[PR #6](https://github.com/Suaiii/zhuiguang-2.0/pull/6)）：三平台私信模板+台账+访谈提纲+7.28 实拍路线（golden 18:37/日落 19:08 实测值）。
3. **AGENT_03 文案引擎**（[PR #7](https://github.com/Suaiii/zhuiguang-2.0/pull/7)）：**用用户提供的火山 ARK API 真跑豆包盲测**。三轮迭代：R1 4/10（发现 few-shot 自带幻觉源——样例里的 18:37 不在输入 JSON，模型学会编时刻；rubric① 对劝退场景误判）→ R2 5/10（幻觉清零，失败收敛为缺具体时间）→ R3 **8/10 C1 达标**；n40 终判**幻觉 0/40 C2 达标**（判分器修正：海堤/城市等通用词不作跨机位幻觉信号，误报核实后清零）。
4. **可颂采集工具链探测**（issue #3 已关）：无浏览器 MCP，但 Playwright 1.61.1+chromium 缓存可用 → SOP 交付（只取事实不搬图），待人收首批分享链接。

### 关键决策
- 2 人口径（H1/H2）正式确认；AGENT_02 改口径"数据层✅/UI 待升级"，3D 光影地图愿景入 issue #4 backlog。
- ARK key 存 `agents_output/03/ark.env`（gitignore 验证未入库）；本地盲测 seed-2.0 vs 平台 seed-2.1 差异显式标注，复测挂 AGENT_06 K3。
- AGENT_03 §9"连续两轮<8/10"曾形式触发：因失败模式已收敛至单一修复点，执行一轮定向修复后达标，全程留痕（check_report K2）。

### 遗留（open）
待人工：merge 三个 PR（LIGHTCHASER#8 / zhuiguang#6 / #7）、⑤⑥语气盲评（~20min）、外联发送启动（**最急**）、可颂 scrape_targets 首批链接。详见 CLAUDE.md §6。

---

## 2026-07-12 · 项目结构完整重整

### 做了什么
把有机生长出来的散乱结构完整重整为清晰目录（**归档不删、可回退**）：
- **docs/**：集中所有文档——`docs/追光_Agent开发规范.md`、`docs/立意/{思路,中文故事}.md`、`docs/赛道细则/{instruction.md,.pdf,image/}`。
- **prototype/**：初赛原型（原 `追·光/LIGHTCHASER/`，含自身 git repo）。
- **assets/**：初赛原始素材（视频/头像/静安寺 + zip、mmexport 图、uploads/scraps）。
- **_archive/**：`agent.md`（外部模板）、`追光_大区赛转型升级计划.md`（已被 v2 取代）、`光报/分工.pdf`、初赛散落 jsx + `追·光.html`（已被 prototype/public 取代）。
- **保留不动**：`Thoughts/`、`agents_output/`（规范已固化、脚本依赖），`CLAUDE.md`/`DEVLOG.md` 留根。
- 新增 **README.md** 导航入口；`追·光/` 空壳目录已删除。

### 遇到的问题与处理
- `set -e` 下移动 `思路.md` 遇 Git Bash 中文编码报错，一度只剩一份副本——核对为 5986 字节原内容无丢失（根与 Thoughts 两份原本相同），已放回 `docs/立意/思路.md`。
- `gen_sun_events.mjs` 有 3 处硬编码绝对路径（suncalc 指向旧 LIGHTCHASER）——改为**相对路径**（`../../prototype/node_modules/suncalc`、`../01/spots.v1.json`、`./sun_events.v1.json`），位置无关。
- 同步更新所有旧路径引用：`CLAUDE.md`（结构/运行/技术栈）、`docs/追光_Agent开发规范.md`（§1/§10/§15）、两份记忆文件（suncalc 路径 + 原型位置）。

### 验证
重整后重跑全部脚本仍绿：`gen_sun_events` 450 条 idMatch=true、`validate_spots.py` 原生 0 error、`light_engine --selftest` 100/66/29；agents_output 脚本无旧路径残留。

---

## 2026-07-12 · 适配《追·光 Agent 开发规范》

### 做了什么
- 派一个 general-purpose 子代理，把外部项目模板 `agent.md`（剧本工具的 16 节《Agent 开发规范》）的**结构骨架**适配到追·光，产出 `追光_Agent开发规范.md`（新文件，未覆盖 `agent.md`，未建外部目录树）。
- 内容取自 `Thoughts/AGENT_00`（宪法）+ `追光_总设计蓝图_v2`（Parts/阶段/Gate）+ `CLAUDE.md`（约定）+ AGENT_01–08。逐节核对关键事实，全部对齐源文件，验收通过。

### 关键判断 / 冲突处理（如实标注，未强行统一）
- **团队 2 vs 3 人**：AGENT_00 说"两人 H1/H2、A/B/C 作废"，v2 用"三人五 Part"。规范保留五 Part（任务域非人头），落到人以 H1/H2 为准，人数标「待确认」。
- **真理源优先级**：规则(instruction) > 宪法(AGENT_00)/蓝图(v2) > 其余；转型升级计划 + LIGHTCHASER Vite/Vercel 路线归"仅追溯"。
- **D1 日期**（7.31 vs 7.28）、迭代轮数（取 AGENT_05 的 R1→R13）、instruction.md 为截图无正文——均保守处理。

### 决策
- 输出为新文件不覆盖 `agent.md`（保留外部模板作参照）；只产规范文档，不物理 scaffold issues/、docs/final/ 等（映射到已有 Thoughts/、agents_output/）。**可逆，用户可要求改为覆盖或建目录。**

### 下一步候选
规范 §16 推荐：AGENT_03 文案引擎（首选，纯 AI，Gate 0 必需）／ AGENT_04 体验规格（冲 30% 权重，需结对）。

---

## 2026-07-11 · 大区赛转型启动 + 数据地基交付

### 做了什么
1. **通读工作区**：思路.md / 中文故事.md / 初赛 LIGHTCHASER 前后端源码 / instruction.md（赛道三细则截图 ×11）/ Thoughts 编队 AGENT_00–08 / 转型升级计划。
2. **校准赛道认知**（重大）：赛道三是「AI体验·刷到懂你的瞬间」，评审锚点"刷到一瞬间是否被打动/满足/自然互动"。评审五维：场景洞察20 / AI×产品15 / **体验完整性30(最高)** / 用户价值20 / 延展15。**大区赛必须用抖音AI平台做 feed卡+小程序**（初赛的 React 网页只算交流赛模拟）。确认赛期 **7.31–8.2 深圳**（非转型计划里写的 7.28）。
3. **交付 AGENT_01 机位库**：`spots.v1.json` 深圳 25 机位（配比 14/4/5/2）+ `validate_spots.py`（+ Node 平价版）+ `spots_readme.md` + 检查报告。
4. **交付 AGENT_02 光线引擎**：`sun_events.v1.json`（suncalc 预计算 25×18=450 条）+ `light_engine.js`（评分公式 v2 + 顺逆侧光判定，自检 100/66/29）+ `score_spec.md` + `weather_ops.md` + 检查报告。
5. **补齐工程文档**：写 `CLAUDE.md`（技术栈/规范/结构/运行/清单/状态）+ 本 `DEVLOG.md`。

### 关键决策
- 现有 LIGHTCHASER **不作废，转为设计蓝本 + 素材库**（评分逻辑/机位/色卡/动画平移进平台 Vibecoding）。
- 机位库主城市 = **深圳**（评委即用户即深圳）；晚霞 sunset 机位 bearing 锁 240–300。
- 评分公式 v2 锁 **5 因子**（云分层/湿度/能见度/时窗/天气码），可解释优先，算例可手工复算。
- Python 用 **anaconda 3.12.7**；脚本网络请求走 Node global fetch。

### 遇到的问题与处理
- **本机系统 python 损坏**（`py`→Python313 缺失、Store 版空壳）→ 改用 anaconda 全路径 `E:\anaconda\python.exe` + `PYTHONUTF8=1`，`validate_spots.py` 原生跑绿。
- **飞书细则文档需登录抓不到** → 用户已把截图存入 `instruction.md`，据此校准。
- **坐标核验捕获真错误**：`szw-012 春茧` 原坐标 (22.4870,113.9740) 经 OSM 反查落**香港元朗**；用 Nominatim 正向搜索取权威坐标 **(22.5213,113.9448) 南山区粤海街道** 修正，sun_events 已重生成，复查 25/25 落正确深圳区县。
- **两处 DoD 遗留已推进**：C3/K2 坐标核验从"待浏览器"→ **OSM 反查 25/25 区县级闭环**；C6 回测用**真实 Open-Meteo 深圳天气**跑出客观排序（晴空日正确判中档、雷暴日正确降档），仅剩主观打分人工半。

### 当前遗留（open）
1. 30m 级精确站位 + 步导图 → 7.28 实拍（既定）。
2. C6 主观打分比对 → 5 分钟人工。
3. C2 权威日落截图归档 → 1 张存证。
4. 样张三件套 25/25 留空 → AGENT_07 授权外联回填。
5. 可颂数据源接入方式未定 → 确认浏览器爬虫工具链 + 数据可授权性；列入 7.24 平台答疑。
6. 天气 A/B 选型 → AGENT_06 7.24 平台测绘。

### 下一步候选
AGENT_03 文案引擎（已解锁，纯 AI）／ AGENT_04 体验规格（首屏 first5s，需结对）／ AGENT_05 需求包（需 04）／ 可颂浏览器爬虫工序。
