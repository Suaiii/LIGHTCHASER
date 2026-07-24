// e2e：GL 光影地图页（Row1 第二子页）冒烟——起 dev-preview 后 Playwright 截图验证 GL 地图+照片气泡渲染。用法：node scripts/e2e/light-map-route-page.mjs
import { chromium } from "playwright";
import previewServer from "../dev-preview.js";

const HOST = "127.0.0.1";
const PORT = 5174;
const BASE_URL = `http://${HOST}:${PORT}/`;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startPreview() {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      previewServer.off("listening", onListening);
      if (error && error.code === "EADDRINUSE") {
        resolve(false);
        return;
      }
      reject(error);
    };
    const onListening = () => {
      previewServer.off("error", onError);
      resolve(true);
    };

    previewServer.once("error", onError);
    previewServer.once("listening", onListening);
    previewServer.listen(PORT, HOST);
  });
}

async function swipe(page, from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
  await wait(700);
}

let previewStarted = false;
let browser;

try {
  previewStarted = await startPreview();
  browser = await chromium.launch(
    process.env.ZG_PROXY
      ? { proxy: { server: process.env.ZG_PROXY, bypass: "127.0.0.1,localhost" } }
      : {}
  );
  const context = await browser.newContext({
    viewport: { width: 430, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const pageErrors = [];

  page.on("pageerror", (error) => {
    pageErrors.push(error.stack || error.message || String(error));
  });

  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("#app", { timeout: 15000 });
  await wait(2500);

  await swipe(page, { x: 215, y: 660 }, { x: 215, y: 330 });
  await swipe(page, { x: 330, y: 470 }, { x: 80, y: 470 });
  await page.waitForSelector(".maplibregl-map", { timeout: 15000 });
  await page.waitForSelector(".zg-photo-bubble", { timeout: 15000 });
  await wait(5000);
  await page.evaluate(() => {
    window.__zgFirstBubble = document.querySelector(".zg-photo-bubble:not(.is-live)") || document.querySelector(".zg-photo-bubble");
  });
  await page.evaluate(async () => {
    const response = await fetch("/api/photos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat: 22.481, lng: 113.941, caption: "GL 地图实时冒泡测试" }),
    });
    if (!response.ok) throw new Error(`photos_post_${response.status}`);
  });
  await page.waitForSelector(".zg-photo-bubble.is-live", { timeout: 4500 });
  await page.waitForFunction(() => window.__zgB && window.__zgB.verts > 0, { timeout: 90000 });

  const state = await page.evaluate(() => ({
    screen: document.querySelector("[data-screen-label]")?.getAttribute("data-screen-label"),
    hasPhotoMap: Boolean(document.querySelector(".photo-map-scene")),
    hasMapLibre: Boolean(document.querySelector(".maplibregl-map")),
    photoBubbleCount: document.querySelectorAll(".zg-photo-bubble").length,
    livePhotoBubbleCount: document.querySelectorAll(".zg-photo-bubble.is-live").length,
    firstBubbleStillConnected: Boolean(window.__zgFirstBubble && window.__zgFirstBubble.isConnected),
    liveBubbleAnimation: getComputedStyle(document.querySelector(".zg-photo-bubble.is-live")).animationName,
    hasThreeCanvas: Boolean(document.querySelector("canvas[data-swipe-lock='true']")),
    hasZgMap: Boolean(window.__zgMap),
    hasZgBuildings: Boolean(window.__zgB),
  }));

  console.log(JSON.stringify({ previewStarted, state, pageErrors: pageErrors.slice(0, 5) }, null, 2));

  if (state.hasPhotoMap) {
    throw new Error("Expected route GL/3D page, got photo map page");
  }
  if (!state.hasMapLibre && !state.hasThreeCanvas && !state.hasZgMap && !state.hasZgBuildings) {
    throw new Error(`Expected GL/3D route map, got ${JSON.stringify(state)}`);
  }
  if (state.hasMapLibre && !state.hasZgBuildings) {
    throw new Error(`Expected 3D building mesh on GL map, got ${JSON.stringify(state)}`);
  }
  if (state.hasMapLibre && state.photoBubbleCount < 1) {
    throw new Error(`Expected photo bubbles on GL map, got ${JSON.stringify(state)}`);
  }
  if (state.hasMapLibre && state.livePhotoBubbleCount < 1) {
    throw new Error(`Expected live photo bubble on GL map, got ${JSON.stringify(state)}`);
  }
  if (state.hasMapLibre && !state.firstBubbleStillConnected) {
    throw new Error(`Expected stable GL photo bubble DOM across refresh, got ${JSON.stringify(state)}`);
  }
  if (state.hasMapLibre && !/zgPhoto/.test(state.liveBubbleAnimation || "")) {
    throw new Error(`Expected live photo bubble animation, got ${JSON.stringify(state)}`);
  }
  if (pageErrors.length) {
    throw new Error(`Route map emitted ${pageErrors.length} pageerror(s)`);
  }

  await context.close();
} finally {
  if (browser) await browser.close();
  if (previewStarted) {
    await new Promise((resolve) => previewServer.close(resolve));
  }
}
