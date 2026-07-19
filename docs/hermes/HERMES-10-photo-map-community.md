# HERMES-10 ｜ 轴二：地图照片气泡实时社区层（提案制）

> **⚠️ 7.18 v4 战略转向增补（母文档 [product-arch-v4.md](product-arch-v4.md)，取代 v3）**：产品收为**两轴**，本任务的"板块二"即 **轴二·GL 3D 地图实时社区（招牌+核心）**，权重升。三处改口径：
> ① **photos.score_at_taken 通用化**：从"拍摄时晚霞评分"改为**"此刻值得度"（可空、场景无关）**——晚霞评分只是其一路来源信号（差异化锋刃），非唯一。字段名保留 `score_at_taken`，语义在 schema 设计说明里改为通用。
> ② **坐标红线放宽**：从"lat/lng 必须落深圳行政区"放宽为 **"演示单城可任选（深圳/上海皆可）、产品设计支持全国任意坐标"**；`photos` 自由散点模型本就全国就绪。**F6 红线保留**：静安寺（上海）素材禁赋深圳坐标仍是 Blocking 级（禁编造地点）——放宽的是"只能深圳"，不是"可以张冠李戴"。DoD 里"全部坐标落深圳"的反查改为"坐标与素材真实产地一致"。
> ③ **demo 密度双分支**：本任务 seed 数据量取决于 HERMES-04 #13 探针——平台开放附近内容=少量兜底即可（真实密度白来）；拿不到=单城造密度。schema/气泡层两分支都要能承载，phase 2 演示态口径随 7.24 定档。
> ④ **底座序**：v3"相位一 2D 先行"改为 GL 优先+2D 保底并行（见 HERMES-07/11）——但**本任务 phase 2 仍先在 2D Leaflet 版落地气泡**（保底、无 GL 依赖、可先出 demo），GL 版移植归 HERMES-11，两者不冲突。**Campus 实机拆解（`campus-teardown.md`）证实其地图即纯 2D 矢量、非 3D GL——"Campus 感"在 2D Leaflet 上即可 100% 兑现，本任务 phase 2 就是那块拿得稳的招牌。**
>
> **⑤ Campus 实机拆解落地（7.19，[campus-teardown.md](campus-teardown.md) + `assets/campus/`）**：负责人提供真机截图+屏录，抄板焦点＝"地图 tab 效果"。三处增补进本任务规格：
> - **§2.3 气泡视觉补第三形态「文字便签气泡」**：便利贴色块（桃/黄）、圆角、一句话闲聊/求助/问路（Campus 实证这是"此刻有活人在场"的关键，比纯照片更强的社区活人味；现原型 `NoteCard` 只有照片卡，便签为新增轻量 CSS 卡）。schema 侧：`caption`/`image` 已可承载"纯文字条目"（`image` 可空时即便签），设计说明须写明便签条目的字段取值。
> - **§2.3 补建议项「朝向光锥定位标」**：蓝点 + 随手机朝向转动的扇形锥（苹果地图同款，Campus signature；低成本高观感，Leaflet `L.divIcon` 小改）。列为建议项非硬 DoD。
> - **§2.3 第4节「点开半屏」补差异声明**：Campus 实录点气泡是**近全屏详情页**；本任务有意做**半屏 bottom-sheet 保持地图可见**（核心价值是把人留在"附近正在发生什么"的地图上，非逐帖深读）——**这是有意差异，实机对比时勿当遗漏**。

- **受众**：AI 编码代理
- **状态**：待领（phase 1 立即可开工；phase 2 有前置闸门，见 §6）
- **时间窗**：phase 1＝7.15–7.18；phase 2＝7.18–7.21（photos schema 7.18 前交 HERMES-09 用，7.21 全案交付）
- **占用文件**：phase 1 仅 `agents_output/10/**`（全新增）；phase 2 加 `public/subpanels.jsx`（`SceneCommunity`/`LightNavigationMap` 区段）+ `public/app.jsx`（feed 列结构）+ `public/scenes.jsx`（`SceneSpotDetail` 改造）——**phase 2 开工前置见 §6 闸门；与 HERMES-06a 按区段划界（06a 只碰 `SceneQuickShoot`/P1 区段，本任务只碰 `SceneCommunity`/地图区段），且在 06a 之后接管并 rebase**；不碰 `public/light-map-gl.jsx`（GL 版气泡移植属 HERMES-11，本任务不做）
- **⚠️ 行号基线**：本任务书代码坐标（行号）以 `zys` 工作树为准；**PR 目标是 main，main 上行号整体前移约 33 行**（近期 route-map/demo-preset 提交所致），且 `light-map-gl.jsx` 不在 zys 分支。**验收与定位一律以函数名为准，行号仅供就近参考。**

