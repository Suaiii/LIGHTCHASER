// AGENT_10 照片种子校验；用法: node agents_output/10/validate_photos.mjs [photos.json] [--date YYYY-MM-DD]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PHOTO_REQUIRED = [
  "id",
  "spot_id",
  "lat",
  "lng",
  "taken_at",
  "image",
  "author_name",
  "caption",
  "score_at_taken",
  "credit",
  "consent_ref",
  "consent_scope",
  "status",
];
const META_REQUIRED = [
  "schema_version",
  "agent",
  "city",
  "count",
  "data_nature",
  "time_basis",
  "location_policy",
];
const CONSENT_SCOPES = new Set(["image_only", "location_ok", "feed_card_ok"]);
const STATUSES = new Set(["已核", "待核", "垫图"]);
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SNAKE_CASE_RE = /^[a-z][a-z0-9_]*$/;
const SHENZHEN_LAT = [22.40, 22.90];
const SHENZHEN_LNG = [113.70, 114.70];

function readJson(filePath, label, errors) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    errors.push(`${label} 无法读取或解析: ${error.message}`);
    return null;
  }
}

function dayNumber(dateText) {
  if (!DATE_RE.test(dateText)) return Number.NaN;
  const [year, month, day] = dateText.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function isIsoTimestamp(value) {
  if (typeof value !== "string" || !ISO_RE.test(value) || !Number.isFinite(Date.parse(value))) return false;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  return calendarDate.getUTCFullYear() === year
    && calendarDate.getUTCMonth() === month - 1
    && calendarDate.getUTCDate() === day;
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const deltaLat = radians(lat2 - lat1);
  const deltaLng = radians(lng2 - lng1);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(deltaLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function checkSnakeCaseKeys(value, location, errors) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => checkSnakeCaseKeys(item, `${location}[${index}]`, errors));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, nestedValue] of Object.entries(value)) {
    if (!SNAKE_CASE_RE.test(key)) errors.push(`${location} 字段非 snake_case: ${key}`);
    checkSnakeCaseKeys(nestedValue, `${location}.${key}`, errors);
  }
}

function checkSchema(schema, errors) {
  if (!schema) return;
  const photoSchema = schema?.properties?.photos?.items;
  const schemaRequired = new Set(photoSchema?.required || []);
  const consentEnum = photoSchema?.properties?.consent_scope?.enum || [];
  const statusEnum = photoSchema?.properties?.status?.enum || [];

  if (schema.type !== "object") errors.push("schema 根节点 type 必须为 object");
  for (const key of ["meta", "photos"]) {
    if (!schema.required?.includes(key)) errors.push(`schema 根节点 required 缺 ${key}`);
  }
  if (schema?.properties?.photos?.type !== "array") errors.push("schema photos 必须为 array");
  for (const field of PHOTO_REQUIRED) {
    if (!schemaRequired.has(field)) errors.push(`schema photo.required 缺 ${field}`);
  }
  if (JSON.stringify(consentEnum) !== JSON.stringify([...CONSENT_SCOPES])) {
    errors.push(`schema consent_scope 枚举错误: ${JSON.stringify(consentEnum)}`);
  }
  if (JSON.stringify(statusEnum) !== JSON.stringify([...STATUSES])) {
    errors.push(`schema status 枚举错误: ${JSON.stringify(statusEnum)}`);
  }
}

function resolveBasisDate(photos, explicitDate, errors) {
  if (explicitDate) {
    if (!DATE_RE.test(explicitDate) || !Number.isFinite(dayNumber(explicitDate))) {
      errors.push(`--date 非法: ${explicitDate}`);
      return null;
    }
    return explicitDate;
  }
  const placeholderDates = photos
    .filter((photo) => photo?.status === "垫图" && isIsoTimestamp(photo?.taken_at))
    .map((photo) => photo.taken_at.slice(0, 10))
    .sort();
  return placeholderDates.at(-1) || null;
}

