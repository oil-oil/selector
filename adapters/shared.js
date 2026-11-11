"use strict";

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");

function resolveDefaultAssetsDir() {
  const candidates = [
    path.resolve(__dirname, "..", "dist", "assets"),
    path.resolve(__dirname, "..", "runtime"),
  ];
  return candidates.find((dir) => fs.existsSync(path.join(dir, "editor.js"))) || candidates[0];
}

const DIST_ASSETS_DIR = resolveDefaultAssetsDir();
const MAX_BODY_BYTES = 1024 * 1024;
const BATCH_MARKER_LINE_RE = /^<!-- selector-batch: /;

function createBodyTooLargeError() {
  const err = new Error("Payload too large");
  err.code = "BODY_TOO_LARGE";
  return err;
}

function normalizePrefix(prefix) {
  let p = String(prefix || "/__selector").trim();
  if (!p.startsWith("/")) p = "/" + p;
  p = p.replace(/\/+$/, "");
  return p || "/__selector";
}

function normalizeRoutePath(rawUrl, prefix) {
  let pathname = "/";
  try {
    pathname = new URL(rawUrl || "/", "http://localhost").pathname;
  } catch (_) {
    pathname = String(rawUrl || "/").split("?")[0];
  }
  if (prefix && (pathname === prefix || pathname.startsWith(prefix + "/"))) {
    pathname = pathname.slice(prefix.length) || "/";
  }
  return pathname.replace(/\/+$/, "") || "/";
}

