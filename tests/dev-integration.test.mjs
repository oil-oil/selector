import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import selectorDev from "../dev/index.mjs";
import { addSelectorPlugin } from "../dev/install.mjs";

const require = createRequire(import.meta.url);

test("exports equivalent ESM and CommonJS Vite plugins", () => {
  const commonJsPlugin = require("../dev/index.cjs");
  assert.equal(selectorDev().name, "selector-dev");
  assert.equal(commonJsPlugin().name, "selector-dev");
});

test("runs only in Vite serve mode", () => {
  const plugin = selectorDev();
  assert.equal(plugin.apply, "serve");
});

test("injects the lightweight loader", () => {
  const tags = selectorDev().transformIndexHtml();
  assert.deepEqual(tags, [{
    tag: "script",
    attrs: { src: "/__selector_dev__/loader.js", defer: true },
    injectTo: "body",
  }]);
});

test("serves built Selector assets from the dev middleware", () => {
  let middleware;
  selectorDev().configureServer({ middlewares: { use(callback) { middleware = callback; } } });

  const headers = new Map();
  const response = {
    setHeader(name, value) { headers.set(name, value); },
    end(body) { this.body = body; },
  };

  middleware({ url: "/__selector_dev__/editor.js" }, response, () => {
    assert.fail("Selector asset unexpectedly fell through to the next middleware");
  });

  assert.equal(response.statusCode, 200);
  assert.match(headers.get("Content-Type"), /text\/javascript/);
  assert.ok(response.body.length > 1000);
});

test("patches ESM Vite configs once", () => {
  const source = "import { defineConfig } from 'vite'\n\nexport default defineConfig({\n  plugins: [],\n})\n";
  const once = addSelectorPlugin(source, "vite.config.ts");
  const twice = addSelectorPlugin(once, "vite.config.ts");

  assert.match(once, /import selectorDev from 'selector\/dev'/);
  assert.match(once, /plugins:\s*\[selectorDev\(\),/);
  assert.equal(twice, once);
});

test("patches CommonJS Vite configs", () => {
  const source = "const { defineConfig } = require('vite')\nmodule.exports = defineConfig({})\n";
  const output = addSelectorPlugin(source, "vite.config.cjs");

  assert.match(output, /const selectorDev = require\('selector\/dev'\)/);
  assert.match(output, /plugins: \[selectorDev\(\)\]/);
});
