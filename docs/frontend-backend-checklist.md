# Frontend Backend Connection Checklist

This checklist tracks the current integration status after moving the frontend prototype into the LIGHTCHASER repo.

## Local Run

```bash
npm install
npm run test:api
npm run dev:preview
```

Open:

```text
http://127.0.0.1:5174/
```

API smoke checks:

```text
http://127.0.0.1:5174/api/sunset?city=shanghai
http://127.0.0.1:5174/api/sunset?demo=high
http://127.0.0.1:5174/api/sunset?demo=mid
http://127.0.0.1:5174/api/sunset?demo=low
```

## Connected Now

- Frontend files are now inside `public/`.
- Video files are now inside `public/assets/videos/`.
- Upload/reference files are now inside `public/assets/uploads/`.
- `npm run dev:preview` serves the frontend and `/api/sunset` from one local port.
- Initial frontend mode is `live`.
- Live mode first requests browser GPS with `navigator.geolocation.getCurrentPosition`.
- If GPS is allowed, the frontend calls `/api/sunset?lat=<lat>&lng=<lng>`.
- If GPS is blocked, unavailable, or times out, the frontend silently calls `/api/sunset?city=shanghai`.
- Tweak panel `high / mid / low` calls `/api/sunset?demo=high|mid|low`.
- The main sunset card now reads `score`, `scoreLabel`, `peakTime`, `peakDuration`, `timelineColors`, `currentSkyColor`, and `recommendation`.
- The route screen now reads `recommendation.spot`, `recommendation.direction`, `recommendation.distance`, and `peakTime`.
- The community screen now reacts to the backend score and recommended spot.
- The quick shoot screen now reads backend `score`, `peakTime`, `peakDuration`, `recommendation.spot`, and `shootingTips`.
- Row 0, Row 2, and Row 3 use local mp4 backgrounds and keep the original gradient fallback if video loading fails.

## Not Connected Yet

- Real map navigation is still a console hook through `window.GuangbaoHooks.openNavigation`.
- Community posts are still mock content, only lightly personalized by backend score and spot.
- Quick shoot camera is still a visual prototype, not real camera capture.
- The frontend remains HTML + Babel CDN for hackathon speed; no Vite/build pipeline has been introduced.

## Demo Notes

- Use `live` in Tweaks to show GPS or Shanghai live data.
- Use `high` for the polished hero demo.
- Use `mid` and `low` to prove the UI responds to different backend scoring states.
- Do not display `meta.debug` in the frontend.

## Verified Locally

- `npm run test:api` passes for default Shanghai, demo high/mid/low, live Shanghai, and live LA.
- Browser with GPS allowed requests `/api/sunset?lat=31.2304&lng=121.4737`.
- Browser with GPS blocked requests `/api/sunset?city=shanghai`.
- The rendered card shows backend `score`, `recommendation.spot`, `peakTime`, route copy, community copy, and quick-shoot suggestions.
- Local mp4 backgrounds mount without console errors.
