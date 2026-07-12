# 天气数据双预案 SOP（AGENT_02 · weather_ops）

> 太阳数据（sun_events）是纯几何、已离线预制、零外部依赖。**唯一有外部依赖的是天气**（云/湿/能见/天气码）。因此天气必须有两条腿：**A 在线 API（realism）** 与 **B 人工刷新（永不断）**。选型由 AGENT_06 的 7.24 测绘第 3 问（平台工具/Skill 能否调外部 HTTP API）拍板；无论选哪条，评分公式与卡片字段**零改动**。

数据落地平台数据库表 `weather_daily`：`date / city / cloud_low / cloud_mid / cloud_high / humidity / visibility_km / weather_code / updated_at`。评分由 `weather_daily`（当日）× `sun_events`（当日机位）经 `score_spec.md` 公式算出。

---

## 预案 A · 在线 API（Open-Meteo 首选，和风为备）

**为何 Open-Meteo**：免费、无需 Key、字段齐（分层云量）、初赛已验证可用。

**请求**（深圳日落窗口）：
```
GET https://api.open-meteo.com/v1/forecast
  ?latitude=22.54&longitude=114.06
  &hourly=cloud_cover_low,cloud_cover_mid,cloud_cover_high,relative_humidity_2m,visibility,weather_code
  &daily=sunset&forecast_days=2&timezone=Asia/Shanghai
```

**字段映射**（API → weather_daily / 评分输入）：
| 评分输入 | Open-Meteo 字段 | 处理 |
|---|---|---|
| cloud_low / mid / high | `cloud_cover_low/mid/high` | 取日落 ±90min 小时样本**均值** |
| humidity | `relative_humidity_2m` | 同上均值 |
| visibility_km | `visibility`（米） | ÷1000 后均值 |
| weather_code | `weather_code` | ±90min 样本**众数/四舍五入均值** |
| （sunset 用 sun_events，不用 API 的） | — | API sunset 仅作交叉校验 |

**采样窗口**：以当日 sunset 为中心，取前后 90 分钟的逐小时样本求均值（复用初赛 `sunset-service.getWindowMetrics` 逻辑），代表"日落时段"而非"此刻"。
**超时/降级**：请求超时 8s、重试 1 次；失败 → 落预案 B 的最近一次人工值 → 再失败 → 用 `demo=high` 兜底文案（不显示假分数，改显"数据获取中，参考昨日"）。

---

## 预案 B · 人工刷新（离线永不断，游园会主力）

**动机**：F3 评委在深圳当天下午亲手体验；若平台不能调外部 API 或现场网络抖动，人工值保证"此刻真实性"。

**数据源**（择一，按可得性）：中国天气网 深圳站 / 和风天气 Web / 彩云天气。读：低中高云量、湿度、能见度、天气现象→映射 WMO code。
**节奏**：每日 **08:00** 与 **16:00** 两次（16:00 那次最关键，最接近当日日落窗口）。
**录入**：对话框向平台自然语言插入 `weather_daily` 当日行（AGENT_06 第 4 问确认导入方式后细化），或手动单条插入。`updated_at` 记录刷新时刻。
**值守**：H2 主值，H1 备份；现场 D2/D3 由当日非驾驶手负责 16:00 刷新。
**WMO code 速查**（人工映射用）：晴=0、少云=2、阴=3、雾=45、小雨=61、中雨=63、雷阵雨=95。

---

## 选型决策树（AGENT_06 测绘后落子）
- 平台工具/Skill **能**稳定调外部 HTTP API → **主用 A**，B 作断网兜底（每日仍人工刷 1 次留底）。
- 平台**不能**调外部 API → **主用 B**（每日 2 刷），A 仅在本地/演示机可联网时作交叉校验。
- 两者产出的 `weather_daily` 行结构完全一致，卡片与评分不感知来源差异。

## 一句话
太阳靠几何（已锁死），天气靠双腿（A 求真、B 求稳），**任一条腿断了，卡片照样出分、不空窗**。
