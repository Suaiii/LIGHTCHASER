# HERMES-09 ｜ 迁移资产包（Migration Kit）——平台开放当天"开箱即传"

- **受众**：**混合**——A/C/D/E 四包=AI 编码代理；B 包 Figma 制作=人（路线待负责人拍板，AI 出清单与截图兜底）
- **状态**：待领
- **时间窗**：7.15–7.22（**硬截止 7.23 Gate 0**：7.24 平台开放当天必须开箱即传，这是一次性窗口的前夜）
- **占用文件**：`agents_output/09/**`（全新增）。只读引用现有数据/代码，**不改动任何现有文件**

## 0. 为什么做（对赛题的回答）

负责人 7.14 拍板：指望平台 AI 靠一段 prompt 一口气搭出架子不现实——"刷到一瞬间的打动"由**视觉动效质感 × 数据真实性**决定，两者都无法靠文字转述保真。平台官方文档已确认六条资产迁移通道（`docs/hermes/platform-capabilities.md`）：数据库 JSON 导入／Figma 链接／上传文件（含图片视频）／自建 Skill／知识库／@图片生成。本任务把我们**已有的一切**打成平台能直接吃的五个弹药包；7.24 由 HERMES-04 §4b 拿这些真弹药实测通道边界。

## 1. 背景（自包含）——已有资产盘点

| 资产 | 位置 | 状态 |
|---|---|---|
| 机位库 25 点 | `agents_output/01/spots.v1.json` | ✅ 校验 0 error，坐标 OSM 核验 |
| 太阳事件 450 条 | `agents_output/02/sun_events.v1.json` | ⚠️ 待补太阳高度角（HERMES-02 顺手项：azimuth_10min→sun_pos_10min） |
| 文案弹药 | `agents_output/03/`（8 硬规则提示词 + few-shot 10 组 + 27 格兜底语料） | ✅ ARK 盲测过 |
| 设计 tokens/规范 | `agents_output/04/tokens.md`、`first5s_spec.md`、`page_specs.md` | ✅ |
| 设计判断规则 | `.claude/skills/zhuiguang-design/SKILL.md`（StyleSeed+UICraft 评分+动效选择规则+前5秒红线） | ✅ 本地 skill，可重封装 |
| 原型本体 | `public/追·光.html`（feed 卡+四页）＋`public/light-map-gl.jsx`（P2 3D 光影地图） | ✅ `npm run dev:preview` 可跑 |
| e2e 截图/序列帧管线 | `scripts/e2e/*.mjs`（支持 `ZG_PROXY`/`ZG_E2E_OUT` 参数化） | ✅ 已能产 step-XX.png 与拼图 |
| 初赛素材（上海） | `assets/`（静安寺照片/视频） | 仅垫图参考，非深圳，不入正式包 |

**缺口**（本任务补齐）：Figma 稿（蓝图 PART-X 一直待排）、动效规格清单、原型动效录屏、建表话术、提示词的"平台可贴"重排、Skill 草案。深圳样张属外联/实拍线（7.28），不在本任务。

## 2. 目标——五个子包，7.23 前齐

