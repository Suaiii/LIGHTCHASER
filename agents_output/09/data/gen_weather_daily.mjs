// AGENT_09 · weather_daily 演示数据一键再生成脚本
// 用途：weather_daily 是"演示用假数据"（真实版走 agents_output/02/weather_ops.md 预案A/B，评分公式与字段零改动）。
// 平台开箱当天（及此后每次演示前）重跑一次，把 date 参数化到运行当日起，避免"昨天的演示数据"穿帮。
// 用法：node agents_output/09/data/gen_weather_daily.mjs [覆盖天数，默认2] > 或直接生成到同目录 weather_daily.v1.json
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const days = Number(process.argv[2] || 2); // 默认覆盖 D0/D+1 两行以上（任务书 §2b③要求）
const __dirname = dirname(fileURLToPath(import.meta.url));

// 三档演示样例（高/中/低），循环铺到每一天，字段与 weather_ops.md 表 weather_daily 一致
const DEMO_PROFILES = [
  { cloud_low: 22, cloud_mid: 18, cloud_high: 10, humidity: 58, visibility_km: 22.5, weather_code: 1, has_rain: false },  // 高分示例：少云通透
  { cloud_low: 45, cloud_mid: 30, cloud_high: 15, humidity: 66, visibility_km: 14.0, weather_code: 2, has_rain: false },  // 中分示例：多云有层次
  { cloud_low: 78, cloud_mid: 60, cloud_high: 40, humidity: 82, visibility_km: 6.5, weather_code: 61, has_rain: true },   // 低分示例：阴雨遮天
];

function todayISO(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD，本地时区误差在演示数据场景可接受
}

const rows = [];
for (let i = 0; i < days; i++) {
  const profile = DEMO_PROFILES[i % DEMO_PROFILES.length];
  rows.push({
    date: todayISO(i),
    city: "深圳",
    ...profile,
    updated_at: new Date().toISOString(),
    _demo_note: "演示用假数据——非实测值，正式版走 weather_ops.md 预案A(Open-Meteo)/预案B(人工刷新)",
  });
}

const outPath = join(__dirname, "weather_daily.v1.json");
writeFileSync(outPath, JSON.stringify(rows, null, 2) + "\n");
console.log(`已生成 ${rows.length} 行 → ${outPath}`);
console.log(rows.map((r) => `${r.date} · has_rain=${r.has_rain}`).join("\n"));
