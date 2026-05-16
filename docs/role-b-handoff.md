# LIGHTCHASER 角色 B 交接说明

## 已交付内容

- `api/sunset.js`
  - Vercel 风格的 serverless 接口。
- `lib/sunset-service.js`
  - 真实天气拉取、SunCalc 时刻计算、评分、fallback 组装都在这里。
- `lib/demo-data.js`
  - `high / mid / low` 三套预生成卡片数据风格。
- `lib/poi.js`
  - 洛杉矶 5 个硬编码机位和最近机位推荐。
- `scripts/test-sunset.js`
  - 本地快速验收脚本。

## 接口

`GET /api/sunset`

支持的 query：

- `lat`
- `lng`
- `city=la`
- `demo=high|mid|low`

默认行为：

- 不传 `demo` 时，走 Open-Meteo 实时数据。
- 实时拉取失败时，自动 fallback 到 `demo=high`，保证路演不空白。

返回结构：

```json
{
  "score": 87,
  "scoreLabel": "值得跑出门",
  "peakTime": "18:43",
  "peakDuration": 14,
  "currentSkyColor": "#3A4A6B",
  "timelineColors": ["#3A4A6B", "#53607B", "#7A6A61"],
  "recommendation": {
    "direction": "西",
    "spot": "Echo Park 高地",
    "distance": "步行 12 分钟",
    "reason": "正好能卡住晚霞最亮的 10 分钟"
  },
  "shootingTips": [
    "站在高处边缘，给天空留出三分之二画面",
    "等一辆车或一个路人经过，再按快门",
    "优先拍反光和剪影，不要把主体顶满画面"
  ],
  "meta": {}
}
```

## 给 A 的联调建议

- A 可以先直接用 `?demo=high` 开发完整卡片 UI。
- 路演时可以切：
  - `?demo=high`
  - `?demo=mid`
  - `?demo=low`
- 真数据联调时，只要把前端请求改成 `/api/sunset?lat=34.078&lng=-118.260` 即可。

## 本地验证

```bash
npm install
npm run test:api
```

## 当前取舍

- 直接采用 Open-Meteo + SunCalc，跳过 SunsetWX 注册环节，降低 demo 风险。
- 当前只内置洛杉矶一座城市和 5 个机位，符合分工文档里的精简版本。