- **A 数据包**（AI）→ `agents_output/09/data/`：五表 JSON 定稿导出（spots／sun_events／weather_daily 样例+双预案说明／copy_corpus／user_prefs 空表 schema）+ **每表一段建表话术**（官方格式：表名+包含什么数据+获取和存储逻辑，≤3 句）。
- **B 设计包**（人+AI）→ `agents_output/09/design/`：①AI：每页"像素级保真元素清单"（从 tokens.md/page_specs.md 提炼，含具体色值/字号/间距）②AI：高清截图集（feed 卡+四页，e2e 管线产，输出用 `ZG_E2E_OUT` 指到本目录）③人：Figma 稿——**已拍板：工具转换+人工整理**。做法：`npm run dev:preview` 起原型 → 用 html.to.design 类 Figma 插件逐页导入（feed 卡+四页）→ 人工整理图层命名/删冗余（约半天，需一个 Figma 账号）；以①的保真清单为整理对照，完成后把**可访问链接**写进 `agents_output/09/design/figma_link.md`。
- **C 动效包**（AI）→ `agents_output/09/motion/`：①动效规格清单——每条五要素（名称/位置/时长/缓动/触发）+ 优先级（招牌｜重要｜锦上添花），P2 生长动画=已知招牌；②原型动效录屏（P2 生长动画/光照时刻切换/金线绘制）mp4 或分段 GIF，总时长 ≤60s——官方通道"上传文件支持视频"，这是动效意图最高保真的传达方式。
- **D 提示词包**（AI）→ `agents_output/09/prompts/`：AGENT_03 全套重排为平台可贴格式，按三场景分块（行动文案/拍摄建议/评分解释），每块=硬规则+few-shot+兜底策略；**硬规则原文不删改**。
- **E Skill 草案**（AI）→ `agents_output/09/skill/`：把 zhuiguang-design 规则重封装为「追光设计系统」平台自建 Skill 内容稿（何时触发/规则正文[tokens+前5秒红线+动效规则+文案硬约束]/校验清单三节）；附平台资源库检索清单（先找现成 `frontend-design` 类 skill，找到则草案降为补充规则）。

**不做什么**：不动任何现有数据/代码文件（schema 改动走 AGENT_05 R2 拍板）；不猜测通道容量边界（那是 HERMES-04 实测）；不替平台写任何实现代码。

### 2b. 附件硬规格（7.14 深夜质检环回填——开局序列 v1.2.1 的话术以这些规格为前提，逐条必须落实）

- **A 包**：①导出文件**剥离 meta 节点**，交付纯数组 JSON（文件首个非空白字符=`[`）②包内 README 声明：联接键 `spots.id ↔ sun_events.spot_id`；`azimuth_10min` 为嵌套数组、期望整列按 JSON 文本保存 ③weather_daily 演示数据**日期参数化**：交付一键再生成脚本（以运行日为 D0，覆盖 D0/D+1 两行以上），7.24 晨重跑一次；含**"是否有雨"字段**；文件内标"演示用假数据" ④copy_corpus 每行含**显式取格键字段**，README 写明取格规则（27 格的维度定义） ⑤附 sun_events **切片脚本**（若平台导入上限 <450 行时启用，对应序列 R0-3 备用块）。
- **B 包**：截图文件名**强制 `feed / p1 / p2 / p3 / p4`**（序列 R0-8 回声要平台复述映射）。
- **C 包**：录屏中**首个动效的起止清晰可辨**（R0-8 回声问"第一个动效持续几秒"，剪辑别拼太碎）。
- **E 包**：文件名固定为**《追光设计系统》**（话术按此称呼引用）；文档顶部显式框出**"必守三条"**：主色色值／文案字数上限／动效第一规则——与序列 R0-7 回声一字对齐。

### 2c. 三板块整合联动（7.15 增补——条件开关，48h 内由负责人拍板落定，工作者领取时先看本节最新状态）

负责人 7.15 拍板产品结构 4→3（全案见 `docs/hermes/product-arch-v3.md`），本任务书两处受联动，**当前均为"待拍板"状态，先做不受影响的部分**：

- **【开关 D-a·photos 第 6 表】**
  - 拍板"加"：A 包增加 `photos.v1.json`（板块二气泡数据源）——schema 与种子由 **HERMES-10 phase 1 出（7.18 前）**，本任务只做"接收+打包+建表话术一段"。
  - 拍板"不加"：按五表交付，气泡走 spots.sample 静态兜底（decisions.md 会留痕）。
  - **超时兜底**：7.19 仍未收到 photos → 按五表交付并 README 标注"photos 表随 v1.3 补传"。
  - **拍板结果落点（双通道）**：decisions.md 顶部 + issue #25 评论；工作者领取时先看本节与 #25 最新状态。
  - **表数变化联动 first_prompt 话术由 Hermes 改，工作者不动 first_prompt。**
