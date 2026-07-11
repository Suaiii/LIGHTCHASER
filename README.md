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
npm test
npm run dev:preview
```

Open the integrated frontend and backend preview:

```text
http://127.0.0.1:5174/
```

Open the AI camera:

```text
http://127.0.0.1:5174/ai-camera.html
```

The AI camera uses the browser camera as the primary input. It presents a full-screen viewfinder with instant shutter capture, grid and ratio controls, camera switching when available, local recent-photo review, and AI composition/filter variants generated after the shot. Developer-only media upload and `metadata.json` export are available with:

```text
http://127.0.0.1:5174/ai-camera.html?debug=1
```

The same local server also handles:

```text
http://127.0.0.1:5174/api/sunset?city=shanghai
http://127.0.0.1:5174/api/sunset?demo=high
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

The current frontend prototype lives in [public/追·光.html](/E:/aNB/Hackson/LIGHTCHASER/public/追·光.html) and loads the React/Babel JSX files in [public/](/E:/aNB/Hackson/LIGHTCHASER/public). Local video assets are under [public/assets/videos](/E:/aNB/Hackson/LIGHTCHASER/public/assets/videos).

Deployment and roadshow notes:

- [docs/deployment-runbook.md](/E:/aNB/Hackson/LIGHTCHASER/docs/deployment-runbook.md)
- [docs/roadshow-tech-script.md](/E:/aNB/Hackson/LIGHTCHASER/docs/roadshow-tech-script.md)