function validateData(data, spotsData, explicitDate, errors, warnings) {
  if (!data) return { photos: [], basisDate: null, todayCount: 0, weekCount: 0 };
  if (!data.meta || typeof data.meta !== "object" || Array.isArray(data.meta)) {
    errors.push("根节点 meta 必须为 object");
  }
  if (!Array.isArray(data.photos)) errors.push("根节点 photos 必须为 array");
  const photos = Array.isArray(data.photos) ? data.photos : [];
  const meta = data.meta || {};

  checkSnakeCaseKeys(data, "root", errors);
  for (const field of META_REQUIRED) if (!(field in meta)) errors.push(`meta 缺字段 ${field}`);
  if (meta.count !== photos.length) errors.push(`meta.count=${meta.count} 与记录数=${photos.length} 不一致`);
  if (photos.length < 20) errors.push(`记录数=${photos.length}, 期望至少20`);

  const spotMap = new Map((spotsData?.spots || []).map((spot) => [spot.id, spot]));
  if (!spotsData) errors.push("无法校验 spot_id 引用");
  const seenIds = new Set();
  const spotCounts = new Map();

  photos.forEach((photo, index) => {
    const tag = `photos[${index}] id=${photo?.id ?? "?"}`;
    if (!photo || typeof photo !== "object" || Array.isArray(photo)) {
      errors.push(`${tag} 必须为 object`);
      return;
    }
    for (const field of PHOTO_REQUIRED) if (!(field in photo)) errors.push(`${tag} 缺字段 ${field}`);
    if (typeof photo.id !== "string" || !/^photo-\d{3}$/.test(photo.id)) errors.push(`${tag} id 格式须为 photo-三位数字`);
    if (seenIds.has(photo.id)) errors.push(`${tag} id 重复`);
    seenIds.add(photo.id);

    if (photo.spot_id !== null && typeof photo.spot_id !== "string") errors.push(`${tag} spot_id 须为字符串或 null`);
    if (typeof photo.spot_id === "string") {
      const spot = spotMap.get(photo.spot_id);
      if (!spot) {
        errors.push(`${tag} spot_id 不存在: ${photo.spot_id}`);
      } else if (typeof photo.lat === "number" && typeof photo.lng === "number") {
        const distance = haversineMeters(photo.lat, photo.lng, spot.lat, spot.lng);
        if (distance > 300) errors.push(`${tag} 坐标距 ${photo.spot_id} ${distance.toFixed(1)}m, 超过300m`);
      }
      spotCounts.set(photo.spot_id, (spotCounts.get(photo.spot_id) || 0) + 1);
    }

    if (typeof photo.lat !== "number" || photo.lat < SHENZHEN_LAT[0] || photo.lat > SHENZHEN_LAT[1]) {
      errors.push(`${tag} lat 越界深圳市域: ${photo.lat}`);
    }
    if (typeof photo.lng !== "number" || photo.lng < SHENZHEN_LNG[0] || photo.lng > SHENZHEN_LNG[1]) {
      errors.push(`${tag} lng 越界深圳市域: ${photo.lng}`);
    }
    if (!isIsoTimestamp(photo.taken_at)) errors.push(`${tag} taken_at 不是带时区 ISO 时间: ${photo.taken_at}`);
    for (const field of ["image", "author_name", "caption", "credit", "consent_ref"]) {
      if (typeof photo[field] !== "string") errors.push(`${tag} ${field} 必须为字符串`);
    }
    if (photo.score_at_taken !== null
      && (typeof photo.score_at_taken !== "number" || photo.score_at_taken < 0 || photo.score_at_taken > 100)) {
      errors.push(`${tag} score_at_taken 须为 null 或 0..100`);
    }
    if (!CONSENT_SCOPES.has(photo.consent_scope)) errors.push(`${tag} consent_scope 非法: ${photo.consent_scope}`);
    if (!STATUSES.has(photo.status)) errors.push(`${tag} status 非法: ${photo.status}`);

    const trio = [photo.image, photo.credit, photo.consent_ref];
    const filledCount = trio.filter((value) => typeof value === "string" && value.trim() !== "").length;
    if (filledCount !== 0 && filledCount !== 3) errors.push(`${tag} image/credit/consent_ref 须同空或同非空`);
    if (filledCount === 0) errors.push(`${tag} 种子数据的 image/credit/consent_ref 不得为空`);

    if (photo.consent_scope === "image_only") {
      if (photo.spot_id !== null) errors.push(`${tag} image_only 不得绑定精确 spot_id`);
      const isCoarse = [photo.lat, photo.lng].every((coordinate) => (
        typeof coordinate === "number" && Math.abs(coordinate * 100 - Math.round(coordinate * 100)) < 1e-8
      ));
      if (!isCoarse) errors.push(`${tag} image_only 坐标须模糊到0.01度`);
    }

    if (photo.status === "垫图") {
      if (!String(photo.image).startsWith("placeholder://gradient/")) errors.push(`${tag} 垫图 image 须使用 placeholder://gradient/`);
      if (!String(photo.author_name).includes("示例数据")) errors.push(`${tag} 垫图 author_name 须显式含“示例数据”`);
      if (!/[垫图示例]/u.test(String(photo.caption))) errors.push(`${tag} 垫图 caption 须显式标注垫图或示例`);
      if (!(String(photo.credit).includes("生成渐变垫图") && String(photo.credit).includes("非真实 UGC"))) {
        errors.push(`${tag} 垫图 credit 须声明生成渐变垫图且非真实 UGC`);
      }
      if (!String(photo.consent_ref).startsWith("internal-demo://AGENT_10/")) {
        errors.push(`${tag} 垫图 consent_ref 须为内部生成来源引用`);
      }
    } else if (filledCount === 3 && !/^agents_output\/07\/consent_ledger\.csv#row-\d+$/.test(photo.consent_ref)) {
      errors.push(`${tag} 真实照片 consent_ref 须指向 AGENT_07 授权台账行号`);
    }

    const contentText = [photo.image, photo.author_name, photo.caption, photo.credit].join(" ");
    if (/jingansi|静安寺/i.test(contentText)) errors.push(`${tag} 禁止把静安寺素材映射到深圳坐标`);
  });

  const distinctSpots = spotCounts.size;
  const maxPerSpot = Math.max(0, ...spotCounts.values());
  if (distinctSpots < Math.min(10, photos.length)) errors.push(`种子仅覆盖 ${distinctSpots} 个 spot, 分布过于集中`);
  if (maxPerSpot > 2) errors.push(`单 spot 最多 ${maxPerSpot} 条, 不得伪造“今晚爆点”`);

  const basisDate = resolveBasisDate(photos, explicitDate, errors);
  const basisDay = basisDate ? dayNumber(basisDate) : Number.NaN;
  const todayIds = new Set();
  const weekIds = new Set();
  for (const photo of photos.filter((item) => item.status === "垫图" && isIsoTimestamp(item.taken_at))) {
    const photoDay = dayNumber(photo.taken_at.slice(0, 10));
    const ageDays = basisDay - photoDay;
    if (ageDays < 0 || ageDays > 7) errors.push(`id=${photo.id} 垫图 taken_at 不在 D-7..D0`);
    if (ageDays === 0) todayIds.add(photo.id);
    if (ageDays >= 0 && ageDays <= 6) weekIds.add(photo.id);
  }
  if (todayIds.size === 0) errors.push("“今天”集合为空");
  if (weekIds.size === 0) errors.push("“本周”集合为空");
  if (todayIds.size === weekIds.size && [...todayIds].every((id) => weekIds.has(id))) {
    errors.push("“今天”与“本周”集合必须不同");
  }

  if (photos.some((photo) => photo.status !== "垫图")) {
    warnings.push("存在真实照片；刷新时间前须运行 refresh_photo_times 测试确认其 taken_at 不变");
  }
  return { photos, basisDate, todayCount: todayIds.size, weekCount: weekIds.size, distinctSpots, maxPerSpot };
}

