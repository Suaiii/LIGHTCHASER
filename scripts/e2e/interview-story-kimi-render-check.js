#!/usr/bin/env node
/**
 * interview-story-kimi-render-check.js
 *
 * 「追·光对谈」Kimi 独立页真实渲染与交互验收。
 * 不安装任何依赖：从 npx 缓存中定位与已装 chromium 匹配的 playwright。
 *
 * 用法：node scripts/e2e/interview-story-kimi-render-check.js
 *
 * 覆盖：
 *  R0 控制台/页面错误为 0            R1 无横向溢出（顶/中/底）
 *  R2 首屏媒体请求 ≤4 且无 mp4       R3 滚动后全部媒体兑现加载
 *  R4 章节导航与当前位置指示          R5 滚动揭示后无隐藏内容
 *  R6 截图存档（desktop/mobile/rm）
 *  I1 灯箱键盘打开（Enter/Space）    I2 Esc 关闭 + 焦点回归
 *  I3 背景滚动锁定/解锁              I4 灯箱切换、计数、焦点圈、inert
 *  I5 视频互斥（同时播放 ≤1）        I6 近视口加载 / 离视口暂停
 *  I7 全程静音                        I8 reduced-motion 降级与内容完整
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");

const ROOT = path.resolve(__dirname, "..", "..");
const PORT = 5199;
const BASE = `http://127.0.0.1:${PORT}`;
const PAGE_URL = `${BASE}/interview-story-kimi.html`;
const SHOTS = path.join(ROOT, "docs", "checks", "shots", "interview-story-kimi");

const problems = [];
let checkCount = 0;
function check(id, ok, detail) {
  checkCount++;
  const line = `${ok ? "PASS" : "FAIL"} ${id}${detail ? " " + detail : ""}`;
  console.log(line);
  if (!ok) problems.push(line);
}

/* ————— 定位可用的 playwright（零安装） ————— */
function loadPlaywright() {
  const home = os.homedir();
  const npxDir = path.join(home, ".npm", "_npx");
  if (fs.existsSync(npxDir)) {
    for (const hash of fs.readdirSync(npxDir)) {
      const nmDir = path.join(npxDir, hash, "node_modules");
      for (const pkg of ["playwright", "playwright-core"]) {
        const pkgJson = path.join(nmDir, pkg, "package.json");
        if (!fs.existsSync(pkgJson)) continue;
        try {
          const { createRequire } = require("module");
          const req = createRequire(pkgJson);
          const pw = req(pkg);
          const exe = pw.chromium.executablePath();
          if (fs.existsSync(exe)) {
            console.log(`NOTE 使用 ${pkg}@${JSON.parse(fs.readFileSync(pkgJson, "utf8")).version}（${hash}），浏览器 ${exe}`);
            return pw;
          }
        } catch (e) { /* 尝试下一个 */ }
      }
    }
  }
  return null;
}

function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    (function poll() {
      http.get(url, (res) => { res.resume(); resolve(); })
        .on("error", () => {
          if (Date.now() > deadline) reject(new Error("服务器等待超时"));
          else setTimeout(poll, 250);
        });
    })();
  });
}

