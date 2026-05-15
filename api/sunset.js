const { buildSunsetPayload } = require("../lib/sunset-service");

module.exports = async function handler(req, res) {
  try {
    const query = req && req.query ? req.query : {};
    const payload = await buildSunsetPayload(query);

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(payload, null, 2));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify(
        {
          error: "sunset_api_failed",
          message: error.message,
        },
        null,
        2
      )
    );
  }
};
