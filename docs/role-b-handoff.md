# LIGHTCHASER Role B Handoff

## Delivered

- `api/sunset.js`
  - Vercel-style serverless endpoint.
- `lib/sunset-service.js`
  - Live weather fetch, SunCalc timing, scoring, and fallback payload assembly.
- `lib/demo-data.js`
  - Three polished demo profiles: `high`, `mid`, and `low`.
- `lib/poi.js`
  - Shanghai-first city preset with five local POIs, plus Los Angeles as a backup preset.
- `scripts/test-sunset.js`
  - Local validation script for demo and live scenarios.
- `docs/work-plan.md`
  - Current work checklist and next-step plan.

## API

`GET /api/sunset`

Supported query params:

- `lat`
- `lng`
- `city=shanghai|la`
- `demo=high|mid|low`

Default behavior:

- No query params defaults to Shanghai.
- No `demo` param uses Open-Meteo live data.
- If live fetch fails, the API falls back to `demo=high` so the demo card stays usable.

Example requests:

```bash
/api/sunset
/api/sunset?city=shanghai
/api/sunset?lat=31.2304&lng=121.4737
/api/sunset?demo=high
/api/sunset?demo=mid
/api/sunset?demo=low
```

## Response Shape

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
    "spot": "北外滩滨江",
    "distance": "步行 12 分钟",
    "reason": "正好能卡住晚霞最亮的 10 分钟"
  },
  "shootingTips": [
    "沿着江边栏杆站，给天空留出三分之二画面",
    "等一艘船或一个骑车的人经过，再按快门",
    "优先拍江面反光和建筑剪影，不要把主体顶满画面"
  ],
  "meta": {}
}
```

## Frontend Handoff

- Use `/api/sunset?demo=high` first while building the complete card UI.
- Use `/api/sunset?demo=mid` and `/api/sunset?demo=low` to test alternate copy and visual states.
- Switch to `/api/sunset?city=shanghai` for live-data integration.
- Keep `demo=high|mid|low` available for roadshow fallback and controlled presentation.

## Local Validation

```bash
npm install
npm run test:api
```

## Current Tradeoffs

- Open-Meteo + SunCalc replaces SunsetWX to reduce integration risk.
- Shanghai is the primary demo city because the team is currently in Shanghai.
- Los Angeles remains available as a backup preset from the earlier product concept.
