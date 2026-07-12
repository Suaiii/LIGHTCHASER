// AGENT_02 · 太阳事件预计算生成器
// 读 agents_output/01/spots.v1.json → 产出 sun_events.v1.json
// 纯几何、离线、零外部依赖（除 suncalc 本地库）。深圳固定 UTC+8，无 DST。
// 用法: node gen_sun_events.mjs
import fs from "node:fs";
import path from "node:path";

// 复用仓库已装的 suncalc（初赛同款算法，纯数学可离线）
// 相对路径：本脚本在 agents_output/02/，suncalc 在仓库根 node_modules/
const HERE = import.meta.dirname;
const require = (await import("node:module")).createRequire(import.meta.url);
const SunCalc = require(path.resolve(HERE, "../../node_modules/suncalc"));

const TZ_OFFSET_MIN = 8 * 60; // 深圳 UTC+8
const DEG = 180 / Math.PI;

// 方位角转罗盘度（0=N,90=E,180=S,270=W），与初赛 sunset-service 约定一致
const compassAz = (azRad) => ((azRad * DEG + 180 + 360) % 360);

// 给定"深圳本地某年月日时分" → 对应 UTC Date（本地 - 8h）
function localToUtc(y, mo, d, hh, mm) {
  return new Date(Date.UTC(y, mo - 1, d, hh - 8, mm, 0, 0));
}
// UTC Date → 深圳本地 "HH:MM"
function utcToLocalHHMM(dt) {
  if (!(dt instanceof Date) || isNaN(dt)) return null;
  const local = new Date(dt.getTime() + TZ_OFFSET_MIN * 60 * 1000);
  const hh = String(local.getUTCHours()).padStart(2, "0");
  const mm = String(local.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function daterange(startISO, endISO) {
  const out = [];
  let d = new Date(startISO + "T00:00:00Z");
  const end = new Date(endISO + "T00:00:00Z");
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d = new Date(d.getTime() + 24 * 3600 * 1000);
  }
  return out;
}

const spotsPath = path.resolve(HERE, "../01/spots.v1.json");
const spots = JSON.parse(fs.readFileSync(spotsPath, "utf-8")).spots;
const dates = daterange("2026-07-24", "2026-08-10"); // 18 天

const records = [];
for (const s of spots) {
  for (const date of dates) {
    const [y, mo, d] = date.split("-").map(Number);
    // 太阳事件：用当日正午的 UTC 作为 getTimes 的基准日
    const noonUtc = localToUtc(y, mo, d, 12, 0);
    const t = SunCalc.getTimes(noonUtc, s.lat, s.lng);

    // 逐 10 分钟方位/高度：本地 16:00 → 20:30
    const azimuth_10min = [];
    for (let mins = 16 * 60; mins <= 20 * 60 + 30; mins += 10) {
      const hh = Math.floor(mins / 60);
      const mm = mins % 60;
      const when = localToUtc(y, mo, d, hh, mm);
      const p = SunCalc.getPosition(when, s.lat, s.lng);
      azimuth_10min.push({
        t: `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`,
        az: Number(compassAz(p.azimuth).toFixed(1)),
        alt: Number((p.altitude * DEG).toFixed(1)),
      });
    }

    records.push({
      spot_id: s.id,
      date,
      sunset: utcToLocalHHMM(t.sunset),
      golden_start: utcToLocalHHMM(t.goldenHour),   // 傍晚黄金时刻开始（日高 ~6°）
      golden_end: utcToLocalHHMM(t.sunsetStart),    // 日面触地
      blue_start: utcToLocalHHMM(t.sunset),         // 日面消失
      blue_end: utcToLocalHHMM(t.dusk),             // 民用暮光结束（日高 -6°）
      azimuth_10min,
    });
  }
}

const payload = {
  meta: {
    schema_version: "1.0",
    agent: "AGENT_02",
    source: "suncalc (offline geometry)",
    tz: "Asia/Shanghai (UTC+8, no DST)",
    date_range: ["2026-07-24", "2026-08-10"],
    days: dates.length,
    spot_count: spots.length,
    record_count: records.length,
    az_convention: "compass degrees 0=N,90=E,180=S,270=W",
    az_sampling: "本地 16:00–20:30 每 10 分钟（28 点/日）",
    fields: "sunset/golden_start/golden_end/blue_start/blue_end = 本地HH:MM; azimuth_10min[].az/alt = 度",
  },
  sun_events: records,
};

const outPath = path.resolve(HERE, "sun_events.v1.json");
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf-8");

// 自检输出
const spotIds = new Set(spots.map((x) => x.id));
const evIds = new Set(records.map((r) => r.spot_id));
const idMatch = spotIds.size === evIds.size && [...spotIds].every((x) => evIds.has(x));
console.log("== gen_sun_events 完成 ==");
console.log("机位数:", spots.length, "| 天数:", dates.length, "| 记录数:", records.length, "(期望", spots.length * dates.length, ")");
console.log("spot_id 集合与 01 一致(K5):", idMatch);
const sample = records.find((r) => r.spot_id === "szw-001" && r.date === "2026-07-31");
console.log("样例 szw-001 @2026-07-31:", JSON.stringify({ sunset: sample.sunset, golden_start: sample.golden_start, golden_end: sample.golden_end, blue_start: sample.blue_start, blue_end: sample.blue_end }));
console.log("  日落方位角(该点最接近日落的采样):", sample.azimuth_10min.filter(a => a.alt >= 0).slice(-1)[0]);
console.log("输出:", outPath);
