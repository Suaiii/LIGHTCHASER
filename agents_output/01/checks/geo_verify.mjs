// AGENT_01 · C3/K2 坐标外部核验：OSM Nominatim 反向地理编码，核对每个机位落在预期深圳区县
// 用法: node geo_verify.mjs  （限速 1.1s/请求，约 30s）
import fs from "node:fs";
import path from "node:path";

const spots = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "../spots.v1.json"), "utf-8")).spots;

// 预期区县（来自 spots_readme 的地理常识，用于比对反查结果）
const EXPECT = {
  "szw-001": "南山区", "szw-002": "南山区", "szw-003": "南山区", "szw-004": "南山区",
  "szw-005": "南山区", "szw-006": "南山区", "szw-007": "南山区", "szw-008": "宝安区",
  "szw-009": "宝安区", "szw-010": "福田区", "szw-011": "南山区", "szw-012": "南山区",
  "szw-013": "南山区", "szw-014": "南山区",
  "szs-001": "福田区", "szs-002": "福田区", "szs-003": "福田区", "szs-004": "南山区",
  "sze-001": "南山区", "sze-002": "福田区", "sze-003": "南山区", "sze-004": "南山区",
  "sze-005": "龙华区", "szc-001": "南山区", "szc-002": "福田区",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let cityOk = 0, distOk = 0, flags = [];

console.log("id        期望区   反查区    街道         判定");
for (const s of spots) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${s.lat}&lon=${s.lng}&accept-language=zh&zoom=14`;
  let addr = {}, err = null;
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(url, { headers: { "User-Agent": "zhuiguang-hackathon-spotcheck/1.0" }, signal: ctrl.signal });
    clearTimeout(to);
    if (res.ok) addr = (await res.json()).address || {};
    else err = "HTTP" + res.status;
  } catch (e) { err = e.name; }

  // 深圳 OSM 地址层级：区常在 city 字段、街道在 city_district/suburb；广东省地址未必含"深圳"字样
  const blob = JSON.stringify(addr);
  const dist = addr.city || addr.city_district || addr.district || addr.county || addr.suburb || addr.state || "";
  const street = addr.city_district || addr.suburb || addr.quarter || "";
  const expect = EXPECT[s.id];
  const inHK = /香港|Hong Kong|元朗|新界/.test(blob);
  const distMatch = !inHK && blob.includes(expect);           // 期望区名（如"南山区"）出现在地址中
  const isSZ = !inHK && (/深圳|Shenzhen/.test(blob) || distMatch);
  if (isSZ) cityOk++;
  if (distMatch) distOk++;
  const verdict = err ? `⚠${err}` : inHK ? "✗香港!" : distMatch ? "✅" : isSZ ? "◐市对区待核" : "✗非深圳?";
  if (!err && !distMatch) flags.push(`${s.id} 期望${expect} 反查[区:${dist} 街道:${street}]${inHK ? " ←落香港!" : ""}`);
  console.log(`${s.id.padEnd(9)} ${expect}  ${String(dist||"—").padEnd(8)} ${String(street||"—").padEnd(12)} ${verdict}`);
  await sleep(1100); // Nominatim 限速
}
console.log(`\n汇总：落深圳市 ${cityOk}/25 · 区县匹配 ${distOk}/25`);
if (flags.length) { console.log("需人工复核:"); flags.forEach((f) => console.log("  - " + f)); }
else console.log("全部机位落在预期深圳区县（市+区双匹配）。");
