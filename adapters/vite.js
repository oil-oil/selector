"use strict";

const { createNodeMiddleware, normalizePrefix } = require("./shared");

function joinBasePrefix(base, prefix) {
  const cleanBase = String(base || "/").replace(/\/+$/, "");
  const cleanPrefix = normalizePrefix(prefix || "/__selector");
  if (!cleanBase || cleanBase === "/") return cleanPrefix;
  return cleanBase + cleanPrefix;
}

/**
 * Vite dev-only plugin that injects Selector in dormant mode (`Alt+S` to toggle)
 * and routes workspace feedback to `.tmp/selector-queue.md`.
 */
function selectorDevPlugin(options = {}) {
  let root = options.root || process.cwd();
  let mountPrefix = normalizePrefix(options.prefix || "/__selector");

  return {
    name: "selector-dev-plugin",
    apply: "serve",
    configResolved(config) {
      if (!options.root && config.root) root = config.root;
      mountPrefix = joinBasePrefix(config.base, options.prefix || "/__selector");
    },
    configureServer(server) {
      const middleware = createNodeMiddleware({
        root,
        prefix: mountPrefix,
        toggleShortcut: options.toggleShortcut,
        startDormant: options.startDormant,
        assetsDir: options.assetsDir,
      });
      server.middlewares.use(mountPrefix, middleware);
    },
    transformIndexHtml() {
      return [
        {
          tag: "script",
          attrs: {
            src: `${mountPrefix}/assets/bootstrap.js`,
            defer: true,
          },
          injectTo: "body",
        },
      ];
    },
  };
}

module.exports = selectorDevPlugin;
module.exports.selectorDevPlugin = selectorDevPlugin;
