const DEFAULT_CITY_KEY = "shanghai";

const CITY_PRESETS = {
  shanghai: {
    key: "shanghai",
    name: "Shanghai",
    timezone: "Asia/Shanghai",
    defaultLat: 31.2304,
    defaultLng: 121.4737,
    pois: [
      {
        name: "北外滩滨江",
        lat: 31.2504,
        lng: 121.5067,
        direction: "西",
        reasonHint: "浦江转弯处视野够开，适合把陆家嘴轮廓和晚霞一起收进画面",
      },
      {
        name: "徐汇滨江西岸",
        lat: 31.1856,
        lng: 121.4594,
        direction: "西",
        reasonHint: "江面反光稳定，低云一有颜色就会被水面拉长",
      },
      {
        name: "苏州河乍浦路桥",
        lat: 31.2456,
        lng: 121.4895,
        direction: "西",
        reasonHint: "桥面纵深、河面倒影和城市剪影都在同一个方向",
      },
      {
        name: "世博公园后滩段",
        lat: 31.1835,
        lng: 121.4829,
        direction: "西",
        reasonHint: "树线、江面和天色层次清楚，适合拍干净的横构图",
      },
      {
        name: "杨浦滨江毛麻仓库段",
        lat: 31.2707,
        lng: 121.5485,
        direction: "西",
        reasonHint: "工业风前景很硬，晚霞起来时画面会更有故事感",
      },
    ],
  },
  la: {
    key: "la",
    name: "Los Angeles",
    timezone: "America/Los_Angeles",
    defaultLat: 34.078,
    defaultLng: -118.260,
    pois: [
      {
        name: "Echo Park 高地",
        lat: 34.0785,
        lng: -118.2606,
        direction: "西",
        reasonHint: "湖面和天际线一起进画面，颜色会更显层次",
      },
      {
        name: "Elysian Park Angel's Point",
        lat: 34.0827,
        lng: -118.2378,
        direction: "西",
        reasonHint: "视野开阔，适合拍城市剪影",
      },
      {
        name: "Vista Hermosa 观景坡",
        lat: 34.0555,
        lng: -118.2665,
        direction: "西",
        reasonHint: "前景层次好，适合把草坡和天色一起收进来",
      },
      {
        name: "Griffith Observatory 西侧平台",
        lat: 34.1184,
        lng: -118.3004,
        direction: "西",
        reasonHint: "高度优势明显，颜色铺开时最稳",
      },
      {
        name: "Baxter St 台阶口",
        lat: 34.0821,
        lng: -118.2471,
        direction: "西",
        reasonHint: "街道纵深强，适合拍车流和天空过渡色",
      },
    ],
  },
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(distanceKm) {
  const walkingMinutes = clamp(Math.round((distanceKm / 4.8) * 60), 3, 90);
  return `步行 ${walkingMinutes} 分钟`;
}

function getCityPreset(cityKey) {
  return CITY_PRESETS[cityKey] || CITY_PRESETS[DEFAULT_CITY_KEY];
}

function getNearestPoi(cityKey, lat, lng) {
  const city = getCityPreset(cityKey);
  const ranked = city.pois
    .map((poi) => ({
      ...poi,
      distanceKm: haversineDistanceKm(lat, lng, poi.lat, poi.lng),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return ranked[0];
}

module.exports = {
  CITY_PRESETS,
  DEFAULT_CITY_KEY,
  getCityPreset,
  getNearestPoi,
  formatDistance,
};
