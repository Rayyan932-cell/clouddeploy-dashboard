const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const PORT = Number(process.env.PORT || 10000);
const ROOT = __dirname;
const MAX_LOGS = 100;
const startedAt = Date.now();
let nextId = 1;
const logs = [];

function addLog(level, message) {
  const entry = {
    id: nextId++,
    time: new Date().toISOString(),
    level,
    message
  };
  logs.unshift(entry);
  if (logs.length > MAX_LOGS) logs.length = MAX_LOGS;
  console.log(`[${entry.time}] ${level}: ${message}`);
  return entry;
}

addLog("SUCCESS", "CloudDeploy API started");
addLog("INFO", "Dashboard server initialized");

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*"
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => {
      data += chunk;
      if (data.length > 10000) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); }
      catch { reject(new Error("Invalid JSON body")); }
    });
    req.on("error", reject);
  });
}

function getRuntimeInfo() {
  const insideContainer = fs.existsSync("/.dockerenv") ||
    Boolean(process.env.KUBERNETES_SERVICE_HOST);
  return {
    app: "CloudDeploy Dashboard",
    api: "online",
    runtime: insideContainer ? "Docker container detected" : "Node.js process (container not detected)",
    containerDetected: insideContainer,
    hostname: os.hostname(),
    platform: process.platform,
    nodeVersion: process.version,
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    memory: {
      usedMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      totalMb: Math.round(os.totalmem() / 1024 / 1024)
    },
    timestamp: new Date().toISOString()
  };
}

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const route = url.pathname;

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    return res.end();
  }

  if (req.method === "GET" && route === "/api/health") {
    addLog("INFO", "Health check requested");
    return sendJson(res, 200, { ok: true, status: "healthy", ...getRuntimeInfo() });
  }

  if (req.method === "GET" && route === "/api/status") {
    return sendJson(res, 200, {
      ok: true,
      status: "online",
      ...getRuntimeInfo(),
      logCount: logs.length,
      note: "Reports this Node.js app's runtime. It does not inspect other Docker containers."
    });
  }

  if (req.method === "GET" && route === "/api/logs") {
    return sendJson(res, 200, { ok: true, count: logs.length, logs });
  }

  if (req.method === "POST" && route === "/api/logs") {
    try {
      const body = await readBody(req);
      const level = ["INFO", "SUCCESS", "WARN", "ERROR"].includes(body.level) ? body.level : "INFO";
      const message = typeof body.message === "string" ? body.message.trim().slice(0, 300) : "";
      if (!message) return sendJson(res, 400, { ok: false, error: "message is required" });
      const entry = addLog(level, message);
      return sendJson(res, 201, { ok: true, log: entry });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err.message });
    }
  }

  if (req.method === "DELETE" && route === "/api/logs") {
    logs.length = 0;
    addLog("INFO", "Activity log history cleared from dashboard");
    return sendJson(res, 200, { ok: true, message: "Logs cleared", count: logs.length });
  }

  if (req.method === "POST" && route === "/api/actions/check") {
    const info = getRuntimeInfo();
    addLog("SUCCESS", "Manual system check completed");
    return sendJson(res, 200, { ok: true, message: "System check completed", ...info });
  }

  if (req.method === "POST" && route === "/api/actions/deploy-demo") {
    addLog("WARN", "Demo deployment requested: this endpoint does not deploy to a cloud provider");
    return sendJson(res, 200, {
      ok: true,
      mode: "demo",
      message: "Demo action recorded. No cloud deployment was triggered.",
      timestamp: new Date().toISOString()
    });
  }

  if (req.method === "GET" && route.startsWith("/api/")) {
    return sendJson(res, 404, { ok: false, error: "API endpoint not found" });
  }

  let requestedPath = route === "/" ? "/index.html" : decodeURIComponent(route);
  requestedPath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  const fullPath = path.join(ROOT, requestedPath);
  if (!fullPath.startsWith(ROOT)) return sendJson(res, 403, { ok: false, error: "Forbidden" });

  fs.readFile(fullPath, (err, content) => {
    if (err) {
      addLog("WARN", `Static file not found: ${requestedPath}`);
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Not found");
    }
    res.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(fullPath)] || "application/octet-stream",
      "Cache-Control": "no-cache"
    });
    res.end(content);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  addLog("SUCCESS", `Server listening on port ${PORT}`);
});

process.on("SIGTERM", () => {
  addLog("WARN", "Server shutting down");
  server.close(() => process.exit(0));
});
