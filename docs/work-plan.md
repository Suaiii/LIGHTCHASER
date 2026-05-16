# LIGHTCHASER Work Plan

## Done

- Built the Role B `/api/sunset` endpoint.
- Integrated Open-Meteo live weather data.
- Added SunCalc timing for golden hour and sunset.
- Implemented sunset scoring and score labels.
- Prepared `high / mid / low` demo datasets.
- Added five Shanghai POI recommendations and kept Los Angeles as a backup preset.
- Added fallback behavior when live weather fetch fails.
- Wrote handoff documentation for Role A and general README notes.
- Added a frontend API usage guide for Role A.
- Added Role B technical notes and roadshow Q&A.
- Added deployment runbook and roadshow technical script.
- Strengthened `npm run test:api` with response-shape assertions.
- Verified the API locally with `npm run test:api`.

## In Progress

- Support frontend integration and update docs if A finds any mismatch.
- Keep the deployment URL and smoke-test notes current once Vercel is connected.

## Next Recommended Steps

- Let frontend Role A integrate against `?demo=high` first to finish the card UI.
- Switch A to `/api/sunset?city=shanghai` for live-data integration after the UI is stable.
- Refine `recommendation.reason` and `shootingTips` copy based on the demo script.
- Add a Beijing preset if the final demo needs a two-city comparison.

## Role B TODO

- Confirm whether `city=beijing` is needed after the Shanghai demo is stable.
- Decide whether to expose scoring component details to the frontend for debugging.
- Add the final Vercel URL to the runbook after deployment.

## Risks

- Remote `main` now has its own initial commit, so future branch work should be based on `main`.
- Live weather is good for realism, but the demo should keep `demo=high|mid|low` as a fallback.
- The current scope intentionally prioritizes Shanghai to protect demo quality and delivery speed.
