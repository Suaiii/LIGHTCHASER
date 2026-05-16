# LIGHTCHASER Work Plan

## Done

- Built the Role B `/api/sunset` endpoint.
- Integrated Open-Meteo live weather data.
- Added SunCalc timing for golden hour and sunset.
- Implemented sunset scoring and score labels.
- Prepared `high / mid / low` demo datasets.
- Added five Los Angeles POI recommendations.
- Added fallback behavior when live weather fetch fails.
- Wrote handoff documentation for Role A and general README notes.
- Verified the API locally with `npm run test:api`.

## In Progress

- Align the `zys` branch onto the current `main` history so the PR is clean.
- Prepare the PR summary for review and merge.

## Next Recommended Steps

- Let frontend Role A integrate against `?demo=high` first to finish the card UI.
- Switch A to `/api/sunset?city=la` for live-data integration after the UI is stable.
- Add a minimal Vercel deployment note or config if deployment is needed soon.
- Refine `recommendation.reason` and `shootingTips` copy based on the demo script.
- Add a Beijing preset if the final demo needs a two-city comparison.

## Role B TODO

- Confirm whether `city=beijing` is needed.
- Decide whether to expose scoring component details to the frontend for debugging.
- Draft a short technical Q&A covering data source, scoring logic, and fallback strategy.
- Add deployment notes if the judging flow requires a live URL.

## Risks

- Remote `main` now has its own initial commit, so future branch work should be based on `main`.
- Live weather is good for realism, but the demo should keep `demo=high|mid|low` as a fallback.
- The current scope intentionally covers only Los Angeles to protect demo quality and delivery speed.
