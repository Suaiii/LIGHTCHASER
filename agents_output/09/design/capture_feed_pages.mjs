// AGENT_09 · B②截图集：feed/p1/p2 三张 1x 截图（Gate 0 裁定：2x 砍，只出 1x 一套）
// 用法：先 `npm run dev:preview`（另开终端），再 node agents_output/09/design/capture_feed_pages.mjs
// 输出目录可用 ZG_E2E_OUT 覆盖（默认本目录 screenshots/）；本机走系统代理时设 ZG_PROXY（同其余 scripts/e2e 约定）。
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = process.env.ZG_E2E_OUT || join(__dirname, "screenshots/");
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(process.env.ZG_PROXY ? { proxy: { server: process.env.ZG_PROXY, bypass: "127.0.0.1,localhost" } } : {});
const page = await browser.newPage({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 1 }); // 1x：与 tokens.md 紧凑视口 402×874 一致
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 150)));

async function closeTweaks() {
  const closeBtn = page.locator('button[aria-label="Close tweaks"]');
  if (await closeBtn.count()) await closeBtn.click();
}

// 默认 demoLocation="gps" 在无浏览器定位权限环境下会 4.5s 超时降级到 FALLBACK_SUNSET_PAYLOAD——
// 那是初赛遗留的上海(金山城市沙滩)兜底数据，不能代表深圳产品，必须显式切到深圳场景，
// 见 public/app.jsx DEMO_LOCATIONS/FALLBACK_SUNSET_PAYLOAD.meta.city==="Shanghai"。
async function forceShenzhenHighScore() {
  await page.locator("select.twk-field").nth(0).selectOption("high"); // 评分场景 → 高分87·值得跑出门
  await page.locator("select.twk-field").nth(1).selectOption("sustech"); // 当前位置 → 南方科技大学(大区赛场地)，city=shenzhen
  await page.waitForTimeout(2500); // /api/sunset 本地推荐计算，留余量等 fetch resolve
}

// --- p1 / feed：默认状态 = 封面（row0,col0），本身就是 feed 卡本体 ---
await page.goto("http://127.0.0.1:5174/?tweaks=1", { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(2000);
await forceShenzhenHighScore();
await closeTweaks();
await page.waitForTimeout(500);
await page.screenshot({ path: OUT + "p1.png" });
await page.screenshot({ path: OUT + "feed.png" }); // feed = 同一张 feed 卡本体（page_specs.md：P1 即"feed 卡本体"），两文件名并存满足 §2b 命名硬规格

// --- p2：追·光地图（row0,col1）---
await page.goto("http://127.0.0.1:5174/?tweaks=1", { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(2000);
await forceShenzhenHighScore();
await page.getByRole("button", { name: "追·光地图", exact: true }).click();
await page.waitForTimeout(3000); // 3D/地图场景加载+光照渲染稳定
await closeTweaks();
await page.waitForTimeout(800);
await page.screenshot({ path: OUT + "p2.png" });

console.log("已生成 3 张 1x 截图 → " + OUT);
console.log("JS 错误(" + errors.length + "):", errors.slice(0, 5));
await browser.close();