function mdFence(text) {
  let longest = 2;
  const matches = String(text || "").match(/`+/g);
  if (matches) {
    for (const m of matches) {
      if (m.length > longest) longest = m.length;
    }
  }
  return "`".repeat(longest + 1);
}

function countPendingBatches(markdown) {
  if (!markdown) return 0;
  const lines = String(markdown).split(/\r?\n/);
  let inFence = false;
  let fenceLen = 0;
  let count = 0;
  for (const line of lines) {
    const fenceMatch = line.match(/^(`{3,})(.*)$/);
    if (!inFence) {
      if (fenceMatch) {
        inFence = true;
        fenceLen = fenceMatch[1].length;
        continue;
      }
      if (BATCH_MARKER_LINE_RE.test(line)) count++;
    } else if (fenceMatch && fenceMatch[1].length >= fenceLen && !fenceMatch[2].trim()) {
      inFence = false;
      fenceLen = 0;
    }
  }
  return count;
}

function sanitizeSingleLine(value) {
  return String(value || "").replace(/[\r\n]+/g, " ").trim();
}

function formatBatchMarkdown({ prompt, url, itemCount, timestamp }, batchNumber) {
  const parsedTime = timestamp ? Date.parse(String(timestamp)) : NaN;
  const ts = Number.isFinite(parsedTime) ? new Date(parsedTime).toISOString() : new Date().toISOString();
  const timeLabel = ts.slice(11, 19) || ts;
  const safeUrl = sanitizeSingleLine(url) || "(unknown)";
  const count = Number.isFinite(Number(itemCount)) ? Number(itemCount) : 1;
  const fence = mdFence(prompt);
  return [
    `<!-- selector-batch: ${ts} -->`,
    `## UI Feedback Batch #${batchNumber} (${timeLabel})`,
    `- Page: ${safeUrl}`,
    `- Items: ${count}`,
    "",
    `${fence}text`,
    String(prompt).trimEnd(),
    fence,
    "",
  ].join("\n");
}

function buildBootstrapScript({ prefix, toggleShortcut, startDormant }) {
  const cleanPrefix = normalizePrefix(prefix);
  const devConfig = {
    endpoint: `${cleanPrefix}/feedback`,
    queueEndpoint: `${cleanPrefix}/queue`,
    toggleShortcut: toggleShortcut || "Alt+S",
    startDormant: startDormant !== false,
  };
  return [
    "(function(){",
    "  if (window.__SELECTOR_DEV_BOOTED__) return;",
    "  window.__SELECTOR_DEV_BOOTED__ = true;",
    `  window.__SELECTOR_DEV__ = ${JSON.stringify(devConfig)};`,
    "  var head = document.head || document.documentElement;",
    `  if (!document.querySelector('link[data-selector-dev-css]')) {`,
    "    var link = document.createElement('link');",
    "    link.rel = 'stylesheet';",
    `    link.href = ${JSON.stringify(`${cleanPrefix}/assets/editor.css`)};`,
    "    link.setAttribute('data-selector-dev-css', '1');",
    "    head.appendChild(link);",
    "  }",
    `  if (!document.querySelector('script[data-selector-dev-js]')) {`,
    "    var s = document.createElement('script');",
    `    s.src = ${JSON.stringify(`${cleanPrefix}/assets/editor.js`)};`,
    "    s.defer = true;",
    "    s.setAttribute('data-selector-dev-js', '1');",
    "    (document.body || head).appendChild(s);",
    "  }",
    "})();",
    "",
  ].join("\n");
}

function isLoopbackHost(host) {
  const raw = String(host || "").trim();
  if (!raw || /[\/\\?#\s]/.test(raw)) return false;
  try {
    const hostname = new URL(`http://${raw}`).hostname.toLowerCase();
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]" ||
      hostname === "::1"
    );
  } catch (_) {
    return false;
  }
}

function extractHostFromUrl(rawUrl) {
  if (!rawUrl || !/^https?:\/\//i.test(String(rawUrl))) return "";
  try {
    return new URL(String(rawUrl)).host;
  } catch (_) {
    return "";
  }
}

function isSameOriginPost(headers, url) {
  const fetchSite = String(headers["sec-fetch-site"] || "").toLowerCase();
  if (fetchSite === "cross-site") return false;
  const origin = headers["origin"];
  const effectiveHost = headers["host"] || extractHostFromUrl(url);
  if (effectiveHost && !isLoopbackHost(effectiveHost)) return false;
  if (origin) {
    if (!effectiveHost) return false;
    try {
      const originHost = new URL(origin).host;
      if (originHost !== effectiveHost || !isLoopbackHost(originHost)) return false;
    } catch (_) {
      return false;
    }
  }
  return true;
}

function jsonResponse(status, data) {
  return {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(data),
  };
}

/**
 * Create a framework-agnostic request handler for Selector dev assets and
 * the local `.tmp/selector-queue.md` workspace queue.
 */
function createSelectorHandler(options = {}) {
  const workspaceRoot = path.resolve(options.root || process.cwd());
  const prefix = normalizePrefix(options.prefix || "/__selector");
  const toggleShortcut = options.toggleShortcut || "Alt+S";
  const startDormant = options.startDormant !== false;
  const assetsDir = path.resolve(options.assetsDir || DIST_ASSETS_DIR);
  const queueRelPath = ".tmp/selector-queue.md";
  const queueAbsPath = path.join(workspaceRoot, ".tmp", "selector-queue.md");

  let queueLock = Promise.resolve();
  function withQueueLock(task) {
    const run = queueLock.then(task, task);
    queueLock = run.catch(() => {});
    return run;
  }

  async function readAsset(filename) {
    const filePath = path.join(assetsDir, filename);
    return fsp.readFile(filePath, "utf8");
  }

  async function handle({ method, url, headers = {}, readBody }) {
    const upperMethod = String(method || "GET").toUpperCase();
    const routePath = normalizeRoutePath(url, prefix);

    if (upperMethod === "GET" && routePath === "/assets/bootstrap.js") {
      return {
        status: 200,
        headers: {
          "Content-Type": "application/javascript; charset=utf-8",
          "Cache-Control": "no-store",
        },
        body: buildBootstrapScript({ prefix, toggleShortcut, startDormant }),
      };
    }

    if (upperMethod === "GET" && (routePath === "/assets/editor.js" || routePath === "/assets/editor.css")) {
      const isCss = routePath.endsWith(".css");
      const filename = isCss ? "editor.css" : "editor.js";
      try {
        const content = await readAsset(filename);
        return {
          status: 200,
          headers: {
            "Content-Type": isCss ? "text/css; charset=utf-8" : "application/javascript; charset=utf-8",
            "Cache-Control": "no-store",
          },
          body: content,
        };
      } catch (err) {
        return jsonResponse(500, {
          ok: false,
          error: `Selector asset missing (${filename}). Run 'npm run build' inside selector repo.`,
        });
      }
    }

    if (upperMethod === "GET" && routePath === "/queue") {
      return withQueueLock(async () => {
        try {
          const content = await fsp.readFile(queueAbsPath, "utf8");
          return jsonResponse(200, {
            ok: true,
            queuePath: queueRelPath,
            pendingBatches: countPendingBatches(content),
          });
        } catch (err) {
          if (err && err.code === "ENOENT") {
            return jsonResponse(200, { ok: true, queuePath: queueRelPath, pendingBatches: 0 });
          }
          throw err;
        }
      });
    }

    if (upperMethod === "DELETE" && routePath === "/queue") {
      if (!isSameOriginPost(headers, url)) {
        return jsonResponse(403, { ok: false, error: "Cross-site request rejected" });
      }
      return withQueueLock(async () => {
        await fsp.rm(queueAbsPath, { force: true });
        return jsonResponse(200, { ok: true, queuePath: queueRelPath, pendingBatches: 0 });
      });
    }

    if (upperMethod === "POST" && routePath === "/feedback") {
      if (!isSameOriginPost(headers, url)) {
        return jsonResponse(403, { ok: false, error: "Cross-site request rejected" });
      }
      const contentType = String(headers["content-type"] || "").toLowerCase();
      if (!contentType.startsWith("application/json")) {
        return jsonResponse(415, { ok: false, error: "Expected application/json" });
      }

      let payload;
      try {
        payload = await readBody(MAX_BODY_BYTES);
      } catch (err) {
        if (err && err.code === "BODY_TOO_LARGE") {
          return jsonResponse(413, { ok: false, error: "Payload exceeds 1 MB limit" });
        }
        return jsonResponse(400, { ok: false, error: "Invalid JSON body" });
      }

      const prompt = payload && typeof payload.prompt === "string" ? payload.prompt.trim() : "";
      if (!prompt) {
        return jsonResponse(400, { ok: false, error: "Missing non-empty prompt" });
      }

      return withQueueLock(async () => {
        await fsp.mkdir(path.dirname(queueAbsPath), { recursive: true });
        let existing = "";
        try {
          existing = await fsp.readFile(queueAbsPath, "utf8");
        } catch (err) {
          if (!err || err.code !== "ENOENT") throw err;
        }
        const existingCount = countPendingBatches(existing);
        const batchNumber = existingCount + 1;
        const header = existing.trim()
          ? ""
          : "# Selector Workspace UI Feedback Queue\n\n";
        const separator = existing.trim() ? "\n" : "";
        const entry = formatBatchMarkdown(payload, batchNumber);
        const nextContent = existing + separator + header + entry;
        await fsp.writeFile(queueAbsPath, nextContent, "utf8");
        return jsonResponse(200, {
          ok: true,
          queuePath: queueRelPath,
          pendingBatches: batchNumber,
        });
      });
    }

    return null;
  }

  return { handle, prefix, queueAbsPath, queueRelPath };
}

function readNodeJsonBody(req, maxBytes) {
  if (req.body !== undefined) {
    if (typeof req.body === "string") {
      if (Buffer.byteLength(req.body, "utf8") > maxBytes) {
        return Promise.reject(createBodyTooLargeError());
      }
      try {
        return Promise.resolve(req.body ? JSON.parse(req.body) : {});
      } catch (err) {
        return Promise.reject(err);
      }
    }
    if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
      return Promise.resolve(req.body);
    }
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    let settled = false;
    req.on("data", (chunk) => {
      if (settled) return;
      total += chunk.length;
      if (total > maxBytes) {
        settled = true;
        // Drain remaining request bytes without tearing down the socket so 413 can be delivered.
        req.resume();
        reject(createBodyTooLargeError());
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (settled) return;
      settled = true;
      try {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve(text ? JSON.parse(text) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    });
  });
}

function createNodeMiddleware(options = {}) {
  const selector = createSelectorHandler(options);
  return async function selectorNodeMiddleware(req, res, next) {
    try {
      const result = await selector.handle({
        method: req.method,
        url: req.url,
        headers: req.headers || {},
        readBody: (limit) => readNodeJsonBody(req, limit),
      });
      if (!result) {
        if (typeof next === "function") return next();
        res.statusCode = 404;
        res.end("Not Found");
        return;
      }
      res.statusCode = result.status;
      for (const [k, v] of Object.entries(result.headers)) {
        res.setHeader(k, v);
      }
      res.end(result.body);
    } catch (err) {
      if (typeof next === "function") return next(err);
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ ok: false, error: err && err.message ? err.message : "Internal Error" }));
    }
  };
}

module.exports = {
  createSelectorHandler,
  createNodeMiddleware,
  normalizePrefix,
  normalizeRoutePath,
  mdFence,
  countPendingBatches,
  MAX_BODY_BYTES,
};