## 0. 为什么做（对赛题的回答）

负责人 7.15 拍板：四板块整合为三板块，第二板块=导航+社区融合——像 Campus/Apple 照片那样，地图各处出现照片小气泡，右滑看一天内/一周内附近的人拍的照片。这直接回答评审锚点"刷到一瞬间被打动+自然产生一次互动"：真人刚拍的真照片是比评分更强的社会证明，看到照片=看到目的地=一键金线路由。全案依据见 `docs/hermes/product-arch-v3.md`（含竞品实证与交互范式研究）。

## 1. 背景（自包含）

- 原型=React 18 UMD+Babel 无构建 4 列横滑 feed（`public/app.jsx:585` colLabels=[封面, 路线·光区, 社区, 拍摄]）。本任务把第 2、3 列融合：地图为底座，社区内容变气泡层，独立「社区」列消失（4 列→3 列的**板块二侧**由本任务承担；板块三侧＝拍摄列由 PR #29 承接）。
- **现成可复用件**（原型侦察 7.15 实证，改造非新建，行号对主工作树 `E:\aNB\Hackson\追光2.0` 核过）：
  - `NoteCard` 照片卡（`subpanels.jsx:624-751`，评分徽章/作者/视频角标）+ `CommunityVideoPlayer`（:753-809，已带 data-swipe-lock）——气泡点开卡本体；
  - **孤立组件 `SceneSpotDetail`**（`scenes.jsx:960-1118`，导出但未挂载）＝机位+照片+AI 拍摄指令+导航四合一详情卡——改造成 bottom-sheet 几乎零冲突；
  - marker 基建：Leaflet `L.divIcon`（`subpanels.jsx:232-239`）；
  - 选中状态链 `onSelectSpot/selectedSpotName` 已从 `app.jsx:515-549` 穿透到地图与底部 chips——气泡选中直接挂这条链。
- **现社区页数据是硬编码 notes 数组**（`subpanels.jsx:477-511`），无坐标、无时间字段；`/api/sunset` payload 无照片字段。现页还有 `score/4` 伪造的"N 位追光者在线"横幅——**不迁移到新气泡层**（见 §5 红线）。
- 素材：`public/assets/jingansi/`（**上海静安寺**照片×4+视频×3，初赛素材，坐标属上海不属深圳，见 §2.2 坐标红线）；外联回流照片 7.13 起陆续到（人工池 #26），带真实深圳位置。

## 2. 目标

### Phase 1（纯设计+数据，`agents_output/10/`，不碰产品代码）

**2.1 photos 表 schema 定稿** `photos.v1.schema.json` + 设计说明。**自起 schema，参照 `agents_output/01/spots.v1.json`、`02/sun_events.v1.json` 现有风格**（不存在现成 photos 底稿——HERMES-05 §2A 是"照片拍摄位置入 spots 机位"的人工通道，数据对象是机位不是照片记录，仅其三件套/授权台账规则可复用）。schema 硬约束：
- 文件为 `{meta, photos}` 包裹（与 01/02 一致，供 HERMES-09 A 包剥 meta 后导入）；全字段 `snake_case`；
- 必含字段方向（可增不可漏）：`id`、`spot_id`（可空，支持非机位自由散点，引用 spots.id 惯例同 sun_events）、`lat`、`lng`、`taken_at`（ISO，支撑一天/一周筛选）、`image`、`author_name`、`caption`、`score_at_taken`（拍摄时晚霞评分，可空）、`credit`、`consent_ref`、`consent_scope`（授权范围：`image_only` / `location_ok`（含位置+姓名+时间公开展示）/ `feed_card_ok`（含上钩子位）——**只有 `location_ok` 及以上可挂精确坐标上气泡；只有 `feed_card_ok` 可作 feed 卡素材，联动待拍板 D-f**）、`status`（`已核`/`待核`/`垫图`）；
- 三件套规则对齐 spots：`image/credit/consent_ref` 同空同非空（spots 现有三件套名为 `sample_img/sample_credit/consent_ref`——photos 用 `image/credit` 而非 `sample_*`，因照片本身即内容非"样张"，此命名取舍在设计说明里注明，供 09 打包时字段对齐）。

