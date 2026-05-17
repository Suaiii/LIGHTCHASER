const fs = require("fs");
const http = require("http");
const path = require("path");
const zlib = require("zlib");
const { URL } = require("url");
const { buildSunsetPayload } = require("../lib/sunset-service");
const { buildRoutePayload } = require("../lib/route-service");
const babel = require("@babel/core");

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

// 可压缩的文本类资源（图片/视频已是压缩格式，再压无意义）
const COMPRESSIBLE = new Set([".html", ".js", ".jsx", ".css", ".json", ".svg", ".txt", ".map"]);

function cacheControlFor(filePath) {
  const normalized = filePath.split(path.sep).join("/");
  // 第三方库基本不变 —— 长缓存，二次访问秒开
  if (normalized.includes("/vendor/")) return "public, max-age=604800";
  // 图片/视频素材 —— 中等缓存
  if (normalized.includes("/assets/")) return "public, max-age=86400";
  // 页面与 JSX 开发中会变 —— 每次校验，不长存
  return "no-cache";
}

// JSX 服务器端预编译缓存：filePath -> { mtimeMs, code }
// 文件改动后 mtime 变化会自动失效重编译，队友改 JSX 无需手动操作
const jsxCache = new Map();

function transpileJsx(filePath, mtimeMs) {
  const cached = jsxCache.get(filePath);
  if (cached && cached.mtimeMs === mtimeMs) {
    return cached.code;
  }
  const source = fs.readFileSync(filePath, "utf8");
  const result = babel.transformSync(source, {
    filename: filePath,
    presets: [["@babel/preset-react", { runtime: "classic" }]],
    babelrc: false,
    configFile: false,
  });
  jsxCache.set(filePath, { mtimeMs, code: result.code });
  return result.code;
}

function respond(req, res, buffer, contentType, cacheControl, compressible) {
  const headers = {
    "Content-Type": contentType,
    "Cache-Control": cacheControl,
  };

  const acceptsGzip = /\bgzip\b/.test(req.headers["accept-encoding"] || "");
  if (acceptsGzip && compressible && buffer.length > 512) {
    zlib.gzip(buffer, (gzipError, gzipped) => {
      if (gzipError) {
        res.writeHead(200, headers);
        res.end(buffer);
        return;
      }
      headers["Content-Encoding"] = "gzip";
      headers["Vary"] = "Accept-Encoding";
      res.writeHead(200, headers);
      res.end(gzipped);
    });
    return;
  }

  res.writeHead(200, headers);
  res.end(buffer);
}

function sendFile(req, res, filePath) {
  const ext = path.extname(filePath).toLowerCase();

  // .jsx —— 服务器端预编译成普通 JS，浏览器无需再下载 3MB 的 Babel
  if (ext === ".jsx") {
    try {
      const mtimeMs = fs.statSync(filePath).mtimeMs;
      const code = transpileJsx(filePath, mtimeMs);
      respond(req, res, Buffer.from(code, "utf8"),
        "text/javascript; charset=utf-8", "no-cache", true);
    } catch (error) {
      res.writeHead(error.code === "ENOENT" ? 404 : 500, {
        "Content-Type": "text/plain; charset=utf-8",
      });
      res.end(error.code === "ENOENT"
        ? "Not found"
        : "JSX transpile error: " + error.message);
    }
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(error.code === "ENOENT" ? 404 : 500, {
        "Content-Type": "text/plain; charset=utf-8",
      });
      res.end(error.code === "ENOENT" ? "Not found" : "Internal server error");
      return;
    }

    respond(req, res, content,
      MIME_TYPES[ext] || "application/octet-stream",
      cacheControlFor(filePath),
      COMPRESSIBLE.has(ext));
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
