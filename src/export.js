  // ── Copy feedback ───────────────────────────────────────────
  let copyTimer=null;
  let copyRequestToken = 0;
  function showCopyFeedback(msg, isError, detail) {
    const btn=chatPanel.querySelector(`.${NS}-copy-btn`);
    if (!btn) return;
    if (copyTimer) clearTimeout(copyTimer);
    btn.classList.remove(`${NS}-copy-error`);
    btn.classList.add(`${NS}-copy-done`);
    if (isError) btn.classList.add(`${NS}-copy-error`);
    btn.style.setProperty("color", "#fff", "important");
    btn.style.setProperty("-webkit-text-fill-color", "#fff", "important");
    btn.style.setProperty("opacity", "1", "important");
    btn.title = detail || msg;
    btn.setAttribute("aria-label", detail || msg);
    btn.innerHTML = settings.sharingan
      ? `${SHARINGAN_ICON}<span>${msg}</span>`
      : `${isError ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v5"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="9"/></svg>' : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>'} <span style="color:#fff!important;-webkit-text-fill-color:#fff!important">${msg}</span>`;
    copyTimer = setTimeout(() => {
      btn.classList.remove(`${NS}-copy-done`, `${NS}-copy-error`);
      btn.title = "";
      btn.removeAttribute("aria-label");
      btn.style.removeProperty("color");
      btn.style.removeProperty("-webkit-text-fill-color");
      btn.style.removeProperty("opacity");
      setCopyButtonIdle(btn);
      copyTimer = null;
    }, 2000);
  }
  function showCopyCaptureError(code, err) {
    const key = screenshotErrorKey(code);
    const detail = err ? `${err.name || "Error"}: ${err.message || String(err)}` : "";
    if (err) console.warn(`[Selector] ${t(key)}`, err);
    showCopyFeedback(t(key), true, detail);
  }
  function showClipboardFeedback(result, token, successKey) {
    if (token !== copyRequestToken) return;
    if (result === "clipboard") showCopyFeedback(t(successKey || "copied"));
    else if (result === "fallback") showCopyFeedback(t("copiedFallback"));
    else showCopyFeedback(t("copyFailed"), true);
  }
  async function copyPrompt() {
    const requestToken = ++copyRequestToken;
    // While a result panel is open, Copy copies that panel's text until closed.
    if (pendingGenPrompt) {
      const result = await writeToClipboard(pendingGenPrompt);
      showClipboardFeedback(result, requestToken);
      return;
    }
    // ── License gate (HOST_CONTRACT.md §1.2) ──────────────────
    // Bookmarklet has no HOST.licensing → skipped entirely. The extension may
    // require an active license before copying; if so, prompt activation.
    if (HOST.licensing && HOST.licensing.required && !HOST.licensing.active) {
      HOST.requestActivation && HOST.requestActivation("copy");
      if (requestToken === copyRequestToken) showCopyFeedback(t("needLicense"), true);
      return;
    }
    // ── Alternate copy formats (HOST_CONTRACT.md §1.5) ────────
    // Bookmarklet settings never carry copyFormat → fmt is undefined → skipped.
    // The extension (Pro) can produce Markdown / JSON / component code.
    const fmt = settings.copyFormat;
    if (fmt && fmt !== "prompt" && HOST.buildCopyPayload) {
      try {
        const payload = await HOST.buildCopyPayload(fmt, {
          elements: selectedElements,
          lang,
          buildPromptText,
          buildSharinganReport,
        });
        if (payload) {
          const result = await writeToClipboard(payload.text);
          if (payload.download && payload.download.content) {
            downloadMarkdown(payload.download.content, payload.download.filename);
          }
          showClipboardFeedback(result, requestToken);
          return;
        }
      } catch (_) { /* fall through to existing logic */ }
    }
    // ── Pre-warm cross-origin assets (HOST_CONTRACT.md §1.4) ──
    // The Sharingan pipeline is synchronous; the extension fetches cross-origin
    // images (which the same-origin canvas path can't read) into a sync cache
    // here, BEFORE buildSharinganReport() runs. Bookmarklet has no HOST.prepareAssets
    // → skipped. Respects the live inlineCrossOrigin toggle when the extension
    // surfaces it; absent on the bookmarklet so the guard is a no-op there.
    if (settings.sharingan && settings.inlineCrossOrigin !== false && HOST.prepareAssets) {
      try { await HOST.prepareAssets(selectedElements); } catch (_) {}
    }
    // ── Pre-warm cross-origin CSS + @font-face (HOST_CONTRACT.md §11) ──
    // Same async-prepare / sync-read pattern as prepareAssets: fetch cross-origin
    // stylesheet text + font binaries into a sync cache before the synchronous
    // Sharingan pipeline runs. Bookmarklet has no HOST.prepareStyles → skipped.
    if (settings.sharingan && HOST.prepareStyles) {
      try { await HOST.prepareStyles(selectedElements); } catch (_) {}
    }
    const text = settings.sharingan ? buildSharinganReport() : buildPromptText(); if (!text) return;
    if (settings.combined) {
      if (settings.sharingan && text.length > SHARINGAN_CLIPBOARD_CHAR_LIMIT) {
        const filename = sharinganFilename();
        const realPath = await saveMarkdownFile(text, filename);
        const promptText = appendSharinganDownloadReference(buildPromptText(), filename, text.length, realPath);
        if (requestToken === copyRequestToken) await captureScreenshot({ text: promptText, feedbackTarget: "copy", copyRequestToken: requestToken, downloadImage: true });
        return;
      }
      if (requestToken === copyRequestToken) await captureScreenshot({ text, feedbackTarget: "copy", copyRequestToken: requestToken, downloadImage: true });
      return;
    }
    if (settings.sharingan && text.length > SHARINGAN_CLIPBOARD_CHAR_LIMIT) {
      const filename = sharinganFilename();
      const realPath = await saveMarkdownFile(text, filename);
      const fallback = appendSharinganDownloadReference(buildPromptText(), filename, text.length, realPath);
      const result = await writeToClipboard(fallback);
      showClipboardFeedback(result, requestToken, "exported");
      return;
    }
    const result = await writeToClipboard(text);
    showClipboardFeedback(result, requestToken);
  }

  // ── ⌘M — copy as Markdown ──────────────────────────────────
  const MARKDOWN_BLOCK_TAGS = new Set(["address","article","aside","blockquote","dd","details","div","dl","dt","figcaption","figure","footer","form","h1","h2","h3","h4","h5","h6","header","hr","li","main","nav","ol","p","pre","section","table","ul"]);

  function mdCollapse(s) { return String(s || "").replace(/[\t\n\r ]+/g, " "); }
  // Position-sensitive escaping: inline-anywhere metas everywhere, line-leading
  // constructs (#, >, lists) only at the node start — escaping every ".-()!"
  // drowned prose in noise ("e\.g\.") without adding safety.
  function mdEscape(s) {
    return String(s || "")
      .replace(/([\\`*_\[\]<])/g, "\\$1")
      .replace(/~~/g, "\\~~")
      .replace(/^(\s*)(#{1,6})(\s|$)/, "$1\\$2$3")
      .replace(/^(\s*)>/, "$1\\>")
      .replace(/^(\s*)([-+])(\s)/, "$1\\$2$3")
      .replace(/^(\s*)(\d+)\.(\s)/, "$1$2\\.$3");
  }
  function mdEscapeCell(s) { return String(s || "").replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\n+/g, "<br>"); }
  function mdResolve(raw, el) {
    if (!raw) return "";
    try { return new URL(raw, (el && el.baseURI) || location.href).href; } catch (_) { return raw; }
  }
  function mdDest(url) {
    if (!url) return "";
    if (!/[ ()\x00-\x1F\x7F]/.test(url)) return url;
    if (/[\x00-\x1F\x7F]/.test(url)) { try { return encodeURI(url); } catch (_) {} }
    return "<" + url.replace(/([<>\\])/g, "\\$1") + ">";
  }
  function mdHidden(el) {
    if (!el || el.nodeType !== 1) return true;
    const tag = el.tagName.toLowerCase();
    if (/^(script|style|noscript|template|link|meta|head)$/.test(tag)) return true;
    if (isEditorElement(el) || el.hidden || el.getAttribute("aria-hidden") === "true") return true;
    try {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || cs.visibility === "collapse") return true;
    } catch (_) {}
    return false;
  }
  function mdTopLevel(elements) {
    return elements.filter((el, i, arr) => el && el.nodeType === 1 && !arr.some((other, j) => j !== i && other && other.nodeType === 1 && other.contains(el)));
  }
  function mdImgSrc(img) {
    if (img.currentSrc) return img.currentSrc;
    const srcset = img.getAttribute("srcset");
    if (srcset) {
      const first = srcset.split(",")[0].trim().split(/\s+/)[0];
      if (first) return mdResolve(first, img);
    }
    return img.src || mdResolve(img.getAttribute("src"), img);
  }
  function mdInlineChildren(el) { return Array.from(el.childNodes).map(mdInlineNode).join(""); }
  function mdInlineNode(node) {
    if (node.nodeType === 3) return mdEscape(mdCollapse(node.nodeValue));
    if (node.nodeType !== 1 || mdHidden(node)) return "";
    const tag = node.tagName.toLowerCase();
    if (tag === "br") return "  \n";
    if (tag === "strong" || tag === "b") { const s = mdInlineChildren(node).trim(); return s ? `**${s}**` : ""; }
    if (tag === "em" || tag === "i") { const s = mdInlineChildren(node).trim(); return s ? `*${s}*` : ""; }
    if (tag === "del" || tag === "s" || tag === "strike") { const s = mdInlineChildren(node).trim(); return s ? `~~${s}~~` : ""; }
    if (tag === "code" && !(node.parentElement && node.parentElement.tagName && node.parentElement.tagName.toLowerCase() === "pre")) {
      const raw = node.textContent || "";
      if (!raw) return "";
      const longest = Math.max(0, ...((raw.match(/`+/g) || []).map(run => run.length)));
      const ticks = "`".repeat(Math.max(1, longest + 1));
      const pad = /^`|`$/.test(raw) || ticks.length > 1 ? " " : "";
      return ticks + pad + raw + pad + ticks;
    }
    if (tag === "a") {
      let text = mdInlineChildren(node).trim();
      const href = node.getAttribute("href");
      const url = /^(?:javascript:|mailto:|tel:|#)/i.test(href || "") ? href : (node.href || mdResolve(href, node));
      if (!url) return text;
      if (!text) text = url;
      return `[${text}](${mdDest(url)})`;
    }
    if (tag === "img") {
      const src = mdImgSrc(node);
      if (!src) return "";
      const alt = (node.getAttribute("alt") || "").replace(/[\[\]]/g, "");
      return `![${alt}](${mdDest(src)})`;
    }
    return mdInlineChildren(node);
  }
  function mdFence(code) {
    const longest = Math.max(0, ...((code.match(/`+/g) || []).map(run => run.length)));
    return "`".repeat(Math.max(3, longest + 1));
  }
  function mdPreText(root) {
    let out = "";
    const gutter = /(?:^|\s)(?:line-numbers?(?:-rows)?|line-?number|linenos?|hljs-ln-numbers?|gutter)(?:\s|$)/i;
    (function walk(node) {
      for (const ch of Array.from(node.childNodes)) {
        if (ch.nodeType === 3) { out += ch.nodeValue; continue; }
        if (ch.nodeType !== 1) continue;
        if (ch.tagName.toLowerCase() === "br") { out += "\n"; continue; }
        if (gutter.test(typeof ch.className === "string" ? ch.className : "") || ch.hidden || ch.getAttribute("aria-hidden") === "true") continue;
        walk(ch);
      }
    })(root);
    return out;
  }
  function mdCodeLang(el) {
    const probes = [el, el.querySelector && el.querySelector("code")].filter(Boolean);
    for (const node of probes) {
      const classes = String(node.className || "").split(/\s+/);
      for (const c of classes) {
        const m = c.match(/^(?:language|lang|highlight-source)-?([a-z0-9#+]+)$/i);
        if (m) return m[1].toLowerCase();
      }
    }
    return "";
  }
  function mdBlock(el) {
    if (!el || mdHidden(el)) return "";
    const tag = el.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) {
      const text = mdInlineChildren(el).replace(/\n+/g, " ").trim();
      return text ? "#".repeat(Number(tag[1])) + " " + text : "";
    }
    if (tag === "hr") return "---";
    if (tag === "pre") {
      const codeEl = el.querySelector("code");
      // textContent flattens <br>-separated code onto one line and includes
      // highlighter line-number gutters — walk instead.
      const code = mdPreText(codeEl || el).replace(/\r\n?/g, "\n").replace(/^\n|\n[ \t]*$/g, "");
      const fence = mdFence(code);
      return fence + mdCodeLang(el) + "\n" + code + "\n" + fence;
    }
    if (tag === "blockquote") {
      const inner = mdFlow(el);
      return inner ? inner.split("\n").map(line => line ? "> " + line : ">").join("\n") : "";
    }
    if (tag === "ul" || tag === "ol") return mdList(el, tag === "ol", 0);
    if (tag === "table") return mdTable(el);
    if (tag === "img" || tag === "a") return mdInlineNode(el).trim();
    return mdFlow(el);
  }
  function mdFlow(el) {
    const blocks = [];
    let inline = "";
    const flush = () => {
      const s = inline.replace(/[ \t]+\n/g, "\n").trim();
      if (s) blocks.push(s);
      inline = "";
    };
    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType === 3) { inline += mdEscape(mdCollapse(node.nodeValue)); continue; }
      if (node.nodeType !== 1 || mdHidden(node)) continue;
      const tag = node.tagName.toLowerCase();
      if (MARKDOWN_BLOCK_TAGS.has(tag)) { flush(); const b = mdBlock(node); if (b) blocks.push(b); }
      else inline += mdInlineNode(node);
    }
    flush();
    return blocks.join("\n\n");
  }
  function mdList(list, ordered, depth) {
    const lines = [];
    let index = ordered ? (parseInt(list.getAttribute("start"), 10) || 1) : 1;
    for (const li of Array.from(list.children)) {
      if (!li || li.tagName.toLowerCase() !== "li" || mdHidden(li)) continue;
      const marker = ordered ? `${index++}. ` : "- ";
      const nested = [];
      const lead = [];
      let inline = "";
      for (const node of Array.from(li.childNodes)) {
        if (node.nodeType === 3) { inline += mdEscape(mdCollapse(node.nodeValue)); continue; }
        if (node.nodeType !== 1 || mdHidden(node)) continue;
        const tag = node.tagName.toLowerCase();
        if (tag === "ul" || tag === "ol") { if (inline.trim()) { lead.push(inline.trim()); inline = ""; } nested.push(mdList(node, tag === "ol", depth + 1)); }
        else if (MARKDOWN_BLOCK_TAGS.has(tag)) { if (inline.trim()) { lead.push(inline.trim()); inline = ""; } const b = mdBlock(node); if (b) lead.push(b); }
        else inline += mdInlineNode(node);
      }
      if (inline.trim()) lead.push(inline.trim());
      const indent = "  ".repeat(depth);
      const body = lead.join("\n\n") || "";
      lines.push(indent + marker + body.replace(/\n/g, "\n" + indent + "  "));
      nested.filter(Boolean).forEach(n => lines.push(n));
    }
    return lines.join("\n");
  }
  function mdTable(table) {
    const rows = Array.from(table.querySelectorAll("tr")).filter(row => !mdHidden(row));
    if (!rows.length) return "";
    // carry[col] = how many following rows are still covered by a rowspan cell
    // opened above; without it every row under a colspan/rowspan shifts left.
    const carry = [];
    const matrix = rows.map(row => {
      const out = [];
      let col = 0;
      const fillCarried = () => { while (carry[col] > 0) { carry[col] -= 1; out[col] = ""; col += 1; } };
      for (const cell of Array.from(row.children)) {
        if (!/^(td|th)$/i.test(cell.tagName) || mdHidden(cell)) continue;
        fillCarried();
        const text = mdEscapeCell(mdFlow(cell) || mdInlineChildren(cell)).trim();
        const span = parseInt(cell.getAttribute("colspan"), 10) || 1;
        const rspan = parseInt(cell.getAttribute("rowspan"), 10) || 1;
        for (let s = 0; s < span; s++) {
          out[col] = text;
          if (rspan > 1) carry[col] = (carry[col] || 0) + (rspan - 1);
          col += 1;
        }
      }
      fillCarried();
      for (let i = 0; i < out.length; i++) if (out[i] === undefined) out[i] = "";
      return out;
    });
    const width = Math.max(1, ...matrix.map(row => row.length));
    matrix.forEach(row => { while (row.length < width) row.push(""); });
    const header = matrix[0];
    const body = matrix.slice(1);
    return [`| ${header.join(" | ")} |`, `| ${Array(width).fill("---").join(" | ")} |`, ...body.map(row => `| ${row.join(" | ")} |`)].join("\n");
  }
  function localMarkdownPayload(elements) {
    const top = mdTopLevel(elements || []);
    const text = top.map(mdBlock).filter(Boolean).join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
    return text ? { text } : null;
  }

  // Press ⌘M to preview clean Markdown in the result panel. It uses the current
  // selection when there is one, otherwise the page's main readable content
  // (article/main/body). Press ⌘C while the panel is open to copy the Markdown.
  async function copyAsMarkdown(targetElements) {
    // ── License gate (HOST_CONTRACT.md §1.2) ──────────────────
    // Bookmarklet has no HOST.licensing → skipped. The extension's image branch
    // calls the vision model, so ⌘M must honor the same gate as ⌘C / ⌘⇧C.
    if (HOST.licensing && HOST.licensing.required && !HOST.licensing.active) {
      HOST.requestActivation && HOST.requestActivation("copy");
      showCopyFeedback(t("needLicense"), true);
      return;
    }
    let els = targetElements && targetElements.length
      ? targetElements.slice()
      : selectedElements.length
      ? selectedElements.slice()
      : [document.querySelector("main, article, [role='main']") || document.body];
    els = els.filter(Boolean);
    if (!els.length) return;
    try {
      // §1.5: a null/failed host payload falls back to the built-in serializer
      // so the extension is never WORSE than the bookmarklet on the same page.
      let payload = null;
      if (HOST.buildCopyPayload) {
        // The host's image branch round-trips a vision model (up to ~60s) —
        // reuse ⌘I's shimmer loading so the UI never looks dead meanwhile.
        setCopyButtonLoading(true);
        try {
          payload = await HOST.buildCopyPayload("markdown", { elements: els, lang, buildPromptText, buildSharinganReport });
        } catch (_) { payload = null; }
        setCopyButtonLoading(false);
      }
      if (!payload) payload = localMarkdownPayload(els);
      if (payload && payload.text) {
        showRevPromptPanel("mdTitle");
        pushRevToken(payload.text);
        finishRevPrompt(payload.text, "copyMarkdown", false);
      }
    } catch (_) { /* best-effort */ }
  }

  // ── ⌘I — image → generation prompt (Pro / extension only) ──
  // Find an image in the selection (an <img>, or a CSS background-image), hand it
  // to the vision model via HOST.reversePrompt, drop the prompt on the clipboard
  // and show it. Bookmarklet has no HOST.reversePrompt → ⌘I is never bound.
  function imageSourceFromElement(el) {
    if (!el) return null;
    // A selection that carries real text is a UI region, not "an image" — let
    // the caller fall through to the screenshot branch (UI reverse prompt)
    // instead of reverse-prompting a thumbnail / decorative background found
    // inside it. Bare <img> still short-circuits below.
    if (el.tagName !== "IMG") {
      try {
        const visText = (el.innerText || "").replace(/\s+/g, " ").trim();
        if (visText.length >= 120) return null;
      } catch (_) {}
    }
    const img = (el.tagName === "IMG") ? el : (el.querySelector && el.querySelector("img"));
    if (img && (img.currentSrc || img.src)) {
      const out = { url: img.currentSrc || img.src };
      // Same-origin → encode locally (no extra fetch). Cross-origin taints the
      // canvas (toDataURL throws) → fall back to the URL; background fetches it.
      try {
        if (img.complete && img.naturalWidth && img.naturalHeight) {
          const c = document.createElement("canvas");
          c.width = img.naturalWidth; c.height = img.naturalHeight;
          c.getContext("2d").drawImage(img, 0, 0);
          out.dataUrl = c.toDataURL("image/png");
        }
      } catch (_) { /* cross-origin → use url */ }
      return out;
    }
    try {
      const bg = getComputedStyle(el).backgroundImage || "";
      const m = bg.match(/url\((?:"|')?(.*?)(?:"|')?\)/);
      if (m && m[1]) {
        if (m[1].indexOf("data:") === 0) return { dataUrl: m[1] };
        return { url: new URL(m[1], location.href).href };
      }
    } catch (_) {}
    return null;
  }

  // Lightweight: a displayable thumbnail src for a selected element, or null.
  // (No canvas — used for the selection tag chip + to decide button visibility.)
  function thumbSrcForElement(el) {
    if (!el) return null;
    const img = (el.tagName === "IMG") ? el : (el.querySelector && el.querySelector("img"));
    if (img && (img.currentSrc || img.src)) return img.currentSrc || img.src;
    try {
      const bg = getComputedStyle(el).backgroundImage || "";
      const m = bg.match(/url\((?:"|')?(.*?)(?:"|')?\)/);
      if (m && m[1]) return m[1].indexOf("data:") === 0 ? m[1] : new URL(m[1], location.href).href;
    } catch (_) {}
    return null;
  }

  // ── Result preview panel: loading lives on the Copy button; the result rises in a
  // panel above the chat menu, and the Copy button is repurposed to copy that
  // panel text until the panel is closed. (revPanel / pendingGenPrompt
  // are declared with the other state vars near the top.) ─────────────────────
  function copyBtnEl() { return chatPanel && chatPanel.querySelector(`.${NS}-copy-btn`); }

  // 流光 loading state on the Copy button while the model analyses the image.
  function setCopyButtonLoading(on) {
    const btn = copyBtnEl(); if (!btn) return;
    if (copyTimer) { clearTimeout(copyTimer); copyTimer = null; }
    btn.classList.remove(`${NS}-copy-done`, `${NS}-copy-error`);
    btn.classList.toggle(`${NS}-copy-loading`, !!on);
    btn.disabled = !!on;
    if (on) btn.textContent = t("revRunning");
    else { btn.disabled = selectedElements.length === 0; setCopyButtonIdle(btn); }
  }

  function positionRevPanel() {
    if (!revPanel || !chatPanel) return;
    const cr = chatPanel.getBoundingClientRect();
    revPanel.style.bottom = (window.innerHeight - cr.top + 8) + "px";
    revPanel.style.right = Math.max(8, window.innerWidth - cr.right) + "px";
  }

  // Opens an empty result panel and arms the smooth typewriter reveal. Text is
  // fed in via pushRevToken() (one call per streamed token, or one big call for
  // the non-stream fallback); the reveal loop catches up smoothly either way.
  function showRevPromptPanel(titleKey) {
    closeRevPromptResult();
    revPanel = document.createElement("div");
    revPanel.className = `${NS}-root ${NS}-revprompt`;
    const head = document.createElement("div"); head.className = `${NS}-revprompt-head`;
    const title = document.createElement("span"); title.className = `${NS}-revprompt-title`; title.textContent = t(titleKey || "revTitle");
    const close = document.createElement("button"); close.className = `${NS}-revprompt-close`; close.type = "button"; close.textContent = "×";
    close.onclick = closeRevPromptResult;
    head.appendChild(title); head.appendChild(close);
    const body = document.createElement("div"); body.className = `${NS}-revprompt-body`;
    const txt = document.createElement("div"); txt.className = `${NS}-revprompt-text`;
    body.appendChild(txt);
    revPanel.appendChild(head); revPanel.appendChild(body);
    document.body.appendChild(revPanel);
    revStream = { target: "", shown: 0, el: txt, timer: null };
    positionRevPanel();
  }

  // setTimeout (not rAF) so the typewriter keeps progressing if the tab is
  // backgrounded mid-stream (rAF fully pauses when hidden); ~22ms ≈ 45fps.
  function revStreamStep() {
    if (!revStream) { return; }
    revStream.timer = null;
    const s = revStream.target;
    if (revStream.shown < s.length) {
      // Reveal a slice; the divisor lets it speed up to catch a fast stream.
      const el = revStream.el;
      // Follow the newest text only while the user is already near the bottom,
      // so once the panel fills (max-height) it keeps scrolling down — but we
      // don't yank them back if they scrolled up to read an earlier section.
      const stick = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
      const step = Math.max(2, Math.ceil((s.length - revStream.shown) / 6));
      revStream.shown = Math.min(s.length, revStream.shown + step);
      el.textContent = s.slice(0, revStream.shown);
      if (stick) el.scrollTop = el.scrollHeight;
      revStream.timer = setTimeout(revStreamStep, 22);
    }
    // else: caught up; pushRevToken/finishRevPrompt will restart on new text.
  }
  function pushRevToken(token) {
    if (!revStream) return;
    revStream.target += token;
    if (!revStream.timer) revStream.timer = setTimeout(revStreamStep, 0);
  }

  function closeRevPromptResult() {
    if (revStream && revStream.timer) clearTimeout(revStream.timer);
    revStream = null;
    if (revPanel) { revPanel.remove(); revPanel = null; }
    if (pendingGenPrompt) {
      pendingGenPrompt = null;
      pendingResultCopyKey = null;
      const btn = copyBtnEl();
      if (btn) {
        btn.disabled = selectedElements.length === 0;
        setCopyButtonIdle(btn);
      }
    }
  }

  // Turn a screenshot Blob into a model-friendly data URL: downscale to a sane
  // max dimension and re-encode as JPEG to keep the request small/fast.
  function blobToReversePromptDataURL(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        try {
          const MAX = 1600;
          let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
          const scale = Math.min(1, MAX / Math.max(w, h || 1));
          w = Math.max(1, Math.round(w * scale)); h = Math.max(1, Math.round(h * scale));
          const c = document.createElement("canvas"); c.width = w; c.height = h;
          c.getContext("2d").drawImage(img, 0, 0, w, h);
          resolve(c.toDataURL("image/jpeg", 0.85));
        } catch (e) { reject(e); } finally { URL.revokeObjectURL(url); }
      };
      img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
      img.src = url;
    });
  }

  // When the streamed/returned result is complete: settle the panel to the full
  // text (guaranteed visible even if the reveal animation is paused — e.g. a
  // backgrounded tab where rAF doesn't fire), then repurpose Copy to the panel
  // text. Some callers still auto-copy; Markdown preview intentionally does not.
  async function finishRevPrompt(fullText, copyLabelKey, shouldCopy, requestToken) {
    if (requestToken && requestToken !== copyRequestToken) return;
    if (revStream) {
      if (revStream.timer) { clearTimeout(revStream.timer); revStream.timer = null; }
      revStream.target = fullText;
      revStream.shown = fullText.length;
      const el = revStream.el;
      if (el) {
        const stick = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
        el.textContent = fullText;
        if (stick) el.scrollTop = el.scrollHeight;
      }
    }
    pendingGenPrompt = fullText;
    pendingResultCopyKey = copyLabelKey || "copyGenPrompt";
    if (shouldCopy !== false) {
      const token = requestToken || ++copyRequestToken;
      const result = await writeToClipboard(fullText);
      showClipboardFeedback(result, token);
    }
    const btn = copyBtnEl();
    if (btn) {
      btn.disabled = false;
      setCopyButtonIdle(btn);
    }
  }

  async function reversePromptForSelection() {
    if (!HOST.reversePrompt && !HOST.reversePromptStream) return;
    const requestToken = ++copyRequestToken;
    // ── License gate (HOST_CONTRACT.md §1.2) ──────────────────
    // ⌘I always calls the vision model — the most expensive action in the
    // product — so it must honor the same gate as ⌘C / ⌘⇧C.
    if (HOST.licensing && HOST.licensing.required && !HOST.licensing.active) {
      HOST.requestActivation && HOST.requestActivation("copy");
      showCopyFeedback(t("needLicense"), true);
      return;
    }
    if (selectedElements.length === 0) { showCopyFeedback(t("revNoImage"), true); return; }
    closeRevPromptResult();
    setCopyButtonLoading(true);
    let opened = false, acc = "";
    try {
      // Prefer an actual image in the selection; otherwise screenshot the region
      // (editor UI is hidden during capture, full element by default) and reverse
      // that — so ⌘I works on any visual selection, not just <img>.
      let src = null;
      for (let i = 0; i < selectedElements.length; i++) {
        const s = imageSourceFromElement(selectedElements[i]);
        if (s) { src = s; break; }
      }
      if (!src) {
        const blob = await captureScreenshotBlob();
        // UI mode: the selection is an interface region, not a picture. The
        // host consumes `elements` (live nodes, MAIN-world only — they never
        // cross the bridge) into a measured style digest so the model quotes
        // real colors/fonts/spacing instead of estimating them from pixels.
        src = {
          dataUrl: await blobToReversePromptDataURL(blob),
          kind: "ui",
          elements: selectedElements.slice(),
        };
      }
      // The prompt language follows the extension's current UI language.
      const payload = Object.assign({ lang: lang === "zh" ? "zh" : "en" }, src);

      if (HOST.reversePromptStream) {
        // Streaming: the panel rises on the first token and types out smoothly.
        await HOST.reversePromptStream(payload, (token) => {
          acc += token;
          if (!opened) { opened = true; setCopyButtonLoading(false); showRevPromptPanel(); }
          pushRevToken(token);
        });
        if (opened && acc) await finishRevPrompt(acc, undefined, undefined, requestToken);
        else { setCopyButtonLoading(false); if (requestToken === copyRequestToken) showCopyFeedback(t("revFailed"), true); }
      } else {
        const res = await HOST.reversePrompt(payload);
        setCopyButtonLoading(false);
        if (res && res.prompt) { showRevPromptPanel(); pushRevToken(res.prompt); await finishRevPrompt(res.prompt, undefined, undefined, requestToken); }
        else if (requestToken === copyRequestToken) showCopyFeedback(t("revFailed"), true);
      }
    } catch (err) {
      setCopyButtonLoading(false);
      // Keep a partial stream if we got one; otherwise surface the failure.
      if (opened && acc) await finishRevPrompt(acc, undefined, undefined, requestToken);
      else if (requestToken === copyRequestToken) showCopyFeedback(t("revFailed"), true);
      console.warn("[Selector] reversePrompt", err);
    }
  }

  // ── Screenshot capture ─────────────────────────────────────
  let screenshotTimer = null;
  function setScreenshotButtonIdle() {
    if (!screenshotBtn) return;
    screenshotBtn.innerHTML = CAMERA_SVG;
    screenshotBtn.title = t("copyScreenshot");
    screenshotBtn.setAttribute("aria-label", t("copyScreenshot"));
  }

  function showScreenshotFeedback(msg, isError, detail) {
    const btn = chatPanel.querySelector(`.${NS}-screenshot-btn`);
    if (screenshotTimer) clearTimeout(screenshotTimer);
    btn.classList.remove(`${NS}-screenshot-done`, `${NS}-screenshot-error`);
    btn.classList.add(isError ? `${NS}-screenshot-error` : `${NS}-screenshot-done`);
    btn.title = detail || msg;
    btn.setAttribute("aria-label", detail || msg);
    btn.innerHTML = isError
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v5"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="9"/></svg>'
      : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
    screenshotTimer = setTimeout(() => { btn.classList.remove(`${NS}-screenshot-done`, `${NS}-screenshot-error`); setScreenshotButtonIdle(); screenshotTimer = null; }, 2400);
  }

  async function captureScreenshot(options) {
    if (selectedElements.length === 0) return;
    // ── License gate (HOST_CONTRACT.md §1.2) ──────────────────
    // Bookmarklet has no HOST.licensing → skipped. Extension may gate capture.
    if (HOST.licensing && HOST.licensing.required && !HOST.licensing.active) {
      HOST.requestActivation && HOST.requestActivation("copy");
      showCopyFeedback(t("needLicense"), true);
      return;
    }
    const opts = options || {};
    const feedbackTarget = opts.feedbackTarget || "screenshot";
    const requestToken = feedbackTarget === "copy" ? (opts.copyRequestToken || ++copyRequestToken) : null;
    const showError = (code, err) => {
      if (feedbackTarget === "copy") {
        if (requestToken !== copyRequestToken) return;
        showCopyCaptureError(code, err);
      } else showScreenshotError(code, err);
    };
    const showSuccess = (savedImage) => {
      if (feedbackTarget === "copy") {
        if (requestToken !== copyRequestToken) return;
        showCopyFeedback(opts.downloadImage && savedImage ? t("copiedSaved") : t("copied"));
      } else showScreenshotFeedback(t("screenshotCopied"));
    };
    // getDisplayMedia is only a requirement on the bookmarklet path; the
    // extension host captures via captureVisibleTab and must not be blocked
    // on pages where mediaDevices is absent (e.g. non-secure contexts).
    const hostCanCapture = !!(HOST.grabViewportFrame || HOST.captureRegion);
    if (!navigator.clipboard || (!hostCanCapture && (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia))) {
      showError("unsupported");
      return;
    }

    const imageFilename = opts.downloadImage ? screenshotFilename() : "";
    let imageBlob;
    try {
      imageBlob = await captureScreenshotBlob();
    } catch (err) {
      showError(classifyScreenshotError(err, "capture"), err);
      return;
    }

    let imageSaved = false;
    let savedFilename = imageFilename;
    let savedPath = "";
    if (imageFilename) {
      try {
        const saveResult = await saveScreenshotImage(imageBlob, imageFilename);
        imageSaved = saveResult.saved;
        savedFilename = saveResult.filename || imageFilename;
        savedPath = saveResult.path || "";
      } catch (err) {
        showError(classifyScreenshotError(err, "capture"), err);
        return;
      }
    }

    const text = Object.prototype.hasOwnProperty.call(opts, "text") ? opts.text : (settings.combined ? buildPromptText() : "");
    const textWithImagePath = imageFilename ? appendScreenshotSaveReference(text, savedFilename, imageSaved, savedPath) : text;

    try {
      if (imageFilename && textWithImagePath) {
        await navigator.clipboard.writeText(textWithImagePath);
      } else {
        if (!window.ClipboardItem) {
          showError("unsupported");
          return;
        }
        let itemData = { "image/png": imageBlob };
        if (textWithImagePath) {
          itemData = {
            "text/html": screenshotHtmlBlob(textWithImagePath, imageBlob),
            "text/plain": new Blob([textWithImagePath], { type: "text/plain" }),
            "image/png": imageBlob,
          };
        }
        await navigator.clipboard.write([new ClipboardItem(itemData)]);
      }
      showSuccess(imageSaved);
    } catch (err) {
      showError("clipboard", err);
    }
  }

  async function saveScreenshotImage(blob, filename) {
    // Extension: save via chrome.downloads and get the REAL on-disk path back —
    // no save dialog, no path-guessing. Bookmarklet has no HOST.downloadFile and
    // falls through to the file picker / pending-save flow below, unchanged.
    if (HOST.downloadFile) {
      try {
        const res = await HOST.downloadFile(filename, blob, "image/png");
        if (res) {
          const path = res.path || "";
          const name = path ? (path.split(/[\\/]/).pop() || filename) : filename;
          return { saved: true, filename: name, path };
        }
      } catch (err) { console.warn("[Selector] host download failed, falling back", err); }
    }
    try {
      const result = await writeScreenshotWithPicker(blob, filename);
      clearPendingScreenshotSave();
      return result;
    } catch (err) {
      if (err && err.name === "AbortError") throw screenshotError("cancelled", err);
      console.warn("[Selector] Save picker unavailable", err);
    }

    showPendingScreenshotSave(blob, filename);
    return { saved: false, filename };
  }

  // When the Sharingan report exceeds the clipboard threshold we auto-download
  // it as a .md file and put only the short prompt summary in the clipboard.
  // Without an explicit note the receiving AI has no way to know the rich
  // report exists. This banner runs FIRST in the clipboard text so any AI
  // sees it before the abbreviated prompt body.
  function appendSharinganDownloadReference(text, filename, fullChars, realPath) {
    const head = `Sharingan replication report: ${filename}  (${(fullChars / 1024).toFixed(1)} KB)`;
    const why = `The full DOM/CSS/font/animation report was downloaded as a Markdown file (it exceeded the clipboard size limit). The prompt body below is only an abbreviated summary — for high-fidelity replication, read the .md file.`;
    // Extension: reference the real on-disk path; bookmarklet: mdfind/find guess.
    const locate = realPath
      ? [`Saved to: ${realPath}`]
      : [
          `To locate the absolute path, run one of:`,
          `  mdfind -name "${filename}"                              # macOS`,
          `  find ~ -name "${filename}" -mtime -1                   # Linux / WSL`,
        ];
    const ref = [head, why].concat(locate).join("\n");
    return text ? `${ref}\n\n${text}` : ref;
  }

  // Save a Markdown report. Extension → chrome.downloads (returns real path);
  // bookmarklet → anchor download (no path). Returns the absolute path or "".
  async function saveMarkdownFile(text, filename) {
    if (HOST.downloadFile) {
      try {
        const res = await HOST.downloadFile(filename, new Blob([text], { type: "text/markdown" }), "text/markdown");
        if (res && res.path) return res.path;
      } catch (_) { /* fall through */ }
      return "";
    }
    downloadMarkdown(text, filename);
    return "";
  }

  // The browser does not expose the absolute path the user picked in the save
  // dialog (sandbox), so we hand the receiving AI a concrete locator command
  // it can run instead. The filename is timestamp-unique so a system-wide
  // search returns exactly one hit.
  function appendScreenshotSaveReference(text, filename, saved, realPath) {
    // Extension: chrome.downloads gave us the actual absolute path — reference it
    // directly. (The mdfind/find guesswork below is only for the bookmarklet,
    // where the browser never exposes the chosen path.)
    if (realPath) {
      const ref = `Screenshot saved to: ${realPath}`;
      return text ? `${text}\n\n${ref}` : ref;
    }
    const lines = saved
      ? [
          `Screenshot file: ${filename}`,
          `The user saved this PNG via the browser save dialog (path not exposed by the browser).`,
          `To locate the absolute path, run one of:`,
          `  mdfind -name "${filename}"                              # macOS`,
          `  find ~ -name "${filename}" -mtime -1                   # Linux / WSL`,
        ]
      : [
          `Screenshot file: ${filename}  (capture pending)`,
          `Auto-save did not run — ask the user to click "Save PNG" in the Selector panel and pick a folder.`,
          `After saving, locate it with:`,
          `  mdfind -name "${filename}"                              # macOS`,
          `  find ~ -name "${filename}" -mtime -1                   # Linux / WSL`,
        ];
    const ref = lines.join("\n");
    return text ? `${text}\n\n${ref}` : ref;
  }

  async function writeScreenshotWithPicker(blob, filename) {
    if (!window.showSaveFilePicker || !window.isSecureContext) throw new Error("File picker unavailable");
    const handle = await window.showSaveFilePicker({
      suggestedName: filename,
      types: [{ description: "PNG image", accept: { "image/png": [".png"] } }],
      excludeAcceptAllOption: false,
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return { saved: true, filename: handle.name || filename };
  }

  function showPendingScreenshotSave(blob, filename) {
    pendingScreenshotSave = { blob, filename };
    if (!saveBtn) return;
    saveBtn.textContent = t("savePng");
    saveBtn.classList.remove(`${NS}-hidden`);
  }

  function clearPendingScreenshotSave() {
    pendingScreenshotSave = null;
    if (saveBtn) saveBtn.classList.add(`${NS}-hidden`);
  }

  async function savePendingScreenshot() {
    if (!pendingScreenshotSave) return;
    const pending = pendingScreenshotSave;
    saveBtn.disabled = true;
    try {
      await writeScreenshotWithPicker(pending.blob, pending.filename);
      clearPendingScreenshotSave();
      showCopyFeedback(t("copiedSaved"));
    } catch (err) {
      if (err && err.name !== "AbortError") showCopyCaptureError("capture", err);
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  function screenshotErrorKey(code) {
    return {
      unsupported: "errUnsupported",
      cancelled: "errCancelled",
      permission: "errPermission",
      clipboard: "errClipboard",
      empty: "errEmpty",
      capture: "errCapture",
    }[code] || "errCapture";
  }

  function showScreenshotError(code, err) {
    const key = screenshotErrorKey(code);
    const detail = err ? `${err.name || "Error"}: ${err.message || String(err)}` : "";
    if (err) console.warn(`[Selector] ${t(key)}`, err);
    showScreenshotFeedback(t(key), true, detail);
  }

  function screenshotError(code, cause) {
    const err = new Error(cause && cause.message ? cause.message : code);
    err.name = cause && cause.name ? cause.name : "SelectorScreenshotError";
    err.selectorCode = code;
    err.cause = cause;
    return err;
  }

  function classifyScreenshotError(err, stage) {
    if (!err) return stage === "clipboard" ? "clipboard" : "capture";
    if (err.selectorCode) return err.selectorCode;
    if (stage === "clipboard") return "clipboard";
    const name = err.name || "";
    const message = String(err.message || "").toLowerCase();
    if (name === "NotAllowedError" || message.includes("permission")) {
      if (message.includes("system") || message.includes("denied")) return "permission";
      return "cancelled";
    }
    if (name === "SecurityError") return "permission";
    return "capture";
  }

  function defer() {
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  }

  // ── Screenshot capture dispatcher (HOST_CONTRACT.md §1.3) ────
  // Early split keeps the bookmarklet path byte-for-byte identical: when the
  // Host provides grabViewportFrame (extension uses captureVisibleTab) we use
  // the no-prompt host path; otherwise the existing getDisplayMedia path runs.
  async function captureScreenshotBlob() {
    // ── Full-element / full-page region capture (HOST_CONTRACT.md §10) ──
    // Bookmarklet has no HOST.captureRegion → this whole branch is skipped and the
    // original viewport dispatch (getDisplayMedia path) runs byte-for-byte.
    const scope = (settings && settings.screenshotScope) || "viewport";
    if (scope !== "viewport" && HOST.captureRegion) {
      const editorEls = document.querySelectorAll(`.${NS}-root, .${NS}-hover-box, .${NS}-sel-box, .${NS}-sel-corner, .${NS}-sel-label, .${NS}-annotate-btn, .${NS}-marquee`);
      const previousDisplay = Array.from(editorEls, el => [el, el.style.display]);
      try {
        editorEls.forEach(el => { el.style.display = "none"; });
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

        const dpr = window.devicePixelRatio || 1;
        const docEl = document.documentElement;
        const pageWidth = docEl.scrollWidth;
        let geom;
        if (scope === "fullPage") {
          geom = {
            x: 0,
            y: 0,
            w: pageWidth,
            h: Math.max(docEl.scrollHeight, document.body ? document.body.scrollHeight : 0),
            dpr,
            pageWidth,
          };
        } else {
          // fullElement: union of selected element rects in DOCUMENT coords.
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          selectedElements.forEach(el => {
            const r = el.getBoundingClientRect();
            minX = Math.min(minX, r.left + window.scrollX);
            minY = Math.min(minY, r.top + window.scrollY);
            maxX = Math.max(maxX, r.right + window.scrollX);
            maxY = Math.max(maxY, r.bottom + window.scrollY);
          });
          const pad = 8;
          minX = Math.max(0, Math.floor(minX - pad));
          minY = Math.max(0, Math.floor(minY - pad));
          maxX = Math.min(pageWidth, Math.ceil(maxX + pad));
          maxY = Math.ceil(maxY + pad);
          geom = { x: minX, y: minY, w: maxX - minX, h: maxY - minY, dpr, pageWidth };
        }
        if (!(geom.w > 0) || !(geom.h > 0)) throw screenshotError("empty");
        const blob = await HOST.captureRegion(scope, geom);
        if (!blob) throw screenshotError("capture");
        return blob;
      } finally {
        previousDisplay.forEach(([el, display]) => { el.style.display = display; });
      }
    }
    if (HOST.grabViewportFrame) return captureViaHost();
    return captureViaDisplayMedia();
  }

  // Extension path: grab a ready-to-draw viewport frame from the Host (already
  // physical pixels = viewport CSS px × dpr) and crop to the selection using
  // the SAME math as the getDisplayMedia path. No getDisplayMedia, no prompt.
  async function captureViaHost() {
    const editorEls = document.querySelectorAll(`.${NS}-root, .${NS}-hover-box, .${NS}-sel-box, .${NS}-sel-corner, .${NS}-sel-label, .${NS}-annotate-btn, .${NS}-marquee`);
    const previousDisplay = Array.from(editorEls, el => [el, el.style.display]);
    try {
      editorEls.forEach(el => { el.style.display = "none"; });
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

      const frame = await HOST.grabViewportFrame();
      const sourceWidth = frame.width || frame.naturalWidth || frame.videoWidth;
      const sourceHeight = frame.height || frame.naturalHeight || frame.videoHeight;
      const dpr = window.devicePixelRatio || 1;
      let minX=Infinity, minY=Infinity, maxX=0, maxY=0;
      selectedElements.forEach(el => { const r=el.getBoundingClientRect(); minX=Math.min(minX,r.left*dpr); minY=Math.min(minY,r.top*dpr); maxX=Math.max(maxX,r.right*dpr); maxY=Math.max(maxY,r.bottom*dpr); });
      const pad = 8 * dpr;
      minX=Math.max(0,Math.floor(minX-pad)); minY=Math.max(0,Math.floor(minY-pad));
      maxX=Math.min(sourceWidth,Math.ceil(maxX+pad)); maxY=Math.min(sourceHeight,Math.ceil(maxY+pad));
      const w=maxX-minX, h=maxY-minY;
      if (w <= 0 || h <= 0) throw screenshotError("empty");
      const canvas=document.createElement("canvas"); canvas.width=w; canvas.height=h;
      canvas.getContext("2d").drawImage(frame, minX, minY, w, h, 0, 0, w, h);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw screenshotError("capture");
      return blob;
    } finally {
      previousDisplay.forEach(([el, display]) => { el.style.display = display; });
    }
  }

  async function captureViaDisplayMedia() {
    const editorEls = document.querySelectorAll(`.${NS}-root, .${NS}-hover-box, .${NS}-sel-box, .${NS}-sel-corner, .${NS}-sel-label, .${NS}-annotate-btn, .${NS}-marquee`);
    const previousDisplay = Array.from(editorEls, el => [el, el.style.display]);
    let stream = null;

    try {
      try { stream = await navigator.mediaDevices.getDisplayMedia({ preferCurrentTab: true, video: { frameRate: 1 } }); }
      catch (err) { throw screenshotError(classifyScreenshotError(err, "capture"), err); }
      editorEls.forEach(el => { el.style.display = "none"; });
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

      const track = stream.getVideoTracks()[0];
      await new Promise(r => setTimeout(r, 100));
      const frame = await grabFrame(stream, track);
      const sourceWidth = frame.width || frame.videoWidth;
      const sourceHeight = frame.height || frame.videoHeight;
      const dpr = window.devicePixelRatio || 1;
      let minX=Infinity, minY=Infinity, maxX=0, maxY=0;
      selectedElements.forEach(el => { const r=el.getBoundingClientRect(); minX=Math.min(minX,r.left*dpr); minY=Math.min(minY,r.top*dpr); maxX=Math.max(maxX,r.right*dpr); maxY=Math.max(maxY,r.bottom*dpr); });
      const pad = 8 * dpr;
      minX=Math.max(0,Math.floor(minX-pad)); minY=Math.max(0,Math.floor(minY-pad));
      maxX=Math.min(sourceWidth,Math.ceil(maxX+pad)); maxY=Math.min(sourceHeight,Math.ceil(maxY+pad));
      const w=maxX-minX, h=maxY-minY;
      if (w <= 0 || h <= 0) throw screenshotError("empty");
      const canvas=document.createElement("canvas"); canvas.width=w; canvas.height=h;
      canvas.getContext("2d").drawImage(frame, minX, minY, w, h, 0, 0, w, h);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw screenshotError("capture");
      return blob;
    } finally {
      if (stream) stream.getTracks().forEach(t => t.stop());
      previousDisplay.forEach(([el, display]) => { el.style.display = display; });
    }
  }

  async function grabFrame(stream, track) {
    if (window.ImageCapture) return new ImageCapture(track).grabFrame();
    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    await new Promise(r => requestAnimationFrame(r));
    return video;
  }

  async function screenshotHtmlBlob(text, imageBlob) {
    const imageUrl = await blobToDataUrl(imageBlob);
    return new Blob([
      '<div data-selector-copy="screenshot-text">',
      '<pre style="white-space:pre-wrap;font:12px ui-monospace,SFMono-Regular,Menlo,monospace;margin:0 0 12px;">',
      escapeHtml(text),
      '</pre>',
      '<img alt="Selector screenshot" src="',
      imageUrl,
      '" style="max-width:100%;height:auto;">',
      '</div>',
    ], { type: "text/html" });
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error("Could not encode screenshot"));
      reader.readAsDataURL(blob);
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[ch]));
  }

  // ── Clipboard helpers ──────────────────────────────────────
  async function writeToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return "clipboard";
      } catch (_) {
        // Fall through to the synchronous selection-based path.
      }
    }
    return fallbackCopy(text) ? "fallback" : "failed";
  }
  function fallbackCopy(text) {
    const ta=document.createElement("textarea"); ta.value=text; ta.style.cssText="position:fixed;opacity:0;top:0;left:0";
    document.body.appendChild(ta); ta.focus(); ta.select();
    let copied = false;
    try { copied = document.execCommand("copy"); } catch(_) {}
    ta.remove();
    return copied;
  }

  function currentPageContext() {
    try {
      const url = new URL(location.href);
      if (!url.search || location.href.length <= 160) return { page: location.href, query: "" };
      return {
        page: url.origin + url.pathname + url.hash,
        query: compactQuery(url.searchParams),
      };
    } catch(_) {
      return { page: location.href, query: "" };
    }
  }

  function compactQuery(searchParams) {
    const grouped = new Map();
    for (const [key, value] of searchParams.entries()) {
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(value);
    }
    return Array.from(grouped.entries()).map(([key, values]) => {
      const compactValues = unique(values.map(compactQueryValue));
      if (values.length > 1) {
        return compactValues.length === 1 ? `${key}=${compactValues[0]} ×${values.length}` : `${key} ×${values.length}`;
      }
      return `${key}=${compactValues[0]}`;
    }).join(", ");
  }

  function compactQueryValue(value) {
    if (!value) return "";
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
      return value.slice(0, 8) + "…" + value.slice(-4);
    }
    return value.length > 48 ? value.slice(0, 32) + "…" + value.slice(-8) : value;
  }