**2.2 种子数据** `photos.v1.json` ≥20 条 + `validate_photos.mjs`（照抄 01 validate 模式，跑 0 error）：
- **坐标红线**：`lat/lng` 必须落深圳行政区且与照片内容不矛盾。**静安寺（上海）素材禁止赋深圳坐标**（否则=编造地点，本仓库 review 规范 Blocking 级）——静安寺照片最多作"点开卡交互示意"不上地图，或整体弃用；上地图的只能是渐变垫图（标 status=垫图，坐标撒在深圳 spots 25 机位附近）与已授权的深圳照片（status=已核/待核）。
- **时间字段按 status 分流**：`status=垫图` 的条目 taken_at 可参数化（再生成脚本以运行日为基准撒在 D-7…D0，保证"今天/本周"两档都非空）；**`status=已核/待核` 的真实照片保留真实 taken_at**，若为演示需要重排则在渲染层必带"示例数据"标识（见 2.3 第七节）。禁止把真实照片的拍摄时间静默改写成"最近一周"冒充新鲜 UGC（F6）。
- 种子分布须均匀或按真实授权照片实际分布撒布，**不得刻意把种子密度堆成"今晚爆点"误导评委**（角标数/尺寸档位在演示数据下属演示态信号，与"N 位在线"伪造同禁，见 §5）。

**2.3 交互规格书** `bubble_spec.md`，八节：
1. 气泡视觉（**三形态**：a 照片/视频缩略图封面卡[白边微倾拍立得质感]，b **文字便签卡**[便利贴色块桃/黄、圆角、一句话，`image` 空时走此形态]，c 数字角标聚合簇；照片卡尺寸 3 档 48/64/80px 编码热度，参照 product-arch-v3 §3 范式表 + `campus-teardown.md` §2.2）；**另补建议项：朝向光锥定位标**（蓝点+扇形随朝向转，`campus-teardown.md` §2.3）；
2. 聚合规则（缩放重聚合，簇内选代表照片作封面）；
3. 时间筛选（今天/本周胶囊，切换全量重聚合，"今天"默认）；
4. 点开行为（半屏 bottom-sheet，地图平移保持该点可见）——**差异声明**：Campus 实录点气泡是近全屏详情页，本任务有意做半屏保持地图可见（核心价值＝把人留在"附近正在发生"的地图上），实机对比勿当遗漏（`campus-teardown.md` §5.2）；
5. 隐私规格（事件位置≠人身位置；正式版位置模糊化条款；外联照片未取 `location_ok` 授权→坐标模糊到机位级/区级或不上气泡层）；
6. 亮度纪律（D-c 裁定后简化——见光点与常驻金线已删，气泡是默认视图主体；按需路线出现时须清晰压过气泡，实测口径见 DoD）；
7. **演示态标识规格**（垫图/被重排时间的条目，气泡与半屏卡上带可见"示例数据"角标：文案/位置/尺寸具体值）；
8. **平台降级三档**（open_questions #16 的消费落点：a 平台支持自定义 marker→气泡层；b 仅原生 marker→marker+照片列表；c 无地图组件→纯照片时间流。HERMES-04 7.24 测绘结果直接对号入座）。

### Phase 2（原型实现，提案制——本任务书只定验收标准）

