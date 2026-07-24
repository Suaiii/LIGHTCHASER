// AGENT_10/HERMES-10 photos 演示服务：加载种子垫图 + 进程内 live 记录，供 /api/photos 使用；被 api/photos.js 与 scripts/dev-preview.js 引用。
// 演示态设计：live 记录只存模块级内存、重启即失——录屏演示"刚刚发布"即可，不落盘以免演示数据被误当真实 UGC（F6 红线）。
const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");
const PHOTOS_FILE = path.join(REPO_ROOT, "agents_output", "10", "photos.v1.json");
const SPOTS_FILE = path.join(REPO_ROOT, "agents_output", "01", "spots.v1.json");

// 深圳粗框：演示端点只服务深圳场景，框外坐标一律视为调用方错误
const SHENZHEN_BOUNDS = { lat_min: 22.3, lat_max: 22.9, lng_min: 113.7, lng_max: 114.7 };

const seedPayload = JSON.parse(fs.readFileSync(PHOTOS_FILE, "utf8"));
const spotsPayload = JSON.parse(fs.readFileSync(SPOTS_FILE, "utf8"));

// spot_id → 机位名：预建索引，避免每次请求重扫 spots 数组
const spotNameById = new Map(spotsPayload.spots.map((spot) => [spot.id, spot.name]));

const livePhotos = [];

function parseNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIsoWithCnOffset(date) {
  // 与种子 taken_at 保持同一时区书写（+08:00），排序与人读都不用换算
  return new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString().replace("Z", "+08:00");
}

function enrichRecord(record) {
  return {
    ...record,
    spot_name: record.spot_id ? spotNameById.get(record.spot_id) || null : null,
  };
}

function loadPhotosPayload() {
  const photos = [...seedPayload.photos, ...livePhotos]
    // bubble_spec §5：image_only 只授权照片本体、不授权地图气泡曝光；当前种子无此档，规则性预埋
    .filter((record) => record.consent_scope !== "image_only")
    .map(enrichRecord)
    .sort((a, b) => Date.parse(b.taken_at) - Date.parse(a.taken_at));

  return {
    meta: { ...seedPayload.meta, served_at: new Date().toISOString() },
    photos,
  };
}

function addLivePhoto({ lat, lng, caption, author_name } = {}) {
  const parsedLat = parseNumber(lat);
  const parsedLng = parseNumber(lng);
  const outOfBounds =
    parsedLat === null ||
    parsedLng === null ||
    parsedLat < SHENZHEN_BOUNDS.lat_min ||
    parsedLat > SHENZHEN_BOUNDS.lat_max ||
    parsedLng < SHENZHEN_BOUNDS.lng_min ||
    parsedLng > SHENZHEN_BOUNDS.lng_max;

  if (outOfBounds) {
    throw new Error("photos_api_invalid_coords");
  }

  const now = new Date();
  const record = {
    id: `live-${now.getTime()}`,
    spot_id: null,
    spot_name: null,
    lat: parsedLat,
    lng: parsedLng,
    taken_at: toIsoWithCnOffset(now),
    image: "placeholder://gradient/live-01",
    author_name: typeof author_name === "string" && author_name.trim() ? author_name.trim() : "演示用户",
    caption: typeof caption === "string" && caption.trim() ? caption.trim() : "刚刚发布的演示照片",
    score_at_taken: null,
    credit: "团队演示数据；非真实 UGC",
    consent_ref: "internal-demo://live",
    consent_scope: "location_ok",
    status: "垫图",
    is_live: true,
  };

  livePhotos.push(record);
  return record;
}

module.exports = {
  loadPhotosPayload,
  addLivePhoto,
};