- **【开关 D-b·B 包截图命名】**待拍板"原型重排"：feed/p1/p2/p3/p4 命名可能变为三板块命名。**7.17 前一律以现状四页截图照做**（截图管线参数化，重排后由 HERMES-10 p2 触发重跑，成本≈0）；Figma 转换子项同理不等拍板。**7.17 后仍无拍板：继续按现状四页交付，不停手**（过渡产物属留痕，见开发规范 §10 过渡豁免）。
- **C 包新增条目（立即生效）**：动效清单加"照片气泡浮现/时间胶囊切换重聚合/半屏卡升起"三条（实现前无录屏，用文字规格五要素顶格写，标注"待 HERMES-10 phase 2 录屏补"）。
- **E 包新增（立即生效）**：《追光设计系统》补"图层亮度纪律：金色路线 > 见光点 > 照片气泡"一条（D-c 建议档，拍板后若排序有变由 Hermes 通知）。

## 3. DoD（验收标准，二元）

- [ ] A：**5 个 JSON（若 D-a=加且 7.19 前收到 photos：6 个）齐**；`node agents_output/01/validate_spots.mjs` 对 spots 副本跑绿；sun_events 行数=450（若 alt 字段 7.20 未到位，出 az-only 版并在包内 README 标注）；**建表话术段数与表数一致，各 ≤3 句**。
- [ ] B：保真元素清单每页 ≥8 条且引用 tokens 具体值；截图集覆盖 feed 卡+四页（≥5 张，1x/2x 各一套）；命名/覆盖按 §2c D-b 状态（未拍板前四页）。
- [ ] B-Figma（人，可后置至 7.23、不阻塞本 PR）：转换+整理后的 Figma 链接可访问、页面命名规范，链接落 `agents_output/09/design/figma_link.md`，补进 check_report。
- [ ] C：动效清单 ≥8 条且五要素+优先级齐；录屏文件本机可播放，内容含 P2 生长动画与光照时刻切换两段。
- [ ] D：三场景块齐；硬规则与 `agents_output/03/` 原文 diff=仅排版差异。
- [ ] E：草案三节齐；检索清单 ≥5 个待查 skill 关键词。
- [ ] §2b 附件硬规格逐条落实（A 包 5 项/B 包命名/C 包剪辑/E 包必守三条），check_report 逐条对勾。
- [ ] `agents_output/09/checks/check_report_09.md`：上述逐条带证据（命令输出/文件清单/播放截图）。

## 4. 输入材料

§1 表格全部路径 + `docs/hermes/platform-capabilities.md`（通道依据）+ `docs/追光_Agent开发规范.md` PART-X 节（Figma/tokens 交接原设计）。

## 5. 红线

- F6：假数据必须在文件内标"演示用假数据"；weather_daily 样例不得伪装成实测值。
- 样张三件套：任何图片素材入包须 credit/consent 齐全或明确标"垫图-不入正式包"。
- A 包字段 `snake_case` 且与 01/02 现有 schema 完全一致——发现想改 schema，停下来报 Hermes，不擅改。
- C 包录屏如遇 3D 不稳定（HERMES-07 范畴），录制失败素材不许拼凑，报障。

## 6. 依赖与顺序

C 包依赖 3D 稳定（HERMES-07 已过验收 → 可录）；A 包 alt 字段依赖 HERMES-02 顺手项（7.20 为界，未到即 az-only 版）；B 包 Figma 子项已拍板路线（工具转换+人工整理），人力档期自排，**不阻塞其余全部工作**。

## 7. 交付方式

分支 `feat/hermes-09-migration-kit`，PR 目标 main，body 链 `check_report_09.md`。Hermes 验收=逐条跑 DoD + 抽查录屏可播。
