# HERMES-01 ｜ 导航走反路根治：步行路由服务替换

- **受众**：AI 编码代理
- **状态**：待验收
- **时间窗**：7.14–7.17（Gate 0 前必须闭环——导航是演示动线的一部分，走反路当场穿帮）
- **占用文件**：`lib/route-service.js`、`api/route.js`、`docs/page_specs.md`（仅 P2 节追加）、`test-sunset.js`（如需加断言）、新增 `agents_output/checks/hermes01_route_report.md`

## 0. 为什么做（对赛题的回答）

评审锚点是"刷到的一瞬间被打动、被满足"。卡片承诺"步行 16 分钟正好赶上日落"，用户点开导航却走反路/绕远——瞬间破功，体验完整性（30% 权重）直接失分。路线必须是**可信的步行路线**。

## 1. 背景（自包含）

- 产品「追·光」：抖音 feed 卡 + 小程序，判断"今晚值不值得为天空出门"并给最短步行路径去晚霞机位。本仓库是原型（React UMD 无构建 + serverless 风格 API），最终迁移到抖音 AI 平台。
- 现状路线链路：`api/route.js`（薄封装）→ `lib/route-service.js` 的 `buildRoutePayload`。
- OSRM 调用（`lib/route-service.js:37-42`）：base = `https://router.project-osrm.org`，URL = `/route/v1/foot/{lng},{lat};{lng},{lat}`，参数 `overview=full&geometries=geojson&steps=false`。坐标顺序正确（OSRM 要求 lng 在前），profile 写的是 `foot`，有 8s 超时 + 2 次重试 + 直线兜底（`straightLineRoute`，`source=fallback-straight-line` 带 `fallbackReason`）。
- **用户报告的症状**：路线"有时候会有很诡异的走反路"。
- **头号嫌疑（未证实，先诊断）**：`router.project-osrm.org` 是 OSRM 官方 demo 服务器，社区普遍反馈它**只部署了 car 数据集**——URL 里写 `foot` 它照样按机动车路网算（单行道/立交约束对步行者=诡异绕路），或返回错误落直线兜底。注意：demo 服务器不同镜像行为可能不同，**必须实测取证，不许拍脑袋**。

## 2. 目标

1. **诊断**：用实测数据回答"走反路的根因是什么"。
2. **替换**：路由服务换成真支持步行 profile 的（候选优先级见 §6），保持 `buildRoutePayload` 返回结构与兜底链完全不变（下游 `public/light-map-gl.jsx` 等按 `{ geometry:[{lat,lng}], distance, duration, source }` 消费，不许破坏）。
3. **平台规格**：在 `docs/page_specs.md` P2 节追加一小节"步行导航规格"——迁移到抖音 AI 平台时，平台侧地图/导航组件必须满足什么（步行 profile、失败降级到直线+文字步导）。

**不做什么**：不做逐步转向导航（`steps=false` 保持——"最后 100 米步导"由机位库 `walk_steps` 字段承担）；不自架路由服务器；不动评分/天气链路。

## 3. DoD（验收标准，二元）

- [ ] 诊断报告 `agents_output/checks/hermes01_route_report.md` 包含：对 demo 服务器与替换服务各发同一批请求的**原始响应摘要**（code / distance / duration / 几何点数），并据此写明根因结论。
- [ ] **五条深圳真实 OD 对照**（坐标写死在 §6，含用户点名的南科大→塘朗山）：新服务返回的路线逐条与地图人工对照，无反向出发、无 >1.3× 合理步行距离的绕路；报告附每条路线的 geojson.io 截图或坐标抽样。
- [ ] `distance/duration` 与步行常识一致：所有 OD 的 duration/distance ∈ [10, 16] 分钟每公里（步行 4–6 km/h 反推）；demo 服务器若按 car 算会明显偏离此区间——这本身就是诊断证据。
- [ ] 兜底链仍然工作：断网/服务 500 时返回 `fallback-straight-line`（现有行为，加一个可重复的验证方式进报告）。
- [ ] `npm run test:api` 绿。
- [ ] `docs/page_specs.md` P2 节出现"步行导航规格"小节（≤15 行：profile 要求/降级链/速度合理性校验）。

## 4. 输入材料

| 文件 | 看什么 |
|---|---|
| `lib/route-service.js` | 全部（核心改动面，~100 行） |
| `api/route.js` | 封装与参数透传 |
| `public/light-map-gl.jsx` 中 `routeData` 的消费点 | **只读**——确认返回结构兼容，此文件被另一任务占用，一行都不许改 |
| `agents_output/01/spots.v1.json` | 机位真实坐标（OD 终点来源） |
| `docs/page_specs.md` P2 节 | 规格追加位置 |
| `CLAUDE.md` §4 | 本地怎么跑、test:api |

## 5. 红线

- **F6 真实性**：诊断结论必须有原始响应做证据；不确定的写"待核"+置信度，不许编造"服务器不支持 foot"这类断言。
- 返回 payload 结构、兜底链结构、8s 超时/重试语义不变。
- 免费公共服务要守礼：请求加 UA 标识、频率 ≤1 req/s、不做压测。
- 若所有候选服务都不可用（网络/墙），如实报告并给出"直线+步导"降级为主的建议，**不硬凑**。

## 6. 候选服务与 OD 清单

**候选（按序试，第一个达标即选定；开源优先原则）**：
1. FOSSGIS 公共 OSRM：`https://routing.openstreetmap.de/routed-foot/route/v1/foot/...`（OSM 官方生态，真 foot 数据集，无需 key）
2. Valhalla 公共实例：`https://valhalla1.openstreetmap.de/route`（同为 FOSSGIS 运营，`costing=pedestrian`，步行质量口碑好；返回格式不同需薄适配——适配层放 route-service 内部，对外 payload 不变）
3. openrouteservice：`api.openrouteservice.org` foot-walking（海德堡大学，开源引擎，免费 key 有日额度——若用此项，key 走 env 不入库，参照 ark.env 惯例）
4. 其他公开 OSRM foot 实例（自查，需注明数据新鲜度）
5. 均不可用 → 保持 demo 服务器 + 响应校验（duration/distance 不在步行区间即视为不可信、主动落直线兜底），并在报告注明这是权宜

**五条 OD（起点→终点，lat,lng）**：
1. 南方科技大学 (22.5956,113.9956) → 塘朗山郊野公园观景平台（spots 表 `szw` 对应条目坐标为准）
2. 市民中心 (22.5451,114.0545) → 莲花山公园山顶广场（spots 表坐标）
3. 后海地铁站 (22.5111,113.9295) → 深圳人才公园（spots 表坐标）
4. 深大南门 (22.5286,113.9375) → 深圳湾滨海栈道（spots 表坐标）
5. 海上世界 (22.4855,113.9165) → 女娲滨海公园（spots 表坐标；跨湾场景，考验绕行合理性）

> 终点坐标一律从 `agents_output/01/spots.v1.json` 取（真实核验过的机位坐标），不要手打。

## 7. 交付方式

分支 `feat/hermes-01-routing` → PR 目标 main，body 链本任务书 + DoD 自核对表 + 报告链接。验收人（Hermes）将重跑五条 OD 与 test:api。
