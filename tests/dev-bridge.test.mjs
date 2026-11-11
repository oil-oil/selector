import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import shared from "../adapters/shared.js";
import selectorDevPlugin from "../adapters/vite.mjs";
import nextAdapter from "../adapters/next.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

function findChromeBinary() {
  const candidates = [
    process.env.CHROME,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p)) || null;
}

test("build artifacts match index.html payload list", async () => {
  const distAssets = path.join(REPO_ROOT, "dist", "assets");
  assert.ok(fs.existsSync(path.join(distAssets, "editor.js")), "editor.js exists");
  assert.ok(fs.existsSync(path.join(distAssets, "editor.css")), "editor.css exists");
  for (let i = 0; i <= 7; i++) {
    const name = `payload-${String(i).padStart(2, "0")}.css`;
    assert.ok(fs.existsSync(path.join(distAssets, name)), `${name} exists`);
  }
  const indexHtml = await fsp.readFile(path.join(REPO_ROOT, "index.html"), "utf8");
  assert.ok(indexHtml.includes('"assets/payload-07.css"'), "index.html references payload-07.css");
});

test("Vite adapter serves assets, enforces security, and serializes queue writes", async () => {
  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "selector-vite-test-"));
  try {
    const plugin = selectorDevPlugin({ root: tmpDir, prefix: "/__selector" });
    assert.equal(plugin.apply, "serve");
    plugin.configResolved({ root: tmpDir, base: "/app/" });
    const htmlTags = plugin.transformIndexHtml();
    assert.equal(htmlTags[0].attrs.src, "/app/__selector/assets/bootstrap.js");

    // Mount real HTTP server using Connect-style stripped prefix
    const handler = shared.createNodeMiddleware({ root: tmpDir, prefix: "/__selector" });
    const server = http.createServer((req, res) => {
      if (req.url && req.url.startsWith("/__selector")) {
        req.url = req.url.slice("/__selector".length) || "/";
        return handler(req, res, () => {
          res.statusCode = 404;
          res.end("Not found");
        });
      }
      res.statusCode = 404;
      res.end("Not found");
    });

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      const bootRes = await fetch(`${baseUrl}/__selector/assets/bootstrap.js`);
      assert.equal(bootRes.status, 200);
      const bootJs = await bootRes.text();
      assert.ok(bootJs.includes('"/__selector/feedback"'));

      // Reject non-JSON content-type (CSRF defense)
      const badCtRes = await fetch(`${baseUrl}/__selector/feedback`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ prompt: "test" }),
      });
      assert.equal(badCtRes.status, 415);

      // Reject cross-site POST
      const crossSiteRes = await fetch(`${baseUrl}/__selector/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Sec-Fetch-Site": "cross-site",
        },
        body: JSON.stringify({ prompt: "test" }),
      });
      assert.equal(crossSiteRes.status, 403);

      // Reject DNS Rebinding (non-loopback Host/Origin even if same-origin)
      const rebindRes = await fetch(`${baseUrl}/__selector/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Host": "evil.com:5173",
          "Origin": "http://evil.com:5173",
          "Sec-Fetch-Site": "same-origin",
        },
        body: JSON.stringify({ prompt: "injected" }),
      });
      assert.equal(rebindRes.status, 403);

      // Reject mismatched loopback Origin
      const mismatchOriginRes = await fetch(`${baseUrl}/__selector/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Origin": "http://localhost:9999",
        },
        body: JSON.stringify({ prompt: "injected" }),
      });
      assert.equal(mismatchOriginRes.status, 403);

      // Reject empty prompt
      const emptyPromptRes = await fetch(`${baseUrl}/__selector/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "   " }),
      });
      assert.equal(emptyPromptRes.status, 400);

      // Reject > 1MB body
      const hugeRes = await fetch(`${baseUrl}/__selector/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "x".repeat(1024 * 1024 + 100) }),
      });
      assert.equal(hugeRes.status, 413);

      // Concurrent writes with embedded triple backticks, fake batch markers, and comment breakout timestamp
      const [r1, r2] = await Promise.all([
        fetch(`${baseUrl}/__selector/feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: "1. Button\n   html: ```btn```\n<!-- selector-batch: fake -->\n   styleDiff: padding-top: 8px -> 16px",
            url: "http://localhost:5173/\nInjectedLine",
            itemCount: 1,
            timestamp: "2026-11-11T05:00:00.000Z --> <script>alert(1)</script>",
          }),
        }),
        fetch(`${baseUrl}/__selector/feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: "2. Card\n   instruction: Make wider",
            url: "http://localhost:5173/cards",
            itemCount: 1,
            timestamp: "2026-11-11T05:00:01.000Z",
          }),
        }),
      ]);
      assert.equal(r1.status, 200);
      assert.equal(r2.status, 200);

      const qRes = await fetch(`${baseUrl}/__selector/queue`);
      const qData = await qRes.json();
      assert.equal(qData.pendingBatches, 2);

      const queueMd = await fsp.readFile(path.join(tmpDir, ".tmp", "selector-queue.md"), "utf8");
      assert.ok(queueMd.includes("## UI Feedback Batch #1"));
      assert.ok(queueMd.includes("## UI Feedback Batch #2"));
      assert.ok(queueMd.includes("````text"), "uses 4-backtick fence when prompt contains ```");
      assert.ok(!queueMd.includes("- Page: http://localhost:5173/\nInjectedLine"), "sanitizes newlines in URL");
      assert.ok(!queueMd.includes("<script>alert(1)</script>"), "rejects malformed timestamp comment breakout");

      const delRes = await fetch(`${baseUrl}/__selector/queue`, { method: "DELETE" });
      assert.equal(delRes.status, 200);
      assert.equal(fs.existsSync(path.join(tmpDir, ".tmp", "selector-queue.md")), false);
    } finally {
      server.close();
    }
  } finally {
    await fsp.rm(tmpDir, { recursive: true, force: true });
  }
});

