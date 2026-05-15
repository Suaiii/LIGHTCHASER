# LIGHTCHASER

A repository for the Douyin hackathon project.

## Role B Bootstrap

This branch adds the initial Role B data layer:

- `/api/sunset` serverless endpoint
- Open-Meteo live weather integration
- SunCalc golden hour and sunset timing
- Sunset scoring logic
- `high / mid / low` demo datasets
- Shanghai POI recommendation set, with Los Angeles kept as backup
- Fallback demo payload when live fetch fails

## Quick Start

```bash
npm install
npm run test:api
```

## API Examples

```bash
/api/sunset
/api/sunset?city=shanghai
/api/sunset?lat=31.2304&lng=121.4737
/api/sunset?demo=high
/api/sunset?demo=mid
/api/sunset?demo=low
```

See [docs/role-b-handoff.md](/E:/aNB/Hackson/LIGHTCHASER/docs/role-b-handoff.md) for the Role B handoff details.

Frontend integration details are in [docs/frontend-api-guide.md](/E:/aNB/Hackson/LIGHTCHASER/docs/frontend-api-guide.md).
