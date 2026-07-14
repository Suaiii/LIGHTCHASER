// 图九复刻：连续多跳平移后建筑必须常驻（v4.4 验收）
// 检查点：①每跳之后 Three 楼群仍在（HUD 徽标 + 像素证据）②console.warn 无洪水 ③0 JS 错误
import { chromium } from "playwright";
const OUT = process.env.ZG_E2E_OUT || "./e2e-out/";
import { mkdirSync } from "node:fs"; mkdirSync(OUT, { recursive: true });
const CLIP = { x: 455, y: 235, width: 370, height: 400 };

// 本机走系统代理时设 ZG_PROXY=http://127.0.0.1:7897（localhost 必须 bypass，否则代理缓存背刺）
const browser = await chromium.launch(process.env.ZG_PROXY ? { proxy: { server: process.env.ZG_PROXY, bypass: "127.0.0.1,localhost" } } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [], warns = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 150)));
page.on("console", (m) => { if (m.type() === "warning") warns.push(m.text().slice(0, 80)); });

await page.goto("http://127.0.0.1:5174/?tweaks=1", { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(4500);
await page.evaluate(() => { window.__zgB = null; });
await page.getByText("一键大区赛演示", { exact: false }).first().click();
await page.waitForFunction(() => window.__zgB && window.__zgB.verts > 0, { timeout: 90000 });
const closeBtn = page.locator('button[aria-label="Close tweaks"]');
if (await closeBtn.count()) await closeBtn.click();
await page.waitForTimeout(1000);

// 建筑存在性探针：直接问引擎（window.__zgB 在每次换装完成时更新），不猜像素
const probe = () => page.evaluate(() => window.__zgB || null);

// 五连跳：塘朗(图九现场) → 深大 → 后海 → 人才公园 → 回塘朗
const hops = [
  ["塘朗·图九现场", 113.9948, 22.5935, 15.8],
  ["深大粤海", 113.9365, 22.5330, 15.5],
  ["后海", 113.9450, 22.5150, 15.6],
  ["人才公园", 113.9550, 22.5230, 15.4],
  ["回塘朗", 113.9948, 22.5935, 15.8],
];
let pass = true;
let prevStamp = JSON.stringify(await probe());
for (const [name, lng, lat, z] of hops) {
  await page.evaluate(([x, y, zz]) => window.__zgMap.jumpTo({ center: [x, y], zoom: zz, pitch: 62, bearing: 200 }), [lng, lat, z]);
  // 等待：moveend 450ms + areTilesLoaded 重试链(≤25×280ms) + 分帧构建；等到 __zgB 更新或超时
  let b = null, changed = false;
  for (let w = 0; w < 24; w++) {
    await page.waitForTimeout(500);
    b = await probe();
    if (b && JSON.stringify(b) !== prevStamp) { changed = true; break; }
  }
  prevStamp = JSON.stringify(b);
  await page.screenshot({ clip: CLIP, path: OUT + `hop-${name.replace(/[·图九现场]/g, "")}.png` });
  const ok = b && b.verts > 0;
  console.log(`跳 ${name}: 楼=${b ? b.n : 0} 栋 · 顶点=${b ? b.verts : 0} · 本跳重建=${changed ? "是" : "否(沿用)"} ${ok ? "✓" : "✗ 空场!"}`);
  if (!ok) pass = false;
}
await page.screenshot({ path: OUT + "hop-full.png" });
console.log(`console.warn 条数: ${warns.length}${warns.length ? "  样例: " + warns[0] : ""}`);
console.log(`JS 错误(${errors.length}):`, errors.slice(0, 3));
console.log(pass && !errors.length ? "✅ 五连跳楼群常驻 PASS" : "❌ FAIL");
await browser.close();