**★ Phase 2 一等目标「实时冒泡」（负责人 7.19 定，最高权重演示点）**：轴二要证明的不是"地图上有存量照片"，而是**"附近别人刚发的内容，此刻活着地冒出来"**——把产品从"历史记录浏览器"变成"实时地理小社区"。硬要求：
- **新内容 N 秒内自动上图**：本地起一个轻发布/轮询（`POST` 一条带 lat/lng/taken_at 的新条目 → 无整页重载、无需手动刷新，**≤3 秒内**该气泡在当前地图视口自动浮现，带浮现动效）。数据源可用本地 mock 端点或前端定时器追加，**不依赖平台 API**（这条链路我们自有、7.24 平台给不给活水都成立，见 `campus-teardown.md` §5 + product-arch-v4 §2④）。
- **"活的"可视信号**：新气泡浮现有区别于存量的动效/短暂高亮；可选"刚刚"时间标。
- **与历史档区分**：演示时能明确区分"存量种子"与"实时新增"（后者才是招牌），二者视觉可辨。
- 此目标是 phase 2 的**招牌演示**，落地方案（mock 端点 / setInterval 追加 / WebSocket 任选最简）在提案文档说明；与下方 4/5 的静态气泡层是同一张地图的两态。

4. 在 Leaflet 版地图（`subpanels.jsx` LightNavigationMap）实现照片气泡层 demo + **把独立「社区」列内容并入地图气泡**（colLabels/顶部 tabs 更新为三板块，触发 HERMES-09 B 包截图重拍）。**D-c 裁定同步**：删除板块二地图的**常驻金线路线发光层**与**见光点标注**（HERMES-03 已取消）——地图默认视图＝Campus 式照片气泡为主，**路线改为"选定目的地/点开气泡卡后按需渲染"**（不再常驻）。"右滑看附近照片"出 2 个方案（Tweaks/URL 参数切换，默认关）：
   - a) 地图内右滑唤出"附近·最近"半屏照片时间流（今天/本周胶囊）——**须写明与现有列间右滑手势（现地图列右滑=回封面）的隔离方案**（如仅气泡/半屏卡区域 data-swipe-lock，或边缘手势区触发）；
   - b) 点气泡起半屏卡+顶部时间筛选胶囊（无独立时间流视图）——**须在提案文档标注"与负责人原话差异声明：本案无右滑时间流手势"**，供实机对比时不被当等价方案误选。
   负责人实机演示后拍板一个，落选代码删除。
5. 气泡点开卡=SceneSpotDetail 改造的 bottom-sheet：照片大图+作者+拍摄时间+距离+「按金线去这里」（挂 onSelectSpot 链，真触发路线重算）。
6. **动效录屏**：7.22 前把"气泡浮现/时间胶囊切换重聚合/半屏卡升起"三段录屏交 `agents_output/09/motion/`（板块二是权重最高板块，动效是一等公民）；未及则书面通知 Hermes，在需求包对应轮次写降级话术。

**不做什么**：不做关注/私信/评论真功能（假交互占位可以，但必须演示态可视区分）；不碰 `light-map-gl.jsx`（GL 版 3D 光影地图上的气泡移植＝HERMES-11，等 HERMES-03/07 结案后成书）；不做正式 UGC 上传（平台侧能力，7.24 HERMES-04 测绘后由需求包承接）；不改评分引擎与路由链路。

## 3. DoD（验收标准，二元）

