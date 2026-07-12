// AGENT_01 机位库校验 — Node 平价版（因本机 python 运行环境损坏，用它执行以取得真实校验输出）
// 逻辑与 validate_spots.py 一一对应。用法: node validate_spots.mjs [spots.v1.json]
import fs from "node:fs";

const SCENE_ENUM = new Set(["sunset", "skyline", "exhibition", "cafe"]);
const COMPOSE_ENUM = new Set(["thirds", "leading", "silhouette", "frame"]);
const REQUIRED = ["id","name","scene","lat","lng","stand_desc","bearing","best_window","focal","compose_template","filters","sample_img","sample_credit","consent_ref","walk_steps","copy_slots","tags"];
const COPY_KEYS = ["hook","tip1","tip2","tip3"];
const SZ_LAT = [22.40, 22.90], SZ_LNG = [113.70, 114.70];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const SCENE_MIN = { sunset: 14, skyline: 4, exhibition: 5, cafe: 2 };
const toMin = (t) => { const [h,m] = t.split(":").map(Number); return h*60+m; };

const path = process.argv[2] || new URL("./spots.v1.json", import.meta.url).pathname.replace(/^\//, "");
const errors = [], warnings = [];
let data;
try { data = JSON.parse(fs.readFileSync(path, "utf-8")); }
catch (e) { console.log("ERROR 无法读取/解析 JSON: " + e.message); process.exit(1); }

const spots = data.spots || [];
const seen = new Set();
const sceneCount = {};

spots.forEach((s, i) => {
  const tag = `spots[${i}] id=${s.id ?? "?"}`;
  for (const f of REQUIRED) if (!(f in s)) errors.push(`${tag} 缺字段 ${f}`);
  if (seen.has(s.id)) errors.push(`${tag} id 重复`);
  seen.add(s.id);

  if (!SCENE_ENUM.has(s.scene)) errors.push(`${tag} scene 非法: ${s.scene}`);
  else sceneCount[s.scene] = (sceneCount[s.scene] || 0) + 1;

  if (!COMPOSE_ENUM.has(s.compose_template)) errors.push(`${tag} compose_template 非法: ${s.compose_template}`);

  if (typeof s.lat !== "number" || s.lat < SZ_LAT[0] || s.lat > SZ_LAT[1]) errors.push(`${tag} lat 越界深圳市域: ${s.lat}`);
  if (typeof s.lng !== "number" || s.lng < SZ_LNG[0] || s.lng > SZ_LNG[1]) errors.push(`${tag} lng 越界深圳市域: ${s.lng}`);

  if (typeof s.bearing !== "number" || s.bearing < 0 || s.bearing >= 360) errors.push(`${tag} bearing 非 [0,360): ${s.bearing}`);

  const bw = s.best_window;
  if (!Array.isArray(bw) || bw.length !== 2) errors.push(`${tag} best_window 需为2元素数组`);
  else {
    if (!(typeof bw[0] === "string" && TIME_RE.test(bw[0]))) errors.push(`${tag} best_window[0] 时间格式错: ${bw[0]}`);
    if (!(typeof bw[1] === "string" && TIME_RE.test(bw[1]))) errors.push(`${tag} best_window[1] 时间格式错: ${bw[1]}`);
    if (bw.every((x) => typeof x === "string" && TIME_RE.test(x)) && toMin(bw[0]) >= toMin(bw[1])) errors.push(`${tag} best_window 起点须早于终点`);
  }

  if (!Array.isArray(s.filters) || s.filters.length < 1) errors.push(`${tag} filters 至少1个`);

  const ws = s.walk_steps;
  if (!Array.isArray(ws) || ws.length < 3 || ws.length > 5) errors.push(`${tag} walk_steps 需3-5条, 实际=${Array.isArray(ws) ? ws.length : "非数组"}`);

  const cs = s.copy_slots || {};
  const keys = Object.keys(cs).sort().join(",");
  if (typeof cs !== "object" || keys !== COPY_KEYS.slice().sort().join(",")) errors.push(`${tag} copy_slots 键须恰为 {hook,tip1,tip2,tip3}`);
  else {
    if ((cs.hook || "").length > 26) warnings.push(`${tag} hook 超26字(${cs.hook.length})，待AGENT_03精修`);
    for (const k of ["tip1","tip2","tip3"]) if ((cs[k] || "").length > 15) warnings.push(`${tag} ${k} 超15字(${cs[k].length})`);
  }

  const trio = [s.sample_img || "", s.sample_credit || "", s.consent_ref || ""];
  const nFilled = trio.filter((x) => x).length;
  if (nFilled !== 0 && nFilled !== 3) errors.push(`${tag} 样张三件套须同空或同非空(现填${nFilled}/3)`);

  if (s.scene === "sunset" && typeof s.bearing === "number" && !(s.bearing >= 240 && s.bearing <= 300))
    warnings.push(`${tag} sunset 机位 bearing=${s.bearing} 不在240-300, 需在readme说明例外`);
});

if (spots.length !== 25) errors.push(`记录数=${spots.length}, 期望25`);
for (const [sc, mn] of Object.entries(SCENE_MIN)) if ((sceneCount[sc] || 0) < mn) errors.push(`场景 ${sc} 配比不足: ${sceneCount[sc] || 0} < ${mn}`);

console.log("=== validate_spots 结果 (Node 平价版) ===");
console.log("记录数: " + spots.length);
console.log("场景计数: " + JSON.stringify(sceneCount));
console.log("Errors: " + errors.length);
errors.forEach((e) => console.log("  [ERROR] " + e));
console.log("Warnings: " + warnings.length);
warnings.forEach((w) => console.log("  [WARN] " + w));
console.log("=== " + (errors.length ? "FAIL" : "PASS (0 error)") + " ===");
process.exit(errors.length ? 1 : 0);
