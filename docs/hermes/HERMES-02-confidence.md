# HERMES-02 ｜ 晚霞算法：置信度输出 + 多源交叉 + 市面算法对标

> **🔻 7.19 瘦身（负责人裁：08 归档 + 02 瘦身）**：晚霞在 v4 已从招牌降为**差异化锋刃之一**，招牌改为"实时地理小社区"。**本任务大幅收缩**：
> - **保留（最小集）**：现有晚霞引擎能用不崩 + **一句可信的话术**（如"今晚 82 分·把握较高"这类置信度标签的最简版），够撑锋刃叙事即可。
> - **搁置（不做）**：置信度全套建模、**多源交叉**、**市面算法竞品对标**、`晚霞算法对标.md` 研究 —— 这些是把晚霞当招牌时的深投，现不划算。
> - **释放**：把人手让给轴二（HERMES-10 实时社区/实时冒泡）这条招牌关键路径。
> 下方原文按此横幅重读——凡"多源/对标/置信度全套"降为"未来 roadmap，本期不做"。若锋刃叙事实测需要更强的置信度，再按需局部复活。

- **受众**：AI 编码代理
- **状态**：🔻瘦身（7.19）：保引擎可用 + 一句可信话术；多源/对标/置信度全套搁置
- **时间窗**：按需（不占 Gate 0 关键路径）
- **占用文件**：`lib/sunset-service.js`（如存在评分组装处）、`api/sunset.js`、新增 `agents_output/02/confidence_spec.md`、新增 `agents_output/02/checks/hermes02_*`、新增 `docs/研究/晚霞算法对标.md`。**不许改** `agents_output/02/light_engine.js` 的评分函数体与 `WEIGHTS`。

## 0. 为什么做（对赛题的回答）

赛题锚点："刷到的一瞬间被打动、被满足"。卡片说"今晚 82 分值得出门"，用户出了门却哑火——第二次刷到就再也不信了（复访动机=延展 15% 也崩）。**算法必须知道自己什么时候没把握，并诚实说出来**："高 82 分·把握较高"与"高 82 分·把握一般（气象源有分歧）"是两张完全不同的卡。这同时是 AI×产品结合（15%）的直接加分项：AI 不只给结论，还给不确定性。

## 1. 背景（自包含）

- 评分引擎 `agents_output/02/light_engine.js`：纯函数五因子加权 `WEIGHTS = { cloud:0.35, humidity:0.20, visibility:0.20, sun:0.15, air:0.10 }`（`light_engine.js:67`），输出 `{score, label, factors, contrib}`（`:71-90`）。可解释性好（contrib 给每因子贡献），**但没有置信度/不确定性概念**。
- 因子细节：f_cloud 用低/中/高云分层（低云 ≥70 封顶 ≤0.2——低云是晚霞杀手）；f_humidity 钟形 40–70；f_visibility 10km 饱和；f_sun 距日落 ±40min；f_air 按 WMO weather_code 惩罚。规格见 `agents_output/02/score_spec.md`。
- 数据源：Open-Meteo `hourly=cloud_cover_low,cloud_cover_mid,cloud_cover_high,relative_humidity_2m,visibility,weather_code`，日落 ±90min 逐小时均值（`agents_output/02/checks/backtest_c6.mjs:8-10`）。
- 双预案（`agents_output/02/weather_ops.md`）：A=在线 API（Open-Meteo 首选/和风备用）；B=人工每日两次录入。**多源目前只是"备用"关系，从未做过交叉校验**。
- C6 回测：真实深圳 8 天天气客观排序合理（雷暴日降档、高云通透日高分），但只验了排序、没验"绝对准不准"。
- **治理红线（AGENT_00 F6/§8，写进 CLAUDE.md）**：评分因子/权重改动只在指定"调参口"，**不加维度**。→ 本任务的 confidence 是**元信息**（对"输入数据可信度"的度量），不是第 6 个评分因子；score 的数值在任何输入下必须与改动前**逐位一致**。

## 2. 目标

三件事，彼此独立可分批交付：

**A. 不确定性度量 → confidence 字段（两条实现路线，按序验证，选定一条并说明依据）**

*路线 A1（优先验证，开源杠杆）：***Open-Meteo Ensemble API 集合预报**——`ensemble-api.open-meteo.com/v1/ensemble`（免费，与现有 Open-Meteo 同生态）。集合预报 = 同一模型扰动初值跑 N 个成员，**成员间离散度(spread)就是气象学标准的不确定性度量**，比拼装多个数据源更专业、更省事、可讲进路演（"我们用的是 ECMWF/ICON 集合预报的官方不确定性"）。
- 拉 `cloud_cover`/`relative_humidity_2m` 各成员在日落 ±90min 的值 → spread 归一 → confidence 三档
- 须实测确认：ensemble 变量是否含云量分层（`cloud_cover_low/mid/high`）；若只有总云量，则 spread 用总云量、评分输入仍取现有确定性预报（设计写进 `confidence_spec.md`）
- 深圳覆盖、免费额度、响应延迟一并实测记录

