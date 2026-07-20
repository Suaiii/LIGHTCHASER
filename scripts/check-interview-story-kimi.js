#!/usr/bin/env node
/**
 * check-interview-story-kimi.js
 *
 * 「追·光对谈」Kimi 独立页（public/interview-story-kimi.html）静态验收脚本。
 * 零依赖（Node 原生 fs/path + 正则），用法：
 *
 *   node scripts/check-interview-story-kimi.js
 *
 * 检查项：
 *  S1  交付物存在与来源隔离（不引用旧页/相机前端/后端/外链资源）
 *  S2  基本 HTML 合法性（doctype/lang/charset/viewport/title、id 唯一、标签配平）
 *  S3  页面引用的媒体路径全部存在于磁盘（大小写敏感）
 *  S4  credits.json 双向对账（media_count === 磁盘数；页面引用均已授权登记）
 *  S5  每位有素材访谈者展示 3–5 件（按章节块内去重媒体数）
 *  S6  纯文字访谈者（深圳豪宅小谭、Tmj）章节内零影像
 *  S7  跨作者误用防线（章节块内媒体必须属于该作者文件夹；旁听席同理）
 *  S8  8 位访谈者章节齐全且导航锚链接可达
 *  S9  旁听席 5 作者齐全；13 位作者署名精确字符串均出现
 *  S10 所有 <img> 有非空、非文件名式 alt
 *  S11 所有 <video> muted + playsinline + preload="none"、无 autoplay、有辅助文本
 *  S12 首屏直载媒体 ≤ 3 件，其余懒加载；存在 IntersectionObserver
 *  S13 reduced-motion 静态证据（CSS 媒体查询 + JS matchMedia）
 *  S14 结尾保留句与核心语义锚点；结尾非 PRD 口吻
 *  S15 无 http(s) 外链引用
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const PAGE = path.join(PUBLIC_DIR, "interview-story-kimi.html");
const CREDITS = path.join(PUBLIC_DIR, "assets", "interviews", "credits.json");
const MEDIA_DIR = path.join(PUBLIC_DIR, "assets", "interviews");

const problems = [];
const notes = [];

function pass(id, msg) {
  console.log(`PASS ${id} ${msg}`);
}
function fail(id, msg) {
  problems.push(`${id} ${msg}`);
  console.log(`FAIL ${id} ${msg}`);
}
function note(msg) {
  notes.push(msg);
  console.log(`NOTE ${msg}`);
}
function check(id, ok, okMsg, failMsg) {
  if (ok) pass(id, okMsg);
  else fail(id, failMsg || okMsg);
}

/* ————— 读取输入 ————— */
if (!fs.existsSync(PAGE)) {
  fail("S1", `页面不存在: ${path.relative(ROOT, PAGE)}`);
  summarize();
}
const html = fs.readFileSync(PAGE, "utf8");
const credits = JSON.parse(fs.readFileSync(CREDITS, "utf8"));

const diskMedia = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "credits.json" || entry.name === ".DS_Store") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else diskMedia.push(path.relative(MEDIA_DIR, full).split(path.sep).join("/"));
  }
})(MEDIA_DIR);

