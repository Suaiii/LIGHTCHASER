// 旋转不变性测试：A→旋转140°→精确回A，两帧像素diff应≈0（reducedMotion 关合法动画）
// 途中抓帧供人工查乱码。第一性验证：帧间不稳定的所有来源都被消灭后，此测试必然通过。
import { chromium } from "playwright";
const OUT = process.env.ZG_E2E_OUT || "./e2e-out/";
import { mkdirSync } from "node:fs"; mkdirSync(OUT, { recursive: true });
const CLIP = { x: 455, y: 235, width: 370, height: 400 }; // 纯地图区（避开倒计时/署名）

// 本机走系统代理时设 ZG_PROXY=http://127.0.0.1:7897（localhost 必须 bypass，否则代理缓存背刺）
const browser = await chromium.launch(process.env.ZG_PROXY ? { proxy: { server: process.env.ZG_PROXY, bypass: "127.0.0.1,localhost" } } : {});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 150)));

await page.goto("http://127.0.0.1:5174/?tweaks=1", { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(4500);
await page.evaluate(() => { window.__zgB = null; });
await page.getByText("一键大区赛演示", { exact: false }).first().click();
// 等 Three 建筑真就位（__zgB=换装完成的真信号；HUD 徽标是 React 旧值会假绿）
await page.waitForFunction(() => window.__zgB && window.__zgB.verts > 0, { timeout: 90000 });
await page.waitForTimeout(2500);
const closeBtn = page.locator('button[aria-label="Close tweaks"]');
if (await closeBtn.count()) await closeBtn.click();
await page.waitForTimeout(400);

// 基准相机
const cam0 = await page.evaluate(() => {
  const m = window.__zgMap;
  m.jumpTo({ bearing: 223, pitch: 62 });
  return { c: m.getCenter(), z: m.getZoom(), b: m.getBearing(), p: m.getPitch() };
});
await page.waitForTimeout(900);
const s1 = await page.screenshot({ clip: CLIP });
console.log("S1 已取 @bearing", cam0.b);

// 连续旋转，途中抓帧
await page.evaluate(() => window.__zgMap.rotateTo(363, { duration: 1600 }));
for (let i = 0; i < 5; i++) {
  await page.waitForTimeout(280);
  await page.screenshot({ clip: CLIP, path: OUT + `rot-${i}.png` });
}
await page.waitForTimeout(600);

// 精确回到基准
await page.evaluate((c) => {
  window.__zgMap.jumpTo({ center: [c.c.lng, c.c.lat], zoom: c.z, bearing: c.b, pitch: c.p });
}, cam0);
await page.waitForTimeout(900);
const s2 = await page.screenshot({ clip: CLIP });
console.log("S2 已取（转回原位）");

// 像素 diff
const diff = await page.evaluate(async ([b1, b2]) => {
  const load = (b) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = "data:image/png;base64," + b; });
  const [i1, i2] = await Promise.all([load(b1), load(b2)]);
  const cv = document.createElement("canvas"); cv.width = i1.width; cv.height = i1.height;
  const g = cv.getContext("2d");
  g.drawImage(i1, 0, 0); const d1 = g.getImageData(0, 0, cv.width, cv.height).data;
  g.clearRect(0, 0, cv.width, cv.height);
  g.drawImage(i2, 0, 0); const d2 = g.getImageData(0, 0, cv.width, cv.height).data;
  let bad = 0; const total = cv.width * cv.height;
  for (let i = 0; i < d1.length; i += 4) {
    if (Math.abs(d1[i] - d2[i]) > 12 || Math.abs(d1[i + 1] - d2[i + 1]) > 12 || Math.abs(d1[i + 2] - d2[i + 2]) > 12) bad++;
  }
  return { bad, total, pct: (bad / total * 100).toFixed(3) };
}, [s1.toString("base64"), s2.toString("base64")]);

console.log(`不变性 diff: ${diff.bad}/${diff.total} 像素 = ${diff.pct}%  ${+diff.pct < 0.2 ? "✅ PASS(<0.2%)" : "❌ FAIL"}`);
console.log("JS 错误(" + errors.length + "):", errors.slice(0, 3));
await page.screenshot({ path: OUT + "rot-final.png" });
await browser.close();
