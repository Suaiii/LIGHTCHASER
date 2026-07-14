// v4.6 验收：拉远+大量旋转+拉回 + 生长动画（__zgGrow 因子必须真实经过中间值）
// 检查点：①低 z 剪影上台+楼缩回(grow→0 有中间帧) ②低 z 旋转 20 次 ③拉回楼长回(grow→1 有中间帧) ④0 JS 错误
import { chromium } from "playwright";
const OUT = process.env.ZG_E2E_OUT || "./e2e-out/";
import { mkdirSync } from "node:fs"; mkdirSync(OUT, { recursive: true });
const CLIP = { x: 455, y: 235, width: 370, height: 400 };

// 本机走系统代理时设 ZG_PROXY=http://127.0.0.1:7897（localhost 必须 bypass，否则代理缓存背刺）
const browser = await chromium.launch(process.env.ZG_PROXY ? { proxy: { server: process.env.ZG_PROXY, bypass: "127.0.0.1,localhost" } } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));

await page.goto("http://127.0.0.1:5174/?tweaks=1", { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(4500);
await page.evaluate(() => { window.__zgB = null; });
await page.getByText("一键大区赛演示", { exact: false }).first().click();
await page.waitForFunction(() => window.__zgB && window.__zgB.verts > 0, { timeout: 90000 });
const closeBtn = page.locator('button[aria-label="Close tweaks"]');
if (await closeBtn.count()) await closeBtn.click();
await page.waitForTimeout(1500);

const state = () => page.evaluate(() => {
  const m = window.__zgMap;
  const sil = m.getLayer("zg-3d-buildings") ? m.getPaintProperty("zg-3d-buildings", "fill-extrusion-opacity") : "absent";
  return { z: +m.getZoom().toFixed(1), sil, zgB: window.__zgB || null, grow: window.__zgGrow };
});
// 生长采样：页面内 rAF 打点（headless 8fps 下跨进程 evaluate 采样会漏帧），
// 传入触发动作，同帧启动记录——中间值证明动画真实发生而非硬切
const sampleGrow = (trigger, ms) => page.evaluate(([trig, dur]) => new Promise((res) => {
  const seen = [];
  const t0 = performance.now();
  const tick = () => {
    const g = window.__zgGrow;
    if (g !== undefined && (seen.length === 0 || Math.abs(seen[seen.length - 1] - g) > 1e-6)) seen.push(+g.toFixed(2));
    if (performance.now() - t0 < dur) requestAnimationFrame(tick);
    else res(seen);
  };
  requestAnimationFrame(tick);
  new Function(trig)();
}), [trigger, ms]);

// ① 就位状态：高 z，剪影应淡出(opacity 0)、grow=1
await page.evaluate(() => window.__zgMap.jumpTo({ center: [113.9948, 22.5935], zoom: 15.8, pitch: 62, bearing: 200 }));
await page.waitForTimeout(6000);
let s = await state();
console.log(`高z就位: z=${s.z} 剪影op=${s.sil}(期望0) grow=${s.grow}(期望1) 楼=${s.zgB?.n}`, s.sil === 0 && s.grow === 1 && s.zgB ? "✓" : "✗");
let pass = s.sil === 0 && s.grow === 1 && !!s.zgB;
await page.screenshot({ clip: CLIP, path: OUT + "lod-high1.png" });

// ② 拉远到 z12.6：楼应缩回地里（grow 经中间值到 0）+ 剪影淡入
const shrink = await sampleGrow("window.__zgMap.jumpTo({ zoom: 12.6 })", 1500);
s = await state();
const shrinkAnimated = shrink.some((g) => g > 0.05 && g < 0.95) && s.grow === 0;
console.log(`拉远: 缩回序列=[${shrink.join(",")}] 终值=${s.grow}(期望0经中间值) 剪影op=${s.sil}(期望0.62)`, shrinkAnimated && s.sil === 0.62 ? "✓" : "✗");
if (!shrinkAnimated || s.sil !== 0.62) pass = false;
await page.screenshot({ clip: CLIP, path: OUT + "lod-far.png" });

// ③ 低 z 疯狂旋转 20 次 + 小幅平移（复刻用户操作）
for (let i = 0; i < 20; i++) {
  await page.evaluate((b) => window.__zgMap.jumpTo({ bearing: b, center: [113.9948 + Math.sin(b / 60) * 0.004, 22.5935] }), 200 + i * 33);
  await page.waitForTimeout(180);
}
await page.waitForTimeout(2500);
s = await state();
console.log(`低z旋转20次后: z=${s.z} 剪影op=${s.sil}(期望0.62) grow=${s.grow}(期望0)`, s.sil === 0.62 && s.grow === 0 ? "✓" : "✗");
if (s.sil !== 0.62 || s.grow !== 0) pass = false;
await page.screenshot({ clip: CLIP, path: OUT + "lod-far-spun.png" });

// ④ 拉回 z15.8：楼从地里长回（grow 经中间值到 1，零重建）+ 剪影淡出
const regrow = await sampleGrow("window.__zgMap.jumpTo({ zoom: 15.8, bearing: 220 })", 1600);
s = await state();
const regrowAnimated = regrow.some((g) => g > 0.05 && g < 0.95) && s.grow === 1;
console.log(`拉回: 生长序列=[${regrow.join(",")}] 终值=${s.grow}(期望1经中间值) 剪影op=${s.sil}(期望0) 楼=${s.zgB?.n}`, regrowAnimated && s.sil === 0 && s.zgB ? "✓" : "✗");
if (!regrowAnimated || s.sil !== 0 || !s.zgB) pass = false;
await page.screenshot({ clip: CLIP, path: OUT + "lod-back.png" });

// ⑤ 高 z 再旋转 12 次（确认回归后稳定，grow 保持 1 不重播动画）
for (let i = 0; i < 12; i++) {
  await page.evaluate((b) => window.__zgMap.jumpTo({ bearing: b }), 220 + i * 25);
  await page.waitForTimeout(200);
}
await page.waitForTimeout(2000);
s = await state();
console.log(`高z旋转12次后: 剪影op=${s.sil}(期望0) grow=${s.grow}(期望1) 楼=${s.zgB?.n}`, s.sil === 0 && s.grow === 1 && s.zgB ? "✓" : "✗");
if (s.sil !== 0 || s.grow !== 1 || !s.zgB) pass = false;
await page.screenshot({ clip: CLIP, path: OUT + "lod-high2.png" });

console.log(`JS 错误(${errors.length}):`, errors.slice(0, 3));
console.log(pass && !errors.length ? "✅ LOD 拉远/旋转/拉回全链路 PASS" : "❌ FAIL");
await browser.close();
