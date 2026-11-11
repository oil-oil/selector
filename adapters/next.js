"use strict";

const { createSelectorHandler, createNodeMiddleware, normalizePrefix, MAX_BODY_BYTES } = require("./shared");

function joinBasePrefix(basePath, prefix) {
  const cleanBase = String(basePath || "").replace(/\/+$/, "");
  const cleanPrefix = normalizePrefix(prefix || "/api/selector");
  return cleanBase ? cleanBase + cleanPrefix : cleanPrefix;
}

function isDevEnabled(options) {
  if (options && options.allowNonDev === true) return true;
  return process.env.NODE_ENV === "development";
}

function headersToPlain(headers) {
  const out = {};
  if (!headers) return out;
  if (typeof headers.forEach === "function") {
    headers.forEach((value, key) => {
      out[String(key).toLowerCase()] = value;
    });
    return out;
  }
  for (const [k, v] of Object.entries(headers)) {
    out[String(k).toLowerCase()] = v;
  }
  return out;
}

async function readWebJsonBody(request, maxBytes) {
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    const err = new Error("Payload too large");
    err.code = "BODY_TOO_LARGE";
    throw err;
  }
  return text ? JSON.parse(text) : {};
}

/**
 * Next.js App Router handler (`app/api/selector/[...slug]/route.ts`).
 * Uses `/api/selector` by default so App Router does not treat `_` folders as private.
 */
function createNextAppHandler(options = {}) {
  const mountPrefix = joinBasePrefix(options.basePath, options.prefix || "/api/selector");
  const selector = createSelectorHandler({
    root: options.root,
    prefix: mountPrefix,
    toggleShortcut: options.toggleShortcut,
    startDormant: options.startDormant,
    assetsDir: options.assetsDir,
  });

  return async function nextSelectorAppHandler(request) {
    if (!isDevEnabled(options)) {
      return new Response("Not Found", { status: 404 });
    }
    const result = await selector.handle({
      method: request.method,
      url: request.url,
      headers: headersToPlain(request.headers),
      readBody: (limit) => readWebJsonBody(request, limit || MAX_BODY_BYTES),
    });
    if (!result) {
      return new Response("Not Found", { status: 404 });
    }
    return new Response(result.body, {
      status: result.status,
      headers: result.headers,
    });
  };
}

/**
 * Next.js Pages Router handler (`pages/api/selector/[...slug].ts`).
 */
function createNextPagesHandler(options = {}) {
  const mountPrefix = joinBasePrefix(options.basePath, options.prefix || "/api/selector");
  const middleware = createNodeMiddleware({
    root: options.root,
    prefix: mountPrefix,
    toggleShortcut: options.toggleShortcut,
    startDormant: options.startDormant,
    assetsDir: options.assetsDir,
  });

  return function nextSelectorPagesHandler(req, res) {
    if (!isDevEnabled(options)) {
      res.statusCode = 404;
      res.end("Not Found");
      return;
    }
    return middleware(req, res);
  };
}

function getBootstrapSrc(options = {}) {
  const mountPrefix = joinBasePrefix(options.basePath, options.prefix || "/api/selector");
  return `${mountPrefix}/assets/bootstrap.js`;
}

module.exports = {
  createNextAppHandler,
  createNextPagesHandler,
  getBootstrapSrc,
};
