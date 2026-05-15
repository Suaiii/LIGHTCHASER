# Frontend A API Guide

This document is for Role A frontend integration.

## Endpoint

```http
GET /api/sunset
```

The default city is Shanghai, so the simplest request is:

```http
GET /api/sunset
```

## Recommended Integration Order

1. Build the card UI with stable demo data.

```http
GET /api/sunset?demo=high
```

2. Test alternate card states.

```http
GET /api/sunset?demo=mid
GET /api/sunset?demo=low
```

3. Switch to live Shanghai data.

```http
GET /api/sunset?city=shanghai
```

## Query Params

| Param | Example | Meaning |
| --- | --- | --- |
| `demo` | `high`, `mid`, `low` | Forces a prewritten demo scenario. Use this for stable UI development and roadshow fallback. |
| `city` | `shanghai`, `la` | Uses the city's default coordinate and timezone. Shanghai is default. |
| `lat` | `31.2304` | Optional custom latitude. |
| `lng` | `121.4737` | Optional custom longitude. |

If both `demo` and `city` are provided, `demo` controls the scoring and copy, while the city controls timezone and nearest POI.

## Response Type

```ts
export type SunsetPayload = {
  score: number;
  scoreLabel: string;
  peakTime: string;
  peakDuration: number;
  currentSkyColor: string;
  timelineColors: string[];
  recommendation: {
    direction: string;
    spot: string;
    distance: string;
    reason: string;
  };
  shootingTips: string[];
  meta: {
    source: string;
    city: string;
    timezone: string;
    coordinates: {
      lat: number;
      lng: number;
    };
    goldenHourStart: string;
    sunsetTime: string;
    debug?: unknown;
  };
};
```

## Example Payload

```json
{
  "score": 87,
  "scoreLabel": "值得跑出门",
  "peakTime": "18:50",
  "peakDuration": 14,
  "currentSkyColor": "#3A4A6B",
  "timelineColors": [
    "#3A4A6B",
    "#53607B",
    "#7A6A61",
    "#A87557",
    "#C98557",
    "#E0A060",
    "#D96C5B",
    "#B54F60",
    "#7A436B",
    "#5A3870"
  ],
  "recommendation": {
    "direction": "西",
    "spot": "苏州河乍浦路桥",
    "distance": "步行 28 分钟",
    "reason": "正好能卡住晚霞最亮的 10 分钟"
  },
  "shootingTips": [
    "沿着江边栏杆站，给天空留出三分之二画面",
    "等一艘船或一个骑车的人经过，再按快门",
    "优先拍江面反光和建筑剪影，不要把主体顶满画面"
  ],
  "meta": {
    "source": "demo-high",
    "city": "Shanghai",
    "timezone": "Asia/Shanghai",
    "coordinates": {
      "lat": 31.2304,
      "lng": 121.4737
    },
    "goldenHourStart": "18:11",
    "sunsetTime": "18:44",
    "debug": {
      "bucket": "high",
      "fallback": false
    }
  }
}
```

## Frontend Fetch Example

```ts
async function fetchSunsetCard(mode: "high" | "mid" | "low" | "live" = "high") {
  const endpoint =
    mode === "live" ? "/api/sunset?city=shanghai" : `/api/sunset?demo=${mode}`;

  const response = await fetch(endpoint);

  if (!response.ok) {
    throw new Error(`Failed to load sunset card: ${response.status}`);
  }

  return (await response.json()) as SunsetPayload;
}
```

## UI Mapping

| UI Area | Field |
| --- | --- |
| Big score | `score` |
| Score caption | `scoreLabel` |
| Best moment | `peakTime` |
| Duration label | `peakDuration` |
| Main sky swatch | `currentSkyColor` |
| Time slider palette | `timelineColors` |
| Direction | `recommendation.direction` |
| Place name | `recommendation.spot` |
| Walking distance | `recommendation.distance` |
| Human recommendation line | `recommendation.reason` |
| Three shooting instructions | `shootingTips` |

## Roadshow Controls

Use URL params or local UI controls to switch between:

```http
/api/sunset?demo=high
/api/sunset?demo=mid
/api/sunset?demo=low
/api/sunset?city=shanghai
```

Recommended final demo path:

- `demo=high` for the polished main card.
- `city=shanghai` to show that live weather data is connected.
- `demo=low` only if the judges ask how the product behaves on bad-sky days.

## Notes

- The API always returns a full card payload unless an unexpected server error happens.
- Live weather failures automatically fall back to a polished high-score demo payload.
- `meta.debug` is for development only. Do not show it in the card UI.
