// HERMES-03: URL modes must create only their declared lightweight layers.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const errors = [];
const results = [];
const modes = (process.env.ZG_LIGHT_ZONE_MODES || "off,axis,spots,both").split(",");
const readyTimeout = Number(process.env.ZG_E2E_TIMEOUT || 90000);
let browser;
const geoBearing = ([[lng1, lat1], [lng2, lat2]]) => {
  const phi1 = lat1 * Math.PI / 180, phi2 = lat2 * Math.PI / 180, lambda = (lng2 - lng1) * Math.PI / 180;
  return (Math.atan2(Math.sin(lambda) * Math.cos(phi2), Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(lambda)) * 180 / Math.PI + 360) % 360;
};
const angleDelta = (a, b) => Math.abs((((a - b) % 360) + 540) % 360 - 180);

try {
  console.log("launching chromium");
  browser = await chromium.launch(process.env.ZG_PROXY ? {
    proxy: { server: process.env.ZG_PROXY, bypass: "127.0.0.1,localhost" },
  } : {});
  mkdirSync("e2e-out", { recursive: true });

  for (const mode of modes) {
    console.log(`${mode}: opening page`);
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on("pageerror", (error) => errors.push(`${mode}: ${String(error)}`));
    page.on("console", (message) => {
      if (message.type() === "error" && message.text().includes("[LIGHTCHASER] light zone setup failed")) errors.push(`${mode}: console ${message.text()}`);
    });
    page.on("requestfailed", (request) => {
      if (/styles\/liberty|api\/(sunset|route)/.test(request.url())) {
        errors.push(`${mode}: request failed ${request.url()} ${request.failure()?.errorText || ""}`);
      }
    });
    await page.goto(`http://127.0.0.1:5174/?tweaks=1&lightZone=${mode}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(4500);
    const demo = page.getByText("一键大区赛演示", { exact: false }).first();
    const demoCount = await demo.count();
    console.log(`${mode}: demo buttons=${demoCount}`);
    if (!demoCount) {
      const pageState = await page.evaluate(() => ({ title: document.title, text: document.body.innerText.slice(0, 500) }));
      throw new Error(`${mode} demo control missing: ${JSON.stringify(pageState)}`);
    }
    await demo.click();
    console.log(`${mode}: waiting for map`);
    const expected = { mode, axis: mode === "axis" || mode === "both", spots: mode === "spots" || mode === "both" };
    const waitForCurrentMap = () => page.waitForFunction((target) => {
      try {
        const map = window.__zgMap;
        return !!map?.getLayer("zg-route-core")
          && !!map.getLayer("zg-sun-axis-core") === target.axis
          && !!map.getLayer("zg-light-spots") === target.spots
          && (target.mode === "off" || window.__zgLightZone?.mode === target.mode);
      } catch { return false; }
    }, expected, { timeout: readyTimeout });
    try { await waitForCurrentMap(); }
    catch (error) {
      const failedState = await page.evaluate(() => {
        try { return { search: window.location.search, hasGeometry: !!window.ZGLightZone, hasSelector: !!window.ZGLightZone?.selectRayBuildings, hasMap: !!window.__zgMap, route: !!window.__zgMap?.getLayer("zg-route-core"), spots: !!window.__zgMap?.getLayer("zg-light-spots"), diagnostics: window.__zgLightZone || null }; }
        catch { return { search: window.location.search, hasGeometry: !!window.ZGLightZone, hasSelector: !!window.ZGLightZone?.selectRayBuildings, hasMap: !!window.__zgMap, route: false, spots: false, diagnostics: window.__zgLightZone || null }; }
      });
      console.error(`${mode}: ready failed state=${JSON.stringify(failedState)} errors=${JSON.stringify(errors)}`);
      throw error;
    }
    if (mode === "spots" || mode === "both") {
      await page.waitForFunction(() => window.__zgLightZone?.dataReady === true, undefined, { timeout: readyTimeout });
    }
    await page.waitForTimeout(1200);
    await waitForCurrentMap();
    const preflight = await page.evaluate(() => {
      try { return { hasMap: !!window.__zgMap, routeReady: !!window.__zgMap?.getLayer("zg-route-core"), build: document.body.innerText.includes("v5.0") }; }
      catch { return { hasMap: !!window.__zgMap, routeReady: false, build: document.body.innerText.includes("v5.0") }; }
    });
    console.log(`${mode}: preflight ${JSON.stringify(preflight)} errors=${JSON.stringify(errors.slice(-3))}`);
    if (!preflight.build) throw new Error(`${mode} expected v5.0 build marker`);
    const state = await page.evaluate(() => ({
      axis: !!window.__zgMap.getLayer("zg-sun-axis-core"),
      spots: !!window.__zgMap.getLayer("zg-light-spots"),
      diagnostics: window.__zgLightZone || null,
      mapSize: { width: window.__zgMap.getCanvas().clientWidth, height: window.__zgMap.getCanvas().clientHeight },
      belowHorizonExpression: window.__zgMap.getLayer("zg-light-spots-label") ? window.__zgMap.getLayoutProperty("zg-light-spots-label", "text-field") : null,
      partialStatus: window.ZGLightZone.evaluateCandidates([{ id: "partial", lng: 113.97, lat: 22.58 }], [], { azimuthDeg: 280, altitudeDeg: 7 }, { dataReady: false })[0].status,
      axisFeature: (() => {
        const feature = window.__zgMap.getSource("zg-sun-axis")?._data?.features?.[0];
        return feature ? {
          coordinates: feature.geometry.coordinates,
          screen: feature.geometry.coordinates.map((point) => window.__zgMap.project(point)),
        } : null;
      })(),
      routeFeature: (() => {
        const feature = window.__zgMap.getSource("zg-route")?._data;
        const coordinates = feature?.geometry?.coordinates || [];
        return coordinates.length ? {
          count: coordinates.length,
          firstScreen: window.__zgMap.project(coordinates[0]),
          lastScreen: window.__zgMap.project(coordinates[coordinates.length - 1]),
        } : null;
      })(),
      spotFeatures: (window.__zgMap.getSource("zg-light-spots")?._data?.features || []).map((feature) => ({
        name: feature.properties.name,
        status: feature.properties.status,
        coordinates: feature.geometry.coordinates,
        screen: window.__zgMap.project(feature.geometry.coordinates),
      })),
    }));
    const expectAxis = mode === "axis" || mode === "both";
    const expectSpots = mode === "spots" || mode === "both";
    if (state.axis !== expectAxis || state.spots !== expectSpots) {
      throw new Error(`${mode} layer mismatch: ${JSON.stringify(state)}`);
    }
    if (mode !== "off" && !state.diagnostics) throw new Error(`${mode} diagnostics missing`);
    if (expectAxis && (!state.axisFeature || angleDelta(geoBearing(state.axisFeature.coordinates), state.diagnostics.sunAzimuthDeg) > 0.5)) {
      throw new Error(`${mode} axis bearing mismatch: ${JSON.stringify(state)}`);
    }
    if (expectSpots && (!state.diagnostics.dataReady || state.diagnostics.candidateCount !== 4 || state.diagnostics.visibleBuildingCount <= 0 || state.diagnostics.rayBuildingCount <= 0 || state.diagnostics.rayBuildingCount > 650 || state.diagnostics.truncated)) {
      throw new Error(`${mode} invalid building sample: ${JSON.stringify(state.diagnostics)}`);
    }
    if (expectSpots && (state.partialStatus !== "unknown" || !JSON.stringify(state.belowHorizonExpression).includes("below_horizon") || !JSON.stringify(state.belowHorizonExpression).includes("已日落"))) {
      throw new Error(`${mode} missing truthful loading/sunset states`);
    }
    if (expectSpots && state.spotFeatures.some(({ screen }) => screen.x < 16 || screen.x > state.mapSize.width - 16 || screen.y < 170 || screen.y > state.mapSize.height - 170)) {
      throw new Error(`${mode} contains off-screen light samples: ${JSON.stringify(state.spotFeatures)}`);
    }
    await page.screenshot({ path: `e2e-out/light-zone-${mode}.png`, fullPage: true });
    console.log(mode, JSON.stringify(state));
    const result = { mode, ...state };
    if (expectSpots) {
      const generation = state.diagnostics.generation;
      const moveProbe = await page.evaluate(() => {
        const map = window.__zgMap, center = map.getCenter();
        const calls = window.__zgLightZoneSelectCalls;
        map.easeTo({ center: [center.lng + 0.0006, center.lat], zoom: map.getZoom() + 0.05, duration: 1000 });
        return { calls };
      });
      await page.waitForTimeout(250);
      const duringMove = await page.evaluate(() => ({ moving: window.__zgMap.isMoving(), calls: window.__zgLightZoneSelectCalls }));
      if (!duringMove.moving || duringMove.calls !== moveProbe.calls) throw new Error(`${mode} computed during camera animation: ${JSON.stringify({ moveProbe, duringMove })}`);
      await page.waitForFunction((previous) => window.__zgLightZone?.generation > previous && window.__zgLightZone?.dataReady === true, generation, { timeout: readyTimeout });
      result.movedDiagnostics = await page.evaluate(() => window.__zgLightZone);
      if (result.movedDiagnostics.candidateCount !== 4 || result.movedDiagnostics.visibleBuildingCount <= 0 || result.movedDiagnostics.truncated) {
        throw new Error(`${mode} invalid moved generation: ${JSON.stringify(result.movedDiagnostics)}`);
      }

      const movedGeneration = result.movedDiagnostics.generation;
      await page.evaluate(() => window.__zgMap.jumpTo({ bearing: window.__zgMap.getBearing() + 6 }));
      await page.waitForFunction((previous) => window.__zgLightZone?.generation > previous && window.__zgLightZone?.dataReady === true, movedGeneration, { timeout: readyTimeout });
      result.bearingDiagnostics = await page.evaluate(() => window.__zgLightZone);

      const timeSelect = page.locator(".twk-row").filter({ hasText: "太阳位置" }).locator("select");
      await timeSelect.selectOption("19:20");
      await page.waitForFunction(() => {
        try {
          const diagnostics = window.__zgLightZone;
          const source = window.__zgMap?.getSource("zg-light-spots");
          const features = source?._data?.features || [];
          return diagnostics?.sunAltitudeDeg <= 0 && features.length === 4 && features.every((feature) => feature.properties.status === "below_horizon");
        } catch { return false; }
      }, undefined, { timeout: readyTimeout });
      result.sunsetDiagnostics = await page.evaluate(() => window.__zgLightZone);
    }
    results.push(result);
    await page.close();
  }

  if (errors.length) throw new Error(errors.join("\n"));
  writeFileSync("e2e-out/light-zone.json", JSON.stringify({ results, errors }, null, 2));
  console.log("light-zone e2e: PASS");
} finally {
  await browser?.close();
}