*路线 A2（A1 不可行时的保底）：多源交叉*——Open-Meteo（现有）+ MET Norway `api.met.no`（免费无 key，UA 必填）+ 和风（若 key 可得；无 key 两源也可接受）；对 `cloud_low/mid/high/humidity` 计算跨源极差归一加权（权重与 WEIGHTS 同构）。

- 两条路线输出相同接口：三档 `confidence: high | medium | low` + `confidence_detail`（成员/源明细数值表，供卡片"为什么"弹层引用）。
- `/api/sunset` 响应新增这两个字段（**加字段，不改任何现有字段**）；来源标注 `meta.sources=[...]`。

**B. 回测挂钩**：把 confidence 接进现有回测 `backtest_c6.mjs` 思路——跑最近 8 天，报告各天 confidence 分布，验证"分歧大的天确实是天气系统不稳的天"（定性核对即可）。

**C. 市面晚霞算法对标文档** `docs/研究/晚霞算法对标.md`：
- 调研 ≥3 家：SunsetWX（sunsetwx.com，学术出身）、莉景天气（国内摄影圈事实标准）、其余自选（如 Alpenglow、Skyfire、HF 气象类论文）。
- 对照表：各家用什么因子（云层分层？气溶胶？湿度？）× 我们五因子——**结论落在"我们的因子选择与市面主流方法一致/差异及理由"**，供 AGENT_08 路演引用（评委问"你们算法凭什么"时的弹药）。
- 红线：只引用公开资料，注明出处链接与访问日期；拿不到细节的写"未公开，据 X 推断（置信度低）"。

**不做什么**：不改评分公式/权重/因子（连注释都别动 light_engine.js 的函数体）；不做机器学习拟合；不做历史爆发日回测（另行任务）。

## 3. DoD（验收标准，二元）

- [ ] `curl "http://127.0.0.1:5174/api/sunset?city=shenzhen"` 响应含 `confidence`（三档之一）与 `confidence_detail`（ensemble：≥N 成员摘要；多源：≥2 源 × ≥4 字段数值表）、`meta.sources`；**现有字段无一变化**（用改动前后响应 diff 证明，demo 模式 `?demo=high|mid|low` 三档照旧）。
- [ ] 报告写明 A1/A2 路线选择依据（ensemble 变量覆盖/延迟实测数据）。
- [ ] `node agents_output/02/light_engine.js --selftest` 输出与改动前逐字节一致（引擎零改动的证据）。
- [ ] `confidence_spec.md`：分歧度公式、三档阈值、以及"为什么这不是第 6 因子"的治理说明（≤60 行）。
- [ ] 回测报告：最近 8 天 confidence 分布 + ≥1 个"分歧大→confidence 低"的实例数据。
- [ ] 对标文档：≥3 家因子对照表 + 每家来源链接 + "我们方法的依据"结论段（≤120 行）。
- [ ] MET Norway 调用带正确 UA（其服务条款要求），频率 ≤1 req/s。
- [ ] `npm run test:api` 绿。

## 4. 输入材料

| 文件 | 看什么 |
|---|---|
| `agents_output/02/light_engine.js` | 评分接口签名（**只读**） |
| `agents_output/02/score_spec.md` / `weather_ops.md` | 因子规格、双预案、Open-Meteo 字段 |
| `agents_output/02/checks/backtest_c6.mjs` | 回测怎么拉数据（照抄取数方式） |
| `api/sunset.js`、`lib/` 下 sunset 相关 | 响应组装处（confidence 注入点） |
| `CLAUDE.md` §1 §4 | Node 直连 fetch 可用；本地跑法 |

## 5. 红线

- **score 数值零变化**（DoD 第 2 条是硬证据）；confidence=元信息。
- F6：多源数据如实呈现，源挂了就标 `source_unavailable`，不许用单源冒充多源。
- 外部 API 守礼：UA、限频、超时 8s 与现有一致；和风无 key 就用两源，不许写死伪 key。
- 对标文档不抄袭原文表述，引用注明出处。

## 6. 调参口

分歧度权重与三档阈值集中在 `confidence_spec.md` 声明 + 代码中单一常量对象（如 `CONFIDENCE_THRESHOLDS`），验收时核对两处一致。

## 7. 交付方式

分支 `feat/hermes-02-confidence` → PR 目标 main，body 链本任务书 + DoD 自核对 + 响应 diff 证据。可拆两个 PR（A+B 一个，C 一个）。
