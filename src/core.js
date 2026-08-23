/**
 * Selector — visual element picker with per-element annotations.
 * Inject via bookmarklet. Click = select, Shift+click = multi, Drag = marquee.
 */
(function () {
  "use strict";
  // Already running: the Pro extension may re-inject after SPA navigations or a
  // second activation shortcut. Prefer a soft resume over a no-op.
  if (document.querySelector(".ai-editor-root")) {
    try {
      if (typeof window.__SELECTOR_ON_REACTIVATE__ === "function") {
        window.__SELECTOR_ON_REACTIVATE__();
      }
    } catch (_) {}
    return;
  }

  const NS = "ai-editor";
  // ── Host capability seam (HOST_CONTRACT.md §0/§1) ────────────
  // The closed-source extension injects window.__SELECTOR_HOST__ in the MAIN
  // world before this core runs, supplying stronger implementations (cross-tab
  // capture, cross-origin asset fetch, extra UI rows, ...).
  // For the free bookmarklet __SELECTOR_HOST__ is undefined → HOST = {} → every
  // seam below falls through to its existing else-branch and behaves exactly as
  // before. Each Host method is OPTIONAL: callers must always keep the original
  // logic as the fallback. Never make a path Host-only.
  const HOST = (typeof window !== "undefined" && window.__SELECTOR_HOST__) || {};
  const AI_ID = "data-ai-id";
  const VERSION = "0.4.1";
  // Cross-link targets for the settings-panel promo (bookmarklet ⇄ Pro extension).
  const EXT_LANDING_URL = "https://selector-pro.org/";
  const BOOKMARKLET_URL = "https://oil-oil.github.io/selector/";
  // Keep the bookmarklet's pause behavior and visible shortcut hint sourced
  // from one value so they cannot drift apart again.
  const PAUSE_SHORTCUT_KEY = "F2";

  // ── i18n ─────────────────────────────────────────────────────
  const DICT = {
    en: {
      selecting:"Selecting", paused:"Paused", copyPrompt:"Copy Prompt", copyReport:"Amaterasu!", copyCombined:"Copy + Screenshot", copyScreenshot:"Copy Screenshot",
      copied:"Copied", copiedFallback:"Copied via fallback", copyFailed:"Copy failed", copiedSaved:"Copied + Saved", exported:"Markdown Exported", screenshotCopied:"Screenshot Copied", screenshotCopiedSaved:"Screenshot Copied + Saved", screenshotFailed:"Screenshot Failed",
      settings:"Settings", lang:"Language", addInstruction:"Add instruction",
      instrPlaceholder:"Instruction for this element\u2026", clear:"Clear", done:"Done",
      clearAll:"Clear all", minimize:"Minimize", restore:"Restore", close:"Close",
      groupGeneral:"General", groupShortcuts:"Page shortcuts",
      skSelect:"Select", skMulti:"Multi", skNavigate:"Navigate", skPause:"Pause",
      skCopy:"Copy", skScreenshot:"Screenshot", skMarkdown:"Markdown", skActivate:"Toggle", skUndo:"Undo", skClear:"Clear",
      optCombined:"Screenshot + text combined", optCombinedDesc:"Copy screenshot and prompt text together",
      optCombinedPro:"Copy button includes screenshot", optCombinedProDesc:"The main copy action also captures the selected element",
      optSharingan:"Sharingan mode", optSharinganDesc:"Copy a complete DOM, CSS, font and animation report",
      savePng:"Save PNG",
      proShortcutTitle:"Activation shortcut", proShortcutHint:"Opens Chrome shortcut settings",
      shortcutCopyContext:"Copy context", shortcutCopyContextDesc:"Copy the selected elements and page context",
      shortcutScreenshotContext:"Screenshot + context", shortcutScreenshotContextDesc:"Copy a PNG screenshot with the selected context",
      shortcutMarkdown:"Markdown", shortcutMarkdownDesc:"Copy the selected content as Markdown",
      shortcutRecordHint:"Press a shortcut. Single keys and combinations are supported; Delete clears.", shortcutDuplicate:"That shortcut is already assigned.", shortcutInvalid:"Typing keys need Command, Control, or Alt.", shortcutCleared:"Not set",
      shortcutUnassigned:"Not set", shortcutSet:"Set", shortcutChange:"Change",
      proPromoTitle:"Selector Pro", proPromoDesc:"Always one shortcut away. Stays active across tabs, captures complete elements without dialogs, and syncs your settings.", proPromoCta:"Get the extension →",
      freePromoTitle:"Free bookmarklet", freePromoDesc:"No install — drag a bookmark, use on any page.", freePromoCta:"Open on GitHub →",
      mdTitle:"Markdown ready", mdPreparing:"Preparing Markdown…", copyMarkdown:"Copy Markdown",
      errUnsupported:"Browser not supported", errCancelled:"Screen choice cancelled",
      errPermission:"Screen recording blocked", errClipboard:"Clipboard blocked",
      errCapture:"Screenshot failed", errEmpty:"Selected area is empty", errDownload:"File save failed",
    },
    zh: {
      selecting:"\u9009\u62e9\u4e2d", paused:"\u5df2\u6682\u505c", copyPrompt:"\u590d\u5236\u63d0\u793a\u8bcd", copyReport:"\u963f\u739b\u7279\u62c9\u65af\uff01", copyCombined:"\u590d\u5236\u56fe\u6587", copyScreenshot:"\u590d\u5236\u622a\u56fe",
      copied:"\u5df2\u590d\u5236", copiedFallback:"\u5df2\u901a\u8fc7\u5907\u7528\u65b9\u5f0f\u590d\u5236", copyFailed:"\u590d\u5236\u5931\u8d25", copiedSaved:"\u5df2\u590d\u5236\u5e76\u4fdd\u5b58", exported:"Markdown \u5df2\u5bfc\u51fa", screenshotCopied:"\u622a\u56fe\u5df2\u590d\u5236", screenshotCopiedSaved:"\u622a\u56fe\u5df2\u590d\u5236\u5e76\u4fdd\u5b58", screenshotFailed:"\u622a\u56fe\u5931\u8d25",
      settings:"\u8bbe\u7f6e", lang:"\u8bed\u8a00", addInstruction:"\u6dfb\u52a0\u6307\u4ee4",
      instrPlaceholder:"\u6b64\u5143\u7d20\u7684\u4fee\u6539\u6307\u4ee4\u2026", clear:"\u6e05\u9664", done:"\u5b8c\u6210",
      clearAll:"\u6e05\u9664\u5168\u90e8", minimize:"\u6700\u5c0f\u5316", restore:"\u6062\u590d", close:"\u5173\u95ed",
      groupGeneral:"\u901a\u7528", groupShortcuts:"\u9875\u5185\u5feb\u6377\u952e",
      skSelect:"\u9009\u62e9", skMulti:"\u591a\u9009", skNavigate:"\u5bfc\u822a", skPause:"\u6682\u505c",
      skCopy:"\u590d\u5236", skScreenshot:"\u622a\u56fe", skMarkdown:"Markdown", skActivate:"\u5f00/\u5173", skUndo:"\u64a4\u9500", skClear:"\u6e05\u9664",
      optCombined:"\u622a\u56fe + \u6587\u672c\u5408\u5e76", optCombinedDesc:"\u540c\u65f6\u590d\u5236\u622a\u56fe\u548c\u63d0\u793a\u8bcd\u6587\u672c",
      optCombinedPro:"\u590d\u5236\u6309\u94ae\u540c\u65f6\u622a\u56fe", optCombinedProDesc:"\u70b9\u51fb\u4e3b\u590d\u5236\u6309\u94ae\u65f6\uff0c\u540c\u65f6\u622a\u53d6\u5df2\u9009\u5143\u7d20",
      optSharingan:"\u5199\u8f6e\u773c\u6a21\u5f0f", optSharinganDesc:"\u590d\u5236\u5b8c\u6574 DOM\u3001\u6837\u5f0f\u3001\u5b57\u4f53\u4e0e\u52a8\u753b\u62a5\u544a",
      savePng:"\u4fdd\u5b58 PNG",
      proShortcutTitle:"\u542f\u52a8\u5feb\u6377\u952e", proShortcutHint:"\u6253\u5f00 Chrome \u5feb\u6377\u952e\u8bbe\u7f6e",
      shortcutCopyContext:"\u590d\u5236\u4e0a\u4e0b\u6587", shortcutCopyContextDesc:"\u590d\u5236\u5df2\u9009\u5143\u7d20\u548c\u9875\u9762\u4e0a\u4e0b\u6587",
      shortcutScreenshotContext:"\u622a\u56fe + \u4e0a\u4e0b\u6587", shortcutScreenshotContextDesc:"\u590d\u5236\u5e26\u5df2\u9009\u4e0a\u4e0b\u6587\u7684 PNG \u622a\u56fe",
      shortcutMarkdown:"Markdown", shortcutMarkdownDesc:"\u5c06\u5df2\u9009\u5185\u5bb9\u590d\u5236\u4e3a Markdown",
      shortcutRecordHint:"\u8bf7\u6309\u4e0b\u5feb\u6377\u952e\u3002\u652f\u6301\u5355\u952e\u548c\u7ec4\u5408\u952e\uff1bDelete \u6e05\u9664\u3002", shortcutDuplicate:"\u8be5\u5feb\u6377\u952e\u5df2\u5206\u914d\u3002", shortcutInvalid:"\u5b57\u6bcd\u3001\u6570\u5b57\u548c\u7b26\u53f7\u952e\u9700\u642d\u914d Command\u3001Control \u6216 Alt\u3002", shortcutCleared:"\u672a\u8bbe\u7f6e",
      shortcutUnassigned:"\u672a\u8bbe\u7f6e", shortcutSet:"\u8bbe\u7f6e", shortcutChange:"\u4fee\u6539",
      proPromoTitle:"Selector Pro", proPromoDesc:"\u968f\u65f6\u4e00\u952e\u5524\u8d77\u3002\u5207\u6362\u6807\u7b7e\u4ecd\u4fdd\u6301\u5f00\u542f\u3001\u96f6\u5f39\u7a97\u5b8c\u6574\u622a\u56fe\u3001\u8bbe\u7f6e\u81ea\u52a8\u540c\u6b65\u3002", proPromoCta:"\u83b7\u53d6\u6d4f\u89c8\u5668\u6269\u5c55 \u2192",
      freePromoTitle:"\u514d\u8d39\u4e66\u7b7e\u7248", freePromoDesc:"\u514d\u5b89\u88c5 \u2014\u2014 \u62d6\u4e00\u4e2a\u4e66\u7b7e\uff0c\u4efb\u610f\u9875\u9762\u53ef\u7528\u3002", freePromoCta:"\u5728 GitHub \u6253\u5f00 \u2192",
      mdTitle:"Markdown \u5df2\u751f\u6210", mdPreparing:"Markdown \u751f\u6210\u4e2d\u2026", copyMarkdown:"\u590d\u5236 Markdown",
      errUnsupported:"\u6d4f\u89c8\u5668\u4e0d\u652f\u6301", errCancelled:"\u5df2\u53d6\u6d88\u5c4f\u5e55\u9009\u62e9",
      errPermission:"\u5c4f\u5e55\u5f55\u5236\u6743\u9650\u53d7\u9650", errClipboard:"\u526a\u8d34\u677f\u6743\u9650\u53d7\u9650",
      errCapture:"\u622a\u56fe\u5931\u8d25", errEmpty:"\u9009\u4e2d\u533a\u57df\u65e0\u6cd5\u622a\u56fe", errDownload:"\u6587\u4ef6\u4fdd\u5b58\u5931\u8d25",
    }
  };
  let lang = "en";
  // Host may pre-seed the language (read once at init); else read localStorage;
  // else follow the browser's UI language so i18n consistently matches the user.
  try { lang = HOST.initialLang || localStorage.getItem(NS + "-lang") || (/^zh\b/i.test(navigator.language || "") ? "zh" : "en"); } catch(_) {}
  function t(k) { return (DICT[lang] && DICT[lang][k]) || DICT.en[k] || k; }

  // ── Settings ─────────────────────────────────────────────────
  const DEFAULTS = { combined:false, sharingan:false };
  // Pro-only page shortcuts. The free bookmarklet never reads these keys, so
  // its legacy Cmd/Ctrl bindings remain unchanged.
  const PRO_SHORTCUT_DEFAULTS = {
    shortcutCopyContext: "Mod+C",
    shortcutScreenshotContext: "Mod+Shift+C",
    shortcutMarkdown: "Mod+M",
  };
  const PRO_SHORTCUT_KEYS = Object.keys(PRO_SHORTCUT_DEFAULTS);
  // Reports up to this size go straight to the clipboard. Past this — and only
  // past it — we fall back to downloading the full report as a .md file so we
  // don't choke the OS clipboard. The previous floor (30_000) silently
  // downgraded every modern report to the short prompt-text fallback even
  // though browsers handle MB-class clipboard text fine.
  const SHARINGAN_CLIPBOARD_CHAR_LIMIT = 500000;
  let settings = Object.assign({}, DEFAULTS);
  // Host may pre-seed the settings object (read once at init); else read
  // localStorage. Either source is merged over DEFAULTS so the shape is stable.
  try { var s = HOST.initialSettings || JSON.parse(localStorage.getItem(NS + "-settings")); if (s) settings = Object.assign({}, DEFAULTS, s); } catch(_) {}
  if (HOST.pageShortcuts === true) settings = Object.assign({}, PRO_SHORTCUT_DEFAULTS, settings);
  const HOST_SETTINGS_BASE = HOST.isExtension === true
    ? Object.assign({}, HOST.pageShortcuts === true ? PRO_SHORTCUT_DEFAULTS : {}, HOST.initialSettings || {})
    : {};

  // Portable shortcut helpers are intentionally pure so both the recorder and
  // the MAIN-world keydown path use exactly the same representation.
  function normalizeShortcutKey(key) {
    const raw = String(key || "").trim();
    if (!raw) return "";
    const aliases = { " ": "Space", Spacebar: "Space", Esc: "Escape", Del: "Delete" };
    if (aliases[raw]) return aliases[raw];
    if (/^Key[A-Z]$/i.test(raw)) return raw.slice(-1).toUpperCase();
    if (/^Digit[0-9]$/.test(raw)) return raw.slice(-1);
    if (/^Numpad[0-9]$/.test(raw)) return raw.slice(-1);
    if (/^[a-z]$/i.test(raw)) return raw.toUpperCase();
    if (/^[0-9]$/.test(raw) || /^F(?:[1-9]|1[0-2])$/i.test(raw)) return raw.toUpperCase();
    if (/^(Space|Enter|Tab|Escape|Backspace|Delete|Insert|Home|End|PageUp|PageDown|Arrow(?:Up|Down|Left|Right)|[.,/;'\\[\\]\\-=`])$/i.test(raw)) return raw.length === 1 ? raw : raw[0].toUpperCase() + raw.slice(1);
    return "";
  }
  function allowsSingleKeyShortcut(key) {
    return /^(?:Escape|F(?:[1-9]|1[0-2])|Space|Enter|Tab|Insert|Home|End|PageUp|PageDown|Arrow(?:Up|Down|Left|Right))$/.test(key);
  }
  function normalizeShortcutBinding(value) {
    if (!value) return "";
    const parts = String(value).split("+").map(part => part.trim()).filter(Boolean);
    let mod = false, alt = false, shift = false, key = "";
    for (const part of parts) {
      if (/^(?:Mod|Command|Cmd|Ctrl|Control)$/i.test(part)) mod = true;
      else if (/^(?:Alt|Option)$/i.test(part)) alt = true;
      else if (/^Shift$/i.test(part)) shift = true;
      else if (!key) key = normalizeShortcutKey(part);
      else return "";
    }
    if (!key || (!mod && !alt && !allowsSingleKeyShortcut(key))) return "";
    return (mod ? "Mod+" : "") + (alt ? "Alt+" : "") + (shift ? "Shift+" : "") + key;
  }
  function shortcutFromEvent(event) {
    if (!event || event.isComposing) return "";
    // `event.code` keeps letter/number shortcuts layout-independent, while
    // punctuation codes such as `BracketLeft` need the printable `event.key`.
    const key = normalizeShortcutKey(event.code) || normalizeShortcutKey(event.key);
    if (!key || (!event.metaKey && !event.ctrlKey && !event.altKey && !allowsSingleKeyShortcut(key))) return "";
    return normalizeShortcutBinding(
      (event.metaKey || event.ctrlKey ? "Mod+" : "") +
      (event.altKey ? "Alt+" : "") +
      (event.shiftKey ? "Shift+" : "") + key,
    );
  }
  function shortcutMatches(event, binding) {
    return !!binding && shortcutFromEvent(event) === normalizeShortcutBinding(binding);
  }
  function saveSettings() {
    // Host persists settings (fire-and-forget); bookmarklet uses localStorage.
    if (HOST.setSettings) { HOST.setSettings(settings); return; }
    try { localStorage.setItem(NS + "-settings", JSON.stringify(settings)); } catch(_) {}
  }

  // ── State ────────────────────────────────────────────────────
  let selectedElements = [], chatPanel = null, hoverBox = null, aiIdCounter = 0;
  let rafPending = false, layerRafPending = false, lastMoveTarget = null, minimized = false, paused = false;
  let layerHost = null;
  const selOverlays = new Map(), annotations = new Map(), listeners = [];
  let domObserver = null;
  let dragState = null, wasJustDragging = false, activePopover = null;
  const selectionHistory = [];
  let screenshotBtn = null, saveBtn = null, pendingScreenshotSave = null, settingsOpen = false, settingsPanel = null;
  let revPanel = null, pendingGenPrompt = null, pendingResultCopyKey = null, revStream = null;

  function on(target, type, fn, capture) {
    target.addEventListener(type, fn, capture);
    listeners.push({ target, type, fn, capture });
  }

  // ── Init ─────────────────────────────────────────────────────
  function init() {
    assignAiIds(document.body);
    createHoverBox();
    createChatPanel();
    on(document, "mousedown", handleMouseDown, true);
    on(document, "click", handleClick, true);
    on(document, "mousemove", handleMouseMove, true);
    on(document, "mouseup", handleMouseUp, true);
    on(document, "mouseleave", () => { showHover(null); cancelDrag(); }, true);
    on(document, "keydown", handleKeyDown, true);
    let repositionRaf = false;
    const scheduleReposition = () => {
      if (!repositionRaf) { repositionRaf = true; requestAnimationFrame(() => { positionAllOverlays(); repositionRaf = false; }); }
    };
    on(window, "scroll", scheduleReposition, true);
    on(window, "resize", scheduleReposition, false);
    // SPA routes often replace large DOM subtrees without reloading this core.
    // Keep newly-added page elements addressable for click, marquee and undo.
    try {
      domObserver = new MutationObserver(records => {
        let addedPageContent = false;
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (node && node.nodeType === 1 && !isEditorElement(node)) {
              assignAiIds(node);
              addedPageContent = true;
            }
          }
        }
        if (addedPageContent) scheduleSelectorLayerRefresh();
      });
      domObserver.observe(document.documentElement, { childList: true, subtree: true });
    } catch (_) {}
    applyI18n();
    // Extension hooks: Pro can destroy/resume this instance after SPA nav or
    // a second activation shortcut without leaving orphan listeners behind.
    try {
      window.__SELECTOR_DESTROY__ = destroy;
      window.__SELECTOR_ON_REACTIVATE__ = function () {
        try {
          bringSelectorLayerToFront();
          if (minimized) toggleMinimize();
          if (paused) togglePaused();
        } catch (_) {}
      };
      // Same-document navigation (SPA/history) must look like a full reload:
      // keep the panel and synced preferences, discard page-specific UI state.
      window.__SELECTOR_ON_NAVIGATION__ = function () {
        try {
          showHover(null);
          cancelDrag();
          closeSettings();
          if (typeof closeRevPromptResult === "function") closeRevPromptResult();
          if (typeof clearPendingScreenshotSave === "function") clearPendingScreenshotSave();
          clearSelection();
          selectionHistory.length = 0;
          if (minimized) toggleMinimize();
          if (paused) togglePaused();
          assignAiIds(document.body);
          updateTags();
        } catch (_) {}
      };
      window.__SELECTOR_APPLY_SETTINGS__ = function (next) {
        if (!next || typeof next !== "object") return;
        settings = Object.assign({}, DEFAULTS, HOST_SETTINGS_BASE, next);
        if (settingsPanel) {
          settingsPanel.querySelectorAll(`.${NS}-setting-row[data-setting-key]`).forEach(row => {
            const key = row.dataset.settingKey;
            if (key === "lang") return;
            const input = row.querySelector('input[type="checkbox"]');
            if (input) input.checked = !!settings[key];
          });
          settingsPanel.querySelectorAll(`.${NS}-setting-row[data-setting-extra]`).forEach(row => {
            const key = row.dataset.settingExtra;
            const input = row.querySelector('input[type="checkbox"]');
            const select = row.querySelector("select");
            if (input) input.checked = !!settings[key];
            if (select && settings[key] != null) select.value = settings[key];
          });
          if (typeof refreshShortcutRows === "function") refreshShortcutRows();
        }
        applyI18n();
      };
      window.__SELECTOR_APPLY_LANG__ = function (next) {
        if (next !== "en" && next !== "zh") return;
        lang = next;
        applyI18n();
        refreshSettingsLabels();
      };
    } catch (_) {}
  }

  // ── Destroy ──────────────────────────────────────────────────
  function destroy() {
    for (const { target, type, fn, capture } of listeners) target.removeEventListener(type, fn, capture);
    listeners.length = 0;
    if (domObserver) { try { domObserver.disconnect(); } catch (_) {} domObserver = null; }
    destroyAllOverlays(); removeAnnotationPopover(); closeSettings();
    try { if (typeof closeRevPromptResult === "function") closeRevPromptResult(); } catch (_) {}
    if (hoverBox) hoverBox.remove();
    if (chatPanel) chatPanel.remove();
    if (layerHost) {
      try { if (layerHost.matches(":popover-open")) layerHost.hidePopover(); } catch (_) {}
      layerHost.remove();
    }
    hoverBox = null;
    chatPanel = null;
    layerHost = null;
    try {
      if (window.__SELECTOR_DESTROY__ === destroy) delete window.__SELECTOR_DESTROY__;
      delete window.__SELECTOR_ON_REACTIVATE__;
      delete window.__SELECTOR_ON_NAVIGATION__;
      delete window.__SELECTOR_APPLY_SETTINGS__;
      delete window.__SELECTOR_APPLY_LANG__;
    } catch (_) {}
    // Tell the Pro host to stop sticky re-open for this tab (X / shortcut off).
    if (HOST.onClosed) { try { HOST.onClosed(); } catch (_) {} }
  }

  // ── AI-ID ────────────────────────────────────────────────────
  function assignAiIds(root) {
    if (!root) return;
    if (root.nodeType === 1 && !isEditorElement(root) && !root.hasAttribute(AI_ID)) {
      root.setAttribute(AI_ID, `el-${aiIdCounter++}`);
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node; while ((node = walker.nextNode())) { if (isEditorElement(node)) continue; if (!node.hasAttribute(AI_ID)) node.setAttribute(AI_ID, `el-${aiIdCounter++}`); }
  }
  function isEditorElement(el) { return el && el.closest && !!el.closest(`.${NS}-root, .${NS}-layer-host`); }
  function isTypingTarget(el) {
    return !!(el && (
      (el.closest && el.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]')) ||
      el.isContentEditable
    ));
  }
  function ensureSelectorLayerHost() {
    if (layerHost && layerHost.isConnected) return layerHost;
    layerHost = document.createElement("div");
    layerHost.className = `${NS}-layer-host`;
    if (typeof layerHost.showPopover === "function") layerHost.setAttribute("popover", "manual");
    (document.documentElement || document.body).appendChild(layerHost);
    try { if (typeof layerHost.showPopover === "function") layerHost.showPopover(); } catch (_) {}
    return layerHost;
  }
  function bringSelectorLayerToFront() {
    const host = ensureSelectorLayerHost();
    if (typeof host.showPopover === "function") {
      try {
        if (host.matches(":popover-open")) host.hidePopover();
        host.showPopover();
        return;
      } catch (_) {}
    }
    const root = document.documentElement || document.body;
    if (host.parentNode === root) root.appendChild(host);
  }
  function mountSelectorSurface(surface) {
    ensureSelectorLayerHost().appendChild(surface);
    bringSelectorLayerToFront();
    return surface;
  }
  function scheduleSelectorLayerRefresh() {
    if (layerRafPending) return;
    layerRafPending = true;
    requestAnimationFrame(() => {
      layerRafPending = false;
      const host = ensureSelectorLayerHost();
      const surfaces = Array.from(document.querySelectorAll(`.${NS}-root`));
      const overlayClasses = [`${NS}-hover-box`, `${NS}-marquee`, `${NS}-sel-box`, `${NS}-sel-corner`, `${NS}-sel-label`, `${NS}-annotate-btn`];
      const panelClasses = [`${NS}-chat`, `${NS}-settings`, `${NS}-annotate-popover`, `${NS}-revprompt`];
      for (const surface of surfaces) {
        if (!overlayClasses.concat(panelClasses).some(name => surface.classList.contains(name))) {
          host.appendChild(surface);
        }
      }
      for (const name of overlayClasses.concat(panelClasses)) {
        document.querySelectorAll(`.${name}`).forEach(surface => {
          host.appendChild(surface);
        });
      }
    });
  }
  function byAiId(id) { return document.querySelector(`[${AI_ID}="${id}"]`); }