function parseArgs(argv) {
  let targetPath = path.join(ROOT, "photos.v1.json");
  let explicitDate = null;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--date") {
      explicitDate = argv[index + 1];
      index += 1;
    } else {
      targetPath = path.resolve(argv[index]);
    }
  }
  return { targetPath, explicitDate };
}

const { targetPath, explicitDate } = parseArgs(process.argv.slice(2));
const errors = [];
const warnings = [];
const schema = readJson(path.join(ROOT, "photos.v1.schema.json"), "photos schema", errors);
const data = readJson(targetPath, "photos data", errors);
const spotsData = readJson(path.resolve(ROOT, "../01/spots.v1.json"), "spots data", errors);

checkSchema(schema, errors);
const summary = validateData(data, spotsData, explicitDate, errors, warnings);

console.log("=== validate_photos 结果 ===");
console.log(`记录数: ${summary.photos.length}`);
console.log(`引用 spot 数: ${summary.distinctSpots || 0}; 单 spot 最大条数: ${summary.maxPerSpot || 0}`);
console.log(`时间基准: ${summary.basisDate || "无"}; 今天: ${summary.todayCount}; 本周: ${summary.weekCount}`);
console.log(`Errors: ${errors.length}`);
errors.forEach((error) => console.log(`  [ERROR] ${error}`));
console.log(`Warnings: ${warnings.length}`);
warnings.forEach((warning) => console.log(`  [WARN] ${warning}`));
console.log(`=== ${errors.length ? "FAIL" : "PASS (0 error)"} ===`);
process.exit(errors.length ? 1 : 0);
