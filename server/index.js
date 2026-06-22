#!/usr/bin/env node
/**
 * Selector Server — bridges browser bookmarklet → Claude Code
 *
 * POST /send   { prompt: string }   receive prompt from bookmarklet
 * GET  /ping                        health check (bookmarklet uses this)
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.SELECTOR_PORT || 7734;
const INBOX = process.env.SELECTOR_INBOX || "/tmp/selector-msg.txt";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const server = http.createServer((req, res) => {
  // preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  // health check — bookmarklet pings this to detect if server is running
  if (req.method === "GET" && req.url === "/ping") {
    res.writeHead(200, { ...CORS, "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // receive prompt from bookmarklet
  if (req.method === "POST" && req.url === "/send") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const { prompt } = JSON.parse(body);
        if (!prompt) {
          res.writeHead(400, CORS);
          res.end(JSON.stringify({ error: "missing prompt" }));
          return;
        }

        const msg =
          "\n========== SELECTOR ==========\n" +
          prompt.trim() + "\n" +
          "==============================\n";

        // write to inbox file — foreground watcher detects this immediately
        fs.writeFileSync(INBOX, msg);
        // also print to stdout for logs
        process.stdout.write(msg);

        res.writeHead(200, { ...CORS, "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400, CORS);
        res.end(JSON.stringify({ error: "invalid JSON" }));
      }
    });
    return;
  }

  res.writeHead(404, CORS);
  res.end(JSON.stringify({ error: "not found" }));
});

server.listen(PORT, "127.0.0.1", () => {
  // skill parses this line to confirm server is ready
  process.stdout.write(`SELECTOR_READY port=${PORT}\n`);
});
