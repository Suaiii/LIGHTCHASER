const SunCalc = require("suncalc");
const { DEMO_PROFILES } = require("./demo-data");
const { getCityPreset, getNearestPoi, formatDistance } = require("./poi");
const {
  average,
  calculateSunsetScore,
  getDemoBucket,
  getScoreLabel,
} = require("./scoring");

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatLocalTime(date, timeZone) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(date);
}

function getTimeZoneOffset(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );

  return asUtc - date.getTime();
}

function zonedTimeToUtc(localIso, timeZone) {
  const [datePart, timePart = "00:00:00"] = localIso.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour = 0, minute = 0, second = 0] = timePart.split(":").map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const offset = getTimeZoneOffset(utcGuess, timeZone);
  return new Date(utcGuess.getTime() - offset);
}

function getTargetSunsetDate(dailySunsets, now, timeZone) {
  const ordered = dailySunsets
    .map((value) => zonedTimeToUtc(value, timeZone))
    .sort((a, b) => a.getTime() - b.getTime());

  for (const sunset of ordered) {
    if (sunset.getTime() >= now.getTime() - 30 * 60 * 1000) {
      return sunset;
    }
  }

  return ordered[ordered.length - 1];
}

function getWindowMetrics(hourly, targetTime, timeZone) {
  const targetMs = targetTime.getTime();
  const samples = [];

  for (let index = 0; index < hourly.time.length; index += 1) {
    const sampleTime = zonedTimeToUtc(hourly.time[index], timeZone).getTime();
    const diffMinutes = Math.abs(sampleTime - targetMs) / (60 * 1000);
    if (diffMinutes <= 90) {
      samples.push({
        cloudCover: hourly.cloud_cover[index],
        relativeHumidity: hourly.relative_humidity_2m[index],
        visibilityKm: hourly.visibility[index] / 1000,
        weatherCode: hourly.weather_code[index],
      });
    }
  }

  if (samples.length === 0) {
    return {
      cloudCover: 50,
      relativeHumidity: 55,
      visibilityKm: 12,
      weatherCode: 1,
    };
  }

  return {
    cloudCover: average(samples.map((sample) => sample.cloudCover)),
    relativeHumidity: average(samples.map((sample) => sample.relativeHumidity)),
    visibilityKm: average(samples.map((sample) => sample.visibilityKm)),
    weatherCode: Math.round(
      average(samples.map((sample) => sample.weatherCode))
    ),
  };
}

function getPaletteCurrentColor(colors, now, goldenHourStart, endTime) {
  const startMs = goldenHourStart.getTime();
  const endMs = endTime.getTime();
  const nowMs = now.getTime();

  if (endMs <= startMs) {
    return colors[0];
  }

  const progress = clamp((nowMs - startMs) / (endMs - startMs), 0, 1);
  const index = clamp(
    Math.round(progress * (colors.length - 1)),
    0,
    colors.length - 1
  );
  return colors[index];
}

function buildRecommendation(cityKey, lat, lng, profile) {
  const poi = getNearestPoi(cityKey, lat, lng);
  const isPrimaryDemoCity = cityKey === "shanghai";

  return {
    direction: poi.direction,
    spot: poi.name,
    distance: formatDistance(poi.distanceKm),
    reason:
      isPrimaryDemoCity && profile.recommendationReason
        ? profile.recommendationReason
        : poi.reasonHint,
  };
}

function getTips(profile, fallbackHint, cityKey) {
  if (
    cityKey === "shanghai" &&
    profile.shootingTips &&
    profile.shootingTips.length > 0
  ) {
    return profile.shootingTips;
  }

  return [
    fallbackHint,
    "先拍一张宽景，再拍一张带人物或车辆的细节",
    "别在颜色最亮时频繁切镜头，先稳住一张主画面",
  ];
}

