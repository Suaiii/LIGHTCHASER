// HERMES-07 RED/GREEN: capture the real browser-facing WebGL recovery path.
// Run with a headed browser when reproducing the physical-machine disappearance.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = process.env.ZG_E2E_OUT || "./e2e-out/";
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({
  headless: false,
  ...(process.env.ZG_PROXY ? { proxy: { server: process.env.ZG_PROXY, bypass: "127.0.0.1,localhost" } } : {}),
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
let startup = null;
for (let attempt = 1; attempt <= 3; attempt++) {
  await page.goto(`http://127.0.0.1:5174/?tweaks=1&hermesAttempt=${attempt}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(4500);
  const demo = page.getByText("一键大区赛演示", { exact: false }).first();
  if (await demo.count()) await demo.click();
  try {
    await page.waitForFunction(() => window.__zgB && window.__zgB.verts > 0 && document.querySelector("canvas"), { timeout: 90000 });
    startup = { attempt, ok: true };
    break;
  } catch (error) {
    startup = { attempt, ok: false, error: String(error), webgl: await page.evaluate(() => window.__zgWebgl).catch(() => null) };
  }
}
if (!startup?.ok) throw new Error(`WebGL startup failed after retries: ${JSON.stringify(startup)}`);

const before = await page.evaluate(() => ({
  webgl: window.__zgWebgl,
  grow: window.__zgGrow,
  buildings: window.__zgB,
  canvas: !!document.querySelector("canvas"),
}));
if (!before.canvas) throw new Error(`WebGL canvas missing: ${JSON.stringify(before)}`);

// Preserve a natural loss when present, then always exercise the restore edge.
await page.evaluate((alreadyLost) => {
  const canvas = document.querySelector("canvas");
  if (!alreadyLost) canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
  canvas.dispatchEvent(new Event("webglcontextrestored"));
}, before.webgl === "lost");
await page.waitForTimeout(1200);
const after = await page.evaluate(() => ({
  webgl: window.__zgWebgl,
  grow: window.__zgGrow,
  buildings: window.__zgB,
}));
// Realistic interaction window: continuous zoom/rotation/pan for one minute.
// A natural context loss is recorded by the page hook if the GPU/driver emits it.
const stressStarted = Date.now();
while (Date.now() - stressStarted < 60000) {
  await page.evaluate((i) => {
    const map = window.__zgMap;
    if (!map) return;
    map.jumpTo({
      zoom: 14.2 + (i % 4) * 0.45,
      bearing: (i * 31) % 360,
      pitch: 52 + (i % 3) * 5,
      center: [113.9948 + Math.sin(i) * 0.002, 22.5935 + Math.cos(i) * 0.0015],
    });
  }, Math.floor((Date.now() - stressStarted) / 900));
  await page.waitForTimeout(900);
}
const stress = await page.evaluate(() => ({
  webgl: window.__zgWebgl,
  grow: window.__zgGrow,
  buildings: window.__zgB,
}));
await page.screenshot({ path: `${OUT}webgl-recovery.png` });
writeFileSync(`${OUT}webgl-recovery.json`, JSON.stringify({ startup, before, after, stress, errors }, null, 2));

const pass = after.webgl === "restored" && after.buildings?.verts > 0 && stress.buildings?.verts > 0 && errors.length === 0;
console.log(JSON.stringify({ startup, before, after, stress, errors, pass }, null, 2));
await browser.close();
if (!pass) process.exitCode = 1;
