const { buildSunsetPayload } = require("../lib/sunset-service");

async function main() {
  const scenarios = [
    { label: "demo-high", query: { demo: "high" } },
    { label: "demo-mid", query: { demo: "mid" } },
    { label: "demo-low", query: { demo: "low" } },
    { label: "live-shanghai", query: { city: "shanghai" } },
    { label: "live-la", query: { city: "la" } },
  ];

  for (const scenario of scenarios) {
    const payload = await buildSunsetPayload(scenario.query);
    console.log(`=== ${scenario.label} ===`);
    console.log(
      JSON.stringify(
        {
          score: payload.score,
          scoreLabel: payload.scoreLabel,
          peakTime: payload.peakTime,
          source: payload.meta.source,
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
