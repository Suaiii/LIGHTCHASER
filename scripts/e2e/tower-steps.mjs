// 塔楼近景逐步进旋转帧检查（图8 现场复刻）：每帧=用户旋转中某瞬间的确定画面
import { chromium } from "playwright";
const OUT = process.env.ZG_E2E_OUT || "./e2e-out/";
const LIGHT_ZONE = process.env.ZG_LIGHT_ZONE ? `&lightZone=${encodeURIComponent(process.env.ZG_LIGHT_ZONE)}` : "";
import { mkdirSync } from "node:fs"; mkdirSync(OUT, { recursive: true });
const CLIP = { x: 455, y: 235, width: 370, height: 400 };
// 本机走系统代理时设 ZG_PROXY=http://127.0.0.1:7897（localhost 必须 bypass，否则代理缓存背刺）
const browser = await chromium.launch(process.env.ZG_PROXY ? { proxy: { server: process.env.ZG_PROXY, bypass: "127.0.0.1,localhost" } } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 150)));

await page.goto(`http://127.0.0.1:5174/?tweaks=1${LIGHT_ZONE}`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(4500);
await page.getByText("一键大区赛演示", { exact: false }).first().click();
const waitForMap = () => page.waitForFunction(() => {
  try { return !!window.__zgMap?.getLayer("zg-route-core"); } catch { return false; }
}, undefined, { timeout: 90000 });
await waitForMap();
await page.waitForTimeout(1200);
await waitForMap();
const closeBtn = page.locator('button[aria-label="Close tweaks"]');
if (await closeBtn.count()) await closeBtn.click();

// 拉近到塘朗站塔楼群（图8 现场），等重建（位移>400m 触发）
await page.evaluate(() => { window.__zgB = null; window.__zgMap.jumpTo({ center: [113.9948, 22.5935], zoom: 15.8, pitch: 62, bearing: 200 }); });
await page.waitForFunction(() => window.__zgB && window.__zgB.verts > 0, undefined, { timeout: 90000 });
await page.waitForTimeout(4500); // moveend 节流 + 重建 + 阴影一次性烘焙

// 逐 2° 步进 12 帧
for (let i = 0; i < 12; i++) {
  await page.evaluate((b) => window.__zgMap.jumpTo({ bearing: b }), 200 + i * 2);
  await page.waitForTimeout(260);
  await page.screenshot({ clip: CLIP, path: OUT + `step-${String(i).padStart(2, "0")}.png` });
}
// 相邻帧 diff 序列（flip-flop 检测：平滑旋转应是均匀小 diff，闪烁=某对暴涨）
const fs = await import("node:fs");
const diffs = [];
for (let i = 1; i < 12; i++) {
  const b1 = fs.readFileSync(OUT + `step-${String(i - 1).padStart(2, "0")}.png`).toString("base64");
  const b2 = fs.readFileSync(OUT + `step-${String(i).padStart(2, "0")}.png`).toString("base64");
  const d = await page.evaluate(async ([x, y]) => {
    const load = (b) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = "data:image/png;base64," + b; });
    const [i1, i2] = await Promise.all([load(x), load(y)]);
    const cv = document.createElement("canvas"); cv.width = i1.width; cv.height = i1.height;
    const g = cv.getContext("2d");
    g.drawImage(i1, 0, 0); const d1 = g.getImageData(0, 0, cv.width, cv.height).data;
    g.clearRect(0, 0, cv.width, cv.height);
    g.drawImage(i2, 0, 0); const d2 = g.getImageData(0, 0, cv.width, cv.height).data;
    let bad = 0;
    for (let k = 0; k < d1.length; k += 4) {
      if (Math.abs(d1[k] - d2[k]) > 12 || Math.abs(d1[k + 1] - d2[k + 1]) > 12 || Math.abs(d1[k + 2] - d2[k + 2]) > 12) bad++;
    }
    return +(bad / (cv.width * cv.height) * 100).toFixed(2);
  }, [b1, b2]);
  diffs.push(d);
}
const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
const max = Math.max(...diffs);
console.log("相邻帧 diff%:", diffs.join(" "));
console.log(`均值 ${mean.toFixed(2)}% · 峰值 ${max}% · 峰/均 ${(max / Math.max(mean, 0.01)).toFixed(1)}x  ${max / Math.max(mean, 0.01) < 2.5 ? "✅ 平滑(无flip-flop)" : "❌ 存在闪烁帧"}`);
console.log("JS 错误(" + errors.length + "):", errors.slice(0, 3));
await browser.close();
if (max / Math.max(mean, 0.01) >= 2.5 || errors.length) throw new Error("tower step regression failed");
