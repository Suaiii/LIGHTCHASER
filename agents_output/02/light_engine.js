// AGENT_02 · 光线引擎 light_engine.js
// 三件功能：① score(weather, sun) 晚霞评分 v2 ② light_relation(bearing, sunAz) 顺/逆/侧光判定
//          ③ 机位级一句话光位描述（供 P3/P4 文案）
// 纯函数、离线、零依赖。CommonJS。自检: node light_engine.js --selftest
// 公式规格见 score_spec.md（权重与曲线一一对应）。

"use strict";

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// 平台钟形：[lo,hi] 内=1，线性降到 hardLo/hardHi 处=0，硬界外=0
function bellPlateau(x, lo, hi, hardLo, hardHi) {
  if (x <= hardLo || x >= hardHi) return 0;
  if (x >= lo && x <= hi) return 1;
  if (x < lo) return (x - hardLo) / (lo - hardLo);
  return (hardHi - x) / (hardHi - hi);
}

// f_cloud：中高云 30–60% 出彩；低云过多压分
function fCloud(cloudLow, cloudMid, cloudHigh) {
  const cmh = 0.6 * cloudMid + 0.4 * cloudHigh;         // 中云权重更高（最易被染色）
  const base = bellPlateau(cmh, 30, 60, 5, 95);
  const lowPenalty = clamp(1 - 0.8 * Math.max(0, cloudLow - 40) / 50, 0.2, 1);
  let f = base * lowPenalty;
  if (cloudLow >= 70) f = Math.min(f, 0.2);              // 低云满盖 → 直接压至 ≤0.2
  return clamp(f, 0, 1);
}

// f_humidity：40–70% 平台区
const fHumidity = (h) => bellPlateau(h, 40, 70, 10, 95);

// f_visibility：10km 饱和递增
function fVisibility(vkm) {
  if (vkm >= 10) return 1;
  if (vkm <= 1) return 0;
  return (vkm - 1) / 9;
}

// f_sun：距日落 ±40min 窗口因子（realtime 传真实分钟；日峰值评分传 0）
function fSun(minutesToSunset) {
  const m = Math.abs(minutesToSunset);
  if (m <= 40) return 1;
  if (m <= 120) return clamp(1 - 0.7 * (m - 40) / 80, 0.3, 1);
  return 0.2;
}

// f_air：天气码惩罚（WMO weather_code）
function fAir(code) {
  if (code === 0 || code === 1) return 1;        // 晴 / 大致晴
  if (code === 2) return 0.95;                    // 少云
  if (code === 3) return 0.85;                    // 阴
  if (code === 45 || code === 48) return 0.5;     // 雾
  if (code >= 51 && code <= 57) return 0.3;       // 毛毛雨
  if (code >= 61 && code <= 67) return 0.2;       // 雨
  if (code >= 71 && code <= 77) return 0.1;       // 雪
  if (code >= 80 && code <= 82) return 0.25;      // 阵雨
  if (code >= 95) return 0.15;                    // 雷暴
  return 0.6;
}

function scoreLabel(s) {
  if (s >= 75) return "值得跑出门";
  if (s >= 45) return "顺路看看";
  return "今天歇着";
}

const WEIGHTS = { cloud: 0.35, humidity: 0.20, visibility: 0.20, sun: 0.15, air: 0.10 };

