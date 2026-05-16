const fs = require("fs");
const http = require("http");
const path = require("path");
const { URL } = require("url");
const { buildSunsetPayload } = require("../lib/sunset-service");
const { buildRoutePayload } = require("../lib/route-service");

const PORT = Number(process.env.PORT || 5174);
const HOST = process.env.HOST || "127.0.0.1";
const PUBLIC_DIR = path.resolve(__dirname, "..", "public");
const INDEX_FILE = path.join(PUBLIC_DIR, "追·光.html");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".jsx": "text/babel; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload, null, 2));
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(error.code === "ENOENT" ? 404 : 500, {
        "Content-Type": "text/plain; charset=utf-8",
      });
      res.end(error.code === "ENOENT" ? "Not found" : "Internal server error");
      return;
    }

    res.writeHead(200, {
      "Content-Type": MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(content);
  });
}

function getStaticPath(pathname) {
  const normalizedPath = pathname === "/" ? "/追·光.html" : pathname;
  const decoded = decodeURIComponent(normalizedPath);
  const targetPath = path.resolve(PUBLIC_DIR, decoded.replace(/^\/+/, ""));

  if (!targetPath.startsWith(PUBLIC_DIR)) {
    return null;
  }

  return targetPath;
}

async function handleRequest(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);

  if (requestUrl.pathname === "/api/sunset") {
    const query = Object.fromEntries(requestUrl.searchParams.entries());
    try {
      const payload = await buildSunsetPayload(query);
      sendJson(res, 200, payload);
    } catch (error) {
      sendJson(res, 500, {
        error: "sunset_api_failed",
        message: error.message,
      });
    }
    return;
  }

  if (requestUrl.pathname === "/api/route") {
    const query = Object.fromEntries(requestUrl.searchParams.entries());
    try {
      const payload = await buildRoutePayload(query);
      sendJson(res, 200, payload);
    } catch (error) {
      sendJson(res, 400, {
        error: "route_api_failed",
        message: error.message,
      });
    }
    return;
  }

  const staticPath = getStaticPath(requestUrl.pathname);
  if (!staticPath) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  fs.stat(staticPath, (error, stat) => {
    if (error) {
      sendFile(res, INDEX_FILE);
      return;
    }

    sendFile(res, stat.isDirectory() ? INDEX_FILE : staticPath);
  });
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    sendJson(res, 500, {
      error: "preview_server_failed",
      message: error.message,
    });
  });
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`LIGHTCHASER preview: http://${HOST}:${PORT}/`);
    console.log(`Sunset API: http://${HOST}:${PORT}/api/sunset?city=shanghai`);
  });
}

module.exports = server;
