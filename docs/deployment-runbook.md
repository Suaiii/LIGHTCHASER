# Deployment Runbook

This runbook is for getting the Role B API ready for frontend integration and roadshow use.

## Target

- Platform: Vercel
- Runtime shape: Vercel Serverless Function
- API path: `/api/sunset`
- Main demo city: Shanghai
- Required environment variables: none

## Pre-Deploy Checklist

- Confirm the branch is up to date.
- Run local validation:

```bash
npm install
npm run test:api
```

- Confirm these scenarios pass:
  - `default-shanghai`
  - `demo-high`
  - `demo-mid`
  - `demo-low`
  - `live-shanghai`
  - `live-la`

## Vercel Settings

Use the default Node project settings:

| Setting | Value |
| --- | --- |
| Framework Preset | Other |
| Install Command | `npm install` |
| Build Command | leave empty |
| Output Directory | leave empty |
| Development Command | leave empty |

The serverless function is discovered from:

```text
api/sunset.js
```

## Smoke Test After Deploy

Replace `<deploy-url>` with the Vercel URL.

```bash
curl "https://<deploy-url>/api/sunset?demo=high"
curl "https://<deploy-url>/api/sunset?city=shanghai"
curl "https://<deploy-url>/api/sunset?demo=low"
```

Expected result:

- HTTP status is `200`.
- Response has `score`, `scoreLabel`, `peakTime`, `timelineColors`, `recommendation`, and `shootingTips`.
- `demo=high` returns a polished high-score card.
- `city=shanghai` returns `meta.city = "Shanghai"`.

## Frontend Integration URL

Frontend can start with:

```ts
fetch("/api/sunset?demo=high")
```

If frontend and API are deployed separately, use the absolute API URL:

```ts
fetch("https://<deploy-url>/api/sunset?demo=high")
```

## Roadshow Fallback

Use these URLs as hard fallback controls:

```text
/api/sunset?demo=high
/api/sunset?demo=mid
/api/sunset?demo=low
```

If live Shanghai weather is unimpressive or unstable during the demo, keep the product walkthrough on `demo=high` and mention that live data is available through `/api/sunset?city=shanghai`.

## Common Issues

| Symptom | Likely Cause | Fix |
| --- | --- | --- |
| `404` on `/api/sunset` | Vercel did not detect the `api` directory | Confirm `api/sunset.js` exists at repo root. |
| `500` from live mode | Open-Meteo request failed | Use `?demo=high` for roadshow fallback. |
| Frontend CORS issue | Frontend and API deployed on different hosts | Proxy through the frontend deployment or configure frontend to request the absolute API URL. |
| Chinese text displays incorrectly | Terminal display encoding issue | Check browser/JSON response; API sends UTF-8 JSON. |
