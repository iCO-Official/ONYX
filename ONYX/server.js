const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const relative = decoded === "/" ? "/index.html" : decoded;
  const normalized = path.normalize(relative).replace(/^(\.\.[/\\])+/, "");
  return path.join(ROOT, normalized);
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      let body = "";
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`Upstream error: ${response.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch {
          reject(new Error("Upstream JSON parse error"));
        }
      });
    }).on("error", reject);
  });
}

async function handleSoundCloudSearch(req, res) {
  try {
    const requestUrl = new URL(req.url, `http://localhost:${PORT}`);
    const term = (requestUrl.searchParams.get("term") || "").trim();
    const clientId = (requestUrl.searchParams.get("client_id") || "").trim();
    if (!term) {
      sendJson(res, 400, { error: "Missing term" });
      return;
    }
    if (!clientId) {
      sendJson(res, 400, { error: "Missing client_id" });
      return;
    }

    const encodedTerm = encodeURIComponent(term);
    const encodedClientId = encodeURIComponent(clientId);
    const upstreamUrls = [
      `https://api-v2.soundcloud.com/search/tracks?q=${encodedTerm}&client_id=${encodedClientId}&limit=20&app_version=1703331289&app_locale=en`,
      `https://api-v2.soundcloud.com/search?q=${encodedTerm}&client_id=${encodedClientId}&limit=20&facet=model&user_id=0&variant_ids=&linked_partitioning=1&app_version=1703331289&app_locale=en`,
      `https://api.soundcloud.com/tracks?client_id=${encodedClientId}&q=${encodedTerm}&limit=20`
    ];

    let lastError = null;
    for (const upstream of upstreamUrls) {
      try {
        const data = await requestJson(upstream);
        const collection = Array.isArray(data) ? data : (data.collection || []);
        sendJson(res, 200, { collection });
        return;
      } catch (error) {
        lastError = error;
      }
    }

    sendJson(res, 502, { error: "SoundCloud request failed", detail: lastError?.message || "unknown error" });
  } catch (error) {
    sendJson(res, 500, { error: "Internal server error", detail: error.message });
  }
}

async function handleDeezerSearch(req, res) {
  try {
    const requestUrl = new URL(req.url, `http://localhost:${PORT}`);
    const term = (requestUrl.searchParams.get("term") || "").trim();
    if (!term) {
      sendJson(res, 400, { error: "Missing term" });
      return;
    }
    const upstream = `https://api.deezer.com/search?q=${encodeURIComponent(term)}&limit=20`;
    const data = await requestJson(upstream);
    sendJson(res, 200, data);
  } catch (error) {
    sendJson(res, 502, { error: "Deezer request failed", detail: error.message });
  }
}

const server = http.createServer((req, res) => {
  if ((req.url || "").startsWith("/api/soundcloud/search")) {
    handleSoundCloudSearch(req, res);
    return;
  }
  if ((req.url || "").startsWith("/api/deezer/search")) {
    handleDeezerSearch(req, res);
    return;
  }

  const filePath = safePath(req.url || "/");

  fs.readFile(filePath, (error, data) => {
    if (error) {
      const fallback = path.join(ROOT, "index.html");
      fs.readFile(fallback, (fallbackError, fallbackData) => {
        if (fallbackError) {
          res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Not found");
          return;
        }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(fallbackData);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const noCacheExt = new Set([".html", ".js", ".css"]);
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": noCacheExt.has(ext) ? "no-cache, no-store, must-revalidate" : "public, max-age=3600"
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`ONYX is running on http://localhost:${PORT}`);
});
