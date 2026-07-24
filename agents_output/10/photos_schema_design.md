# photos.v1 schema 设计说明

## 数据边界

- 根对象固定为 `{meta, photos}`，数据字段全部使用 `snake_case`。
- `spot_id` 可空；非空时引用 `agents_output/01/spots.v1.json` 的 `spots.id`，校验器同时检查引用存在且坐标相距不超过 300m。
- `score_at_taken` 可空。当前 20 条记录都是团队生成渐变垫图，不声称现场评分，因此全部为 `null`。
- `taken_at` 必须是带时区的 ISO 时间。validator 默认以真实 `Asia/Shanghai` 当前时刻为基准，拒绝未来时间；跨日后若“今天”为空则失败并要求先刷新。垫图可由时间脚本重排；`已核/待核` 的真实时间禁止改写。

## 授权与位置

| `consent_scope` | 地图位置 | feed 卡 |
|---|---|---|
| `image_only` | 不上精确气泡；`spot_id=null`，坐标最多保留 0.01° 精度 | 禁止 |
| `location_ok` | 可展示位置、署名和拍摄时间 | 禁止 |
| `feed_card_ok` | 同 `location_ok` | 允许 |

授权范围按 `image_only < location_ok < feed_card_ok` 递增。真实外部照片的非空 `consent_ref` 必须指向 `agents_output/07/consent_ledger.csv#row-N`；validator 会解析该行，并要求：行号为不重复的正整数、不是示例行、`授权状态=已同意`、图片链接一致、署名一致、机位一致，并从备注读取显式 `授权范围=<consent_scope>`。当前台账没有独立授权范围列，因此备注缺该键时保守失败；不会仅仅因为引用字符串形似 row-N 就放行。测试可用 `--ledger <csv>` 注入临时台账，不修改 AGENT_07 文件。团队生成垫图使用 `internal-demo://AGENT_10/<id>` 记录内部来源，不冒充外部授权。

授权凭证路径必须是台账目录下 `consents/` 内的相对路径，禁止绝对路径和 `..`。validator 对目录和文件执行 `realpath`，防止符号链接越界；仅接受 `.png/.jpg/.jpeg/.webp`，并检查文件非空及对应图片签名。路径、扩展名或签名任一不合格即保守失败。

## 三件套与命名

`image/credit/consent_ref` 必须同空或同非空；种子数据为可演示记录，所以三项全部非空。`photos` 使用 `image/credit`，不沿用 `spots` 的 `sample_img/sample_credit`：`spots` 的字段是机位附带样张，而这里每一行本身就是一条照片内容记录，继续使用 `sample_*` 会错误表达从属关系。HERMES-09 导入时只需剥离 `meta`，无需再改名。

## 垫图协议

- `placeholder://gradient/...` 是不可联网访问的内部占位 URI，不是假照片 URL。
- `author_name` 固定为“追·光示例数据”，`caption` 和 `credit` 均明确声明垫图、非真实 UGC。
- Phase 2 渲染必须在气泡和 bottom-sheet 同时显示“示例数据”角标；占位 URI 由前端映射为设计令牌内的渐变，不发起网络请求。
- 当前 20 条数据各绑定一个不同的已验证深圳 spot，不使用 `public/assets/jingansi`，也不通过聚集种子伪造“今晚爆点”。

## 时间再生成

运行 `node agents_output/10/refresh_photo_times.mjs [photos.json]`；默认取真实当前时刻并换算为 `Asia/Shanghai`。测试或复算可注入 `--now <带时区 ISO>`；旧 `--date` 仅在与该当前时刻的上海日期一致时兼容，不能覆盖真实日期边界。写入前，脚本拒绝格式错误或重复的垫图 id；生成后重新检查 D-7..D0、future、“今天/本周”非空且不同。所有检查通过后才把 JSON 写到输入文件同目录的临时文件，并用原子 rename 替换；异常时清理临时文件，原文件字节不变。脚本按稳定的 `id` 排序，D0 时刻不超过运行时钟，凌晨运行也不会生成未来时间。同一 `--now` 重复运行结果相同。脚本测试用 `已核/待核` 夹具证明真实记录的全部字段保持不变。

validator 不引入 JSON Schema 依赖，但逐项锁定当前 schema：root/meta/photo 的 `properties/required/additionalProperties`、`photos.minItems`、meta 常量与非空字段、每个 photo 字段的类型/模式/范围/ISO 格式，以及三件套、`image_only` 和垫图三组 `allOf` 规则。`--schema <json>` 仅供测试注入；变异测试覆盖缺 meta required、降低 minItems、修改范围/pattern/allOf，以及数据额外字段、错误常量、错误类型与空字符串。

所有 CLI 选项都必须紧跟非 option 值；缺值、下一项仍是 option 或未知参数时，仅输出一行 `... ERROR:` 并以 1 退出，不输出堆栈。
