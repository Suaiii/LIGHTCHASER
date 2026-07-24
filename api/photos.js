// AGENT_10/HERMES-10 photos 演示端点（serverless 风格）：GET 返回垫图+live 照片列表，POST 新增内存 live 记录；本地由 scripts/dev-preview.js 等价挂载。
const { loadPhotosPayload, addLivePhoto } = require("../lib/photos-service");

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload, null, 2));
}

function readBody(req) {
  // serverless 平台可能已把 body 解析好；原生 http 则要自收流——两种形态都兜住
  if (req.body !== undefined) {
    return Promise.resolve(req.body);
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "POST") {
      let body;
      try {
        const raw = await readBody(req);
        body = typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch (error) {
        sendJson(res, 400, { error: "photos_api_invalid_body" });
        return;
      }

      try {
        sendJson(res, 201, addLivePhoto(body || {}));
      } catch (error) {
        if (error.message === "photos_api_invalid_coords") {
          sendJson(res, 400, { error: "photos_api_invalid_coords" });
          return;
        }
        throw error;
      }
      return;
    }

    sendJson(res, 200, loadPhotosPayload());
  } catch (error) {
    sendJson(res, 500, {
      error: "photos_api_failed",
      message: error.message,
    });
  }
};
