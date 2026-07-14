// 拉取深圳建筑数据包（AGENT_04 · 3D 离线兜底用）v2
// 策略：26 战略点位分片（25 机位 + 南方科技大学场地）各 ±2km；way id 去重；
//   多 Overpass 镜像轮换 + 429 冷却退避 + 断点续传（缓存在 jobs tmp，可安全复跑）。
// 数据：OpenStreetMap © contributors, ODbL 1.0。
// 用法：node scripts/fetch-shenzhen-buildings.mjs   （可反复跑直到 26/26）
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const HERE = import.meta.dirname;
const CACHE = path.join(os.homedir(), ".claude/jobs/47223776/tmp/sz-buildings-cache.json");
const OUT = path.join(HERE, "../public/assets/geo/shenzhen-buildings.json");

const spots = JSON.parse(fs.readFileSync(path.join(HERE, "../agents_output/01/spots.v1.json"), "utf-8")).spots;
const CENTERS = [
  { id: "sustech", name: "南方科技大学（大区赛场地）", lat: 22.5956, lng: 113.9956 },
  ...spots.map((s) => ({ id: s.id, name: s.name, lat: s.lat, lng: s.lng })),
];
const D = 0.018;
const ENDPOINTS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://z.overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.osm.jp/api/interpreter",
];
const cooldown = new Map(); // endpoint → 可用时刻
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 断点缓存
let cache = { doneCells: [], buildings: {} };
try { cache = JSON.parse(fs.readFileSync(CACHE, "utf-8")); } catch (e) { /* 首跑 */ }
const byId = new Map(Object.entries(cache.buildings));
const done = new Set(cache.doneCells);

function saveAll() {
  fs.writeFileSync(CACHE, JSON.stringify({ doneCells: [...done], buildings: Object.fromEntries(byId) }));
  let hOsm = 0, hLvl = 0, hDef = 0;
  const buildings = [...byId.values()].sort((a, b) => b.h - a.h);
  for (const b of buildings) { if (b.hs === "osm") hOsm++; else if (b.hs === "levels") hLvl++; else hDef++; }
  fs.writeFileSync(OUT, JSON.stringify({
    meta: {
      source: "OpenStreetMap contributors, ODbL 1.0 (openstreetmap.org/copyright)",
      strategy: "26 战略点位分片（25 机位 + 南方科技大学场地）各 ±2km，way id 去重",
      done_cells: [...done], pending_cells: CENTERS.filter((c) => !done.has(c.id)).map((c) => c.id),
      fetched: new Date().toISOString().slice(0, 10), count: buildings.length,
      heights: { osm: hOsm, levels: hLvl, default16m: hDef },
      height_note: "hs=osm(实测)/levels(层数×3.2m)/default(无数据置16m)",
    },
    buildings,
  }));
  return buildings.length;
}

async function fetchCell(c) {
  const bbox = `${(c.lat - D).toFixed(4)},${(c.lng - D).toFixed(4)},${(c.lat + D).toFixed(4)},${(c.lng + D).toFixed(4)}`;
  const q = `[out:json][timeout:90];(way["building"](${bbox}););out geom 6000;`;
  const nowOk = ENDPOINTS.filter((ep) => (cooldown.get(ep) || 0) < Date.now());
  for (const ep of nowOk) {
    try {
      // curl 子进程：自动遵循 HTTP(S)_PROXY 环境变量（Node fetch 不走代理，本机多数镜像直连不通）
      const { execFileSync } = await import("node:child_process");
      const raw = execFileSync("curl", ["-sS", "--max-time", "110", "-X", "POST", ep,
        "--data-urlencode", "data=" + q, "-w", "\n%{http_code}"], { maxBuffer: 128 * 1024 * 1024, encoding: "utf8" });
      const nl = raw.lastIndexOf("\n");
      const code = raw.slice(nl + 1).trim();
      const body = raw.slice(0, nl);
      if (code === "429" || code === "504") { cooldown.set(ep, Date.now() + 70000); continue; }
      if (code !== "200") { cooldown.set(ep, Date.now() + 30000); continue; }
      const data = JSON.parse(body);
      let added = 0;
      for (const e of data.elements || []) {
        const key = String(e.id);
        if (!e.geometry || e.geometry.length < 4 || byId.has(key)) continue;
        const tg = e.tags || {};
        let h = null, hs = "default";
        if (tg.height) { const m = parseFloat(String(tg.height)); if (m > 0) { h = m; hs = "osm"; } }
        if (h == null && tg["building:levels"]) { const l = parseFloat(tg["building:levels"]); if (l > 0) { h = l * 3.2; hs = "levels"; } }
        if (h == null) h = 16;
        h = Math.min(h, 340);
        let g = e.geometry.map((p) => [+p.lat.toFixed(6), +p.lon.toFixed(6)]);
        if (g.length > 14) { const step = Math.ceil(g.length / 14); g = g.filter((_, k) => k % step === 0); }
        byId.set(key, { p: g, h: +h.toFixed(1), hs });
        added++;
      }
      return { ok: true, added, ep: new URL(ep).host };
    } catch (err) { cooldown.set(ep, Date.now() + 30000); }
  }
  return { ok: false };
}

const pending = () => CENTERS.filter((c) => !done.has(c.id));
console.log(`断点续传：已完成 ${done.size}/26 分片，累计 ${byId.size} 栋`);
for (let round = 1; round <= 6 && pending().length; round++) {
  console.log(`\n—— 第 ${round} 轮（待拉 ${pending().length} 片）——`);
  for (const c of pending()) {
    process.stdout.write(`  ${c.id} … `);
    const r = await fetchCell(c);
    if (r.ok) { done.add(c.id); console.log(`+${r.added}（累计 ${byId.size}，via ${r.ep}）`); saveAll(); }
    else console.log("本轮各镜像均忙，下轮重试");
    await sleep(4000); // 礼貌间隔
  }
  if (pending().length) { console.log("  …冷却 30s 后进入下一轮"); await sleep(30000); }
}

const total = saveAll();
const mb = (fs.statSync(OUT).size / 1048576).toFixed(1);
console.log(`\n${done.size === 26 ? "✅ 全部完成" : `◐ 完成 ${done.size}/26（可再跑本脚本续传）`} ｜ ${total} 栋 ｜ ${mb}MB`);
