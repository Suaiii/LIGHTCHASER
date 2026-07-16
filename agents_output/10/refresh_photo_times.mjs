// AGENT_10 垫图时间再生成；用法: node agents_output/10/refresh_photo_times.mjs [photos.json] [--now ISO]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/;
const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

function shanghaiParts(date) {
  const shifted = new Date(date.getTime() + SHANGHAI_OFFSET_MS);
  return {
    date: shifted.toISOString().slice(0, 10),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
  };
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

function parseNow(nowText) {
  if (typeof nowText !== "string" || !ISO_RE.test(nowText) || !Number.isFinite(Date.parse(nowText))) {
    throw new Error(`--now 须为带时区 ISO 时间: ${nowText}`);
  }
  return new Date(nowText);
}

function timeFromSecondOfDay(secondOfDay) {
  const hour = Math.floor(secondOfDay / 3600);
  const minute = Math.floor((secondOfDay % 3600) / 60);
  const second = secondOfDay % 60;
  return [hour, minute, second].map((value) => String(value).padStart(2, "0")).join(":");
}

function requireOptionValue(argv, index, option) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${option} 缺少值`);
  return value;
}

function dayNumber(dateText) {
  const [year, month, day] = dateText.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function validatePlaceholderIds(photos) {
  const seen = new Set();
  for (const photo of photos.filter((item) => item?.status === "垫图")) {
    if (typeof photo.id !== "string" || !/^photo-\d{3}$/.test(photo.id)) {
      throw new Error(`垫图 id 格式错误: ${photo.id}`);
    }
    if (seen.has(photo.id)) throw new Error(`垫图 id 重复: ${photo.id}`);
    seen.add(photo.id);
  }
}

function validateRefreshedTimes(data, now, runDate) {
  const basisDay = dayNumber(runDate);
  const today = new Set();
  const week = new Set();
  for (const photo of data.photos.filter((item) => item?.status === "垫图")) {
    const timestamp = Date.parse(photo.taken_at);
    if (!Number.isFinite(timestamp)) throw new Error(`垫图 taken_at 非法: ${photo.id}`);
    if (timestamp > now.getTime()) throw new Error(`垫图 taken_at 晚于当前时刻: ${photo.id}`);
    const photoDate = shanghaiParts(new Date(timestamp)).date;
    const ageDays = basisDay - dayNumber(photoDate);
    if (ageDays < 0 || ageDays > 7) throw new Error(`垫图 taken_at 不在 D-7..D0: ${photo.id}`);
    if (ageDays === 0) today.add(photo.id);
    if (ageDays <= 6) week.add(photo.id);
  }
  if (today.size === 0) throw new Error("刷新后“今天”集合为空");
  if (week.size === 0) throw new Error("刷新后“本周”集合为空");
  if (today.size === week.size && [...today].every((id) => week.has(id))) {
    throw new Error("刷新后“今天/本周”集合相同");
  }
}

function writeJsonAtomically(inputPath, data) {
  const directory = path.dirname(inputPath);
  const tempPath = path.join(directory, `.${path.basename(inputPath)}.${process.pid}.${Date.now()}.tmp`);
  try {
    fs.writeFileSync(tempPath, `${JSON.stringify(data, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    fs.renameSync(tempPath, inputPath);
  } catch (error) {
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch {
      // Keep the original error; cleanup failure must not hide the write failure.
    }
    throw error;
  }
}

function parseArgs(argv) {
  let inputPath = path.join(ROOT, "photos.v1.json");
  let now = new Date();
  let explicitDate = null;
  let hasInputPath = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--now") {
      now = parseNow(requireOptionValue(argv, index, argument));
      index += 1;
    } else if (argument === "--date") {
      explicitDate = requireOptionValue(argv, index, argument);
      parseDate(explicitDate);
      index += 1;
    } else if (argument.startsWith("--")) {
      throw new Error(`未知参数: ${argument}`);
    } else {
      if (hasInputPath) throw new Error(`只能提供一个 photos.json: ${argument}`);
      inputPath = path.resolve(argument);
      hasInputPath = true;
    }
  }
  const runDate = shanghaiParts(now).date;
  if (explicitDate && explicitDate !== runDate) {
    throw new Error(`--date=${explicitDate} 与 --now 的上海日期 ${runDate} 不一致`);
  }
  return { inputPath, now, runDate };
}

export function refreshPlaceholderTimes(data, nowValue = new Date()) {
  const now = nowValue instanceof Date ? nowValue : parseNow(nowValue);
  if (!Number.isFinite(now.getTime())) throw new Error(`now 非法: ${nowValue}`);
  if (!data || !Array.isArray(data.photos)) throw new Error("输入必须包含 photos 数组");
  validatePlaceholderIds(data.photos);

  const runDate = shanghaiParts(now).date;
  const placeholderIds = data.photos
    .filter((photo) => photo?.status === "垫图")
    .map((photo) => photo.id)
    .sort();
  if (placeholderIds.length < 2) throw new Error("至少需要2条垫图，才能保证“今天/本周”非空且集合不同");
  const rankById = new Map(placeholderIds.map((id, index) => [id, index]));
  const todayIds = placeholderIds.filter((id) => rankById.get(id) % 8 === 0);
  const todayRankById = new Map(todayIds.map((id, index) => [id, index]));
  const nowParts = shanghaiParts(now);
  const nowSecondOfDay = nowParts.hour * 3600 + nowParts.minute * 60 + nowParts.second;

  const refreshed = {
    ...data,
    photos: data.photos.map((photo) => {
      if (photo?.status !== "垫图") return photo;
      const rank = rankById.get(photo.id);
      const ageDays = rank % 8;
      const time = ageDays === 0
        ? timeFromSecondOfDay(Math.floor(nowSecondOfDay * (todayRankById.get(photo.id) + 1) / todayIds.length))
        : `${String(15 + (rank % 5)).padStart(2, "0")}:${String((rank * 7) % 60).padStart(2, "0")}:00`;
      return {
        ...photo,
        taken_at: `${dateBefore(runDate, ageDays)}T${time}+08:00`,
      };
    }),
  };
  validateRefreshedTimes(refreshed, now, runDate);
  return refreshed;
}

function main() {
  const { inputPath, now, runDate } = parseArgs(process.argv.slice(2));
  const original = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const refreshed = refreshPlaceholderTimes(original, now);
  writeJsonAtomically(inputPath, refreshed);

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
