const CITY_PRESETS = {
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
        reasonHint: "湖面和天际线一起进画面，颜色会更显层次"
      },
      {
        name: "Elysian Park Angel's Point",
        lat: 34.0827,
        lng: -118.2378,
        direction: "西",
        reasonHint: "视野开阔，适合拍城市剪影"
      },
      {
        name: "Vista Hermosa 观景坡",
        lat: 34.0555,
        lng: -118.2665,
        direction: "西",
        reasonHint: "前景层次好，适合把草坡和天色一起收进来"
      },
      {
        name: "Griffith Observatory 西侧平台",
        lat: 34.1184,
        lng: -118.3004,
        direction: "西",
        reasonHint: "高度优势明显，颜色铺开时最稳"
      },
      {
        name: "Baxter St 台阶口",
        lat: 34.0821,
        lng: -118.2471,
        direction: "西",
        reasonHint: "街道纵深强，适合拍车流和天空过渡色"
      }
    ]
  }
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
  return CITY_PRESETS[cityKey] || CITY_PRESETS.la;
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
  getCityPreset,
  getNearestPoi,
  formatDistance,
};
