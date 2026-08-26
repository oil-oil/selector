const { readFileSync } = require("node:fs");
const { join, resolve } = require("node:path");

const assetsDirectory = resolve(__dirname, "../dist/assets");
const publicBase = "/__selector_dev__";

const assets = new Map([
  ["/loader.js", { type: "text/javascript; charset=utf-8", file: join(__dirname, "loader.js") }],
  ["/editor.js", { type: "text/javascript; charset=utf-8", file: join(assetsDirectory, "editor.js") }],
  ["/editor.css", { type: "text/css; charset=utf-8", file: join(assetsDirectory, "editor.css") }],
]);

function selectorDev() {
  return {
    name: "selector-dev",
    apply: "serve",

    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (!request.url) return next();

        const pathname = new URL(request.url, "http://selector.local").pathname;
        if (!pathname.startsWith(publicBase)) return next();

        const asset = assets.get(pathname.slice(publicBase.length));
        if (!asset) return next();

        response.statusCode = 200;
        response.setHeader("Content-Type", asset.type);
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.end(readFileSync(asset.file));
      });
    },

    transformIndexHtml() {
      return [{
        tag: "script",
        attrs: { src: `${publicBase}/loader.js`, defer: true },
        injectTo: "body",
      }];
    },
  };
}

module.exports = selectorDev;