- [ ] `photos.v1.schema.json`（`{meta,photos}` 包裹、snake_case、含 consent_scope）+ 设计说明齐；`node agents_output/10/validate_photos.mjs` 0 error；种子 ≥20 条且每条 credit/consent_ref/consent_scope/status 齐全，垫图逐条标注（F6）。
- [ ] **种子坐标核**：抽 5 条种子反查 `lat/lng` 均落深圳行政区且与照片内容不矛盾；无一条静安寺素材被赋深圳坐标。
- [ ] 时间再生成脚本：运行后 `status=垫图` 条目 taken_at 落 [D-7, D0] 且"今天/本周"两档非空；真实照片 taken_at 未被静默改写。
- [ ] `bubble_spec.md` 八节齐，每节有可验收的具体值（尺寸 px/档位/触发条件/标识文案位置）。
- [ ] **演示态标识验收**：抽 5 个气泡点开卡截图，凡 status=垫图或时间被重排的条目，渲染画面均带可见"示例数据"标识。
- [ ] Phase 2 demo **3 秒测试**（D-c 后默认视图＝气泡地图，单一心智）：向 ≥2 位未参与者提开放问句"这个画面在告诉你什么"，两人都能 3 秒内答出"附近有人拍到了什么/在哪"（记录原话进提案文档）。
- [ ] 时间筛选实测：切"今天/本周"气泡集合可见变化（种子数据须保证两档结果不同）。
- [ ] 气泡点开卡「去这里」真触发路线重算（selectedSpot 链路，非跳转假链接）。
- [ ] **★「实时冒泡」验收（招牌）**：触发一条新条目（本地端点/前端追加），**≤3 秒内**其气泡在当前地图视口自动浮现、带浮现动效、无整页重载；存量种子与实时新增视觉可区分。录屏一条为证入 `agents_output/10/checks/`。
- [ ] 亮度纪律（D-c 简化后）：默认视图无常驻金线/见光点，气泡为主体；**触发按需路线时**，取色器抽 5 点确认路线亮芯清晰压过气泡边框/角标（照片内容不计入），路线消失后气泡复为主体。
- [ ] 右滑方案 a 若入选：右滑时间流与列间右滑并存不冲突（手测清单）。
- [ ] 两方案并存期以开关隔离且默认关；`npm run test:api` 绿；列结构由四列改三列后横滑无回归（顶部 tabs/colLabels 同步更新）。
- [ ] 动效录屏三段交付 09/motion（或书面降级通知留痕）。
- [ ] `agents_output/10/checks/check_report_10.md` 逐条带证据。

## 4. 输入材料

**`docs/hermes/campus-teardown.md` + `docs/hermes/assets/campus/`（Campus 真机一手拆解 + 截图，轴二形态首要视觉参照）**｜`docs/hermes/product-arch-v3.md`（§0 解读/§3 范式表/§6 拍板项）｜`public/subpanels.jsx`（SceneCommunity/NoteCard/LightNavigationMap）｜`public/scenes.jsx`（SceneSpotDetail）｜`agents_output/01/spots.v1.json`+`validate_spots.mjs`（schema 风格与校验模式，`{meta,spots}`/id/三件套 sample_img·sample_credit·consent_ref）｜`agents_output/02/sun_events.v1.json`（spot_id 引用惯例）｜`docs/hermes/HERMES-05-scene-expansion.md` §2A（三件套/授权台账规则，非 schema 底稿）｜`docs/tokens.md`（视觉令牌唯一来源）

## 5. 红线

- **F6**：照片必须 credit/consent 齐或标"垫图"；作者名/拍摄时间不得伪装成真实 UGC 呈现给评委（演示态可视区分，见 2.3 第七节）；"N 位追光者在线"式伪造实时数据、刻意堆种子造单点热度，均禁止进新气泡层。
- 坐标红线：静安寺（上海）素材禁赋深圳坐标（Blocking 级）；上地图坐标必落深圳且与内容不矛盾。
- 授权红线：consent_scope 未达 `location_ok` 的照片不得挂精确坐标上气泡；未达 `feed_card_ok` 不得作 feed 卡素材（D-f 拍板前一律不进 feed 卡）。
- 隐私：demo 一律授权样张；规格书必须含正式版位置模糊化条款。
- 占用文件纪律：phase 2 前置闸门未过不开工；与 06a 按区段划界、在其后 rebase。
- 设计令牌之外不引入新颜色/字号；亮度纪律排序不可倒置。

## 6. 依赖与顺序

phase 1 无依赖立即可开工；**phase 2 闸门**＝①PR #29 合入 main（负责人终审）②D-c 三层层级拍板。（**不再以 HERMES-03 三选一为闸门**——03 只影响 GL 版 light-map-gl.jsx 图层，本任务只动 Leaflet 版 subpanels.jsx，无依赖。）photos schema 7.18 前定稿交 HERMES-09 A 包（D-a 拍板"加"后生效，赶 7.23 硬截止）；06a 先于本任务 phase 2 动 subpanels.jsx，本任务在其后接管 rebase。

## 7. 交付方式

phase 1：分支 `feat/hermes-10-photo-map` → PR 目标 main（可先交 phase 1 单独 PR）。phase 2：同分支续 → 提案文档+两案 demo 链接 issue 评论 @负责人约演示 → 拍板后删落选代码 → PR。Hermes 验收=逐条跑 DoD。