/* ————— S1 来源隔离 ————— */
const blacklist = [
  { re: /interview-story\.html/i, label: "interview-story.html（旧页）" },
  { re: /ai-camera/i, label: "ai-camera（相机前端）" },
  { re: /legacy-v1/i, label: "legacy-v1" },
  { re: /workers\//i, label: "workers/" },
  { re: /\/api\//i, label: "/api/（后端）" },
  { re: /<script[^>]*\ssrc\s*=/i, label: "<script src=（外链脚本）" },
  { re: /<link[^>]*\.css/i, label: "外链 CSS" },
];
{
  const hits = blacklist.filter((b) => b.re.test(html)).map((b) => b.label);
  check("S1", hits.length === 0, "来源隔离通过（未引用旧页/相机/后端/外链）", `发现禁止引用: ${hits.join(", ")}`);
}

/* ————— S2 基本 HTML 合法性 ————— */
{
  const issues = [];
  if (!/^<!doctype html>/i.test(html.trim())) issues.push("doctype 缺失或不在开头");
  if (!/<html[^>]*lang="zh/i.test(html)) issues.push('缺少 <html lang="zh…">');
  if (!/<meta[^>]*charset/i.test(html)) issues.push("缺少 charset meta");
  if (!/<meta[^>]*name="viewport"/i.test(html)) issues.push("缺少 viewport meta");
  if (!/<title>[^<]{1,}<\/title>/i.test(html)) issues.push("title 缺失或为空");
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const dup = ids.filter((v, i) => ids.indexOf(v) !== i);
  if (dup.length) issues.push(`重复 id: ${[...new Set(dup)].join(", ")}`);
  for (const tag of ["section", "article", "figure", "div", "video", "nav", "main", "button", "span", "p"]) {
    const open = (html.match(new RegExp(`<${tag}(\\s|>)`, "g")) || []).length;
    const close = (html.match(new RegExp(`</${tag}>`, "g")) || []).length;
    if (open !== close) issues.push(`<${tag}> 标签不配平: 开 ${open} / 闭 ${close}`);
  }
  check("S2", issues.length === 0, "基本 HTML 合法性通过", issues.join("；"));
}

/* ————— 引用媒体抽取 ————— */
function extractMediaRefs(text) {
  const refs = new Set();
  for (const m of text.matchAll(/(?:src|data-src|poster|href)="(assets\/interviews\/[^"]+)"/g)) refs.add(m[1]);
  for (const m of text.matchAll(/url\(\s*['"]?(assets\/interviews\/[^)'"]+)['"]?\s*\)/g)) refs.add(m[1]);
  return [...refs];
}
const pageRefs = extractMediaRefs(html);

/* ————— S3 引用媒体全部存在（大小写敏感） ————— */
{
  const missing = [];
  for (const rel of pageRefs) {
    const abs = path.join(PUBLIC_DIR, rel);
    if (!fs.existsSync(abs)) {
      missing.push(rel);
      continue;
    }
    // 大小写敏感比对真实文件名
    const dir = path.dirname(abs);
    const base = path.basename(abs);
    if (!fs.readdirSync(dir).includes(base)) missing.push(`${rel}（大小写不匹配）`);
  }
  check("S3", missing.length === 0, `全部 ${pageRefs.length} 个引用媒体存在于磁盘`, `缺失: ${missing.join(", ")}`);
}

/* ————— S4 credits 双向对账 ————— */
{
  const issues = [];
  if (credits.media_count !== diskMedia.length) {
    issues.push(`media_count=${credits.media_count} 与磁盘 ${diskMedia.length} 不一致`);
  }
  const creditFiles = new Set(credits.media.map((m) => m.file));
  const unregistered = diskMedia.filter((f) => !creditFiles.has(f));
  if (unregistered.length) issues.push(`磁盘文件未登记进 credits: ${unregistered.join(", ")}`);
  const pageRel = pageRefs.map((r) => r.replace(/^assets\/interviews\//, ""));
  const unauthorized = pageRel.filter((f) => !creditFiles.has(f));
  if (unauthorized.length) issues.push(`页面引用了未授权文件: ${unauthorized.join(", ")}`);
  const badConsent = credits.media.filter((m) => m.consent_status !== "authorized");
  if (badConsent.length) issues.push(`存在非 authorized 素材: ${badConsent.map((m) => m.file).join(", ")}`);
  check("S4", issues.length === 0, `credits 对账通过（${diskMedia.length} 件磁盘素材 = media_count，页面引用均已授权）`, issues.join("；"));
}

/* ————— 章节块切分 ————— */
const authorBlocks = {};
for (const m of html.matchAll(/<section\b[^>]*\bdata-author="([^"]+)"[^>]*>([\s\S]*?)<\/section>/g)) {
  authorBlocks[m[1]] = m[2];
}
const gallerySection = (html.match(/<section\b[^>]*\bdata-gallery\b[^>]*>([\s\S]*?)<\/section>/) || [])[1] || "";

const MEDIA_AUTHORS = ["calm-breeze", "peng", "kellys-image", "zhao-lives", "xuan-long-vacation", "travis"];
const TEXT_ONLY = ["tmj", "shenzhen-xiaotan"];

/* ————— S5 有素材访谈者 3–5 件 ————— */
{
  const issues = [];
  for (const a of MEDIA_AUTHORS) {
    if (!authorBlocks[a]) {
      issues.push(`缺少章节 data-author="${a}"`);
      continue;
    }
    const n = new Set(extractMediaRefs(authorBlocks[a])).size;
    if (n < 3 || n > 5) issues.push(`${a} 展示 ${n} 件（要求 3–5）`);
  }
  check("S5", issues.length === 0, "6 位有素材访谈者展示数量均在 3–5 件", issues.join("；"));
}

/* ————— S6 纯文字章节零影像 ————— */
{
  const issues = [];
  for (const a of TEXT_ONLY) {
    const block = authorBlocks[a];
    if (!block) {
      issues.push(`缺少章节 data-author="${a}"`);
      continue;
    }
    if (/<(img|video|picture|source)\b/i.test(block) || /assets\/interviews/.test(block)) {
      issues.push(`${a} 章节内出现影像或素材引用`);
    }
  }
  check("S6", issues.length === 0, "纯文字访谈者章节零影像（未复用他人影像）", issues.join("；"));
}

/* ————— S7 跨作者误用防线 ————— */
{
  const issues = [];
  for (const [a, block] of Object.entries(authorBlocks)) {
    for (const ref of extractMediaRefs(block)) {
      const rel = ref.replace(/^assets\/interviews\//, "");
      if (!rel.startsWith(`${a}/`)) issues.push(`章节 ${a} 引用了他人素材 ${rel}`);
    }
  }
  for (const m of gallerySection.matchAll(/<figure\b[^>]*\bdata-gallery-author="([^"]+)"[^>]*>([\s\S]*?)<\/figure>/g)) {
    for (const ref of extractMediaRefs(m[2])) {
      const rel = ref.replace(/^assets\/interviews\//, "");
      if (!rel.startsWith(`${m[1]}/`)) issues.push(`旁听席 ${m[1]} 的格子引用了他人素材 ${rel}`);
    }
  }
  check("S7", issues.length === 0, "无跨作者素材误用", issues.join("；"));
}

/* ————— S8 8 位访谈者齐全且可导航 ————— */
{
  const expected = [...MEDIA_AUTHORS, ...TEXT_ONLY].sort();
  const actual = Object.keys(authorBlocks).sort();
  const issues = [];
  if (actual.join(",") !== expected.join(",")) {
    issues.push(`章节集合不符: 期望 ${expected.join(",")}，实际 ${actual.join(",")}`);
  }
  for (const a of expected) {
    if (!new RegExp(`href="#chap-${a}"`).test(html)) issues.push(`导航缺少锚链接 #chap-${a}`);
  }
  check("S8", issues.length === 0, "8 位访谈者章节齐全且导航可达", issues.join("；"));
}

/* ————— S9 旁听席与署名 ————— */
{
  const issues = [];
  const galleryAuthors = [...new Set([...gallerySection.matchAll(/data-gallery-author="([^"]+)"/g)].map((m) => m[1]))].sort();
  const expectedGallery = credits.authors.filter((a) => a.role === "gallery").map((a) => a.author_id).sort();
  if (galleryAuthors.join(",") !== expectedGallery.join(",")) {
    issues.push(`旁听席作者集合不符: 期望 ${expectedGallery.join(",")}，实际 ${galleryAuthors.join(",")}`);
  }
  for (const a of credits.authors) {
    if (!html.includes(a.author_name)) issues.push(`页面缺少署名「${a.author_name}」`);
  }
  check("S9", issues.length === 0, "5 位旁听席作者齐全；13 位作者署名均精确出现", issues.join("；"));
}

/* ————— S10 img alt ————— */
{
  const issues = [];
  const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
  let checked = 0;
  for (const tag of imgs) {
    if (/\sid="lb-img"/.test(tag)) {
      note("S10 灯箱 img#lb-img 初始无 src，alt 由 JS 在打开时从触发图同步（渲染验收 I1 断言其非空且与触发图一致）");
      continue;
    }
    checked++;
    const alt = (tag.match(/\salt="([^"]*)"/) || [])[1];
    if (alt === undefined || alt.trim() === "") {
      issues.push(`存在无 alt 的 img: ${tag.slice(0, 80)}…`);
    } else if (/\.(jpe?g|webp|png|gif|mp4)$/i.test(alt.trim())) {
      issues.push(`alt 是文件名: ${alt}`);
    } else if (alt.trim().length < 8) {
      note(`S10 alt 偏短（<8 字符）: 「${alt}」`);
    }
  }
  check("S10", issues.length === 0, `全部 ${checked} 个内容 img 均有准确 alt`, issues.join("；"));
}

/* ————— S11 video 属性与辅助文本 ————— */
{
  const issues = [];
  const videos = [...html.matchAll(/<video\b[^>]*>/g)].map((m) => m[0]);
  for (const tag of videos) {
    if (!/\bmuted\b/i.test(tag)) issues.push(`video 缺 muted: ${tag.slice(0, 60)}…`);
    if (!/\bplaysinline\b/i.test(tag)) issues.push(`video 缺 playsinline: ${tag.slice(0, 60)}…`);
    if (!/\bpreload="none"/i.test(tag)) issues.push(`video 缺 preload="none": ${tag.slice(0, 60)}…`);
    if (/\bautoplay\b/i.test(tag)) issues.push(`video 含 autoplay: ${tag.slice(0, 60)}…`);
    const aria = (tag.match(/\baria-label="([^"]*)"/) || [])[1];
    if (!aria || aria.trim().length < 8) issues.push(`video 辅助文本缺失或过短: ${tag.slice(0, 60)}…`);
  }
  if (/<[a-z]+[^>]*\sautoplay[\s=>]/i.test(html)) issues.push("页面某处仍存在 autoplay 属性");
  check("S11", issues.length === 0, `全部 ${videos.length} 个 video 属性合规（静音/内联/不预载/无自动播放属性）`, issues.join("；"));
}

/* ————— S12 首屏懒加载 ————— */
{
  const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
  // 直载 = 带 src 且未标 loading="lazy"；data-src 走 JS 近视口载入，不算直载
  const eager = imgs.filter((t) => /\ssrc="/i.test(t) && !/\bloading="lazy"/i.test(t));
  const lazy = imgs.filter((t) => /\sdata-src="/i.test(t) || /\bloading="lazy"/i.test(t));
  const videosWithSrc = [...html.matchAll(/<video\b[^>]*\ssrc="/g)];
  const issues = [];
  if (eager.length > 3) issues.push(`首屏直载 img 达 ${eager.length} 件（要求 ≤3）`);
  if (eager.length + lazy.length !== imgs.length - 1) issues.push("存在既非直载也非延迟加载的 img（#lb-img 除外）");
  if (videosWithSrc.length) issues.push(`存在直接带 src 的 video ${videosWithSrc.length} 个（应走 data-src 近视口加载）`);
  if (!/IntersectionObserver/.test(html)) issues.push("缺少 IntersectionObserver（懒加载/视频调度前提）");
  check("S12", issues.length === 0, `首屏直载媒体 ${eager.length} 件 ≤3，其余 ${lazy.length} 图与全部视频延迟加载`, issues.join("；"));
}

/* ————— S13 reduced-motion 静态证据 ————— */
{
  const ok = /@media\s*\(prefers-reduced-motion/.test(html) && /matchMedia\(/.test(html);
  check("S13", ok, "reduced-motion 静态证据齐备（CSS 媒体查询 + JS matchMedia）", "缺少 prefers-reduced-motion 媒体查询或 matchMedia 调用");
}

/* ————— S14 结尾要求 ————— */
{
  const issues = [];
  if (!html.includes("访谈到这里结束，追光才刚刚开始。")) issues.push("缺少保留句「访谈到这里结束，追光才刚刚开始。」");
  if (!html.includes("值不值得")) issues.push("缺少「值不值得」语义锚点");
  if (!html.includes("现在出发，还来得及")) issues.push("缺少「现在出发，还来得及」语义锚点");
  const epi = (html.match(/<section\b[^>]*id="chap-epilogue"[^>]*>([\s\S]*?)<\/section>/) || [])[1] || "";
  if (/PRD|功能清单|需求文档/.test(epi)) issues.push("结尾出现 PRD 式措辞");
  check("S14", issues.length === 0, "结尾保留句与核心语义锚点齐备，非 PRD 口吻", issues.join("；"));
}

/* ————— S15 无外链 ————— */
{
  const ext = [...html.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
  const cssExt = [...html.matchAll(/url\(\s*['"]?(https?:\/\/[^)'"]+)/g)].map((m) => m[1]);
  const all = [...ext, ...cssExt];
  check("S15", all.length === 0, "无任何 http(s) 外链引用", `外链: ${all.join(", ")}`);
}

summarize();

function summarize() {
  console.log("");
  if (problems.length) {
    console.log(`STATIC CHECK FAILED: ${problems.length} 项未通过`);
    process.exit(1);
  } else {
    console.log("ALL CHECKS PASSED");
  }
}
