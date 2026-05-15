# LIGHTCHASER

A repository for the Douyin hackathon project.

## Role B Bootstrap

This branch adds the initial Role B data layer:

- `/api/sunset` serverless endpoint
- Open-Meteo live weather integration
- SunCalc golden hour and sunset timing
- Sunset scoring logic
- `high / mid / low` demo datasets
- Los Angeles POI recommendation set
- Fallback demo payload when live fetch fails

## Quick Start

```bash
npm install
npm run test:api
```

## API Examples

```bash
/api/sunset?city=la
/api/sunset?lat=34.078&lng=-118.260
/api/sunset?demo=high
/api/sunset?demo=mid
/api/sunset?demo=low
```

See [docs/role-b-handoff.md](/E:/aNB/Hackson/LIGHTCHASER/docs/role-b-handoff.md) for the Role B handoff details.
