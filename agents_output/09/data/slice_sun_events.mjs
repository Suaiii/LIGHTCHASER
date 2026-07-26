// AGENT_09 · sun_events 切片脚本（备用块）
// 用途：若平台数据库导入单表上限 < 450 行，用本脚本切一份更小的子集顶上（而不是手改主表）。
// 策略：按"今天+明天"两天优先（演示窗口最相关），25 机位 × N 天，而不是天真地取前 N 行——
// 天真截断会砍掉后半批机位的今天数据，切片版仍要保证 25 个机位每天都有一条。
// 用法：node agents_output/09/data/slice_sun_events.mjs [天数，默认2]
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const days = Number(process.argv[2] || 2);
const __dirname = dirname(fileURLToPath(import.meta.url));

const full = JSON.parse(readFileSync(join(__dirname, "sun_events.v1.json"), "utf8"));
const dates = [...new Set(full.map((r) => r.date))].sort();
const keepDates = new Set(dates.slice(0, days));
const sliced = full.filter((r) => keepDates.has(r.date));

const outPath = join(__dirname, `sun_events.slice-${days}d.v1.json`);
writeFileSync(outPath, JSON.stringify(sliced, null, 2) + "\n");
console.log(`原 ${full.length} 行 → 切片 ${sliced.length} 行（${[...keepDates].join(", ")}，覆盖机位数 ${new Set(sliced.map(r=>r.spot_id)).size}） → ${outPath}`);
