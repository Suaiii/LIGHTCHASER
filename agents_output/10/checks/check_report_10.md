# AGENT_10 检查报告（HERMES-10 Phase 1）

执行日期：2026-07-16 ｜ 范围：仅 `agents_output/10/**` ｜ 结论：Phase 1 数据与设计交付通过；Phase 2 未执行。

## Phase 1 DoD

| 条目 | 结论 | 证据 |
|---|---|---|
| `{meta,photos}` schema、snake_case、授权枚举与设计说明 | 通过 | `photos.v1.schema.json` + `photos_schema_design.md`；validator 镜像 root/meta/photo 类型、常量、范围、格式、额外字段禁令与 allOf |
| 种子不少于 20 条 | 通过 | 20 条，20 个不同 `spot_id`，单 spot 最大 1 条 |
| validator 0 error | 通过 | `node agents_output/10/validate_photos.mjs`：`Errors: 0`、`Warnings: 0` |
| credit / consent_ref / consent_scope / status 与 F6 | 通过 | 20/20 为明确团队生成渐变垫图；内部占位 URI、示例作者名、非真实 UGC credit、内部生成来源引用均非空 |
| 抽 5 条坐标核 | 通过 | 五条均与 `agents_output/01/spots.v1.json` 完全相同；上游 `check_report_01.md` 已记录这些 spots 属于 25/25 OSM 深圳区县核验集合 |
| 无静安寺素材映射深圳 | 通过 | 数据扫描 `jingansi_mapped=0`；20/20 `image` 均为 `placeholder://gradient/...`，没有真实照片 URL |
| 时间再生成与真实时间保护 | 通过 | 默认按真实上海当前时刻生成；垫图分布 D-7..D0；今天 3 条、本周 18 条；拒绝未来；测试夹具中的 `已核/待核` 全记录保持不变 |
| “今天/本周”集合不同 | 通过 | validator 输出 `今天: 3; 本周: 18` |
| bubble_spec 恰好八节且有具体值 | 通过 | 标题扫描为 1–8 共 8 节；含 48/64/80px、聚合阈值、默认今天、sheet/平移、隐私、亮度、示例角标、三档降级 |
| 真实照片授权不靠字符串放行 | 通过 | 专项回归覆盖 row 存在性、示例行、已同意状态、凭证存在、图片/署名/机位/范围匹配；当前 row-1“已触达”明确失败 |
| 台账与凭证边界 | 通过 | BOM/CRLF/quoted comma 正例；重复/空/非正整数行号、绝对/穿越/越出 consents/、错误扩展、作者/图片/机位不匹配均有负例 |
| 时间刷新写入安全 | 通过 | 重复/坏 id 在写入前失败且原文件字节不变；生成后复核时间集合；同目录临时文件 + 原子 rename，异常清理 |
| schema 合同未被弱化 | 通过 | `--schema` 注入变异覆盖 meta required、minItems、范围、pattern、allOf，全部按预期失败 |
| Phase 2 边界 | 未执行，符合本次范围 | 未修改 `public/**`；未实现气泡 UI、bottom-sheet、路线联动、三列改造、截图/录屏或 3 秒用户测试，不能声称 Phase 2 完成 |

## TDD 证据

### RED 1：数据校验先失败

实现 schema 与数据前运行：

```text
$ node agents_output/10/validate_photos.mjs
记录数: 0
Errors: 2
[ERROR] photos schema ... ENOENT
[ERROR] photos data ... ENOENT
=== FAIL ===
```

### RED 2：时间脚本测试先失败

实现 `refresh_photo_times.mjs` 前运行：

```text
$ node --test agents_output/10/checks/test_refresh_photo_times.mjs
tests 2
pass 0
fail 2
Error: Cannot find module '.../agents_output/10/refresh_photo_times.mjs'
```

### GREEN：最小实现后通过