test("Next.js App Router and Pages Router adapters enforce dev guard and handle requests", async () => {
  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "selector-next-test-"));
  const prevEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    const appHandler = nextAdapter.createNextAppHandler({ root: tmpDir, basePath: "/docs" });
    const prodRes = await appHandler(new Request("http://localhost:3000/docs/api/selector/queue"));
    assert.equal(prodRes.status, 404);

    process.env.NODE_ENV = "development";
    assert.equal(nextAdapter.getBootstrapSrc({ basePath: "/docs" }), "/docs/api/selector/assets/bootstrap.js");

    const postReq = new Request("http://localhost:3000/docs/api/selector/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "1. Title\n   styleDiff: font-size: 16px -> 20px", url: "http://localhost:3000/docs", itemCount: 1 }),
    });
    const postRes = await appHandler(postReq);
    assert.equal(postRes.status, 200);
    const postJson = await postRes.json();
    assert.equal(postJson.pendingBatches, 1);

    // Pages router with pre-parsed req.body
    const pagesHandler = nextAdapter.createNextPagesHandler({ root: tmpDir });
    const fakeRes = {
      statusCode: 0,
      headers: {},
      body: "",
      setHeader(k, v) { this.headers[k] = v; },
      end(b) { this.body = b; },
    };
    await pagesHandler(
      {
        method: "POST",
        url: "/api/selector/feedback",
        headers: { "content-type": "application/json", host: "[::1]:3000", origin: "http://[::1]:3000" },
        body: { prompt: "2. Footer\n   instruction: Align center", url: "http://localhost:3000", itemCount: 1 },
      },
      fakeRes,
    );
    assert.equal(fakeRes.statusCode, 200);
    assert.equal(JSON.parse(fakeRes.body).pendingBatches, 2);

    // Pages router pre-parsed string req.body exceeding 1MB limit
    const hugeFakeRes = {
      statusCode: 0,
      headers: {},
      body: "",
      setHeader(k, v) { this.headers[k] = v; },
      end(b) { this.body = b; },
    };
    await pagesHandler(
      {
        method: "POST",
        url: "/api/selector/feedback",
        headers: { "content-type": "application/json", host: "localhost:3000" },
        body: JSON.stringify({ prompt: "x".repeat(1024 * 1024 + 50) }),
      },
      hugeFakeRes,
    );
    assert.equal(hugeFakeRes.statusCode, 413);
  } finally {
    process.env.NODE_ENV = prevEnv;
    await fsp.rm(tmpDir, { recursive: true, force: true });
  }
});

