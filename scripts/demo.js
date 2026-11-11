#!/usr/bin/env node
"use strict";

const http = require("http");
const path = require("path");
const { createNodeMiddleware } = require("../adapters/shared");

const PORT = Number(process.env.PORT || 4173);
const ROOT = path.resolve(__dirname, "..");

const middleware = createNodeMiddleware({
  root: ROOT,
  prefix: "/__selector",
  toggleShortcut: "Alt+S",
  startDormant: true,
});

const DEMO_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Selector Dev Bridge Demo</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    padding: 40px 24px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    background: #faf9f5;
    color: #141413;
  }
  .container {
    max-width: 760px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .card {
    background: #f5f4ee;
    border: 1px solid #e5e0d5;
    border-radius: 14px;
    padding: 20px 24px;
    box-shadow: 0 4px 16px rgba(20, 20, 19, 0.05);
  }
  .card h1 {
    margin: 0 0 8px;
    font-size: 22px;
    color: #141413;
  }
  .card p {
    margin: 0 0 16px;
    color: #5c5a54;
    line-height: 1.6;
    font-size: 14px;
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .btn-primary {
    padding: 10px 18px;
    border-radius: 8px;
    border: none;
    background: #141413;
    color: #faf9f5;
    font-size: 17px;
    font-weight: 600;
    cursor: pointer;
    transition: background 150ms ease, transform 120ms ease;
  }
  .btn-primary:hover {
    background: #2b2a27;
  }
  .btn-secondary {
    padding: 10px 20px;
    border-radius: 10px;
    border: 1px solid #c96442;
    background: linear-gradient(135deg, #d97757 0%, #c96442 100%);
    color: #ffffff;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(217, 119, 87, 0.28);
    transition: transform 150ms ease, box-shadow 150ms ease, filter 150ms ease;
  }
  .btn-secondary:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(217, 119, 87, 0.36);
    filter: brightness(1.04);
  }
  .btn-secondary:active {
    transform: translateY(0) scale(0.98);
  }
  .badge {
    display: inline-block;
    margin-bottom: 10px;
    padding: 4px 10px;
    border-radius: 999px;
    background: rgba(217, 119, 87, 0.14);
    color: #b85332;
    font-size: 12px;
    font-weight: 600;
  }
</style>
</head>
<body>
  <div class="container">
    <div class="card">
      <span class="badge">Local Dev Demo</span>
      <h1>Selector 实时微调 &amp; 工作区投递测试页</h1>
      <p>1. 页面正常状态下可自由点击按钮，右下角有一个半透明 Selector 胶囊。<br>2. 按 <strong>Alt + S</strong>（或直接点右下角胶囊）唤醒 Selector。<br>3. 点击任意按钮/卡片，点右上角铅笔图标打开可拖动的统一编辑窗：上方写指令、下方实时微调样式。<br>4. 点「投递到工作区」，查看项目根目录 <code>.tmp/selector-queue.md</code>。</p>
      <div class="actions">
        <button class="btn-primary" id="demo-primary" onclick="this.textContent='Clicked!'">主按钮 Primary</button>
        <button class="btn-secondary" id="demo-secondary">次按钮 Secondary</button>
      </div>
    </div>
  </div>
  <script src="/__selector/assets/bootstrap.js" defer></script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  if (req.url && req.url.startsWith("/__selector")) {
    return middleware(req, res, () => {
      res.statusCode = 404;
      res.end("Not Found");
    });
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(DEMO_HTML);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Selector demo running at http://127.0.0.1:${PORT}/`);
  console.log(`Queue output file: ${path.join(ROOT, ".tmp", "selector-queue.md")}`);
});
