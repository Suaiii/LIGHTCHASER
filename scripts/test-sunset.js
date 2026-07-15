const { buildSunsetPayload } = require("../lib/sunset-service");
const { buildRoutePayload } = require("../lib/route-service");

const REQUIRED_TOP_LEVEL_FIELDS = [
  "score",
  "scoreLabel",
  "peakTime",
  "peakDuration",
  "currentSkyColor",
  "timelineColors",
  "recommendation",
  "nearbySpots",
  "shootingTips",
  "meta",
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertPayloadShape(label, payload) {
  for (const field of REQUIRED_TOP_LEVEL_FIELDS) {
    assert(payload[field] !== undefined, `${label}: missing field ${field}`);
  }

  assert(Number.isInteger(payload.score), `${label}: score must be an integer`);
  assert(payload.score >= 0 && payload.score <= 100, `${label}: score out of range`);
  assert(typeof payload.scoreLabel === "string", `${label}: scoreLabel must be a string`);
  assert(typeof payload.peakTime === "string", `${label}: peakTime must be a string`);
  assert(Number.isInteger(payload.peakDuration), `${label}: peakDuration must be an integer`);
  assert(/^#[0-9A-F]{6}$/i.test(payload.currentSkyColor), `${label}: invalid currentSkyColor`);
  assert(Array.isArray(payload.timelineColors), `${label}: timelineColors must be an array`);
  assert(payload.timelineColors.length >= 8, `${label}: timelineColors should have at least 8 colors`);
  assert(Array.isArray(payload.shootingTips), `${label}: shootingTips must be an array`);
  assert(payload.shootingTips.length === 3, `${label}: expected exactly 3 shootingTips`);
  assert(Array.isArray(payload.nearbySpots), `${label}: nearbySpots must be an array`);
  assert(payload.nearbySpots.length >= 1, `${label}: expected at least 1 nearby spot`);
  assert(typeof payload.recommendation.spot === "string", `${label}: missing recommendation.spot`);
  assert(typeof payload.recommendation.distance === "string", `${label}: missing recommendation.distance`);
  assert(typeof payload.recommendation.reason === "string", `${label}: missing recommendation.reason`);
  assert(typeof payload.recommendation.coordinates?.lat === "number", `${label}: missing recommendation.coordinates.lat`);
  assert(typeof payload.recommendation.coordinates?.lng === "number", `${label}: missing recommendation.coordinates.lng`);
  assert(typeof payload.meta.source === "string", `${label}: missing meta.source`);
  assert(typeof payload.meta.city === "string", `${label}: missing meta.city`);
  assert(typeof payload.meta.sun?.current?.azimuthDeg === "number", `${label}: missing current sun azimuth`);
  assert(typeof payload.meta.sun?.current?.altitudeDeg === "number", `${label}: missing current sun altitude`);
  assert(typeof payload.meta.sun?.peak?.azimuthDeg === "number", `${label}: missing peak sun azimuth`);
}

function assertRouteShape(label, payload) {
  assert(["osrm-foot", "fallback-straight-line"].includes(payload.source), `${label}: unexpected route source`);
  assert(Array.isArray(payload.geometry), `${label}: geometry must be an array`);
  assert(payload.geometry.length >= 2, `${label}: geometry should have at least 2 points`);
  assert(typeof payload.geometry[0].lat === "number", `${label}: geometry point missing lat`);
  assert(typeof payload.geometry[0].lng === "number", `${label}: geometry point missing lng`);
}

async function assertUntrustedRouteFallsBack() {
  const originalFetch = global.fetch;
  let attempts = 0;
  let requestHeaders;
  global.fetch = async (_url, options) => {
    attempts += 1;
    requestHeaders = options?.headers;
    return {
      ok: true,
      async json() {
        return {
          code: "Ok",
          routes: [
            {
              distance: 1000,
              duration: 60,
              geometry: { coordinates: [[113.9, 22.5], [114.0, 22.6]] },
            },
          ],
        };
      },
    };
  };

  try {
    const route = await buildRoutePayload({
      startLat: "22.5",
      startLng: "113.9",
      endLat: "22.6",
      endLng: "114.0",
    });
    assert(route.source === "fallback-straight-line", "route-untrusted: expected straight-line fallback");
    assert(route.fallbackReason === "osrm_untrusted_walking_pace", "route-untrusted: unexpected fallback reason");
    assert(attempts === 3, `route-untrusted: expected 3 attempts, got ${attempts}`);
    assert(requestHeaders?.["User-Agent"]?.includes("LIGHTCHASER"), "route-untrusted: missing project User-Agent");
  } finally {
    global.fetch = originalFetch;
  }
}

async function assertProviderFailureFallsBack() {
  const originalFetch = global.fetch;
  let attempts = 0;
  global.fetch = async () => {
    attempts += 1;
    return { ok: false, status: 500 };
  };

  try {
    const route = await buildRoutePayload({
      startLat: "22.5",
      startLng: "113.9",
      endLat: "22.6",
      endLng: "114.0",
    });
    assert(route.source === "fallback-straight-line", "route-500: expected straight-line fallback");
    assert(route.fallbackReason === "osrm_failed:500", "route-500: unexpected fallback reason");
    assert(attempts === 3, `route-500: expected 3 attempts, got ${attempts}`);
  } finally {
    global.fetch = originalFetch;
  }
}

async function main() {
  await assertUntrustedRouteFallsBack();
  await assertProviderFailureFallsBack();

  const scenarios = [
    { label: "default-shanghai", query: {}, expectedCity: "Shanghai" },
    { label: "demo-high", query: { demo: "high" } },
    {
      label: "demo-high-jinshan-gps",
      query: { demo: "high", lat: "30.7109", lng: "121.3456" },
      expectedSpotIncludes: "金山",
      forbiddenReasonTerms: ["苏州河乍浦路桥", "桥面能吃到"],
    },
    { label: "demo-mid", query: { demo: "mid" } },
    { label: "demo-low", query: { demo: "low" } },
    { label: "live-shanghai", query: { city: "shanghai" } },
    {
      label: "live-la",
      query: { city: "la" },
      forbiddenReasonTerms: ["桥面", "苏州河"],
    },
  ];

  for (const scenario of scenarios) {
    const payload = await buildSunsetPayload(scenario.query);
    assertPayloadShape(scenario.label, payload);

    if (scenario.expectedCity) {
      assert(
        payload.meta.city === scenario.expectedCity,
        `${scenario.label}: expected city ${scenario.expectedCity}, got ${payload.meta.city}`
      );
    }

    if (scenario.expectedSpotIncludes) {
      assert(
        payload.recommendation.spot.includes(scenario.expectedSpotIncludes),
        `${scenario.label}: expected spot to include ${scenario.expectedSpotIncludes}, got ${payload.recommendation.spot}`
      );
    }

    if (scenario.forbiddenReasonTerms) {
      for (const term of scenario.forbiddenReasonTerms) {
        assert(
          !payload.recommendation.reason.includes(term),
          `${scenario.label}: reason should not include ${term}`
        );
      }
    }

    console.log(`=== ${scenario.label} ===`);
    console.log(
      JSON.stringify(
        {
          score: payload.score,
          scoreLabel: payload.scoreLabel,
          peakTime: payload.peakTime,
          source: payload.meta.source,
          city: payload.meta.city,
          sun: payload.meta.sun,
          recommendation: payload.recommendation,
        },
        null,
        2
      )
    );
  }

  const route = await buildRoutePayload({
    startLat: "30.7200",
    startLng: "121.3430",
    endLat: "30.7109005",
    endLng: "121.3455949",
  });
  assertRouteShape("route-jinshan", route);
  if (route.source === "osrm-foot") {
    assert(route.geometry.length > 2, "route-jinshan: OSRM route should not be a straight two-point line");
    assert(route.distanceMeters > 200 && route.distanceMeters < 5000, "route-jinshan: distance should be plausible");
    assert(route.durationSeconds > 60 && route.durationSeconds < 1800, "route-jinshan: duration should be plausible");
    const minutesPerKilometer = route.durationSeconds / 60 / (route.distanceMeters / 1000);
    assert(
      minutesPerKilometer >= 10 && minutesPerKilometer <= 16,
      `route-jinshan: expected walking pace, got ${minutesPerKilometer.toFixed(2)} min/km`
    );
  }

  console.log("=== route-jinshan ===");
  console.log(
    JSON.stringify(
      {
        source: route.source,
        distanceMeters: route.distanceMeters,
        durationSeconds: route.durationSeconds,
        geometryPoints: route.geometry.length,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
