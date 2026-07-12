// AGENT_02 · C6 回测：用真实深圳天气跑评分引擎（客观半），人工主观排序另附
// 数据源 Open-Meteo（公开、无 key）。用法: node backtest_c6.mjs
import path from "node:path";
const require = (await import("node:module")).createRequire(import.meta.url);
const { score } = require(path.resolve(import.meta.dirname, "../light_engine.js"));

const LAT = 22.4703, LNG = 113.9440; // 深圳湾·日出剧场
const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LNG}`
  + `&hourly=cloud_cover_low,cloud_cover_mid,cloud_cover_high,relative_humidity_2m,visibility,weather_code`
  + `&daily=sunset&past_days=7&forecast_days=1&timezone=Asia%2FShanghai`;

const avg = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const mode = (a) => { const m = {}; let best = a[0], bc = 0; for (const x of a) { m[x] = (m[x] || 0) + 1; if (m[x] > bc) { bc = m[x]; best = x; } } return best; };

const res = await fetch(url);
if (!res.ok) { console.error("fetch failed", res.status); process.exit(1); }
const d = await res.json();
const H = d.hourly, times = H.time;
const idxByTime = new Map(times.map((t, i) => [t, i]));

console.log("== C6 回测 · 深圳湾 · 真实 Open-Meteo 数据 ==");
console.log("date       sunset  低/中/高云   湿  能见  code  → 分数 · 等级");
const rows = [];
for (const sunsetIso of d.daily.sunset) {
  const date = sunsetIso.slice(0, 10);
  const sunsetMin = (() => { const [, hm] = sunsetIso.split("T"); const [h, m] = hm.split(":").map(Number); return h * 60 + m; })();
  // 取日落 ±90min 的逐小时样本
  const samp = [];
  for (const [t, i] of idxByTime) {
    if (!t.startsWith(date)) continue;
    const [, hm] = t.split("T"); const [h, m] = hm.split(":").map(Number);
    if (Math.abs(h * 60 + m - sunsetMin) <= 90) {
      samp.push({ cl: H.cloud_cover_low[i], cm: H.cloud_cover_mid[i], ch: H.cloud_cover_high[i], hu: H.relative_humidity_2m[i], vis: H.visibility[i], code: H.weather_code[i] });
    }
  }
  if (!samp.length) continue;
  const w = {
    cloud_low: Math.round(avg(samp.map(s => s.cl))),
    cloud_mid: Math.round(avg(samp.map(s => s.cm))),
    cloud_high: Math.round(avg(samp.map(s => s.ch))),
    humidity: Math.round(avg(samp.map(s => s.hu))),
    visibility_km: +(avg(samp.map(s => s.vis)) / 1000).toFixed(1),
    weather_code: mode(samp.map(s => s.code)),
  };
  const r = score(w, { minutes_to_sunset: 0 });
  rows.push({ date, sunset: sunsetIso.slice(11), ...w, score: r.score, label: r.label });
  console.log(`${date}  ${sunsetIso.slice(11)}   ${String(w.cloud_low).padStart(2)}/${String(w.cloud_mid).padStart(2)}/${String(w.cloud_high).padStart(2)}    ${String(w.humidity).padStart(2)}  ${String(w.visibility_km).padStart(4)}   ${String(w.weather_code).padStart(2)}   →  ${String(r.score).padStart(3)} · ${r.label}`);
}
console.log("\n客观分数排序(高→低):");
console.log("  " + [...rows].sort((a, b) => b.score - a.score).map(r => `${r.date}(${r.score})`).join("  "));
console.log("\n【待人工】两人各自对这几晚实际天空质量独立打分(1-5)，与上面排序比对；一致=C6通过。");
