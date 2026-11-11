const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
const distAssets = path.join(dist, "assets");

const editorParts = [
  "core.js",
  "tweak.js",
  "selection.js",
  "ui.js",
  "export.js",
  "prompt.js",
];

const editorPayloadParts = [
  ...editorParts.map((file, index) => ({
    output: `payload-${String(index).padStart(2, "0")}.css`,
    source: path.join("src", file),
  })),
  { output: "payload-06.css", source: path.join("src", "sharingan.js"), stripHeader: true },
  { output: "payload-07.css", source: path.join("src", "context.js") },
];

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(from, to) {
  ensureDir(path.dirname(to));
  fs.copyFileSync(from, to);
}

function copyDir(from, to, skip) {
  ensureDir(to);
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    const rel = path.relative(root, source);
    if (skip && skip(rel)) continue;
    if (entry.isDirectory()) copyDir(source, target, skip);
    else if (entry.isFile()) copyFile(source, target);
  }
}

function stripSharinganHeader(source) {
  return source.replace(/^\s*\/\*\*[\s\S]*?\*\/\s*/, "");
}

function buildEditor() {
  const assembled = [];
  for (const part of editorPayloadParts) {
    const source = part.stripHeader ? stripSharinganHeader(read(part.source)) : read(part.source);
    const output = source.trim() + "\n\n";
    if (output.includes("__SHARINGAN_MODULE__")) {
      throw new Error(`Unreplaced Sharingan marker in ${part.source}`);
    }
    assembled.push(output);
    fs.writeFileSync(path.join(distAssets, part.output), Buffer.from(output, "utf8").toString("base64"));
  }
  // Parse the exact assembled payload during every build. The deployed files
  // are base64-encoded static assets, but the decoded bookmarklet must remain
  // valid JavaScript.
  const joined = assembled.join("");
  new Function(joined);
  // Flat editor.js for Selector Pro (vendors this file into dist/vendor/core.js).
  fs.writeFileSync(path.join(distAssets, "editor.js"), joined);
}

function build() {
  fs.rmSync(dist, { recursive: true, force: true });
  ensureDir(distAssets);
  copyFile(path.join(root, "index.html"), path.join(dist, "index.html"));
  copyFile(path.join(root, "assets", "editor.css"), path.join(distAssets, "editor.css"));
  for (const file of ["favicon-96.png", "apple-touch-icon.png"]) {
    copyFile(path.join(root, "assets", file), path.join(distAssets, file));
  }
  copyDir(path.join(root, "assets", "product-hunt"), path.join(distAssets, "product-hunt"));
  buildEditor();
}

build();
