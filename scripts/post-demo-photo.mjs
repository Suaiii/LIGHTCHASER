// AGENT_10/HERMES-10 录屏触发器：向本地 /api/photos POST 一条演示照片。用法: node scripts/post-demo-photo.mjs [--lat 22.48] [--lng 113.94] [--caption 文案]；默认坐标取 photos.v1.json 首条种子 ±0.003 随机偏移；需先 npm run dev:preview。
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PHOTOS_FILE = path.join(REPO_ROOT, "agents_output", "10", "photos.v1.json");
const ENDPOINT = "http://127.0.0.1:5174/api/photos";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--lat") args.lat = Number(argv[i + 1]);
    if (argv[i] === "--lng") args.lng = Number(argv[i + 1]);
    if (argv[i] === "--caption") args.caption = argv[i + 1];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const firstSeed = JSON.parse(readFileSync(PHOTOS_FILE, "utf8")).photos[0];
// 默认在首条种子附近随机落点：每次录屏气泡位置略不同，"新增"在视口里更直观
const jitter = () => (Math.random() * 2 - 1) * 0.003;

const body = {
  lat: Number.isFinite(args.lat) ? args.lat : Number((firstSeed.lat + jitter()).toFixed(6)),
  lng: Number.isFinite(args.lng) ? args.lng : Number((firstSeed.lng + jitter()).toFixed(6)),
};
if (typeof args.caption === "string" && args.caption.trim()) {
  body.caption = args.caption.trim();
}

try {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (response.status !== 201) {
    console.error(`POST ${ENDPOINT} -> ${response.status}`);
    console.error(JSON.stringify(payload, null, 2));
    process.exit(1);
  }
  console.log("已发布演示照片:");
  console.log(JSON.stringify(payload, null, 2));
  console.log("请在 3 秒内观察地图视口（新气泡应出现在上述坐标附近）");
} catch (error) {
  console.error("连接失败：请先启动 npm run dev:preview（默认 http://127.0.0.1:5174）");
  console.error(String(error && error.message ? error.message : error));
  process.exit(1);
}
