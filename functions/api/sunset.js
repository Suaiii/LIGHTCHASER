import sunsetService from "../../lib/sunset-service";

const { buildSunsetPayload } = sunsetService;

function getQuery(request) {
  const url = new URL(request.url);
  return Object.fromEntries(url.searchParams.entries());
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function onRequestGet({ request }) {
  try {
    const payload = await buildSunsetPayload(getQuery(request));
    return json(payload);
  } catch (error) {
    return json(
      {
        error: "sunset_api_failed",
        message: error.message,
      },
      500
    );
  }
}