async function newPage(browser, contextOptions) {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const state = { page, context, errors: [], mediaReqs: new Set() };
  page.on("pageerror", (e) => state.errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") state.errors.push(`console: ${m.text()}`); });
  page.on("request", (r) => { if (r.url().includes("/assets/interviews/")) state.mediaReqs.add(r.url()); });
  return state;
}

async function scrollInstant(page, y) {
  await page.evaluate((v) => window.scrollTo({ top: v, behavior: "instant" }), y);
  await page.waitForTimeout(500);
}
async function scrollToSection(page, id) {
  await page.evaluate((sid) => {
    document.getElementById(sid).scrollIntoView({ behavior: "instant", block: "start" });
  }, id);
  await page.waitForTimeout(800);
}
async function scrollThrough(page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const step = await page.evaluate(() => Math.floor(window.innerHeight * 0.8));
  for (let y = 0; y < height; y += step) {
    await page.evaluate((v) => window.scrollTo({ top: v, behavior: "instant" }), y);
    await page.waitForTimeout(200);
  }
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  await page.waitForTimeout(600);
}
async function noOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
}
async function shot(page, name) {
  await page.screenshot({ path: path.join(SHOTS, name) });
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const pw = loadPlaywright();
  if (!pw) {
    console.log("FAIL ENV 未找到可用的 playwright + chromium 组合");
    process.exit(1);
  }

  const server = spawn(process.execPath, [path.join(ROOT, "scripts", "dev-preview.js")], {
    cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: "ignore",
  });
  let browser;
  try {
    await waitForServer(PAGE_URL, 10000);
    browser = await pw.chromium.launch({ headless: true });

    /* ================= 桌面 1280×800 ================= */
    console.log("\n--- 桌面 1280×800 ---");
    const d = await newPage(browser, { viewport: { width: 1280, height: 800 } });
    await d.page.goto(PAGE_URL, { waitUntil: "load" });
    await d.page.waitForTimeout(2500);

    // I6a / R2：首屏（未滚动）
    check("R2", d.mediaReqs.size <= 4, `首屏媒体请求 ${d.mediaReqs.size} 件 ≤4`);
    const mp4Early = [...d.mediaReqs].filter((u) => u.endsWith(".mp4")).length;
    check("R2-mp4", mp4Early === 0, `首屏 mp4 请求 ${mp4Early} 个（应为 0）`);
    const videosWithSrcEarly = await d.page.evaluate(() => [...document.querySelectorAll("video")].filter((v) => v.getAttribute("src")).length);
    check("I6-load", videosWithSrcEarly === 0, `首屏未滚动时带 src 的视频 ${videosWithSrcEarly} 个（应为 0）`);
    check("R1-top", await noOverflow(d.page), "首屏无横向溢出");
    await shot(d.page, "desktop-01-hero.png");

    // R4a 导航链接数
    const navCount = await d.page.evaluate(() => document.querySelectorAll('#rail a[href^="#chap-"]').length);
    check("R4-count", navCount >= 8, `桌面导航章节链接 ${navCount} 条 ≥8`);

    // 逐章滚动 + 截图
    await scrollToSection(d.page, "chap-calm-breeze");
    await shot(d.page, "desktop-02-chapter-calm-breeze.png");
    check("R1-mid", await noOverflow(d.page), "中段无横向溢出");
    await scrollToSection(d.page, "chap-tmj");
    await shot(d.page, "desktop-04-text-only.png");
    await scrollToSection(d.page, "chap-kellys-image");
    await d.page.waitForTimeout(1500); // 等视频加载起播
    await shot(d.page, "desktop-03-chapter-kellys.png");

    // I6b：进入章节后视频获得 src
    const kellysLoaded = await d.page.evaluate(() => [...document.querySelectorAll('#chap-kellys-image video')].filter((v) => v.getAttribute("src")).length);
    check("I6-near", kellysLoaded >= 1, `进入凯利斯映像章节后已加载视频 ${kellysLoaded} 个 ≥1`);

    // I5：互斥 —— 等一个自动起播，再强制播另一个
    let mutexOk = true;
    let playedCount = 0;
    for (let t = 0; t < 3; t++) {
      await d.page.evaluate(() => {
        const vs = [...document.querySelectorAll("#chap-kellys-image video, #chap-zhao-lives video")];
        const idle = vs.find((v) => v.paused);
        if (idle) {
          if (!idle.getAttribute("src")) idle.src = idle.getAttribute("data-src");
          idle.muted = true;
          idle.play().catch(() => {});
        }
      });
      await d.page.waitForTimeout(600);
      const playing = await d.page.evaluate(() => [...document.querySelectorAll("video")].filter((v) => !v.paused).length);
      if (playing > 1) mutexOk = false;
      playedCount = Math.max(playedCount, playing);
    }
    check("I5", mutexOk, `三次采样同时播放数峰值 ${playedCount}（应 ≤1）`);

    // I6c：探测视频滚到视口中央自动起播，随后滚离 2 屏必须被暂停
    const probeSrc = await d.page.evaluate(() => {
      const v = document.querySelector("#chap-kellys-image video");
      v.dataset.probe = "1";
      v.scrollIntoView({ behavior: "instant", block: "center" });
      return v.getAttribute("data-src");
    });
    await d.page.waitForTimeout(1800);
    const probePlaying = await d.page.evaluate(() => {
      const v = document.querySelector("video[data-probe='1']");
      return v ? !v.paused : false;
    });
    await d.page.evaluate(() => window.scrollBy({ top: window.innerHeight * 2.2, behavior: "instant" }));
    await d.page.waitForTimeout(1200);
    const probePaused = await d.page.evaluate(() => {
      const v = document.querySelector("video[data-probe='1']");
      return v ? v.paused : null;
    });
    check("I6-away", probePlaying && probePaused === true, `探测视频（${probeSrc ? probeSrc.split("/").pop() : "?"}）视口内起播、滚离 2 屏已暂停`);

    // I7：全程静音
    const allMuted = await d.page.evaluate(() => [...document.querySelectorAll("video")].every((v) => v.muted));
    check("I7", allMuted, "全部视频保持 muted");

    // 继续滚完：旁听席、终章
    await scrollToSection(d.page, "chap-gallery");
    await shot(d.page, "desktop-05-gallery.png");
    await scrollToSection(d.page, "chap-epilogue");
    await d.page.waitForTimeout(1200);
    await shot(d.page, "desktop-06-epilogue.png");
    check("R1-bottom", await noOverflow(d.page), "底部无横向溢出");

    // R3：滚通全页后所有媒体兑现
    await scrollThrough(d.page);
    const pending = await d.page.evaluate(() => {
      const imgs = [...document.querySelectorAll("img")].filter((i) => i.id !== "lb-img" && !(i.currentSrc || i.src));
      const vids = [...document.querySelectorAll("video")].filter((v) => !v.getAttribute("src"));
      return { imgs: imgs.length, vids: vids.length };
    });
    check("R3", pending.imgs === 0 && pending.vids === 0, `滚通后未兑现媒体 img=${pending.imgs} video=${pending.vids}（应均 0）`);

    // R5：揭示完成后无残留隐藏块
    const hiddenLeft = await d.page.evaluate(() => document.querySelectorAll(".rv:not(.on), .rvp:not(.on), .rvf:not(.on)").length);
    check("R5", hiddenLeft === 0, `滚通后未揭示元素 ${hiddenLeft} 个（应 0）`);

    // R4b：点击导航跳转 + 当前位置指示
    for (const id of ["chap-peng", "chap-calm-breeze", "chap-gallery"]) {
      await d.page.click(`#rail a[href="#${id}"]`);
      await d.page.waitForTimeout(1400);
      const top = await d.page.evaluate((sid) => Math.abs(document.getElementById(sid).getBoundingClientRect().top), id);
      check(`R4-jump-${id}`, top < 400, `点击导航后 ${id} 距视口顶 ${Math.round(top)}px <400`);
    }
    await scrollToSection(d.page, "chap-tmj");
    const ariaCurrent = await d.page.evaluate(() => {
      const a = document.querySelector('#rail a[href="#chap-tmj"]');
      return a && a.getAttribute("aria-current") === "true";
    });
    check("R4-current", ariaCurrent, "滚动至 Tmj 章后对应导航项 aria-current=true");
    await shot(d.page, "desktop-08-nav-active.png");

    /* ————— 灯箱 I1–I4（键盘全流程） ————— */
    await scrollToSection(d.page, "chap-calm-breeze");
    await d.page.evaluate(() => {
      const b = document.querySelector("#chap-calm-breeze .zoom");
      b.id = "probe-trigger";
      b.focus();
    });
    await d.page.keyboard.press("Enter");
    await d.page.waitForTimeout(400);
    const lbOpen1 = await d.page.evaluate(() => !document.getElementById("lightbox").hidden);
    const lbInfo = await d.page.evaluate(() => {
      const img = document.getElementById("lb-img");
      const trig = document.querySelector("#probe-trigger img");
      return { src: img.getAttribute("src") || "", alt: img.alt, trigAlt: trig.alt };
    });
    check("I1-enter", lbOpen1 && lbInfo.src.includes("calm-breeze") && lbInfo.alt.length >= 8 && lbInfo.alt === lbInfo.trigAlt,
      `Enter 打开灯箱，大图 ${lbInfo.src.split("/").pop()}，alt 与触发图一致`);
    await shot(d.page, "desktop-07-lightbox.png");

    // I2：Esc 关闭 + 焦点回归
    await d.page.keyboard.press("Escape");
    await d.page.waitForTimeout(300);
    const closed = await d.page.evaluate(() => document.getElementById("lightbox").hidden);
    const focusBack = await d.page.evaluate(() => document.activeElement && document.activeElement.id === "probe-trigger");
    check("I2", closed && focusBack, "Esc 关闭且焦点回归触发元素");

    // I1b：Space 也能开
    await d.page.keyboard.press(" ");
    await d.page.waitForTimeout(300);
    check("I1-space", await d.page.evaluate(() => !document.getElementById("lightbox").hidden), "Space 重新打开灯箱");

    // I4：切换、计数、焦点圈、inert
    const srcBefore = await d.page.evaluate(() => document.getElementById("lb-img").getAttribute("src"));
    await d.page.keyboard.press("ArrowRight");
    await d.page.waitForTimeout(300);
    const after = await d.page.evaluate(() => ({
      src: document.getElementById("lb-img").getAttribute("src"),
      count: document.getElementById("lb-count").textContent,
    }));
    const inertMain = await d.page.evaluate(() => document.getElementById("main").hasAttribute("aria-hidden"));
    let focusInDialog = true;
    for (let i = 0; i < 4; i++) {
      await d.page.keyboard.press("Tab");
      const inLb = await d.page.evaluate(() => document.getElementById("lightbox").contains(document.activeElement));
      if (!inLb) focusInDialog = false;
    }
    check("I4", after.src !== srcBefore && /2\s*\/\s*\d+/.test(after.count) && focusInDialog && inertMain,
      `ArrowRight 切换（计数 ${after.count}）、Tab 焦点圈闭环、背景 inert`);

    // I3：背景滚动锁定与解锁
    const yBefore = await d.page.evaluate(() => window.scrollY);
    await d.page.mouse.wheel(0, 800);
    await d.page.waitForTimeout(400);
    const yLocked = await d.page.evaluate(() => window.scrollY);
    const overflowHidden = await d.page.evaluate(() => getComputedStyle(document.body).overflow === "hidden");
    await d.page.keyboard.press("Escape");
    await d.page.waitForTimeout(300);
    await d.page.mouse.wheel(0, 800);
    await d.page.waitForTimeout(400);
    const yAfter = await d.page.evaluate(() => window.scrollY);
    check("I3", yLocked === yBefore && overflowHidden && yAfter > yBefore, `打开时 scrollY 锁定（${yBefore}→${yLocked}），关闭后恢复滚动（→${yAfter}）`);

    // 桌面全页存档
    await scrollThrough(d.page);
    await scrollInstant(d.page, 0);
    await d.page.screenshot({ path: path.join(SHOTS, "desktop-full.png"), fullPage: true });

    // R0
    check("R0-desktop", d.errors.length === 0, d.errors.length ? `页面错误: ${d.errors.slice(0, 3).join(" | ")}` : "桌面全程零控制台/页面错误");
    await d.context.close();

    /* ================= 移动 390×844 ================= */
    console.log("\n--- 移动 390×844 ---");
    const m = await newPage(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await m.page.goto(PAGE_URL, { waitUntil: "load" });
    await m.page.waitForTimeout(2500);
    check("R2-mobile", m.mediaReqs.size <= 4, `移动首屏媒体请求 ${m.mediaReqs.size} 件 ≤4`);
    check("R1m-top", await noOverflow(m.page), "移动首屏无横向溢出");
    const bars = await m.page.evaluate(() => ({
      top: getComputedStyle(document.getElementById("topbar")).display,
      rail: getComputedStyle(document.getElementById("rail")).display,
    }));
    check("R4-mobile-nav", bars.top === "flex" && bars.rail === "none", `移动顶条显示（${bars.top}）、侧轨隐藏（${bars.rail}）`);
    await shot(m.page, "mobile-01-hero.png");
    await scrollToSection(m.page, "chap-calm-breeze");
    await shot(m.page, "mobile-02-chapter.png");
    check("R1m-mid", await noOverflow(m.page), "移动中段无横向溢出");
    await scrollToSection(m.page, "chap-tmj");
    await shot(m.page, "mobile-03-text-only.png");
    await scrollToSection(m.page, "chap-gallery");
    await shot(m.page, "mobile-04-gallery.png");
    await scrollToSection(m.page, "chap-epilogue");
    await m.page.waitForTimeout(1200);
    await shot(m.page, "mobile-05-epilogue.png");
    check("R1m-bottom", await noOverflow(m.page), "移动底部无横向溢出");

    // 移动灯箱（点按 + 关闭钮）
    await scrollToSection(m.page, "chap-calm-breeze");
    await m.page.tap("#chap-calm-breeze .zoom");
    await m.page.waitForTimeout(400);
    const mLb = await m.page.evaluate(() => !document.getElementById("lightbox").hidden);
    await shot(m.page, "mobile-06-lightbox.png");
    await m.page.tap("#lb-close");
    await m.page.waitForTimeout(300);
    const mLbClosed = await m.page.evaluate(() => document.getElementById("lightbox").hidden);
    check("I1-mobile", mLb && mLbClosed, "移动端点按打开灯箱、关闭钮关闭");

    await scrollThrough(m.page);
    await scrollInstant(m.page, 0);
    await m.page.screenshot({ path: path.join(SHOTS, "mobile-full.png"), fullPage: true });
    check("R0-mobile", m.errors.length === 0, m.errors.length ? `页面错误: ${m.errors.slice(0, 3).join(" | ")}` : "移动端全程零控制台/页面错误");
    await m.context.close();

    /* ================= reduced-motion ================= */
    console.log("\n--- reduced-motion: reduce ---");
    const r = await newPage(browser, { viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
    await r.page.goto(PAGE_URL, { waitUntil: "load" });
    await r.page.waitForTimeout(1500);
    const rmMatches = await r.page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
    check("I8-emulate", rmMatches, "仿真 prefers-reduced-motion 生效");
    await scrollThrough(r.page);
    const rmPlaying = await r.page.evaluate(() => [...document.querySelectorAll("video")].filter((v) => !v.paused).length);
    check("I8-noautoplay", rmPlaying === 0, `reduced-motion 下滚通全页，播放中视频 ${rmPlaying} 个（应 0）`);
    const rmReveal = await r.page.evaluate(() => {
      const els = [...document.querySelectorAll(".rv, .rvp, .rvf")].slice(0, 10);
      return els.every((el) => {
        const cs = getComputedStyle(el);
        return cs.opacity === "1" && (cs.transform === "none" || cs.transform === "matrix(1, 0, 0, 1, 0, 0)");
      });
    });
    check("I8-reveal", rmReveal, "reduced-motion 下揭示元素计算样式 opacity=1 且无位移");
    const rmDuration = await r.page.evaluate(() => {
      const cs = getComputedStyle(document.querySelector(".rv"));
      return cs.transitionDuration;
    });
    check("I8-duration", /^(0s|0\.01ms|0\.00001s)(,|$)/.test(rmDuration) || parseFloat(rmDuration) <= 0.01, `揭示过渡时长 ${rmDuration}（≈0）`);
    const rmContent = await r.page.evaluate(() => {
      const ids = ["chap-calm-breeze", "chap-tmj", "chap-shenzhen-xiaotan", "chap-travis", "chap-xuan-long-vacation", "chap-kellys-image", "chap-zhao-lives", "chap-peng", "chap-gallery", "chap-epilogue"];
      return ids.every((id) => (document.getElementById(id)?.innerText || "").trim().length > 60);
    });
    check("I8-content", rmContent, "reduced-motion 下 10 个章节文本完整（每章 >60 字）");
    check("R1-rm", await noOverflow(r.page), "reduced-motion 下无横向溢出");
    await scrollInstant(r.page, 0);
    await shot(r.page, "rm-desktop-01.png");
    check("R0-rm", r.errors.length === 0, r.errors.length ? `页面错误: ${r.errors.slice(0, 3).join(" | ")}` : "reduced-motion 全程零控制台/页面错误");
    await r.context.close();

    // reduced-motion 移动视口补一张
    const rm2 = await newPage(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
    await rm2.page.goto(PAGE_URL, { waitUntil: "load" });
    await rm2.page.waitForTimeout(1500);
    await scrollToSection(rm2.page, "chap-calm-breeze");
    check("R1-rm-mobile", await noOverflow(rm2.page), "reduced-motion 移动视口无横向溢出");
    await shot(rm2.page, "rm-mobile-01.png");
    await rm2.context.close();

  } finally {
    if (browser) await browser.close();
    server.kill();
  }

  console.log("");
  if (problems.length) {
    console.log(`RENDER CHECK FAILED: ${problems.length}/${checkCount} 项未通过`);
    problems.forEach((p) => console.log(`  ${p}`));
    process.exit(1);
  }
  console.log(`ALL RENDER CHECKS PASSED (${checkCount} 项)`);
})().catch((e) => {
  console.error(`RENDER CHECK ERROR: ${e.stack || e}`);
  process.exit(1);
});