function buildPayloadFromProfile({
  profile,
  city,
  lat,
  lng,
  goldenHourStart,
  sunset,
  now,
  source,
  debug,
}) {
  const peakTime = new Date(
    sunset.getTime() + profile.peakOffsetMinutes * 60 * 1000
  );
  const endTime = new Date(
    peakTime.getTime() + profile.peakDuration * 60 * 1000
  );
  const recommendation = buildRecommendation(city.key, lat, lng, profile);

  return {
    score: profile.score,
    scoreLabel: profile.scoreLabel,
    peakTime: formatLocalTime(peakTime, city.timezone),
    peakDuration: profile.peakDuration,
    currentSkyColor: getPaletteCurrentColor(
      profile.timelineColors,
      now,
      goldenHourStart,
      endTime
    ),
    timelineColors: profile.timelineColors,
    recommendation,
    shootingTips: getTips(profile, recommendation.reason, city.key),
    meta: {
      source,
      city: city.name,
      timezone: city.timezone,
      coordinates: {
        lat,
        lng,
      },
      goldenHourStart: formatLocalTime(goldenHourStart, city.timezone),
      sunsetTime: formatLocalTime(sunset, city.timezone),
      debug,
    },
  };
}

async function fetchOpenMeteo({ lat, lng, timezone }) {
  const query = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    current: "cloud_cover,relative_humidity_2m,visibility,weather_code",
    hourly: "cloud_cover,relative_humidity_2m,visibility,weather_code",
    daily: "sunrise,sunset",
    forecast_days: "2",
    timezone,
  });

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${query}`);
  if (!response.ok) {
    throw new Error(`open_meteo_failed:${response.status}`);
  }

  return response.json();
}

async function buildLivePayload({ city, lat, lng, now }) {
  const weather = await fetchOpenMeteo({
    lat,
    lng,
    timezone: city.timezone,
  });

  const sunset = getTargetSunsetDate(weather.daily.sunset, now, city.timezone);
  const sunTimes = SunCalc.getTimes(sunset, lat, lng);
  const goldenHourStart =
    sunTimes.goldenHour || new Date(sunset.getTime() - 45 * 60 * 1000);
  const metrics = getWindowMetrics(weather.hourly, sunset, city.timezone);
  const { score, components } = calculateSunsetScore(metrics);
  const bucket = getDemoBucket(score);
  const baseProfile = DEMO_PROFILES[bucket];
  const liveProfile = {
    ...baseProfile,
    score,
    scoreLabel: getScoreLabel(score),
    peakOffsetMinutes: bucket === "high" ? 6 : bucket === "mid" ? 4 : 2,
    peakDuration: bucket === "high" ? 14 : bucket === "mid" ? 10 : 6,
  };

  return buildPayloadFromProfile({
    profile: liveProfile,
    city,
    lat,
    lng,
    goldenHourStart,
    sunset,
    now,
    source: "open-meteo-live",
    debug: {
      metrics: {
        cloudCover: Math.round(metrics.cloudCover),
        relativeHumidity: Math.round(metrics.relativeHumidity),
        visibilityKm: Number(metrics.visibilityKm.toFixed(1)),
        weatherCode: metrics.weatherCode,
      },
      components,
      bucket,
    },
  });
}

async function buildSunsetPayload(query = {}) {
  const city = getCityPreset(query.city);
  const lat = parseNumber(query.lat, city.defaultLat);
  const lng = parseNumber(query.lng, city.defaultLng);
  const now = new Date();
  const baseSunTimes = SunCalc.getTimes(now, lat, lng);
  const baseGoldenHourStart =
    baseSunTimes.goldenHour || new Date(now.getTime() + 60 * 60 * 1000);
  const baseSunset =
    baseSunTimes.sunset || new Date(now.getTime() + 90 * 60 * 1000);

  if (query.demo && DEMO_PROFILES[query.demo]) {
    return buildPayloadFromProfile({
      profile: DEMO_PROFILES[query.demo],
      city,
      lat,
      lng,
      goldenHourStart: baseGoldenHourStart,
      sunset: baseSunset,
      now,
      source: `demo-${query.demo}`,
      debug: {
        bucket: query.demo,
        fallback: false,
      },
    });
  }

  try {
    return await buildLivePayload({ city, lat, lng, now });
  } catch (error) {
    return buildPayloadFromProfile({
      profile: DEMO_PROFILES.high,
      city,
      lat,
      lng,
      goldenHourStart: baseGoldenHourStart,
      sunset: baseSunset,
      now,
      source: "fallback-demo-high",
      debug: {
        bucket: "high",
        fallback: true,
        reason: error.message,
      },
    });
  }
}

module.exports = {
  buildSunsetPayload,
};