// 主评分。weather 字段：cloud_low/cloud_mid/cloud_high(%)、humidity(%)、visibility_km、weather_code
// sun 字段（可选）：minutes_to_sunset（默认 0 = 评估日落峰值）
function score(weather, sun = {}) {
  const fc = fCloud(weather.cloud_low ?? 0, weather.cloud_mid ?? 0, weather.cloud_high ?? 0);
  const fh = fHumidity(weather.humidity ?? 55);
  const fv = fVisibility(weather.visibility_km ?? 12);
  const fs = fSun(sun.minutes_to_sunset ?? 0);
  const fa = fAir(weather.weather_code ?? 1);
  const raw = WEIGHTS.cloud * fc + WEIGHTS.humidity * fh + WEIGHTS.visibility * fv + WEIGHTS.sun * fs + WEIGHTS.air * fa;
  const s = Math.round(100 * clamp(raw, 0, 1));
  return {
    score: s,
    label: scoreLabel(s),
    factors: { fc: +fc.toFixed(3), fh: +fh.toFixed(3), fv: +fv.toFixed(3), fs: +fs.toFixed(3), fa: +fa.toFixed(3) },
    contrib: {
      cloud: +(WEIGHTS.cloud * fc * 100).toFixed(1),
      humidity: +(WEIGHTS.humidity * fh * 100).toFixed(1),
      visibility: +(WEIGHTS.visibility * fv * 100).toFixed(1),
      sun: +(WEIGHTS.sun * fs * 100).toFixed(1),
      air: +(WEIGHTS.air * fa * 100).toFixed(1),
    },
  };
}

// 角差 [0,180]
function angularDiff(a, b) {
  let d = Math.abs(((a - b) % 360));
  if (d > 180) d = 360 - d;
  return d;
}

// 光位判定：相机朝向 bearing vs 太阳方位角 sunAz
// 阈值：0-45 逆光 / 45-90 侧逆光 / 90-135 侧光 / 135-180 顺光
const LIGHT_DESC = {
  逆光: "逆光，天空与半透明云彩最通透，适合剪影和压暗前景",
  侧逆光: "侧逆光，边缘光强，适合勾人物/建筑轮廓，注意防眩光",
  侧光: "侧光，明暗立体、质感最强，适合拍纹理与层次",
  顺光: "顺光，色彩饱和但偏平，适合拍天空大色块与倒影",
};
function lightRelation(bearing, sunAz) {
  const d = angularDiff(bearing, sunAz);
  let relation;
  if (d <= 45) relation = "逆光";
  else if (d <= 90) relation = "侧逆光";
  else if (d <= 135) relation = "侧光";
  else relation = "顺光";
  return { relation, angle: +d.toFixed(1), desc: LIGHT_DESC[relation] };
}

module.exports = { score, scoreLabel, lightRelation, angularDiff, fCloud, fHumidity, fVisibility, fSun, fAir, WEIGHTS };

// ── 自检 CLI ──
if (require.main === module && process.argv.includes("--selftest")) {
  console.log("=== light_engine 自检 ===");
  const cases = {
    "高分·中高云通透晴": { cloud_low: 15, cloud_mid: 45, cloud_high: 30, humidity: 55, visibility_km: 18, weather_code: 2 },
    "中分·低云偏多微湿阴": { cloud_low: 60, cloud_mid: 25, cloud_high: 15, humidity: 80, visibility_km: 8, weather_code: 3 },
    "低分·雨天低云满盖": { cloud_low: 95, cloud_mid: 20, cloud_high: 10, humidity: 92, visibility_km: 4, weather_code: 63 },
  };
  for (const [name, w] of Object.entries(cases)) {
    const r = score(w, { minutes_to_sunset: 0 });
    console.log(`\n[${name}] → ${r.score} 分 · ${r.label}`);
    console.log("  factors:", JSON.stringify(r.factors));
    console.log("  贡献(分):", JSON.stringify(r.contrib));
  }
  console.log("\n=== 光位判定（相机 bearing=250，扫 4 象限太阳方位）===");
  for (const az of [250, 305, 345, 70]) {
    const lr = lightRelation(250, az);
    console.log(`  sunAz=${az} → 角差 ${lr.angle}° → ${lr.relation}｜${lr.desc}`);
  }
  console.log("\n=== 极端输入健壮性（K4）===");
  const ext1 = score({ cloud_low: 100, cloud_mid: 100, cloud_high: 100, humidity: 100, visibility_km: 0, weather_code: 65 });
  console.log(`  云量100/能见0/大雨 → ${ext1.score} 分 · ${ext1.label}（要求 <45 劝退档且不报错）`);
  const ext2 = score({});
  console.log(`  空对象缺省 → ${ext2.score} 分 · ${ext2.label}（要求不报错；无云晴空得中分属合理）`);
}
