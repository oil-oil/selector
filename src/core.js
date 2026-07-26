/**
 * Selector — visual element picker with per-element annotations.
 * Inject via bookmarklet. Click = select, Shift+click = multi, Drag = marquee.
 */
(function () {
  "use strict";
  if (document.querySelector(".ai-editor-root")) return;

  const NS = "ai-editor";
  // ── Host capability seam (HOST_CONTRACT.md §0/§1) ────────────
  // The closed-source extension injects window.__SELECTOR_HOST__ in the MAIN
  // world before this core runs, supplying stronger implementations (cross-tab
  // capture, cross-origin asset fetch, license gating, extra UI rows, ...).
  // For the free bookmarklet __SELECTOR_HOST__ is undefined → HOST = {} → every
  // seam below falls through to its existing else-branch and behaves exactly as
  // before. Each Host method is OPTIONAL: callers must always keep the original
  // logic as the fallback. Never make a path Host-only.
  const HOST = (typeof window !== "undefined" && window.__SELECTOR_HOST__) || {};
  const AI_ID = "data-ai-id";
  const VERSION = "0.3.9";
  // Cross-link targets for the settings-panel promo (bookmarklet ⇄ Pro extension).
  const EXT_LANDING_URL = "https://oil-oil.github.io/selector-extension/";
  const BOOKMARKLET_URL = "https://oil-oil.github.io/selector/";

  // ── i18n ─────────────────────────────────────────────────────
  const DICT = {
    en: {
      selecting:"Selecting", paused:"Paused", copyPrompt:"Copy Prompt", copyReport:"Amaterasu!", copyCombined:"Copy + Screenshot", copyScreenshot:"Copy Screenshot",
      copied:"Copied", copiedFallback:"Copied via fallback", copyFailed:"Copy failed", copiedSaved:"Copied + Saved", exported:"Markdown Exported", screenshotCopied:"Screenshot Copied", screenshotFailed:"Screenshot Failed",
      settings:"Settings", lang:"Language", addInstruction:"Add instruction", needLicense:"Activate to use",
      instrPlaceholder:"Instruction for this element\u2026", clear:"Clear", done:"Done",
      clearAll:"Clear all", minimize:"Minimize", restore:"Restore", close:"Close",
      groupGeneral:"General",
      skSelect:"Select", skMulti:"Multi", skNavigate:"Navigate", skPause:"Pause",
      skCopy:"Copy", skScreenshot:"Screenshot", skMarkdown:"Markdown", skActivate:"Activate", skUndo:"Undo", skClear:"Clear",
      optCombined:"Screenshot + text combined", optCombinedDesc:"Copy screenshot and prompt text together",
      optSharingan:"Sharingan mode", optSharinganDesc:"Copy a pixel-faithful clone report for AI — full DOM, hover/dark CSS, fonts, animations, and design tokens",
      savePng:"Save PNG",
      proPromoTitle:"Selector Pro", proPromoDesc:"Full-element & full-page shots, cross-origin fidelity, synced settings, Markdown / JSON.", proPromoCta:"Get the extension →",
      freePromoTitle:"Free bookmarklet", freePromoDesc:"No install — drag a bookmark, use on any page.", freePromoCta:"Open on GitHub →",
      licLabel:"License", licActive:"Active", licNone:"Inactive",
      licActiveNote:"Pro is active — thank you", licNoneNote:"Activate to unlock everything",
      licActivate:"Activate →", licManage:"Manage subscription →", freeLink:"Free bookmarklet version →",
      skRevPrompt:"→ Prompt", revRunning:"Reading image…", revNoImage:"Select an element first", revFailed:"Couldn't generate a prompt",
      revTitle:"Image → generation prompt", revCopied:"Copied to clipboard — paste into your image model.", copyGenPrompt:"Copy image prompt",
      mdTitle:"Markdown ready", copyMarkdown:"Copy Markdown",
      errUnsupported:"Browser not supported", errCancelled:"Screen choice cancelled",
      errPermission:"Screen recording blocked", errClipboard:"Clipboard blocked",
      errCapture:"Screenshot failed", errEmpty:"Selected area is empty",
    },
    zh: {
      selecting:"\u9009\u62e9\u4e2d", paused:"\u5df2\u6682\u505c", copyPrompt:"\u590d\u5236\u63d0\u793a\u8bcd", copyReport:"\u963f\u739b\u7279\u62c9\u65af\uff01", copyCombined:"\u590d\u5236\u56fe\u6587", copyScreenshot:"\u590d\u5236\u622a\u56fe",
      copied:"\u5df2\u590d\u5236", copiedFallback:"\u5df2\u901a\u8fc7\u5907\u7528\u65b9\u5f0f\u590d\u5236", copyFailed:"\u590d\u5236\u5931\u8d25", copiedSaved:"\u5df2\u590d\u5236\u5e76\u4fdd\u5b58", exported:"Markdown \u5df2\u5bfc\u51fa", screenshotCopied:"\u622a\u56fe\u5df2\u590d\u5236", screenshotFailed:"\u622a\u56fe\u5931\u8d25",
      settings:"\u8bbe\u7f6e", lang:"\u8bed\u8a00", addInstruction:"\u6dfb\u52a0\u6307\u4ee4", needLicense:"\u6fc0\u6d3b\u540e\u5373\u53ef\u4f7f\u7528",
      instrPlaceholder:"\u6b64\u5143\u7d20\u7684\u4fee\u6539\u6307\u4ee4\u2026", clear:"\u6e05\u9664", done:"\u5b8c\u6210",
      clearAll:"\u6e05\u9664\u5168\u90e8", minimize:"\u6700\u5c0f\u5316", restore:"\u6062\u590d", close:"\u5173\u95ed",
      groupGeneral:"\u901a\u7528",
      skSelect:"\u9009\u62e9", skMulti:"\u591a\u9009", skNavigate:"\u5bfc\u822a", skPause:"\u6682\u505c",
      skCopy:"\u590d\u5236", skScreenshot:"\u622a\u56fe", skMarkdown:"Markdown", skActivate:"\u6fc0\u6d3b", skUndo:"\u64a4\u9500", skClear:"\u6e05\u9664",
      optCombined:"\u622a\u56fe + \u6587\u672c\u5408\u5e76", optCombinedDesc:"\u540c\u65f6\u590d\u5236\u622a\u56fe\u548c\u63d0\u793a\u8bcd\u6587\u672c",
      optSharingan:"\u5199\u8f6e\u773c\u6a21\u5f0f", optSharinganDesc:"\u590d\u5236\u4f9b AI \u50cf\u7d20\u7ea7\u590d\u523b\u7684\u62a5\u544a \u2014\u2014 \u5b8c\u6574 DOM\u3001hover/dark \u6837\u5f0f\u3001\u5b57\u4f53\u3001\u52a8\u753b\u4e0e\u8bbe\u8ba1 token",
      savePng:"\u4fdd\u5b58 PNG",
      proPromoTitle:"Selector Pro", proPromoDesc:"\u5b8c\u6574\u5143\u7d20/\u6574\u9875\u622a\u56fe\u3001\u8de8\u57df\u9ad8\u4fdd\u771f\u3001\u8bbe\u7f6e\u540c\u6b65\u3001Markdown / JSON\u3002", proPromoCta:"\u83b7\u53d6\u6d4f\u89c8\u5668\u6269\u5c55 \u2192",
      freePromoTitle:"\u514d\u8d39\u4e66\u7b7e\u7248", freePromoDesc:"\u514d\u5b89\u88c5 \u2014\u2014 \u62d6\u4e00\u4e2a\u4e66\u7b7e\uff0c\u4efb\u610f\u9875\u9762\u53ef\u7528\u3002", freePromoCta:"\u5728 GitHub \u6253\u5f00 \u2192",
      licLabel:"\u6388\u6743", licActive:"\u5df2\u6fc0\u6d3b", licNone:"\u672a\u6fc0\u6d3b",
      licActiveNote:"Pro \u5df2\u6fc0\u6d3b\uff0c\u611f\u8c22\u652f\u6301", licNoneNote:"\u6fc0\u6d3b\u4ee5\u89e3\u9501\u5168\u90e8\u80fd\u529b",
      licActivate:"\u6fc0\u6d3b \u2192", licManage:"\u7ba1\u7406\u8ba2\u9605 \u2192", freeLink:"\u514d\u8d39\u4e66\u7b7e\u7248 \u2192",
      skRevPrompt:"\u53cd\u63a8", revRunning:"\u8bfb\u56fe\u4e2d\u2026", revNoImage:"\u8bf7\u5148\u9009\u4e2d\u4e00\u4e2a\u5143\u7d20", revFailed:"\u53cd\u63a8\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5",
      revTitle:"\u56fe\u7247 \u2192 \u751f\u6210\u63d0\u793a\u8bcd", revCopied:"\u5df2\u590d\u5236\u5230\u526a\u8d34\u677f \u2014\u2014 \u7c98\u5230\u4f60\u7684\u751f\u56fe\u6a21\u578b\u5373\u53ef\u3002", copyGenPrompt:"\u590d\u5236\u751f\u56fe\u63d0\u793a\u8bcd",
      mdTitle:"Markdown \u5df2\u751f\u6210", copyMarkdown:"\u590d\u5236 Markdown",
      errUnsupported:"\u6d4f\u89c8\u5668\u4e0d\u652f\u6301", errCancelled:"\u5df2\u53d6\u6d88\u5c4f\u5e55\u9009\u62e9",
      errPermission:"\u5c4f\u5e55\u5f55\u5236\u6743\u9650\u53d7\u9650", errClipboard:"\u526a\u8d34\u677f\u6743\u9650\u53d7\u9650",
      errCapture:"\u622a\u56fe\u5931\u8d25", errEmpty:"\u9009\u4e2d\u533a\u57df\u65e0\u6cd5\u622a\u56fe",
    }
  };
  let lang = "en";
  // Host may pre-seed the language (read once at init); else read localStorage;
  // else follow the browser's UI language so i18n consistently matches the user.
  try { lang = HOST.initialLang || localStorage.getItem(NS + "-lang") || (/^zh\b/i.test(navigator.language || "") ? "zh" : "en"); } catch(_) {}
  function t(k) { return (DICT[lang] && DICT[lang][k]) || DICT.en[k] || k; }

  // ── Settings ─────────────────────────────────────────────────
  const DEFAULTS = { combined:false, sharingan:false };
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
  function saveSettings() {
    // Host persists settings (fire-and-forget); bookmarklet uses localStorage.
    if (HOST.setSettings) { HOST.setSettings(settings); return; }
    try { localStorage.setItem(NS + "-settings", JSON.stringify(settings)); } catch(_) {}
  }

  // ── State ────────────────────────────────────────────────────
  let selectedElements = [], chatPanel = null, hoverBox = null, aiIdCounter = 0;
  let rafPending = false, lastMoveTarget = null, minimized = false, paused = false;
  const selOverlays = new Map(), annotations = new Map(), listeners = [];
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
    applyI18n();
  }

  // ── Destroy ──────────────────────────────────────────────────
  function destroy() {
    for (const { target, type, fn, capture } of listeners) target.removeEventListener(type, fn, capture);
    destroyAllOverlays(); removeAnnotationPopover(); closeSettings();
    if (hoverBox) hoverBox.remove();
    if (chatPanel) chatPanel.remove();
  }

  // ── AI-ID ────────────────────────────────────────────────────
  function assignAiIds(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node; while ((node = walker.nextNode())) { if (isEditorElement(node)) continue; if (!node.hasAttribute(AI_ID)) node.setAttribute(AI_ID, `el-${aiIdCounter++}`); }
  }
  function isEditorElement(el) { return el && el.closest && !!el.closest(`.${NS}-root`); }
  function byAiId(id) { return document.querySelector(`[${AI_ID}="${id}"]`); }
