# Role B Technical Notes and Q&A

## One-Line Technical Summary

Role B turns live weather, sun timing, and local POI data into a stable card payload that frontend can render immediately.

## Implementation Summary

- Weather data comes from Open-Meteo.
- Sun timing comes from SunCalc.
- POI recommendations come from local city presets.
- Scoring is computed from cloud cover, humidity, visibility, and weather code.
- Demo scenarios are prewritten to keep the roadshow stable.
- If live weather fails, the endpoint falls back to `demo=high`.

## Scoring Logic

The score is based on four components:

| Component | Weight | Why it matters |
| --- | ---: | --- |
| Cloud cover | 42% | Best sunsets usually need some clouds, but not full overcast. |
| Humidity | 24% | Moderate humidity can help color and haze; too much reduces clarity. |
| Visibility | 20% | Higher visibility keeps skyline and color separation clean. |
| Weather code | 14% | Rain, fog, and heavy weather reduce the chance of a usable sunset. |

Current thresholds:

- Cloud cover around `30%-60%` gets the best score.
- Humidity around `40%-70%` gets the best score.
- Visibility above `10km` is useful; above `18km` is excellent.
- Rain, fog, and snow-like WMO weather codes are penalized.

## Why Prewritten Demo Copy

We intentionally use prewritten `high / mid / low` copy instead of live LLM generation during the demo.

Reasons:

- It is more stable for a hackathon roadshow.
- It avoids API key and latency risk.
- It gives the product a more polished voice.
- It still demonstrates the core AI concept: translating structured signals into human-readable guidance.

## Likely Judge Questions

### Is this real-time data?

Partly. The live mode uses Open-Meteo weather data and SunCalc timing. The roadshow mode can also use prewritten demo data so the presentation remains stable.

### Why not call an LLM live?

A live LLM call would add latency, key management, and prompt-tuning risk without improving the visible demo much. For this prototype, we prewrite the strongest copy and use deterministic scoring for reliability.

### What does the AI layer do?

In the product concept, the AI layer is a translator. It turns weather signals, sun timing, location, and POI context into one clear recommendation and three shooting tips.

### What happens if the weather API fails?

The endpoint returns a polished `demo=high` payload. Frontend still gets the same response shape, so the card can keep rendering.

### Why Shanghai?

The team is currently in Shanghai, so the demo should match the user's real city and the likely testing context. Shanghai also has strong west-facing waterfront and bridge scenes that fit the product story.

### Can the same API support another city?

Yes. Add a new city preset in `lib/poi.js` with timezone, default coordinates, and POIs. The scoring and payload assembly logic will work unchanged.

## Current API Contract

Use:

```http
GET /api/sunset?city=shanghai
GET /api/sunset?demo=high
GET /api/sunset?demo=mid
GET /api/sunset?demo=low
```

Frontend should depend on the public fields documented in `docs/frontend-api-guide.md`.

## Remaining Role B Work

- Add Vercel deployment notes if needed.
- Add Beijing or more Shanghai POIs if the story expands.
- Tune scoring weights after one or two real Shanghai weather checks.
- Prepare a shorter spoken answer for the final roadshow.
