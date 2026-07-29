// zg-sun-helpers.js —— 追·光 GL 地图的太阳几何 + 主题光色（抽自原型 public/light-map-3d.jsx）
// 用途：随 light-map-gl.jsx 一起上传给平台 AI；这四个函数是 GL 场景的依赖，缺了跑不起来。
// 依赖：window.SunCalc（BSD-2，见 materials/lib/suncalc.js）

function zgToLocal(lat, lng, origin) {
  const R = 6371000, rad = Math.PI / 180;
  return {
    x: (lng - origin.lng) * rad * R * Math.cos(origin.lat * rad),
    z: -(lat - origin.lat) * rad * R,
  };
}
function zgSunDir(azDeg, altDeg) {
  const az = azDeg * Math.PI / 180, alt = Math.max(altDeg, 0.5) * Math.PI / 180;
  return { x: Math.sin(az) * Math.cos(alt), y: Math.sin(alt), z: -Math.cos(az) * Math.cos(alt) };
}
const zgClamp = (v, a, b) => Math.min(b, Math.max(a, v));

// —— 追光主题光色：日照高度角 → 色卡（tokens 8 锚点语言）——
// 正午白金 → golden 金黄 → 日落橘红 → 峰值深红 → 暮光紫，锚点间线性插值。
// GL 版与 Three 版共用（本文件先于 light-map-gl.jsx 加载）。
const ZG_SUN_PALETTE = [
  { alt: -6, c: "#5A3870" },   // 暮光紫（夜幕）
  { alt: 0,  c: "#8A4068" },   // 消散紫红
  { alt: 3,  c: "#C84858" },   // 晚霞峰值深红
  { alt: 8,  c: "#DE6B48" },   // 日落橘红
  { alt: 16, c: "#E0A060" },   // Golden Hour 橘黄
  { alt: 30, c: "#EBC28E" },   // 暖金
  { alt: 55, c: "#F2E2C4" },   // 正午白金
];
function zgHexLerp(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const mix = (sh) => Math.round(((pa >> sh) & 255) + (((pb >> sh) & 255) - ((pa >> sh) & 255)) * t);
  return "#" + ((mix(16) << 16) | (mix(8) << 8) | mix(0)).toString(16).padStart(6, "0");
}
function zgSunPalette(altDeg) {
  const P = ZG_SUN_PALETTE;
  if (altDeg <= P[0].alt) return P[0].c;
  for (let i = 1; i < P.length; i++) {
    if (altDeg <= P[i].alt) {
      return zgHexLerp(P[i - 1].c, P[i].c, (altDeg - P[i - 1].alt) / (P[i].alt - P[i - 1].alt));
    }
  }
  return P[P.length - 1].c;
}