```text
$ node --test agents_output/10/checks/test_refresh_photo_times.mjs
tests 2
pass 2
fail 0

$ node agents_output/10/refresh_photo_times.mjs agents_output/10/photos.v1.json
refresh_photo_times: date=2026-07-16 placeholders=20 today=3 real_unchanged=0

$ node agents_output/10/validate_photos.mjs
记录数: 20
引用 spot 数: 20; 单 spot 最大条数: 1
时间基准: 2026-07-16; 今天: 3; 本周: 18
Errors: 0
Warnings: 0
=== PASS (0 error) ===
```

时间测试的临时夹具包含 4 条垫图、1 条 `已核`、1 条 `待核`。第一项测试确认仅仅垫图时间进入 D-7..D0，后两条对象完全不变；第二项确认同一 `--now` 重复生成完全相同；第三项在 00:05 运行，确认 D0 非空且所有时间不晚于 00:05。

### 规格审查修复 RED / GREEN

修复前先新增并运行审查回归：`test_refresh_photo_times.mjs` 为 0/3，`test_validate_photos.mjs` 为 0/7。失败原因分别是 `--now` 未实现，以及 validator 不识别 `--now/--ledger`、未产生预期时间/授权/schema 错误。

修复后：

```text
$ node --test agents_output/10/checks/test_refresh_photo_times.mjs
tests 3; pass 3; fail 0

$ node --test agents_output/10/checks/test_validate_photos.mjs
tests 7; pass 7; fail 0
```

授权测试使用临时 CSV 与临时凭证文件：完整匹配的 row-2 通过；仓库现有 row-1 因“示例行 + 已触达 + 无凭证 + 无显式授权范围”失败。实际 `agents_output/07/consent_ledger.csv` 未修改。

### 质量审查第二轮 RED / GREEN

实现前分四组运行：台账/凭证组 2/5 通过、3/5 失败；refresh 新增用例 0/2；schema 变异 0/1；CLI 1/2。失败分别证明重复/非法 row 会被忽略或覆盖、凭证路径可越界、坏/重复 id 会写回、`--schema` 不存在且 validator 会吐堆栈。

最小修复后全量专项结果：

```text
$ node --test agents_output/10/checks/test_refresh_photo_times.mjs agents_output/10/checks/test_validate_photos.mjs agents_output/10/checks/test_cli_errors.mjs
tests 20; pass 20; fail 0
```

成功授权 fixture 使用真实 1×1 PNG；凭证校验覆盖相对路径、`consents/` realpath、扩展名、非空与图片签名。schema 检查对约束做精确比较（忽略说明性 `description`），报告不把未覆盖项写成通过。

## 五条坐标证据

| photo_id | spot_id | lat | lng | 与 spots 原值一致 |
|---|---|---:|---:|---|
| photo-001 | szw-001 | 22.4703 | 113.9440 | true |
| photo-005 | szw-005 | 22.5270 | 113.8870 | true |
| photo-010 | szw-010 | 22.5230 | 114.0100 | true |
| photo-015 | szs-001 | 22.5560 | 114.0580 | true |
| photo-020 | sze-002 | 22.5470 | 114.0680 | true |

本任务没有重新声称 30m 实地精度；仅仅继承 AGENT_01 已外部反查通过的深圳 spot 坐标。真实照片后续回流时仍需核对内容与位置是否一致。

## 仓库回归与范围

```text
$ npm test
test:api passed; AI camera core tests passed

$ git diff --check
exit 0

$ git diff --cached --check
exit 0

$ git diff --cached --name-only
仅 agents_output/10/**
```

以上暂存 diff 与范围检查已在本次提交前实际执行，不是待办项。

## Phase 2 明确未完成

本报告仅验收 Phase 1。以下 HERMES-10 总 DoD 属于 Phase 2，当前均未执行：气泡真实渲染与五张截图、两位未参与者 3 秒测试、`selectedSpot` 路线重算、路线亮度取色、右滑方案实测、四列改三列、动效录屏。它们不能从本次 schema、数据或规格通过推导为完成。
