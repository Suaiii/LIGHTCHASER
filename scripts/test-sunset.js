const { buildSunsetPayload } = require("../lib/sunset-service");

const REQUIRED_TOP_LEVEL_FIELDS = [
  "score",
  "scoreLabel",
  "peakTime",
  "peakDuration",
  "currentSkyColor",
  "timelineColors",
  "recommendation",
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

async function main() {
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
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
