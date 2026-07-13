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
      {
        name: "金山城市沙滩",
        lat: 30.7109005,
        lng: 121.3455949,
        direction: "西南",
        reasonHint: "海面足够开阔，低云被晚霞染色时会在水面上拉出很长的反光带",
      },
      {
        name: "金山嘴渔村海边",
        lat: 30.7358486,
        lng: 121.3696611,
        direction: "西南",
        reasonHint: "海堤、渔村屋顶和开阔天线能一起入画，比赶去市中心更适合就近追光",
      },
      {
        name: "漕泾郊野公园湿地",
        lat: 30.8260622,
        lng: 121.3913371,
        direction: "西",
        reasonHint: "湿地水面和低矮树线不会挡住西侧天光，适合拍干净的金色边缘光",
      },
      {
        name: "廊下郊野公园",
        lat: 30.7848082,
        lng: 121.1518995,
        direction: "西",
        reasonHint: "田野和水渠前景很平，晚霞不强时也能拍出安静的乡野黄昏感",
      },
      {
        name: "枫泾古镇外围开阔水岸",
        lat: 30.8895355,
        lng: 121.013122,
        direction: "西",
        reasonHint: "古镇外围的开阔水岸比巷子里更吃天光，适合把屋檐剪影压在晚霞下面",
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

// 大区赛：深圳 25 机位——单一真相源 agents_output/01/spots.v1.json（AGENT_01 交付，坐标已经 OSM 反查核验）
// require 失败（数据文件未随部署带上）时静默跳过，不影响上海/LA。
try {
  const shenzhenSpots = require("../agents_output/01/spots.v1.json").spots || [];
  if (shenzhenSpots.length) {
    CITY_PRESETS.shenzhen = {
      key: "shenzhen",
      name: "Shenzhen",
      timezone: "Asia/Shanghai",
      defaultLat: 22.4930,
      defaultLng: 113.9470,
      pois: shenzhenSpots.map((s) => ({
        name: s.name,
        lat: s.lat,
        lng: s.lng,
        direction: s.direction,
        reasonHint: s.stand_desc,
      })),
    };
  }
} catch (error) {
  // 数据文件缺失时保持既有城市不受影响
}

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

function getNearbyPois(cityKey, lat, lng, limit = 4) {
  const city = getCityPreset(cityKey);
  return city.pois
    .map((poi) => ({
      ...poi,
      distanceKm: haversineDistanceKm(lat, lng, poi.lat, poi.lng),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}

module.exports = {
  CITY_PRESETS,
  DEFAULT_CITY_KEY,
  getCityPreset,
  getNearestPoi,
  getNearbyPois,
  formatDistance,
};
