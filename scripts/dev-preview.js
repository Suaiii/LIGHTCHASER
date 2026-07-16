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
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".pdf": "application/pdf",
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload, null, 2));
}

function sendFile(req, res, filePath) {
  fs.stat(filePath, (error, stat) => {
    if (error) {
      res.writeHead(error.code === "ENOENT" ? 404 : 500, {
        "Content-Type": "text/plain; charset=utf-8",
      });
      res.end(error.code === "ENOENT" ? "Not found" : "Internal server error");
      return;
    }

    const contentType = MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    const range = req.headers.range?.match(/^bytes=(\d*)-(\d*)$/);
    if (range) {
      const suffixLength = !range[1] && range[2] ? Number(range[2]) : null;
      const start = suffixLength === null ? Number(range[1]) : Math.max(stat.size - suffixLength, 0);
      const end = suffixLength === null && range[2] ? Math.min(Number(range[2]), stat.size - 1) : stat.size - 1;
      if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= stat.size) {
        res.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
        res.end();
        return;
      }

      res.writeHead(206, {
        "Content-Type": contentType,
        "Content-Length": end - start + 1,
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-store",
      });
      if (req.method === "HEAD") res.end();
      else fs.createReadStream(filePath, { start, end }).pipe(res);
      return;
    }

    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": stat.size,
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
    });
    if (req.method === "HEAD") res.end();
    else fs.createReadStream(filePath).pipe(res);
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
      sendFile(req, res, INDEX_FILE);
      return;
    }

    sendFile(req, res, stat.isDirectory() ? INDEX_FILE : staticPath);
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