test("Real browser E2E: dormant Alt+S wake, live visual tweak, styleDiff export, and Send revert", async (t) => {
  const chromePath = findChromeBinary();
  if (!chromePath) {
    t.skip("No Chrome/Edge binary found on host");
    return;
  }

  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "selector-e2e-"));
  const chromeProfile = path.join(tmpDir, "chrome-profile");
  await fsp.mkdir(chromeProfile, { recursive: true });

  const handler = shared.createNodeMiddleware({ root: tmpDir, prefix: "/__selector" });
  const server = http.createServer((req, res) => {
    if (req.url && req.url.startsWith("/__selector")) {
      return handler(req, res, () => { res.statusCode = 404; res.end("Not found"); });
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(`<!DOCTYPE html>
      <html>
      <head><title>Selector E2E</title></head>
      <body style="margin:0;padding:40px;font-family:sans-serif">
        <button id="hero-btn" style="padding: 8px 16px; font-size: 14px; color: rgb(17, 24, 39); background-color: rgb(243, 244, 246);">Click Me</button>
        <script src="/__selector/assets/bootstrap.js" defer></script>
      </body>
      </html>`);
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const pageUrl = `http://127.0.0.1:${port}/`;

  const chrome = spawn(chromePath, [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${chromeProfile}`,
    "--remote-debugging-port=0",
    "about:blank",
  ], { stdio: ["ignore", "pipe", "pipe"] });

  let ws = null;
  try {
    const wsUrl = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Chrome DevTools timeout")), 10000);
      let stderr = "";
      chrome.stderr.on("data", (chunk) => {
        stderr += chunk.toString("utf8");
        const m = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
        if (m) {
          clearTimeout(timeout);
          resolve(m[1]);
        }
      });
      chrome.on("exit", (code) => {
        clearTimeout(timeout);
        reject(new Error(`Chrome exited early (${code}): ${stderr}`));
      });
    });

    const listRes = await fetch(wsUrl.replace(/^ws:/, "http:").replace(/\/devtools\/browser\/.*$/, "/json/list"));
    const targets = await listRes.json();
    const pageTarget = targets.find((tg) => tg.type === "page") || targets[0];
    assert.ok(pageTarget && pageTarget.webSocketDebuggerUrl, "CDP page target found");

    ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", reject, { once: true });
    });

    let msgId = 0;
    const cdp = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++msgId;
      const onMsg = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.id === id) {
          ws.removeEventListener("message", onMsg);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result);
        }
      };
      ws.addEventListener("message", onMsg);
      ws.send(JSON.stringify({ id, method, params }));
    });

    const evalJs = async (expression) => {
      const res = await cdp("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      if (res.exceptionDetails) {
        throw new Error(res.exceptionDetails.text || JSON.stringify(res.exceptionDetails));
      }
      return res.result ? res.result.value : undefined;
    };

    await cdp("Page.enable");
    await cdp("Page.navigate", { url: pageUrl });

    // Wait for Selector dormant pill
    for (let i = 0; i < 40; i++) {
      const ready = await evalJs("!!document.querySelector('.ai-editor-dev-pill')");
      if (ready) break;
      await new Promise((r) => setTimeout(r, 100));
    }

    // 1. Verify dormant mode does not mutate data-ai-id onto host DOM
    const dormantCheck = await evalJs(`(() => {
      const btn = document.getElementById('hero-btn');
      const pill = document.querySelector('.ai-editor-dev-pill');
      const host = document.querySelector('.ai-editor-layer-host');
      return {
        hasAiIdWhileDormant: btn.hasAttribute('data-ai-id'),
        isDormantClass: host.classList.contains('ai-editor-dormant'),
        pillVisible: !!pill && getComputedStyle(pill).display !== 'none',
      };
    })()`);
    assert.equal(dormantCheck.hasAiIdWhileDormant, false);
    assert.equal(dormantCheck.isDormantClass, true);
    assert.equal(dormantCheck.pillVisible, true);

    // 2. Wake with Alt+S
    await evalJs(`(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', code: 'KeyS', altKey: true, bubbles: true, cancelable: true }));
    })()`);

    const awakeCheck = await evalJs(`(() => {
      const btn = document.getElementById('hero-btn');
      const host = document.querySelector('.ai-editor-layer-host');
      return {
        hasAiIdAfterWake: btn.hasAttribute('data-ai-id'),
        isDormantClass: host.classList.contains('ai-editor-dormant'),
        hasSendBtn: !!document.querySelector('.ai-editor-send-btn'),
      };
    })()`);
    assert.equal(awakeCheck.hasAiIdAfterWake, true);
    assert.equal(awakeCheck.isDormantClass, false);
    assert.equal(awakeCheck.hasSendBtn, true);

    // 3. Click #hero-btn, open single unified popover, drag it, and edit padding-top & font-size
    await evalJs(`(() => {
      const btn = document.getElementById('hero-btn');
      const r = btn.getBoundingClientRect();
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: r.left + 10, clientY: r.top + 10 }));
    })()`);

    const popoverDragCheck = await evalJs(`(() => {
      const annotateBtn = document.querySelector('.ai-editor-annotate-btn:not(.ai-editor-markdown-btn)');
      annotateBtn.click();
      const pop = document.querySelector('.ai-editor-annotate-popover');
      const hdr = document.querySelector('.ai-editor-popover-header');
      const hasNote = !!document.querySelector('.ai-editor-annotate-input');
      const hasTweak = !!document.querySelector('.ai-editor-tweak-panel');
      const hasTabs = !!document.querySelector('.ai-editor-popover-tabs');
      const beforeLeft = parseFloat(pop.style.left);
      const beforeTop = parseFloat(pop.style.top);
      const hr = hdr.getBoundingClientRect();
      hdr.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: hr.left + 20, clientY: hr.top + 10 }));
      document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: hr.left + 80, clientY: hr.top + 50 }));
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: hr.left + 80, clientY: hr.top + 50 }));
      return {
        hasNote,
        hasTweak,
        hasTabs,
        dx: parseFloat(pop.style.left) - beforeLeft,
        dy: parseFloat(pop.style.top) - beforeTop,
      };
    })()`);
    assert.equal(popoverDragCheck.hasNote, true);
    assert.equal(popoverDragCheck.hasTweak, true);
    assert.equal(popoverDragCheck.hasTabs, false);
    assert.equal(popoverDragCheck.dx, 60);
    assert.equal(popoverDragCheck.dy, 40);

    const liveStyleCheck = await evalJs(`(() => {
      const btn = document.getElementById('hero-btn');
      const quadInputs = document.querySelectorAll('.ai-editor-quad-grid .ai-editor-tweak-num');
      quadInputs[0].value = '24';
      quadInputs[0].dispatchEvent(new Event('input', { bubbles: true }));
      const fontSizeInput = document.querySelectorAll('.ai-editor-tweak-num-sm')[1];
      fontSizeInput.value = '18';
      fontSizeInput.dispatchEvent(new Event('input', { bubbles: true }));
      const cs = getComputedStyle(btn);
      return {
        paddingTop: cs.paddingTop,
        fontSize: cs.fontSize,
      };
    })()`);
    assert.equal(liveStyleCheck.paddingTop, "24px");
    assert.equal(liveStyleCheck.fontSize, "18px");

    // 3b. Same-page hash/query pushState should preserve active selection & tweaks when DOM stays connected
    const hashNavCheck = await evalJs(`(async () => {
      history.pushState(null, '', '#tab=preview');
      await new Promise(r => setTimeout(r, 30));
      const cs = getComputedStyle(document.getElementById('hero-btn'));
      return {
        paddingTop: cs.paddingTop,
        hasSelectionOverlay: !!document.querySelector('.ai-editor-sel-box'),
      };
    })()`);
    assert.equal(hashNavCheck.paddingTop, "24px");
    assert.equal(hashNavCheck.hasSelectionOverlay, true);

    // 4. Type note directly in the same popover, click Done, then click Send to Workspace
    await evalJs(`(() => {
      const ta = document.querySelector('.ai-editor-annotate-input');
      ta.value = 'Make button taller';
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('.ai-editor-annotate-done').click();
      document.querySelector('.ai-editor-send-btn').click();
    })()`);

    // Wait for fetch + DOM revert
    for (let i = 0; i < 30; i++) {
      if (fs.existsSync(path.join(tmpDir, ".tmp", "selector-queue.md"))) break;
      await new Promise((r) => setTimeout(r, 100));
    }

    const queueText = await fsp.readFile(path.join(tmpDir, ".tmp", "selector-queue.md"), "utf8");
    assert.ok(queueText.includes("styleDiff: padding-top: 8px -> 24px; font-size: 14px -> 18px"));
    assert.ok(queueText.includes("instruction: Make button taller"));

    // Verify inline preview styles were cleanly reverted back to original inline shorthand!
    const afterSendStyle = await evalJs(`(() => {
      const btn = document.getElementById('hero-btn');
      const cs = getComputedStyle(btn);
      return {
        paddingTop: cs.paddingTop,
        fontSize: cs.fontSize,
        cssText: btn.style.cssText,
      };
    })()`);
    assert.equal(afterSendStyle.paddingTop, "8px");
    assert.equal(afterSendStyle.fontSize, "14px");
    assert.ok(afterSendStyle.cssText.includes("8px 16px"), "restored original inline shorthand");
  } finally {
    if (ws) { try { ws.close(); } catch (_) {} }
    if (chrome.exitCode === null) {
      const closed = new Promise((resolve) => chrome.once("close", resolve));
      try { chrome.kill("SIGKILL"); } catch (_) {}
      await Promise.race([closed, new Promise((r) => setTimeout(r, 2000))]);
    }
    server.close();
    await fsp.rm(tmpDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});
