// verify-sun.mjs — 太阳几何交叉核验：suncalc ↔ NOAA 算法独立实现
// 用法：node scripts/verify-sun.mjs
// 为什么要有这个：负责人质疑"太阳位置是不是算错了"。与其嘴上说没错，不如用第二套
//   独立算法对拍——两套算法各自实现、互不引用，一致才说明几何没问题。
// 判定：**天球角距** < 0.3°（大气折射等细节差异在此量级内属正常）。
//   为什么不用方位角原始差值判：太阳接近天顶时方位角是病态量——高度角 81.9° 时
//   两套算法高度角只差 0.001°，方位角却差 0.92°，因为天顶附近方位角对微小位移
//   极度敏感。角距（两个方向矢量的夹角）才是物理上有意义的一致性度量。
// 归属：AGENT_02 光线引擎 · 核验件

import SunCalc from "../node_modules/suncalc/suncalc.js";

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

// ── NOAA Solar Position Algorithm（公开算法，独立实现，不引用 suncalc）──
// 参考：NOAA Global Monitoring Laboratory 太阳位置计算公式集
function noaaSunPosition(date, lat, lng) {
  // 儒略日
  const jd = date.getTime() / 86400000 + 2440587.5;
  const t = (jd - 2451545) / 36525; // 儒略世纪

  // 几何平黄经与平近点角（度）
  const L0 = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
  const M = 357.52911 + t * (35999.05029 - 0.0001537 * t);

  // 中心差 → 真黄经
  const C =
    Math.sin(M * RAD) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(2 * M * RAD) * (0.019993 - 0.000101 * t) +
    Math.sin(3 * M * RAD) * 0.000289;
  const trueLong = L0 + C;

  // 视黄经（含章动修正）
  const omega = 125.04 - 1934.136 * t;
  const appLong = trueLong - 0.00569 - 0.00478 * Math.sin(omega * RAD);

  // 黄赤交角
  const seconds = 21.448 - t * (46.815 + t * (0.00059 - t * 0.001813));
  const e0 = 23 + (26 + seconds / 60) / 60;
  const eps = e0 + 0.00256 * Math.cos(omega * RAD);

  // 赤经赤纬
  const decl = Math.asin(Math.sin(eps * RAD) * Math.sin(appLong * RAD)) * DEG;
  const ra =
    Math.atan2(
      Math.cos(eps * RAD) * Math.sin(appLong * RAD),
      Math.cos(appLong * RAD)
    ) * DEG;

  // 格林尼治恒星时 → 地方时角
  const gmst = (280.46061837 + 360.98564736629 * (jd - 2451545)) % 360;
  let ha = gmst + lng - ra;
  ha = ((ha + 180) % 360 + 360) % 360 - 180; // 归一到 -180..180

  // 地平坐标
  const latR = lat * RAD, declR = decl * RAD, haR = ha * RAD;
  const altitude =
    Math.asin(
      Math.sin(latR) * Math.sin(declR) + Math.cos(latR) * Math.cos(declR) * Math.cos(haR)
    ) * DEG;
  // 方位角：自北顺时针
  const azimuth =
    (Math.atan2(
      -Math.sin(haR),
      Math.tan(declR) * Math.cos(latR) - Math.sin(latR) * Math.cos(haR)
    ) * DEG + 360) % 360;

  return { azimuthDeg: azimuth, altitudeDeg: altitude };
}

// ── 被验对象：项目里实际用的换算（与 lib/sunset-service.js:30-34 完全一致）──
function projectSunPosition(date, lat, lng) {
  const p = SunCalc.getPosition(date, lat, lng);
  return {
    azimuthDeg: ((p.azimuth * DEG + 180) % 360 + 360) % 360, // SunCalc 自南起向西为正 → 罗盘方位
    altitudeDeg: p.altitude * DEG,
  };
}

const CITIES = [
  { name: "深圳·南科大", lat: 22.5956, lng: 113.9956 },
  { name: "上海·人民广场", lat: 31.2304, lng: 121.4737 },
  { name: "漠河（高纬极端）", lat: 52.9720, lng: 122.5320 },
];
const CLOCKS = ["06:00", "12:00", "18:40", "22:00"];
const TZ_OFFSET_HOURS = 8; // 三地均用 UTC+8（中国单一时区），构造 UTC 时刻避免本机时区干扰

const THRESHOLD = 0.3; // 角距阈值（度）
const rows = [];
let worstSep = 0;

// 天球角距：两个地平坐标方向矢量的夹角
function angularSeparation(a, b) {
  const a1 = a.altitudeDeg * RAD, a2 = b.altitudeDeg * RAD;
  const dAz = (a.azimuthDeg - b.azimuthDeg) * RAD;
  const cos = Math.sin(a1) * Math.sin(a2) + Math.cos(a1) * Math.cos(a2) * Math.cos(dAz);
  return Math.acos(Math.min(1, Math.max(-1, cos))) * DEG;
}

// 日期取当天，保证结果可随时复算（记录在报告里）
const today = new Date();
const y = today.getUTCFullYear(), m = today.getUTCMonth(), d = today.getUTCDate();

for (const city of CITIES) {
  for (const clock of CLOCKS) {
    const [hh, mm] = clock.split(":").map(Number);
    const date = new Date(Date.UTC(y, m, d, hh - TZ_OFFSET_HOURS, mm, 0));
    const a = projectSunPosition(date, city.lat, city.lng);
    const b = noaaSunPosition(date, city.lat, city.lng);
    const sep = angularSeparation(a, b);
    worstSep = Math.max(worstSep, sep);
    rows.push({
      city: city.name,
      clock,
      az: a.azimuthDeg,
      alt: a.altitudeDeg,
      nAz: b.azimuthDeg,
      nAlt: b.altitudeDeg,
      sep,
      ok: sep < THRESHOLD,
    });
  }
}

const f = (v, n = 2) => v.toFixed(n).padStart(7);
console.log(`太阳几何交叉核验 · 日期 ${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}（UTC+8 时刻）`);
console.log("");
console.log("| 城市 | 时刻 | 项目方位角 | NOAA方位角 | 项目高度角 | NOAA高度角 | 角距 | 判定 |");
console.log("|---|---|---|---|---|---|---|---|");
for (const r of rows) {
  console.log(
    `| ${r.city} | ${r.clock} | ${f(r.az)}° | ${f(r.nAz)}° | ${f(r.alt)}° | ${f(r.nAlt)}° | ${f(r.sep, 3)}° | ${r.ok ? "✅" : "❌"} |`
  );
}
console.log("");
console.log(`最大角距误差 ${worstSep.toFixed(3)}°｜阈值 ${THRESHOLD}°`);

const failed = rows.filter((r) => !r.ok);
if (failed.length) {
  console.error(`\n❌ ${failed.length}/${rows.length} 组超阈值——几何有问题，必须查`);
  process.exit(1);
}
console.log(`\n✅ ${rows.length}/${rows.length} 组通过：项目使用的 suncalc 换算与 NOAA 独立算法一致，太阳几何无误`);
