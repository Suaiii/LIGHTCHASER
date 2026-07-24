const OSRM_BASE_URL = "https://routing.openstreetmap.de/routed-foot";
const OSRM_TIMEOUT_MS = 8000;
const OSRM_RETRIES = 2;
const OSRM_USER_AGENT = "LIGHTCHASER-HERMES-01/1.0 (github.com/Suaiii/LIGHTCHASER)";
const MIN_WALKING_MINUTES_PER_KILOMETER = 10;
const MAX_WALKING_MINUTES_PER_KILOMETER = 16;

function parseNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function assertCoordinate(name, value, min, max) {
  if (value === null || value < min || value > max) {
    throw new Error(`invalid_${name}`);
  }
}

function straightLineRoute(start, end, reason = "route_provider_unavailable") {
  return {
    source: "fallback-straight-line",
    distanceMeters: null,
    durationSeconds: null,
    geometry: [start, end],
    fallbackReason: reason,
  };
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": OSRM_USER_AGENT },
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchOsrmRouteOnce(start, end) {
  const query = new URLSearchParams({
    overview: "full",
    geometries: "geojson",
    steps: "false",
  });
  const url = `${OSRM_BASE_URL}/route/v1/foot/${start.lng},${start.lat};${end.lng},${end.lat}?${query}`;
  const response = await fetchWithTimeout(url, OSRM_TIMEOUT_MS);

  if (!response.ok) {
    throw new Error(`osrm_failed:${response.status}`);
  }

  const payload = await response.json();
  const route = payload.routes && payload.routes[0];
  const coordinates = route?.geometry?.coordinates;

  if (payload.code !== "Ok" || !Array.isArray(coordinates) || coordinates.length < 2) {
    throw new Error(`osrm_no_route:${payload.code || "unknown"}`);
  }

  const minutesPerKilometer = route.duration / 60 / (route.distance / 1000);
  if (
    !Number.isFinite(minutesPerKilometer) ||
    minutesPerKilometer < MIN_WALKING_MINUTES_PER_KILOMETER ||
    minutesPerKilometer > MAX_WALKING_MINUTES_PER_KILOMETER
  ) {
    throw new Error("osrm_untrusted_walking_pace");
  }

  return {
    source: "osrm-foot",
    distanceMeters: Math.round(route.distance),
    durationSeconds: Math.round(route.duration),
    geometry: coordinates.map(([lng, lat]) => ({ lat, lng })),
  };
}

async function fetchOsrmRoute(start, end) {
  let lastError;
  for (let attempt = 0; attempt <= OSRM_RETRIES; attempt += 1) {
    try {
      return await fetchOsrmRouteOnce(start, end);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

async function buildRoutePayload(query = {}) {
  const start = {
    lat: parseNumber(query.startLat),
    lng: parseNumber(query.startLng),
  };
  const end = {
    lat: parseNumber(query.endLat),
    lng: parseNumber(query.endLng),
  };

  assertCoordinate("startLat", start.lat, -90, 90);
  assertCoordinate("startLng", start.lng, -180, 180);
  assertCoordinate("endLat", end.lat, -90, 90);
  assertCoordinate("endLng", end.lng, -180, 180);

  try {
    return await fetchOsrmRoute(start, end);
  } catch (error) {
    return straightLineRoute(start, end, error.message);
  }
}

module.exports = {
  buildRoutePayload,
  straightLineRoute,
};
