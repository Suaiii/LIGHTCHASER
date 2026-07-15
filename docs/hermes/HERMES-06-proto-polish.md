# HERMES-06 ｜ 原型收尾包：P1 前5秒违规修复 + P3 打磨 + P4 相机 HTTPS

> **⚠️ 7.15 拆单增补（三板块整合，全案见 `docs/hermes/product-arch-v3.md`）**：
> ①本任务拆为 **06a＝目标 1（P1 前 5 秒）+ 目标 3（P4 HTTPS），立即有效**；**06b＝目标 2（P3 打磨）→ 取消**（D-b 按建议"重排"推进：P3「社区」列并入板块二地图气泡层，由 HERMES-10 承接，无独立 P3 可打磨；如负责人改判"不重排"再解冻）。
> ②**开工顺序前置**：PR #29（AI 相机并入 P4，+881/-328，重写 SceneQuickShoot）与本任务占用文件完全重叠——**先等 #29 终审合入 main 再开工并 rebase**，否则必起实质冲突。与 HERMES-10 p2 同动 subpanels.jsx，**按区段划界**：06a 只碰 QuickShoot/P1 区段、10-p2 只碰 SceneCommunity/地图区段；顺序 #29 合入 → 06a → 10-p2 接管 rebase。
> ③背景修正：§1 的 P4 描述（"QuickShoot 已实现 getUserMedia+CSS 滤镜"）在 #29 合入后过时——新现状=CameraSession 共享会话+LUT 真渲染成像+23 套滤镜抽屉，HTTPS 真机路径仍缺（#29 自列人工项），**目标 3 照做且是 #29 的直接补位**。
> ④DoD 口径注记：「四页横滑无回归」在列结构重排（D-b）前照旧执行；重排后口径由 Hermes 更新。

- **受众**：AI 编码代理
- **状态**：待领（06a 可领；06b 冻结）
- **时间窗**：7.15–7.19（06a；以 #29 合入为起点顺延）
- **占用文件**：`public/app.jsx`、`public/subpanels.jsx`、`public/追·光.html`、`scripts/dev-preview.js`（仅 HTTPS 方案需要时）。**禁止触碰** `public/light-map-gl.jsx`（被 3D 存量任务占用）与 `public/legacy-v1/`（1.0 快照）。

## 0. 为什么做（对赛题的回答）

评审锚点"刷到的一瞬间"几乎全部发生在 P1 封面的前 5 秒——它是 30% 体验完整性权重的主战场；P4 真相机决定"拍摄建议"是演的还是真的（AI×产品 15%）。这批是把已知的、清单化的缺口收干净。

## 1. 背景（自包含）

- 原型：React 18 UMD + Babel Standalone 无构建，四页横滑（P1 封面/P2 光影地图/P3 机位/P4 快拍），`npm run dev:preview` → http://127.0.0.1:5174/。
- **P1 三处前 5 秒违规**：`docs/first5s_spec.md` 已逐条列出违规点与期望行为（K5 反检出记录），对照修复即可；设计约束查 `docs/tokens.md`（色卡/字阶/动效三档）与 `.claude/skills/zhuiguang-design`（评分规则：payload 永不动画化、前 5 秒信息效率 30 分权重）。
- **P3 机位卡**：对照 `docs/fidelity_scorecard.md` P3 页的 10 项打分表，把"待达标"项清掉（数据源=真实 spots + sun_events，已在 payload 里，纯呈现层工作）。
- **P4 相机 HTTPS**：`public/subpanels.jsx` 的 QuickShoot 已实现 getUserMedia + CSS 滤镜实时渲染 + vision-engine 识别；`denied` 态已明示"需 HTTPS"。问题：getUserMedia 只在 secure context 可用——`127.0.0.1` 可以，**手机真机访问局域网 IP 不行**。需要给演示场景一条真机可用路径。

## 2. 目标

1. P1 三处违规按 first5s_spec 修复（改动最小化，不重设计）。
2. P3 按 fidelity_scorecard 清"待达标"项。
3. P4 真机路径二选一实现并写清用法：
   - a) `dev-preview.js` 加自签名 HTTPS 模式（`npm run dev:preview -- --https` 之类），README 写清手机信任证书步骤；
   - b) 文档化隧道方案（如 `npx localtunnel`/`cloudflared` 免费通道），写进演示手册。
   选择标准：**赛场无外网依赖优先**（a 优于 b），但 a 的证书信任步骤若在安卓/iOS 上超过 5 步，则 a+b 都给。
4. 每处改动过 `zhuiguang-design` skill 自评（设计分不倒退）。

**不做什么**：不改 P2（被占用）；不动 1.0 快照；不引入构建工具（保持无打包器架构——F2：最终产物是给平台 AI 的规格，原型保持可读）。

## 3. DoD（验收标准，二元）

- [ ] `docs/first5s_spec.md` 三处违规逐条对照截图（修复前/后），K5 反检出重跑通过。
- [ ] `docs/fidelity_scorecard.md` P1/P3 页无"待达标"项（表格更新提交）。
- [ ] 真机路径：手机（安卓或 iOS 至少其一）实拍走通 P4 相机权限授予 → 滤镜实时预览，录屏为证；步骤文档 ≤10 步。
- [ ] `npm run test:api` 绿；四页横滑/降级链（GL→Three→classic）行为无回归（手测清单：Tweaks 切三形态各截一图）。
- [ ] 未触碰占用文件（`git diff --stat` 中不出现 light-map-gl.jsx / legacy-v1）。

## 4. 输入材料

| 文件 | 看什么 |
|---|---|
| `docs/first5s_spec.md` | 三处违规清单与期望（本任务的需求本体） |
| `docs/fidelity_scorecard.md` | P1/P3 打分表 |
| `docs/tokens.md` | 色卡/字阶/圆角/动效三档（改样式的唯一依据） |
| `.claude/skills/zhuiguang-design/SKILL.md` | 设计自评规则 |
| `public/app.jsx` / `subpanels.jsx` | P1/P3/P4 实现 |
| `scripts/dev-preview.js` | 静态服务（HTTPS 方案挂点） |

## 5. 红线

- 设计令牌之外不引入新颜色/字号（tokens.md 是唯一来源）。
- payload 数据（评分/时间/机位名）永不参与动画（skill 红线）。
- P4 识别失败时的兜底口径保持"构图引擎"（不冒充 AI 识别成功）。

## 7. 交付方式

分支 `feat/hermes-06-polish` → PR 目标 main，body 链本任务书 + 前后对照截图 + 真机录屏。
