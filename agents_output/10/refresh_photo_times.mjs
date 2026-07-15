// AGENT_10 垫图时间再生成；用法: node agents_output/10/refresh_photo_times.mjs [photos.json] [--date YYYY-MM-DD]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function localDateText(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(dateText) {
  if (!DATE_RE.test(dateText)) throw new Error(`日期须为 YYYY-MM-DD: ${dateText}`);
  const [year, month, day] = dateText.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  if (value.toISOString().slice(0, 10) !== dateText) throw new Error(`日期不存在: ${dateText}`);
  return value;
}

function dateBefore(runDate, offsetDays) {
  const value = parseDate(runDate);
  value.setUTCDate(value.getUTCDate() - offsetDays);
  return value.toISOString().slice(0, 10);
}

function parseArgs(argv) {
  let inputPath = path.join(ROOT, "photos.v1.json");
  let runDate = localDateText();
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--date") {
      runDate = argv[index + 1];
      index += 1;
    } else {
      inputPath = path.resolve(argv[index]);
    }
  }
  parseDate(runDate);
  return { inputPath, runDate };
}

export function refreshPlaceholderTimes(data, runDate) {
  parseDate(runDate);
  if (!data || !Array.isArray(data.photos)) throw new Error("输入必须包含 photos 数组");

  const placeholderIds = data.photos
    .filter((photo) => photo?.status === "垫图")
    .map((photo) => photo.id)
    .sort();
  if (placeholderIds.length < 2) throw new Error("至少需要2条垫图，才能保证“今天/本周”非空且集合不同");
  const rankById = new Map(placeholderIds.map((id, index) => [id, index]));

  return {
    ...data,
    photos: data.photos.map((photo) => {
      if (photo?.status !== "垫图") return photo;
      const rank = rankById.get(photo.id);
      const ageDays = rank % 8;
      const hour = String(15 + (rank % 5)).padStart(2, "0");
      const minute = String((rank * 7) % 60).padStart(2, "0");
      return {
        ...photo,
        taken_at: `${dateBefore(runDate, ageDays)}T${hour}:${minute}:00+08:00`,
      };
    }),
  };
}

function main() {
  const { inputPath, runDate } = parseArgs(process.argv.slice(2));
  const original = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const refreshed = refreshPlaceholderTimes(original, runDate);
  fs.writeFileSync(inputPath, `${JSON.stringify(refreshed, null, 2)}\n`, "utf8");

  const placeholders = refreshed.photos.filter((photo) => photo.status === "垫图");
  const todayCount = placeholders.filter((photo) => photo.taken_at.startsWith(runDate)).length;
  const realCount = refreshed.photos.length - placeholders.length;
  console.log(`refresh_photo_times: date=${runDate} placeholders=${placeholders.length} today=${todayCount} real_unchanged=${realCount}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`refresh_photo_times ERROR: ${error.message}`);
    process.exit(1);
  }
}
