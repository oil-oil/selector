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
  const VERSION = "0.3.7";
  // Cross-link targets for the settings-panel promo (bookmarklet ⇄ Pro extension).
  const EXT_LANDING_URL = "https://oil-oil.github.io/selector-extension/";
  const BOOKMARKLET_URL = "https://oil-oil.github.io/selector/";

  // ── i18n ─────────────────────────────────────────────────────
  const DICT = {
    en: {
      selecting:"Selecting", paused:"Paused", copyPrompt:"Copy Prompt", copyReport:"Amaterasu!", copyCombined:"Copy + Screenshot", copyScreenshot:"Copy Screenshot",
      copied:"Copied", copiedSaved:"Copied + Saved", exported:"Markdown Exported", screenshotCopied:"Screenshot Copied", screenshotFailed:"Screenshot Failed",
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
      mdTitle:"Copied Markdown", copyMarkdown:"Copy Markdown",
      errUnsupported:"Browser not supported", errCancelled:"Screen choice cancelled",
      errPermission:"Screen recording blocked", errClipboard:"Clipboard blocked",
      errCapture:"Screenshot failed", errEmpty:"Selected area is empty",
    },
    zh: {
      selecting:"\u9009\u62e9\u4e2d", paused:"\u5df2\u6682\u505c", copyPrompt:"\u590d\u5236\u63d0\u793a\u8bcd", copyReport:"\u963f\u739b\u7279\u62c9\u65af\uff01", copyCombined:"\u590d\u5236\u56fe\u6587", copyScreenshot:"\u590d\u5236\u622a\u56fe",
      copied:"\u5df2\u590d\u5236", copiedSaved:"\u5df2\u590d\u5236\u5e76\u4fdd\u5b58", exported:"Markdown \u5df2\u5bfc\u51fa", screenshotCopied:"\u622a\u56fe\u5df2\u590d\u5236", screenshotFailed:"\u622a\u56fe\u5931\u8d25",
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
      mdTitle:"\u5df2\u590d\u5236 Markdown", copyMarkdown:"\u590d\u5236 Markdown",
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

  // ── Resolve target ───────────────────────────────────────────
  function resolveTarget(el) {
    const action = closestActionElement(el);
    if (action && !isEditorElement(action) && isVisible(action)) return action;
    let cur = el;
    while (cur && cur !== document.body && cur !== document.documentElement) {
      if (isEditorElement(cur)) { cur = cur.parentElement; continue; }
      if (!isVisible(cur)) { cur = cur.parentElement; continue; }
      if (isMeaningful(cur)) return cur;
      cur = cur.parentElement;
    }
    return el;
  }

  function closestActionElement(el) {
    return el && el.closest && el.closest("button,a,input,select,textarea,[role='button'],[role='link'],[role='menuitem'],[role='tab'],[role='checkbox'],[role='radio']");
  }
  function isVisible(el) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 && r.height < 2) return false;
    const s = getComputedStyle(el);
    return s.display !== "none" && s.visibility !== "hidden" && s.opacity !== "0";
  }
  function isMeaningful(el) {
    if (isAtomicElement(el)) return true;
    if (hasDirectText(el)) return true;
    if (el.querySelector("img,video,canvas,svg,button,a,input,select,textarea,iframe")) return true;
    return el.children.length > 1;
  }

  function isAtomicElement(el) {
    const tag = el.tagName && el.tagName.toLowerCase();
    if (/^(button|a|input|select|textarea|img|video|canvas|svg|iframe|h[1-6]|p|li|dt|dd|summary)$/.test(tag)) return true;
    return !!el.getAttribute("role");
  }
  function hasDirectText(el) {
    for (const n of el.childNodes) { if (n.nodeType === 3 && n.textContent.trim()) return true; }
    return false;
  }

  // ── Hover overlay ────────────────────────────────────────────
  function createHoverBox() { hoverBox = document.createElement("div"); hoverBox.className = `${NS}-hover-box`; document.body.appendChild(hoverBox); }
  function showHover(el) {
    if (!el || isEditorElement(el) || selectedElements.includes(el)) { hoverBox.style.opacity = "0"; return; }
    const r = el.getBoundingClientRect();
    hoverBox.style.top = (r.top-1)+"px"; hoverBox.style.left = (r.left-1)+"px";
    hoverBox.style.width = (r.width+2)+"px"; hoverBox.style.height = (r.height+2)+"px"; hoverBox.style.opacity = "1";
  }

  // ── Mouse handling ───────────────────────────────────────────
  function handleMouseMove(e) {
    if (minimized || paused) return;
    if (dragState) {
      const dx = e.clientX - dragState.startX, dy = e.clientY - dragState.startY;
      if (!dragState.isDragging && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
        dragState.isDragging = true;
        dragState.marquee = document.createElement("div"); dragState.marquee.className = `${NS}-marquee`;
        document.body.appendChild(dragState.marquee); showHover(null);
      }
      if (dragState.isDragging) {
        dragState.marquee.style.left = Math.min(e.clientX, dragState.startX)+"px";
        dragState.marquee.style.top = Math.min(e.clientY, dragState.startY)+"px";
        dragState.marquee.style.width = Math.abs(dx)+"px"; dragState.marquee.style.height = Math.abs(dy)+"px";
        return;
      }
    }
    lastMoveTarget = resolveTarget(e.target);
    if (!rafPending) { rafPending = true; requestAnimationFrame(() => { showHover(lastMoveTarget); rafPending = false; }); }
  }
  function handleMouseDown(e) {
    if (isEditorElement(e.target) || minimized || paused || e.button !== 0) return;
    if (e.shiftKey) e.preventDefault();
    dragState = { startX: e.clientX, startY: e.clientY, isDragging: false, marquee: null };
  }
  function handleMouseUp(e) {
    if (!dragState || !dragState.isDragging) { dragState = null; return; }
    wasJustDragging = true;
    const mRect = dragState.marquee.getBoundingClientRect();
    dragState.marquee.remove(); dragState = null;
    pushHistory(); if (!e.shiftKey) clearSelection();
    document.querySelectorAll(`[${AI_ID}]`).forEach(el => {
      if (isEditorElement(el) || !isVisible(el) || !isMeaningful(el)) return;
      if (rectsIntersect(mRect, el.getBoundingClientRect())) addSelection(el);
    });
    updateTags(); setTimeout(() => { wasJustDragging = false; }, 0);
  }
  function cancelDrag() { if (dragState && dragState.marquee) dragState.marquee.remove(); dragState = null; }
  function rectsIntersect(a, b) { return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom); }
  function handleClick(e) {
    if (isEditorElement(e.target) || minimized || paused || wasJustDragging) return;
    e.preventDefault(); e.stopPropagation(); removeAnnotationPopover();
    const sel = window.getSelection(); if (sel) sel.removeAllRanges();
    pushHistory(); const el = resolveTarget(e.target);
    if (e.shiftKey) toggleElement(el); else { clearSelection(); addSelection(el); }
    updateTags();
  }

  // ── Selection overlays ──────────────────────────────────────
  function createSelOverlay(el) {
    const aiId = el.getAttribute(AI_ID); if (selOverlays.has(aiId)) return;
    const box = document.createElement("div"); box.className = `${NS}-sel-box`;
    const corners = [0,1,2,3].map(i => { const c = document.createElement("div"); c.className = `${NS}-sel-corner`; c.style.animationDelay = `${i*28}ms`; document.body.appendChild(c); return c; });
    const label = document.createElement("div"); label.className = `${NS}-sel-label`; label.textContent = elementLabel(el);
    const annotateBtn = document.createElement("button");
    annotateBtn.className = `${NS}-root ${NS}-annotate-btn`; annotateBtn.title = t("addInstruction");
    annotateBtn.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
    annotateBtn.onclick = (e) => { e.stopPropagation(); e.preventDefault(); showAnnotationPopover(el, annotateBtn); };
    document.body.appendChild(box); document.body.appendChild(label); document.body.appendChild(annotateBtn);
    selOverlays.set(aiId, { box, corners, label, annotateBtn }); positionSelOverlay(el);
  }
  function positionSelOverlay(el) {
    const aiId = el.getAttribute(AI_ID), ov = selOverlays.get(aiId); if (!ov) return;
    const r = el.getBoundingClientRect(), pad = 2;
    ov.box.style.top=(r.top-pad)+"px"; ov.box.style.left=(r.left-pad)+"px"; ov.box.style.width=(r.width+pad*2)+"px"; ov.box.style.height=(r.height+pad*2)+"px";
    const cs=6, pos=[{top:r.top-pad-cs/2,left:r.left-pad-cs/2},{top:r.top-pad-cs/2,left:r.right+pad-cs/2},{top:r.bottom+pad-cs/2,left:r.left-pad-cs/2},{top:r.bottom+pad-cs/2,left:r.right+pad-cs/2}];
    for (let i=0;i<4;i++) { ov.corners[i].style.top=pos[i].top+"px"; ov.corners[i].style.left=pos[i].left+"px"; }
    ov.label.style.top=(r.top-pad-20)+"px"; ov.label.style.left=(r.left-pad)+"px";
    ov.annotateBtn.style.top=(r.top-pad-22)+"px"; ov.annotateBtn.style.left=(r.right+pad+4)+"px";
    ov.annotateBtn.classList.toggle(`${NS}-has-note`, annotations.has(aiId));
  }
  function positionAllOverlays() { for (const el of selectedElements) positionSelOverlay(el); }
  function destroySelOverlay(aiId) { const ov=selOverlays.get(aiId); if(!ov)return; ov.box.remove(); ov.corners.forEach(c=>c.remove()); ov.label.remove(); ov.annotateBtn.remove(); selOverlays.delete(aiId); }
  function destroyAllOverlays() { for (const [aiId] of selOverlays) destroySelOverlay(aiId); }
  function addSelection(el) { if (!selectedElements.includes(el)) { selectedElements.push(el); createSelOverlay(el); } }
  function removeSelection(el) { const idx=selectedElements.indexOf(el); if(idx>=0){ selectedElements.splice(idx,1); destroySelOverlay(el.getAttribute(AI_ID)); annotations.delete(el.getAttribute(AI_ID)); } }
  function toggleElement(el) { selectedElements.includes(el) ? removeSelection(el) : addSelection(el); }
  function clearSelection() { destroyAllOverlays(); selectedElements=[]; annotations.clear(); removeAnnotationPopover(); }

  // ── History (undo) ──────────────────────────────────────────
  function pushHistory() { selectionHistory.push({ elements:[...selectedElements], annotations:new Map(annotations) }); if (selectionHistory.length>30) selectionHistory.shift(); }
  function undo() {
    if (!selectionHistory.length) return; const state=selectionHistory.pop();
    destroyAllOverlays(); removeAnnotationPopover(); selectedElements=state.elements;
    annotations.clear(); for (const [k,v] of state.annotations) annotations.set(k,v);
    for (const el of selectedElements) createSelOverlay(el); updateTags();
  }

  // ── Navigation ──────────────────────────────────────────────
  function navigateToParent() {
    if (selectedElements.length!==1) return;
    let p=selectedElements[0].parentElement;
    while(p&&p!==document.body&&p!==document.documentElement){ if(!isEditorElement(p)&&isVisible(p)){ pushHistory();clearSelection();addSelection(p);updateTags();return; } p=p.parentElement; }
  }
  function navigateToChild() {
    if (selectedElements.length!==1) return;
    for(const c of selectedElements[0].children){ if(!isEditorElement(c)&&isVisible(c)&&isMeaningful(c)){ pushHistory();clearSelection();addSelection(c);updateTags();return; } }
  }
  function navigateToSibling(dir) {
    if (selectedElements.length!==1) return; const el=selectedElements[0], par=el.parentElement; if(!par) return;
    const sibs=Array.from(par.children).filter(c=>!isEditorElement(c)&&isVisible(c)&&isMeaningful(c));
    const next=sibs[sibs.indexOf(el)+dir]; if(next){ pushHistory();clearSelection();addSelection(next);updateTags(); }
  }

  function handleKeyDown(e) {
    if (isEditorElement(e.target)&&(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA")) return;
    const mod=e.metaKey||e.ctrlKey;
    if(e.key==="Escape"){
      e.preventDefault();
      if(revPanel) closeRevPromptResult();
      else if(activePopover) removeAnnotationPopover();
      else if(settingsOpen) closeSettings();
      else if(selectedElements.length>0){ pushHistory(); clearSelection(); updateTags(); }
      else togglePaused();
      return;
    }
    if(mod&&e.key.toLowerCase()==="c"&&!e.shiftKey&&selectedElements.length>0){ e.preventDefault(); copyPrompt(); return; }
    if(mod&&e.shiftKey&&e.key.toLowerCase()==="c"&&selectedElements.length>0){ e.preventDefault(); captureScreenshot(); return; }
    if(mod&&!e.shiftKey&&e.key.toLowerCase()==="m"){ e.preventDefault(); copyAsMarkdown(); return; }
    if(mod&&!e.shiftKey&&e.key.toLowerCase()==="i"&&(HOST.reversePrompt||HOST.reversePromptStream)&&selectedElements.length>0){ e.preventDefault(); reversePromptForSelection(); return; }
    if(mod&&e.key.toLowerCase()==="z"&&!e.shiftKey){ e.preventDefault(); undo(); return; }
    if(e.key==="ArrowUp"&&selectedElements.length===1){ e.preventDefault(); navigateToParent(); return; }
    if(e.key==="ArrowDown"&&selectedElements.length===1){ e.preventDefault(); navigateToChild(); return; }
    if(e.key==="ArrowLeft"&&selectedElements.length===1){ e.preventDefault(); navigateToSibling(-1); return; }
    if(e.key==="ArrowRight"&&selectedElements.length===1){ e.preventDefault(); navigateToSibling(1); return; }
  }

  function togglePaused() {
    paused = !paused; showHover(null);
    const dot = chatPanel.querySelector(`.${NS}-status-dot`), label = chatPanel.querySelector(`.${NS}-status-label`);
    if (dot) dot.style.background = paused ? "#888" : "#4ade80";
    if (label) label.textContent = paused ? t("paused") : t("selecting");
  }

  // ── Annotation popover ──────────────────────────────────────
  function showAnnotationPopover(el, btn) {
    removeAnnotationPopover(); const aiId = el.getAttribute(AI_ID);
    const popover = document.createElement("div"); popover.className = `${NS}-root ${NS}-annotate-popover`;
    const textarea = document.createElement("textarea"); textarea.className = `${NS}-annotate-input`;
    textarea.value = annotations.get(aiId)||""; textarea.placeholder = t("instrPlaceholder"); textarea.rows = 2;
    const actions = document.createElement("div"); actions.className = `${NS}-annotate-actions`;
    const clearBtn = document.createElement("button"); clearBtn.className = `${NS}-annotate-clear`; clearBtn.textContent = t("clear");
    const doneBtn = document.createElement("button"); doneBtn.className = `${NS}-annotate-done`; doneBtn.textContent = t("done");
    const save = () => { const v=textarea.value.trim(); if(v) annotations.set(aiId,v); else annotations.delete(aiId); removeAnnotationPopover(); positionSelOverlay(el); };
    doneBtn.onclick = (e) => { e.stopPropagation(); save(); };
    clearBtn.onclick = (e) => { e.stopPropagation(); annotations.delete(aiId); removeAnnotationPopover(); positionSelOverlay(el); };
    textarea.addEventListener("keydown", (e) => { if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();save();} e.stopPropagation(); });
    textarea.addEventListener("click", (e) => e.stopPropagation());
    actions.appendChild(clearBtn); actions.appendChild(doneBtn); popover.appendChild(textarea); popover.appendChild(actions);
    const r = btn.getBoundingClientRect();
    popover.style.top = (r.bottom+6)+"px"; popover.style.right = Math.max(8, window.innerWidth-r.right)+"px";
    document.body.appendChild(popover); activePopover = popover; textarea.focus();
  }
  function removeAnnotationPopover() { if (activePopover) { activePopover.remove(); activePopover = null; } }

  // ── Settings panel ──────────────────────────────────────────
  const GEAR_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
  const CAMERA_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3.5"/></svg>';
  const SHARINGAN_ICON_SRC = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAN1wAADdcBQiibeAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAAmdEVYdFRpdGxlAFNoYXJpbmdhbiAxLjUgc291cmNlIGZpbGUgLSA0OHB4GezWSAAAACl0RVh0QXV0aG9yAEhhcmVub21lIFJhbmFpdm9hcml2b255IFJhemFuYWphdG9bgQgTAAAAIHRFWHRDcmVhdGlvbiBUaW1lAE5vdmVtYmVyIDEydGggMjAxMGDwISsAAABjdEVYdENvcHlyaWdodABDQyBBdHRyaWJ1dGlvbi1Ob25Db21tZXJjaWFsLVNoYXJlQWxpa2UgaHR0cDovL2NyZWF0aXZlY29tbW9ucy5vcmcvbGljZW5zZXMvYnktbmMtc2EvMy4wL94EGuUAAAeMSURBVFiFxZdrjCRVFcd/p7qnXzPTO++e7V0GhocrCARkBVExKuoXNZt1jTEkG6LyCHFNiC5+MAjL+ophkTUhgK8Y5JsEcOMrEUM0ShZ0IQvyTAgLw27Po6fn0dVdXV117z1+6JqemR0eC9F4kkpV5Vbd8z//87/nniuqyv/T0qf6oYh45XL5cmAHsF1Vy0A5Ga6ISAU4AhyqVCqHVdWd0rxvx8Dk5GQuDMM9wN4PbR4r7TjnTC4uDTPcm2colwd11BpNqr7PUzM1fj91gsMz1VngQC6Xu+vYsWPhuwZQLpd3Agev2nb2xJ5LzqfcW4BmE4lDPGPAxqAKeCw6+Esj5LLREdTE3HHkGR56fXpKRG6sVCoPvyMAIiLj4+O3nl3su+Unn/iInNuXR30fr91CPA9BEUCAV1ttfjpd49GazxWDffxw6wiaSsPgIM/O1fj6E0d1qtXePzMzc5u+gbMNABLn9336tPLuH334UvpaPvgNJCV4IogIAlSN5Rczi/yutoxxSiHl8cDF2xhq1FFrUadocRN+Jsc3Dj/J3+YX75+Zmbn6ZBAbRDg2NnbrlZvHdh/84CXI3DTOGMQTwEMFEI/jUcy1r8ywGBtUFVXl8+VRhlpNcBZ1DnUON18ln8ly9/YLue7xp3b/3blXgH1vykCpVNp5VrH/wQc+eYXkF2pI3MZLeYh4ncg9qDvl+lfnOB6tOu8R4aELzmI4bHQitxa1DucczlrI5mj0D7DrH//SqVa4a3Z2tqsJb+VhcnIy53newds/cJHkalW0FaDWJZN1rthYbpqqMhVGncmT66JigeF2gFpN/nE4px0mrOKaTQp+nQMXbBMROTg5OZnbACAIgj07tmyeeE9KsHU/yaPrgnDO8pjf4tmgDdCNXlXJobgoxlmDsxbnHOo6LKh25rCLNc7LZvjs2PBEEAR71gEQEQ/Ye8M5Z2BrNdRZ3IrjxLkayyN+uC5y5xyqytP1gMhanFVcbHDtNrYVYNshGsW4RJRmvsrXTj8NYG/isyPCsbGxy7cPDZTG1WFbLTxPQMHh4TkBT0CEl8KIFc2oKnEcEwQBNWPY5y+xbyjfYU0ThpzikrsC6nmUejKcn8uUnh0buxx4LA1gjNlx5cgQxm+AtYljBXU4EUQ7y2+23cl9FEX4vk8Yrha5X7daVMOQ74300y+rANYBiQ22WuWj2R6ONoIdXQAisv3C/n5cw0esBVWcJwgd9XtOqKqyHAT4vk8URSevXgD+1Ah5vh1z72iRybS3Gv3aezviomwGEdm+VgPlgXQKF4U467o5V9NRvzMxR+fmWVhYII5jRISJfI7vn3M63z5zKyOZns4yFWHKOL40u8wTrajj1K0y4JziTMxQOkWyma0BALjYoMagJhGfNbg4xiwu8mSjtS7ab20tsSutXJ1Lc+3m0XVjdadcU2twJIxXxbpSnKxl2EtBspOmAay1yRq2OAFRTUpuZw2rMzze7kS+YvmgicUCUHCpdWMAFviO3+Y3xRxZdM2ypZuOLgOqWpmPQ1TBrdAex5ilJaI44qalkOfD9Xn/ca3OY62IR4KIny8sv6EmjhvLnc32ulSoeFSdAah0GVDVyokg3PaqcYwbw1g6xfFGg+diwx9jx1PGbYjwxdhyw7Ltvp88vmJ/iB3fzDokYYB0mvnYoqqrAETkyAt+8+Pj+QLXzM4T2pBW6y37iFO2liqvGceE0OkdejIcDSNE5AgkKTDGHPpzdZ4rh4a4vVwia+J35CQtwvbeApf2FUi9ARMvJvuCc4r0ZHm00cQYcwgSBnzfP/xvz5udWl4undvw+Vl5jB9UF3n6bVgo9/TwhaEin9vUz4AxABzD4865eQ43gu53JySFczFkMryuyvNRPOv7/uEuA6rqnHMH7qlMoyKMz81xz/AAd20Z5/353DqnAlzWW+COreM8dMYWrhLorVSIpqeJKhW2VOe4c3iAz2zq6/5TSnk455D+IvcuLOGcO7DStHb7ARHJFYvFl365eWzivWEL12ySyudIDw4RZDJYBBUlLUJvO8I16rhgNUp05aagYEZG+UptmdfimLuzac7rSfNiLs9Xp+em6vX6NlUN1wEAKBaLO7ek0w/+qlySwkINjSJEQLwUCHQ2MAX3Fh23JiDE4+XRUa6bmee3uR5SAwN8uTKrJ4zZVa/XNzYkAPV6/eGKtftvrtbQ4REkk+lsscbgTKc2uNgk1W1NmXWadD+uO+aM4aylZb44uIm+wUFurtaoWLt/rfMNDCSpkP7+/vsuzWV3f3d0lEJ9CddoJGMrKlh5XhN4dxrtPnt9fTRPO51bXn6Zf4bt+33f39CUvmlb3tfXd+uWnp5bbhsZlnM9cIuLuHZ79ZuNzHfNy2bxBgd5wcG+2oIej6L9jUbj1NrytVYoFHZ6nnfwU72FiesHBymjuFYLF7YgKdkAkkpBOoWXy+Pl81QQfrq4yCPNYMo5d2MQBO/sYHISG7ne3t49wN73ZTOlj+ULXJjPMZxKMZROAbBgLDVreaYV8tdWwHPtaBY40Gw271pR+7sGsAaIl8/nu4dTOttp93CaXEeAQ61W6793OP1f238AQw7/dVTED/cAAAAASUVORK5CYII=";
  const SHARINGAN_ICON = `<img class="${NS}-sharingan-icon" src="${SHARINGAN_ICON_SRC}" alt="" aria-hidden="true">`;
  // Small stroke icons for the other rows so each setting reads at a glance.
  const ICON_COMBINED = `<svg class="${NS}-setting-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>`;
  const ICON_KEY = `<svg class="${NS}-setting-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4"/><path d="M10.85 12.15 19 4"/><path d="M18 5l2 2"/><path d="M15 8l2 2"/></svg>`;
  const ICON_BOOKMARK = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`;
  const SETTING_ICONS = { combined: ICON_COMBINED };

  function mkToggle(key) {
    const row = document.createElement("div"); row.className = `${NS}-setting-row`;
    row.dataset.settingKey = key;
    const info = document.createElement("div"); info.className = `${NS}-setting-info`;
    const labelLine = document.createElement("span"); labelLine.className = `${NS}-setting-label-line`;
    if (key === "sharingan") labelLine.innerHTML = SHARINGAN_ICON;
    else if (SETTING_ICONS[key]) labelLine.innerHTML = SETTING_ICONS[key];
    const lbl = document.createElement("span"); lbl.className = `${NS}-setting-label`; lbl.textContent = t("opt" + key[0].toUpperCase() + key.slice(1));
    labelLine.appendChild(lbl);
    const desc = document.createElement("span"); desc.className = `${NS}-setting-desc`; desc.textContent = t("opt" + key[0].toUpperCase() + key.slice(1) + "Desc");
    info.appendChild(labelLine); info.appendChild(desc);
    const toggle = document.createElement("label"); toggle.className = `${NS}-toggle`;
    const input = document.createElement("input"); input.type = "checkbox"; input.checked = !!settings[key];
    const slider = document.createElement("span"); slider.className = `${NS}-toggle-slider`;
    toggle.appendChild(input); toggle.appendChild(slider);
    input.onchange = () => {
      settings[key] = input.checked; saveSettings();
      applyI18n();
      // Visual feedback: flash the row
      row.classList.remove(`${NS}-setting-flash`);
      void row.offsetWidth; // force reflow to restart animation
      row.classList.add(`${NS}-setting-flash`);
    };
    row.appendChild(info); row.appendChild(toggle); return row;
  }

  // ── Host UI extra rows (HOST_CONTRACT.md §1.6) ──────────────
  // These reuse the exact markup/classes of mkToggle so extension-supplied rows
  // are visually consistent with the built-in ones. Labels come from the extra
  // descriptor (labelEn/labelZh/descEn/descZh) rather than the DICT, and writes
  // go to settings[key] + saveSettings(). Only reached when HOST.uiExtras exists.
  function extraText(extra, base) {
    return lang === "zh" ? (extra[base + "Zh"] || extra[base + "En"] || "") : (extra[base + "En"] || extra[base + "Zh"] || "");
  }
  function mkExtraToggle(extra) {
    if (!extra || !extra.key) return null;
    const row = document.createElement("div"); row.className = `${NS}-setting-row`;
    row.dataset.settingExtra = extra.key;
    const info = document.createElement("div"); info.className = `${NS}-setting-info`;
    const labelLine = document.createElement("span"); labelLine.className = `${NS}-setting-label-line`;
    const lbl = document.createElement("span"); lbl.className = `${NS}-setting-label`; lbl.textContent = extraText(extra, "label");
    labelLine.appendChild(lbl);
    const descText = extraText(extra, "desc");
    info.appendChild(labelLine);
    if (descText) { const desc = document.createElement("span"); desc.className = `${NS}-setting-desc`; desc.textContent = descText; info.appendChild(desc); }
    const toggle = document.createElement("label"); toggle.className = `${NS}-toggle`;
    const input = document.createElement("input"); input.type = "checkbox"; input.checked = !!settings[extra.key];
    const slider = document.createElement("span"); slider.className = `${NS}-toggle-slider`;
    toggle.appendChild(input); toggle.appendChild(slider);
    input.onchange = () => {
      settings[extra.key] = input.checked; saveSettings();
      applyI18n();
      row.classList.remove(`${NS}-setting-flash`);
      void row.offsetWidth;
      row.classList.add(`${NS}-setting-flash`);
    };
    row.appendChild(info); row.appendChild(toggle); return row;
  }
  function mkExtraSelect(extra) {
    if (!extra || !extra.key) return null;
    const row = document.createElement("div"); row.className = `${NS}-setting-row`;
    row.dataset.settingExtra = extra.key;
    const info = document.createElement("div"); info.className = `${NS}-setting-info`;
    const labelLine = document.createElement("span"); labelLine.className = `${NS}-setting-label-line`;
    const lbl = document.createElement("span"); lbl.className = `${NS}-setting-label`; lbl.textContent = extraText(extra, "label");
    labelLine.appendChild(lbl);
    const descText = extraText(extra, "desc");
    info.appendChild(labelLine);
    if (descText) { const desc = document.createElement("span"); desc.className = `${NS}-setting-desc`; desc.textContent = descText; info.appendChild(desc); }
    const select = document.createElement("select"); select.className = `${NS}-setting-select`;
    (extra.options || []).forEach(opt => {
      const o = document.createElement("option"); o.value = opt.value;
      o.textContent = lang === "zh" ? (opt.labelZh || opt.labelEn || opt.value) : (opt.labelEn || opt.labelZh || opt.value);
      if (settings[extra.key] === opt.value) o.selected = true;
      select.appendChild(o);
    });
    select.onchange = (e) => {
      e.stopPropagation();
      settings[extra.key] = select.value; saveSettings();
      applyI18n();
      row.classList.remove(`${NS}-setting-flash`);
      void row.offsetWidth;
      row.classList.add(`${NS}-setting-flash`);
    };
    row.appendChild(info); row.appendChild(select); return row;
  }

  function mkSettingGroup(key) {
    const group = document.createElement("div");
    group.className = `${NS}-setting-group-title`;
    group.dataset.settingGroup = key;
    group.textContent = t("group" + key[0].toUpperCase() + key.slice(1));
    return group;
  }

  function createSettingsPanel() {
    settingsPanel = document.createElement("div"); settingsPanel.className = `${NS}-root ${NS}-settings`;
    const hdr = document.createElement("div"); hdr.className = `${NS}-settings-header`;
    const title = document.createElement("span"); title.className = `${NS}-settings-title`; title.textContent = t("settings");
    const langWrap = document.createElement("div"); langWrap.className = `${NS}-setting-row`; langWrap.dataset.settingKey = "lang";
    const langInfo = document.createElement("div"); langInfo.className = `${NS}-setting-info`;
    const langLbl = document.createElement("span"); langLbl.className = `${NS}-setting-label`; langLbl.textContent = t("lang");
    langInfo.appendChild(langLbl); langWrap.appendChild(langInfo);
    const langBtn = document.createElement("button"); langBtn.className = `${NS}-lang-btn`;
    langBtn.textContent = lang === "zh" ? "\u4e2d\u6587 / EN" : "EN / \u4e2d\u6587";
    langBtn.onclick = (e) => {
      e.stopPropagation(); lang = lang === "zh" ? "en" : "zh";
      // Host persists language; bookmarklet uses localStorage.
      if (HOST.setLang) HOST.setLang(lang);
      else { try { localStorage.setItem(NS + "-lang", lang); } catch(_) {} }
      langBtn.textContent = lang === "zh" ? "\u4e2d\u6587 / EN" : "EN / \u4e2d\u6587";
      applyI18n(); refreshSettingsLabels();
    };
    langWrap.appendChild(langBtn);
    const closeBtn = document.createElement("button"); closeBtn.className = `${NS}-settings-close`;
    closeBtn.innerHTML = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
    closeBtn.title = t("close"); closeBtn.onclick = closeSettings;
    hdr.appendChild(title); hdr.appendChild(closeBtn); settingsPanel.appendChild(hdr);
    settingsPanel.appendChild(mkSettingGroup("general"));
    settingsPanel.appendChild(langWrap);
    settingsPanel.appendChild(mkToggle("combined"));
    settingsPanel.appendChild(mkToggle("sharingan"));
    // ── Host UI extras (HOST_CONTRACT.md §1.6) ────────────────
    // Bookmarklet has no HOST.uiExtras → loop is empty → panel is pixel-identical.
    // Extension appends extra toggle/select rows here, reusing existing styles.
    (HOST.uiExtras || []).forEach(extra => {
      const row = extra && extra.type === "select" ? mkExtraSelect(extra) : mkExtraToggle(extra);
      if (row) settingsPanel.appendChild(row);
    });
    // Extension → license status + activate/manage (all state lives here, no
    // popup window). Bookmarklet → a quiet "get the Pro extension" cross-link.
    settingsPanel.appendChild(HOST.licensing ? mkSettingsLicense() : mkSettingsPromo());
    document.body.appendChild(settingsPanel);
    const cr = chatPanel.getBoundingClientRect();
    settingsPanel.style.bottom = (window.innerHeight - cr.top + 4) + "px";
    settingsPanel.style.right = Math.max(8, window.innerWidth - cr.right) + "px";
  }

  function refreshSettingsLabels() {
    if (!settingsPanel) return;
    settingsPanel.querySelectorAll(`.${NS}-setting-group-title`).forEach(group => {
      const k = group.dataset.settingGroup;
      group.textContent = t("group" + k[0].toUpperCase() + k.slice(1));
    });
    settingsPanel.querySelectorAll(`.${NS}-setting-row[data-setting-key]`).forEach(row => {
      const k = row.dataset.settingKey;
      if (k === "lang") return;
      const lbl = row.querySelector(`.${NS}-setting-label`); if (lbl) lbl.textContent = t("opt" + k[0].toUpperCase() + k.slice(1));
      const desc = row.querySelector(`.${NS}-setting-desc`); if (desc) desc.textContent = t("opt" + k[0].toUpperCase() + k.slice(1) + "Desc");
    });
    const stTitle = settingsPanel.querySelector(`.${NS}-settings-title`); if (stTitle) stTitle.textContent = t("settings");
    const langRow = settingsPanel.querySelector(`.${NS}-setting-row[data-setting-key="lang"]`);
    if (langRow) { const ll = langRow.querySelector(`.${NS}-setting-label`); if (ll) ll.textContent = t("lang"); }
    const promo = settingsPanel.querySelector(`.${NS}-settings-promo`);
    if (promo) {
      const isExt = !!HOST.isExtension;
      const tt = promo.querySelector(`.${NS}-settings-promo-title`); if (tt) tt.textContent = t(isExt ? "freePromoTitle" : "proPromoTitle");
      const dd = promo.querySelector(`.${NS}-settings-promo-desc`); if (dd) dd.textContent = t(isExt ? "freePromoDesc" : "proPromoDesc");
      const cc = promo.querySelector(`.${NS}-settings-promo-cta`); if (cc) cc.textContent = t(isExt ? "freePromoCta" : "proPromoCta");
    }
    const licBlock = settingsPanel.querySelector(`.${NS}-settings-license`);
    if (licBlock && HOST.licensing) {
      const state = licBlock.dataset.licState || "none";
      const lbl = licBlock.querySelector(`.${NS}-license-label-text`); if (lbl) lbl.textContent = t("licLabel");
      const badge = licBlock.querySelector(`.${NS}-license-state`); if (badge) badge.textContent = licStateName(state);
      const desc = licBlock.querySelector(`.${NS}-license-desc`); if (desc) desc.textContent = licDescText(HOST.licensing);
      const act = licBlock.querySelector(`.${NS}-license-action`); if (act) act.textContent = licActionText(HOST.licensing);
    }
  }

  // Subtle cross-link shown at the bottom of the settings panel.
  // Bookmarklet (HOST absent / not extension) → upsell the Pro extension.
  // Extension (HOST.isExtension) → point to the free bookmarklet on GitHub.
  function mkSettingsPromo() {
    const isExt = !!HOST.isExtension;
    const wrap = document.createElement("a");
    wrap.className = `${NS}-settings-promo`;
    wrap.href = isExt ? BOOKMARKLET_URL : EXT_LANDING_URL;
    wrap.target = "_blank"; wrap.rel = "noopener noreferrer";
    wrap.onclick = (e) => e.stopPropagation();
    const title = document.createElement("span"); title.className = `${NS}-settings-promo-title`;
    title.textContent = t(isExt ? "freePromoTitle" : "proPromoTitle");
    const desc = document.createElement("span"); desc.className = `${NS}-settings-promo-desc`;
    desc.textContent = t(isExt ? "freePromoDesc" : "proPromoDesc");
    const cta = document.createElement("span"); cta.className = `${NS}-settings-promo-cta`;
    cta.textContent = t(isExt ? "freePromoCta" : "proPromoCta");
    wrap.appendChild(title); wrap.appendChild(desc); wrap.appendChild(cta);
    return wrap;
  }

  // ── License status block (extension only) ──────────────────
  // Shows trial / active / inactive state + the trial countdown, plus an
  // Activate or Manage link, and a quiet link back to the free bookmarklet —
  // i.e. everything the old popup window showed, now inside the in-page menu.
  function licStateName(state) {
    return state === "active" ? t("licActive") : t("licNone");
  }
  function licDescText(lic) {
    const state = lic.state || (lic.active ? "active" : "none");
    return state === "active" ? t("licActiveNote") : t("licNoneNote");
  }
  function licActionText(lic) {
    const state = lic.state || (lic.active ? "active" : "none");
    return state === "active" ? t("licManage") : t("licActivate");
  }
  function licActionUrl(lic) {
    const state = lic.state || (lic.active ? "active" : "none");
    // Activate → the marketing site (it carries the details + purchase flow).
    // Manage → Stripe customer portal.
    return state === "active" ? (lic.portalUrl || EXT_LANDING_URL) : EXT_LANDING_URL;
  }
  function mkSettingsLicense() {
    const lic = HOST.licensing || { state: "none" };
    const state = lic.state || (lic.active ? "active" : "none");
    const wrap = document.createElement("div");
    wrap.className = `${NS}-settings-license`;
    wrap.dataset.licState = state;

    const row = document.createElement("div"); row.className = `${NS}-license-row`;
    const label = document.createElement("span"); label.className = `${NS}-license-label`;
    label.innerHTML = ICON_KEY;
    const labelText = document.createElement("span"); labelText.className = `${NS}-license-label-text`; labelText.textContent = t("licLabel");
    label.appendChild(labelText);
    const badge = document.createElement("span"); badge.className = `${NS}-license-state`; badge.dataset.state = state; badge.textContent = licStateName(state);
    row.appendChild(label); row.appendChild(badge); wrap.appendChild(row);

    const desc = document.createElement("span"); desc.className = `${NS}-license-desc`; desc.textContent = licDescText(lic);
    wrap.appendChild(desc);

    const action = document.createElement("a"); action.className = `${NS}-license-action`;
    action.href = licActionUrl(lic); action.target = "_blank"; action.rel = "noopener noreferrer";
    action.textContent = licActionText(lic);
    action.onclick = (e) => { e.stopPropagation(); };
    wrap.appendChild(action);
    // The free bookmarklet is presented on the marketing site, not in this menu.

    return wrap;
  }

  function toggleSettings() {
    settingsOpen ? closeSettings() : openSettings();
  }
  function openSettings() {
    if (settingsOpen) return; settingsOpen = true; createSettingsPanel();
  }
  function closeSettings() {
    settingsOpen = false; if (settingsPanel) { settingsPanel.remove(); settingsPanel = null; }
  }

  // ── i18n application ────────────────────────────────────────
  function applyI18n() {
    if (!chatPanel) return;
    const sl = chatPanel.querySelector(`.${NS}-status-label`);
    if (sl) sl.textContent = paused ? t("paused") : t("selecting");
    const cb = chatPanel.querySelector(`.${NS}-copy-btn`);
    if (cb && !cb.classList.contains(`${NS}-copy-done`)) setCopyButtonIdle(cb);
    if (screenshotBtn && !screenshotBtn.classList.contains(`${NS}-screenshot-done`) && !screenshotBtn.classList.contains(`${NS}-screenshot-error`))
      setScreenshotButtonIdle();
    if (saveBtn) saveBtn.textContent = t("savePng");
    const minBtn = chatPanel.querySelector('[data-action="minimize"]');
    if (minBtn) minBtn.title = minimized ? t("restore") : t("minimize");
    const closeBtn = chatPanel.querySelector('[data-action="close"]');
    if (closeBtn) closeBtn.title = t("close");
    const settingsBtnEl = chatPanel.querySelector('[data-action="settings"]');
    if (settingsBtnEl) settingsBtnEl.title = t("settings");
    updateShortcuts();
  }

  function copyButtonLabel() {
    if (settings.sharingan) return t("copyReport");
    if (settings.combined) return t("copyCombined");
    return t("copyPrompt");
  }

  function setCopyButtonIdle(btn) {
    // While a result panel is open, the Copy button copies that panel's text
    // instead of the current element prompt.
    if (pendingGenPrompt) { btn.textContent = t(pendingResultCopyKey || "copyGenPrompt"); return; }
    btn.innerHTML = settings.sharingan ? `${SHARINGAN_ICON}<span>${copyButtonLabel()}</span>` : copyButtonLabel();
  }

  function updateShortcuts() {
    const sc = chatPanel.querySelector(`.${NS}-shortcuts`); if (!sc) return;
    const items = [
      `<span><kbd>Click</kbd> ${t("skSelect")}</span>`,
      `<span><kbd>Shift</kbd> ${t("skMulti")}</span>`,
      `<span><kbd>\u2190\u2191\u2192\u2193</kbd> ${t("skNavigate")}</span>`,
      `<span><kbd>\u2318C</kbd> ${t("skCopy")}</span>`,
      `<span><kbd>\u2318\u21e7C</kbd> ${t("skScreenshot")}</span>`,
    ];
    // \u2318M copies rendered content as Markdown in both bookmarklet and Pro.
    items.push(`<span><kbd>\u2318M</kbd> ${t("skMarkdown")}</span>`);
    // \u2318I (image \u2192 generation prompt) is Pro/extension-only.
    if (HOST.reversePrompt || HOST.reversePromptStream) items.push(`<span><kbd>\u2318I</kbd> ${t("skRevPrompt")}</span>`);
    items.push(`<span><kbd>\u2318Z</kbd> ${t("skUndo")}</span>`);
    items.push(`<span><kbd>Esc</kbd> ${selectedElements.length ? t("skClear") : t("skPause")}</span>`);
    // Extension activation shortcut (toolbar/Alt+S re-opens the menu on any page).
    if (HOST.isExtension) items.push(`<span><kbd>Alt+S</kbd> ${t("skActivate")}</span>`);
    sc.innerHTML = items.join("");
  }

  // ── Chat panel ──────────────────────────────────────────────
  function createChatPanel() {
    chatPanel = document.createElement("div"); chatPanel.className = `${NS}-root ${NS}-chat${HOST.isExtension ? ` ${NS}-pro` : ""}`;
    chatPanel.innerHTML = `
      <div class="${NS}-drag-handle">
        <span class="${NS}-drag-title">
          <span class="${NS}-status-dot"></span>
          <span class="${NS}-status-label">Selecting</span>
          ${HOST.isExtension ? `<span class="${NS}-pro-badge">Pro</span>` : `<span class="${NS}-version">v${VERSION}</span>`}
        </span>
        <div class="${NS}-panel-actions">
          <button class="${NS}-panel-btn" data-action="settings" title="Settings">${GEAR_SVG}</button>
          <button class="${NS}-panel-btn" data-action="minimize" title="Minimize">
            <svg width="10" height="2" viewBox="0 0 10 2" fill="none"><line x1="0" y1="1" x2="10" y2="1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
          <button class="${NS}-panel-btn" data-action="close" title="Close">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>
      <div class="${NS}-panel-body">
        <div class="${NS}-chat-tags ${NS}-hidden"></div>
        <div class="${NS}-shortcuts"></div>
        <div class="${NS}-action-row">
          <button class="${NS}-copy-btn" disabled>Copy Prompt</button>
          <button class="${NS}-screenshot-btn" disabled title="Copy Screenshot" aria-label="Copy Screenshot">${CAMERA_SVG}</button>
          <button class="${NS}-save-btn ${NS}-hidden" type="button">Save PNG</button>
        </div>
      </div>`;
    document.body.appendChild(chatPanel);
    chatPanel.querySelector(`.${NS}-copy-btn`).onclick = () => copyPrompt();
    screenshotBtn = chatPanel.querySelector(`.${NS}-screenshot-btn`);
    screenshotBtn.onclick = () => captureScreenshot();
    saveBtn = chatPanel.querySelector(`.${NS}-save-btn`);
    saveBtn.onclick = () => savePendingScreenshot();
    chatPanel.querySelector('[data-action="settings"]').onclick = toggleSettings;
    chatPanel.querySelector('[data-action="minimize"]').onclick = toggleMinimize;
    chatPanel.querySelector('[data-action="close"]').onclick = destroy;
    makeDraggable(chatPanel, chatPanel.querySelector(`.${NS}-drag-handle`));
  }

  const ICON_MINIMIZE = `<svg width="10" height="2" viewBox="0 0 10 2" fill="none"><line x1="0" y1="1" x2="10" y2="1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
  const ICON_EXPAND = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 7L5 3L9 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  function toggleMinimize() {
    minimized = !minimized;
    const body = chatPanel.querySelector(`.${NS}-panel-body`), btn = chatPanel.querySelector('[data-action="minimize"]');
    if (minimized) { body.style.display="none"; chatPanel.classList.add(`${NS}-minimized`); showHover(null); btn.innerHTML=ICON_EXPAND; btn.title=t("restore"); closeSettings(); }
    else { body.style.display=""; chatPanel.classList.remove(`${NS}-minimized`); btn.innerHTML=ICON_MINIMIZE; btn.title=t("minimize"); }
  }

  function makeDraggable(panel, handle) {
    let sx,sy,sl,st;
    handle.addEventListener("mousedown", (e) => {
      if (e.target.closest(`.${NS}-panel-btn`)) return; e.preventDefault();
      const r=panel.getBoundingClientRect(); sx=e.clientX; sy=e.clientY; sl=r.left; st=r.top;
      const move=(e)=>{ panel.style.left=sl+e.clientX-sx+"px"; panel.style.top=st+e.clientY-sy+"px"; panel.style.right="auto"; panel.style.bottom="auto"; };
      const up=()=>{ document.removeEventListener("mousemove",move); document.removeEventListener("mouseup",up); };
      document.addEventListener("mousemove",move); document.addEventListener("mouseup",up);
    });
  }

  // ── Element label ───────────────────────────────────────────
  function elementLabel(el) {
    const role = explicitOrImplicitRole(el);
    const label = accessibleLabel(el);
    if (role && label) return `${role} "${label}"`;
    if (label) return `${el.tagName.toLowerCase()} "${label}"`;
    if (el.id) return `#${el.id}`;
    if (el.classList.length) return `.${el.classList[0]}`;
    return `<${el.tagName.toLowerCase()}>`;
  }

  // ── Tags ────────────────────────────────────────────────────
  function updateTags() {
    const container=chatPanel.querySelector(`.${NS}-chat-tags`), copyBtn=chatPanel.querySelector(`.${NS}-copy-btn`);
    container.innerHTML = "";
    if (selectedElements.length > 0) {
      container.classList.remove(`${NS}-hidden`); copyBtn.disabled=false;
      if (screenshotBtn) screenshotBtn.disabled=false;
      for (let i=0;i<selectedElements.length;i++) {
        const el=selectedElements[i], aiId=el.getAttribute(AI_ID), tag=document.createElement("span");
        tag.className=`${NS}-tag`; const hasNote=annotations.has(aiId);
        tag.innerHTML=`<span class="${NS}-tag-num">${i+1}</span><span class="${NS}-tag-label">${elementLabel(el)}${hasNote?' \u270e':''}</span><button class="${NS}-tag-x" data-aiid="${aiId}" title="Remove">\u00d7</button>`;
        const thumb=thumbSrcForElement(el);
        if(thumb){ const ti=document.createElement("img"); ti.className=`${NS}-tag-thumb`; ti.src=thumb; ti.alt=""; tag.insertBefore(ti, tag.firstChild); }
        container.appendChild(tag);
      }
      container.querySelectorAll(`.${NS}-tag-x`).forEach(btn => {
        btn.addEventListener("click", (e) => { e.stopPropagation(); const el=byAiId(btn.dataset.aiid); if(el) removeSelection(el); updateTags(); }, true);
      });
      const clearBtn=document.createElement("button"); clearBtn.className=`${NS}-tags-action`; clearBtn.title=t("clearAll");
      clearBtn.innerHTML=`<svg width="8" height="8" viewBox="0 0 8 8" fill="none"><line x1="1" y1="1" x2="7" y2="7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="7" y1="1" x2="1" y2="7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> ${t("clearAll")}`;
      clearBtn.onclick = (e) => { e.stopPropagation(); clearSelection(); updateTags(); };
      container.appendChild(clearBtn);
    } else {
      container.classList.add(`${NS}-hidden`); copyBtn.disabled=true;
      if (screenshotBtn) screenshotBtn.disabled=true;
    }
    updateShortcuts();
  }

  // ── Copy feedback ───────────────────────────────────────────
  let copyTimer=null;
  function showCopyFeedback(msg, isError, detail) {
    const btn=chatPanel.querySelector(`.${NS}-copy-btn`);
    if (copyTimer) clearTimeout(copyTimer);
    btn.classList.remove(`${NS}-copy-error`);
    btn.classList.add(`${NS}-copy-done`);
    if (isError) btn.classList.add(`${NS}-copy-error`);
    btn.style.setProperty("color", "#fff", "important");
    btn.style.setProperty("-webkit-text-fill-color", "#fff", "important");
    btn.style.setProperty("opacity", "1", "important");
    btn.title = detail || msg;
    btn.innerHTML = settings.sharingan
      ? `${SHARINGAN_ICON}<span>${msg}</span>`
      : `${isError ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v5"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="9"/></svg>' : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>'} <span style="color:#fff!important;-webkit-text-fill-color:#fff!important">${msg}</span>`;
    copyTimer = setTimeout(() => {
      btn.classList.remove(`${NS}-copy-done`, `${NS}-copy-error`);
      btn.title = "";
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
  async function copyPrompt() {
    // While a result panel is open, Copy copies that panel's text until closed.
    if (pendingGenPrompt) { writeToClipboard(pendingGenPrompt); showCopyFeedback(t("copied")); return; }
    // ── License gate (HOST_CONTRACT.md §1.2) ──────────────────
    // Bookmarklet has no HOST.licensing → skipped entirely. The extension may
    // require an active license before copying; if so, prompt activation.
    if (HOST.licensing && HOST.licensing.required && !HOST.licensing.active) {
      HOST.requestActivation && HOST.requestActivation("copy");
      showCopyFeedback(t("needLicense"), true);
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
          buildPromptText,
          buildSharinganReport,
        });
        if (payload) {
          writeToClipboard(payload.text);
          if (payload.download && payload.download.content) {
            downloadMarkdown(payload.download.content, payload.download.filename);
          }
          showCopyFeedback(t("copied"));
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
        captureScreenshot({ text: promptText, feedbackTarget: "copy", downloadImage: true });
        return;
      }
      captureScreenshot({ text, feedbackTarget: "copy", downloadImage: true });
      return;
    }
    if (settings.sharingan && text.length > SHARINGAN_CLIPBOARD_CHAR_LIMIT) {
      const filename = sharinganFilename();
      const realPath = await saveMarkdownFile(text, filename);
      const fallback = appendSharinganDownloadReference(buildPromptText(), filename, text.length, realPath);
      writeToClipboard(fallback);
      showCopyFeedback(t("exported"));
      return;
    }
    writeToClipboard(text); showCopyFeedback(t("copied"));
  }

  // ── ⌘M — copy as Markdown ──────────────────────────────────
  const MARKDOWN_BLOCK_TAGS = new Set(["address","article","aside","blockquote","dd","details","div","dl","dt","figcaption","figure","footer","form","h1","h2","h3","h4","h5","h6","header","hr","li","main","nav","ol","p","pre","section","table","ul"]);

  function mdCollapse(s) { return String(s || "").replace(/[\t\n\r ]+/g, " "); }
  function mdEscape(s) { return String(s || "").replace(/([\\`*_{}\[\]()#+\-.!>|~])/g, "\\$1"); }
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
      const code = ((codeEl || el).textContent || "").replace(/\r\n?/g, "\n").replace(/^\n|\n[ \t]*$/g, "");
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
    const matrix = rows.map(row => Array.from(row.children).filter(cell => /^(td|th)$/i.test(cell.tagName) && !mdHidden(cell)).map(cell => mdEscapeCell(mdFlow(cell) || mdInlineChildren(cell)).trim()));
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
  async function copyAsMarkdown() {
    let els = selectedElements.length
      ? selectedElements.slice()
      : [document.querySelector("main, article, [role='main']") || document.body];
    els = els.filter(Boolean);
    if (!els.length) return;
    try {
      const payload = HOST.buildCopyPayload
        ? await HOST.buildCopyPayload("markdown", { elements: els, buildPromptText, buildSharinganReport })
        : localMarkdownPayload(els);
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
  function finishRevPrompt(fullText, copyLabelKey, shouldCopy) {
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
    if (shouldCopy !== false) writeToClipboard(fullText);
    const btn = copyBtnEl();
    if (btn) {
      btn.disabled = false;
      setCopyButtonIdle(btn);
    }
  }

  async function reversePromptForSelection() {
    if (!HOST.reversePrompt && !HOST.reversePromptStream) return;
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
        src = { dataUrl: await blobToReversePromptDataURL(blob) };
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
        if (opened && acc) finishRevPrompt(acc);
        else { setCopyButtonLoading(false); showCopyFeedback(t("revFailed"), true); }
      } else {
        const res = await HOST.reversePrompt(payload);
        setCopyButtonLoading(false);
        if (res && res.prompt) { showRevPromptPanel(); pushRevToken(res.prompt); finishRevPrompt(res.prompt); }
        else showCopyFeedback(t("revFailed"), true);
      }
    } catch (err) {
      setCopyButtonLoading(false);
      // Keep a partial stream if we got one; otherwise surface the failure.
      if (opened && acc) finishRevPrompt(acc);
      else showCopyFeedback(t("revFailed"), true);
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
    const showError = (code, err) => feedbackTarget === "copy" ? showCopyCaptureError(code, err) : showScreenshotError(code, err);
    const showSuccess = (savedImage) => feedbackTarget === "copy" ? showCopyFeedback(opts.downloadImage && savedImage ? t("copiedSaved") : t("copied")) : showScreenshotFeedback(t("screenshotCopied"));
    if (!navigator.clipboard || !navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
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
  function writeToClipboard(text) {
    if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    else fallbackCopy(text);
  }
  function fallbackCopy(text) {
    const ta=document.createElement("textarea"); ta.value=text; ta.style.cssText="position:fixed;opacity:0;top:0;left:0";
    document.body.appendChild(ta); ta.focus(); ta.select();
    try { document.execCommand("copy"); } catch(_) {}
    ta.remove();
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

  // ── Prompt building ────────────────────────────────────────
  function buildPromptText() {
    if (selectedElements.length === 0) return "";
    const pageContext = currentPageContext();
    const lines = ["Page: " + pageContext.page];
    if (pageContext.query) lines.push("Query: " + pageContext.query);
    lines.push("");
    selectedElements.forEach((el, i) => {
      const aiId = el.getAttribute(AI_ID);
      const note = annotations.get(aiId);
      const ctx = buildElementContext(el, i + 1, note);
      lines.push(`${i + 1}. ${ctx.title} <${ctx.tag}>`);
      if (ctx.selector) lines.push(`   selector: ${ctx.selector}`);
      if (ctx.locator) lines.push(`   locator: ${ctx.locator}`);
      if (ctx.inside) lines.push(`   inside: ${ctx.inside}`);
      if (ctx.source) lines.push(`   source: ${ctx.source}`);
      if (ctx.react) lines.push(`   react: ${ctx.react}`);
      if (ctx.text) lines.push(`   text: "${ctx.text}"`);
      Object.entries(ctx.dataAttrs).forEach(([k, v]) => lines.push(`   ${k}: ${v}`));
      if (ctx.visual) lines.push(`   visual: ${ctx.visual}`);
      if (ctx.layout) lines.push(`   layout: ${ctx.layout}`);
      if (ctx.parent) lines.push(`   parent: ${ctx.parent}`);
      if (ctx.outerHTML) lines.push(`   html: ${ctx.outerHTML}`);
      if (ctx.reactProps) lines.push(`   props: ${ctx.reactProps}`);
      if (note) lines.push(`   instruction: ${note}`);
    });
    return lines.join("\n");
  }

  /*__SHARINGAN_MODULE__*/
  // ── Computed styles ────────────────────────────────────────
  const LAYOUT_STYLE_KEYS = ["display","flex-direction","align-items","justify-content","gap","grid-template-columns","padding","margin","width","height","position","z-index","overflow","text-align"];
  function getLayoutSummary(el) {
    const cs = getComputedStyle(el);
    const keys = smartStyleKeys(el, cs);
    return keys.map(k => `${k}:${compactCssValue(cs.getPropertyValue(k))}`).filter(s => !s.endsWith(":")).join("; ");
  }

  // ── Parent context ─────────────────────────────────────────
  function getParentContextStr(el) {
    const p = el.parentElement;
    if (!p || p === document.body || p === document.documentElement) return null;
    const tag = p.tagName.toLowerCase();
    const id = p.id && isStableToken(p.id) ? `#${p.id}` : "";
    const cls = stableClasses(p).slice(0, 2).map(c => "." + c).join("");
    const cs = getComputedStyle(p);
    const bits = [`<${tag}${id}${cls}>`, `display:${cs.display}`];
    if (cs.display.includes("flex")) bits.push(`flex-direction:${cs.flexDirection}`, `align-items:${cs.alignItems}`, `justify-content:${cs.justifyContent}`);
    if (cs.display.includes("grid")) bits.push(`grid-template-columns:${compactCssValue(cs.gridTemplateColumns)}`);
    if (cs.gap && cs.gap !== "normal") bits.push(`gap:${cs.gap}`);
    return bits.join("; ");
  }

  function smartStyleKeys(el, cs) {
    const keys = ["display"];
    if (cs.display.includes("flex")) keys.push("flex-direction","align-items","justify-content","gap");
    if (cs.display.includes("grid")) keys.push("grid-template-columns","gap");
    if (selectedElements.length > 1 || isPositioned(el)) keys.push("width","height");
    if (cs.position !== "static") keys.push("position","z-index");
    if (isScrollable(el)) keys.push("overflow");
    return unique(keys).filter(k => LAYOUT_STYLE_KEYS.includes(k));
  }

  function shouldIncludeLayout(el) {
    const cs = getComputedStyle(el);
    if (selectedElements.length > 1) return hasMeaningfulLayout(el, cs) && !isSimpleInlineLabel(el, cs);
    if (cs.position !== "static" || isScrollable(el)) return true;
    if (cs.display.includes("grid")) return true;
    if (cs.display.includes("flex")) {
      const children = visibleChildren(el);
      if (children.length > 1) return true;
      if (hasNonDefaultFlex(cs) && !isSimpleInlineLabel(el, cs)) return true;
    }
    return false;
  }

  function shouldIncludeParent(el) {
    const p = el.parentElement;
    if (!p || p === document.body || p === document.documentElement) return false;
    const cs = getComputedStyle(p);
    if (selectedElements.length > 1) return (cs.display.includes("flex") || cs.display.includes("grid")) && visibleChildren(p).length > 1;
    if (isAtomicElement(el)) return false;
    if (isInsideStructuredContainer(el)) return false;
    if (cs.display.includes("grid")) return visibleChildren(p).length > 1;
    if (cs.display.includes("flex")) return visibleChildren(p).length > 2 || isPrimaryLayoutContainer(p);
    return false;
  }

  function shouldIncludeHtml(el, ctx) {
    if (ctx.text || ctx.locator || ctx.source || ctx.react || Object.keys(ctx.dataAttrs).length) return false;
    if (el.children.length > 4) return false;
    if (ctx.selector && !ctx.selector.includes("nth-of-type") && !ctx.selector.startsWith("body >")) return false;
    return true;
  }

  function compactCssValue(value) {
    if (!value) return "";
    value = value.replace(/\s+/g, " ").trim();
    return value.length > 80 ? value.slice(0, 80) + "\u2026" : value;
  }

  function unique(values) {
    return Array.from(new Set(values));
  }

  // ── React debug info ───────────────────────────────────────
  const SKIP_REACT = new Set(["ClientPageRoot","LinkComponent","ServerComponent","AppRouter","Router","HotReload","ReactDevOverlay","InnerLayoutRouter","OuterLayoutRouter","RedirectBoundary","NotFoundBoundary","ErrorBoundary","LoadingBoundary","TemplateContext","ScrollAndFocusHandler","RenderFromTemplateContext","PathnameContextProviderAdapter","Hot","Inner","Forward","Root"]);
  function isUserComponent(name) { return name && name.length >= 2 && !SKIP_REACT.has(name) && /^[A-Z]/.test(name) && !name.startsWith("_"); }

  function getReactFiber(el) {
    try {
      const key = Object.keys(el).find(k => k.startsWith("__reactFiber") || k.startsWith("__reactInternalInstance"));
      return key ? el[key] : null;
    } catch(_) { return null; }
  }

  function getReactDebug(el) {
    try {
      const f = getReactFiber(el); if (!f) return {};
      const result = {};
      let walker = f;
      while (walker) { if (walker._debugSource) { const s=walker._debugSource; result.source=`${s.fileName.replace(/^.*?\/src\//, "src/")}:${s.lineNumber}`; break; } walker=walker.return; }
      const components = [];
      walker = f;
      while (walker) {
        if (walker.type && typeof walker.type === "function") {
          const name = walker.type.displayName || walker.type.name;
          if (isUserComponent(name) && !components.includes(name)) { components.push(name); if (components.length >= 3) break; }
        }
        walker = walker.return;
      }
      if (components.length) result.react = components.reverse().join(" \u203a ");
      return result;
    } catch(_) { return {}; }
  }

  function getReactPropsInfo(el) {
    try {
      const f = getReactFiber(el); if (!f) return null;
      const props = f.memoizedProps; if (!props || typeof props !== "object") return null;
      const entries = Object.entries(props).filter(([k]) => k !== "children" && !k.startsWith("__"));
      if (!entries.length) return { className: "", props: "" };
      let className = "";
      const useful = [];
      entries.forEach(([k, v]) => {
        if (k === "className" && typeof v === "string") { className = v; return; }
        if (!isUsefulReactProp(k, v)) return;
        if (v === null || v === undefined) { useful.push(`${k}:null`); return; }
        if (typeof v === "function") { useful.push(`${k}:fn`); return; }
        if (typeof v === "object") {
          try {
            const s=JSON.stringify(v);
            useful.push(`${k}:${s.length > 60 ? s.slice(0, 60) + "\u2026" : s}`);
          } catch(_) { useful.push(`${k}:{...}`); }
          return;
        }
        useful.push(`${k}:${truncate(String(v), 80)}`);
      });
      return { className, props: useful.slice(0, 8).join(", ") };
    } catch(_) { return null; }
  }

  function isUsefulReactProp(key, value) {
    if (/^(id|role|type|name|href|to|for|htmlFor|target|rel|title|alt|placeholder|value|defaultValue)$/.test(key)) return value !== "";
    if (/^(variant|size|tone|color|status|state|kind|intent|as|label)$/.test(key)) return true;
    if (/^(disabled|selected|checked|open|active|expanded|pressed|required|readOnly)$/.test(key)) return true;
    if (/^aria-/.test(key)) return true;
    if (/^data-/.test(key)) return isUsefulDataValue(key, value);
    return false;
  }

  function isUsefulDataAttr(attr) {
    if (!attr || !attr.name || attr.name === AI_ID || !attr.name.startsWith("data-")) return false;
    if (/^data-(test|testid|test-id|cy|qa|state|slot|value|name|variant|status|selected|disabled|orientation)$/.test(attr.name)) return true;
    if (/^data-(pjax|turbo|hovercard|analytics|octo|view-component|hydrated|rr-ui|react)/.test(attr.name)) return false;
    if (/^(true|false|0|1)$/.test(attr.value || "")) return false;
    return attr.value && attr.value.length <= 80 && isStableToken(attr.value);
  }

  function isUsefulDataValue(key, value) {
    if (/^data-(test|testid|test-id|cy|qa|state|slot|value|name|variant|status|selected|disabled|orientation)$/.test(key)) return true;
    if (/^data-(pjax|turbo|hovercard|analytics|octo|view-component|hydrated|rr-ui|react)/.test(key)) return false;
    if (value === true || value === false || value === 0 || value === 1) return false;
    if (/^(true|false|0|1)$/.test(String(value))) return false;
    return value !== null && value !== undefined && String(value).length <= 80 && isStableToken(String(value));
  }

  // ── Element context ────────────────────────────────────────
  function buildElementContext(el, index, note) {
    const dataAttrs = {};
    for (const attr of Array.from(el.attributes).filter(isUsefulDataAttr).slice(0, 8)) {
      dataAttrs[attr.name] = truncate(attr.value, 120);
    }
    const reactInfo = getReactDebug(el);
    const reactProps = getReactPropsInfo(el) || { className: "", props: "" };
    const classTokens = unique([
      ...Array.from(el.classList),
      ...String(reactProps.className || "").split(/\s+/).filter(Boolean),
    ]);
    const rawSelector = buildSelector(el);
    const locator = buildLocator(el);
    const text = readableText(el);
    const ctx = {
      index, aiId: el.getAttribute(AI_ID), locator, tag: el.tagName.toLowerCase(),
      text: shouldIncludeText(text, locator) ? text : "", classes: classTokens,
      dataAttrs, reactProps: reactProps.props, ...reactInfo,
    };
    ctx.title = contextTitle(el, ctx);
    ctx.inside = getSemanticContextStr(el);
    ctx.visual = getVisualSummary(el, ctx, classTokens);
    if (shouldIncludeSelector(rawSelector, ctx)) ctx.selector = rawSelector;
    if (shouldIncludeLayout(el)) ctx.layout = getLayoutSummary(el);
    if (shouldIncludeParent(el)) ctx.parent = getParentContextStr(el);
    if (shouldIncludeHtml(el, ctx)) ctx.outerHTML = truncateHtml(el.outerHTML, 240);
    return ctx;
  }

  function contextTitle(el, ctx) {
    const label = accessibleLabel(el);
    const kind = elementKind(el, ctx);
    return label ? `${kind} "${truncate(label, 48)}"` : kind;
  }

  function elementKind(el, ctx) {
    const reactLast = ctx.react && ctx.react.split(" \u203a ").pop();
    if (reactLast && /^[A-Z]/.test(reactLast)) return reactLast;
    const role = explicitOrImplicitRole(el);
    if (role) return role;
    const tag = el.tagName.toLowerCase();
    const classBlob = ctx.classes.join(" ").toLowerCase();
    if (/badge|tag|chip|pill/.test(classBlob)) return "Badge";
    if (/card|panel|tile/.test(classBlob)) return "Card";
    if (/avatar/.test(classBlob)) return "Avatar";
    if (/icon/.test(classBlob)) return "Icon";
    return tag;
  }

  function readableText(el) {
    return truncate(visibleText(el), 80);
  }

  function shouldIncludeText(text, locator) {
    if (!text) return false;
    if (!locator) return true;
    return !locator.includes(`"${truncate(text, 48)}"`);
  }

  function shouldIncludeSelector(selector, ctx) {
    if (!selector) return false;
    const durableDirect = selector.length <= 120 && (/^#/.test(selector) || /^\[data-/.test(selector) || /^[a-z]+\[data-/.test(selector));
    if (durableDirect) return true;
    const hasStrongIdentity = ctx.locator || ctx.react || ctx.source || ctx.text || Object.keys(ctx.dataAttrs).length;
    if (hasStrongIdentity) return false;
    return selector.length <= 180;
  }

  function getSemanticContextStr(el) {
    const parts = [];
    const cell = el.closest("td,th");
    if (cell) {
      const header = tableHeaderForCell(cell);
      parts.push(header ? `table cell under "${header}"` : "table cell");
    }
    const li = el.closest("li");
    if (li) parts.push("list item");
    const field = nearestFieldContext(el);
    if (field) parts.push(field);
    const region = nearestRegionContext(el);
    if (region) parts.push(region);
    return unique(parts).slice(0, 2).join("; ");
  }

  function tableHeaderForCell(cell) {
    try {
      if (cell.tagName.toLowerCase() !== "td") return null;
      const table = cell.closest("table");
      const row = cell.closest("tr");
      if (!table || !row || cell.cellIndex < 0) return null;
      const header = table.querySelector(`thead tr th:nth-child(${cell.cellIndex + 1})`);
      return header ? truncate(header.textContent, 36) : null;
    } catch(_) { return null; }
  }

  function nearestFieldContext(el) {
    const label = el.closest("label");
    if (label) return `field "${truncate(label.textContent, 36)}"`;
    const form = el.closest("form");
    if (form) return "form";
    return null;
  }

  function nearestRegionContext(el) {
    const region = el.closest("dialog,[role='dialog'],[role='menu'],[role='tablist'],nav,aside,header,footer,main,section,article");
    if (!region || region === el) return null;
    const role = explicitOrImplicitRole(region) || region.getAttribute("role") || region.tagName.toLowerCase();
    const label = region.getAttribute("aria-label") || region.getAttribute("title") || nearestHeadingText(region);
    return label ? `${role} "${truncate(label, 36)}"` : role;
  }

  function nearestHeadingText(region) {
    const heading = region.querySelector("h1,h2,h3,h4,h5,h6");
    return heading ? heading.textContent : "";
  }

  function getVisualSummary(el, ctx, classTokens) {
    const parts = [];
    const cs = getComputedStyle(el);
    const classBlob = classTokens.join(" ");
    const lower = classBlob.toLowerCase();
    const kind = elementKind(el, ctx).toLowerCase();
    const hasStyleTokens = hasVisualClassTokens(classTokens);
    if (!hasStyleTokens && isAtomicElement(el) && kind !== "badge") return "";
    if (/badge|tag|chip|pill/.test(lower) || kind === "badge") parts.push("badge");
    if (/(rounded-full|pill)/.test(lower) || parseFloat(cs.borderRadius) >= Math.min(el.offsetHeight, el.offsetWidth) / 3) parts.push("pill");
    else if ((cs.borderRadius && cs.borderRadius !== "0px") || /rounded/.test(lower)) parts.push("rounded");
    if (hasBorder(cs) || /\bborder\b|border-/.test(lower)) parts.push("border");
    if (hasBackground(cs) || /\bbg-/.test(lower)) parts.push(colorToken(lower, "bg") || "background");
    if (hasForeground(cs) || /\btext-/.test(lower)) {
      const textTone = textSizeToken(lower);
      if (textTone) parts.push(textTone);
      const color = colorToken(lower, "text");
      if (color && color !== "text-xs" && color !== "text-sm" && color !== "text-lg" && color !== "text-xl") parts.push(color);
    }
    if (/shadow/.test(lower) || cs.boxShadow !== "none") parts.push("shadow");
    return unique(parts).slice(0, 6).join(", ");
  }

  function hasVisualClassTokens(tokens) {
    return tokens.some(token => /^(inline-flex|flex|grid|items-|justify-|gap-|rounded|border|bg-|text-|shadow|ring|opacity|px-|py-|p-|m-|badge|tag|chip|pill)/.test(token));
  }

  function colorToken(classBlob, prefix) {
    const match = classBlob.match(new RegExp(`\\b${prefix}-([a-z][a-z0-9-]*(?:/[0-9]+)?)`));
    if (prefix === "text" && match && /^(xs|sm|base|lg|xl|[2-9]xl)$/.test(match[1])) return "";
    return match ? `${prefix}-${match[1]}` : "";
  }

  function textSizeToken(classBlob) {
    if (/text-\[(?:9|10|11|12)px\]|text-xs/.test(classBlob)) return "tiny text";
    if (/text-sm/.test(classBlob)) return "small text";
    if (/text-lg|text-xl|text-2xl|text-3xl/.test(classBlob)) return "large text";
    return "";
  }

  function hasBorder(cs) {
    return ["Top","Right","Bottom","Left"].some(side => parseFloat(cs[`border${side}Width`]) > 0);
  }

  function hasBackground(cs) {
    return cs.backgroundColor && cs.backgroundColor !== "rgba(0, 0, 0, 0)" && cs.backgroundColor !== "transparent";
  }

  function hasForeground(cs) {
    return cs.color && cs.color !== "rgba(0, 0, 0, 0)" && cs.color !== "transparent";
  }

  function visibleChildren(el) {
    return Array.from(el.children).filter(isVisible);
  }

  function hasMeaningfulLayout(el, cs) {
    return cs.display.includes("grid") || cs.display.includes("flex") || cs.position !== "static" || isScrollable(el);
  }

  function hasNonDefaultFlex(cs) {
    return cs.flexDirection !== "row" || cs.alignItems !== "normal" || cs.justifyContent !== "normal" || (cs.gap && cs.gap !== "normal" && cs.gap !== "0px");
  }

  function isSimpleInlineLabel(el, cs) {
    return cs.display.includes("flex") && visibleChildren(el).length <= 1 && readableText(el) && el.getBoundingClientRect().height <= 40;
  }

  function isScrollable(el) {
    const cs = getComputedStyle(el);
    return /(auto|scroll)/.test(`${cs.overflow} ${cs.overflowX} ${cs.overflowY}`);
  }

  function isPositioned(el) {
    return getComputedStyle(el).position !== "static";
  }

  function isInsideStructuredContainer(el) {
    return !!el.closest("td,th,li,label");
  }

  function isPrimaryLayoutContainer(el) {
    const tag = el.tagName.toLowerCase();
    if (/^(main|section|article|aside|nav|header|footer)$/.test(tag)) return true;
    return /\b(container|layout|grid|row|toolbar|header|footer|sidebar|content)\b/i.test(Array.from(el.classList).join(" "));
  }

  function buildSelector(el) {
    const direct = bestDirectSelector(el);
    if (direct) return direct;
    const parts = []; let node = el;
    while (node && node !== document.body && node !== document.documentElement) {
      const stable = stableSegment(node);
      if (stable) {
        parts.unshift(stable);
        const candidate = parts.join(" > ");
        if (isUniqueSelector(candidate)) return candidate;
        if (stable.startsWith("#")) break;
        node = node.parentElement;
        continue;
      }
      let seg = node.tagName.toLowerCase();
      const p = node.parentElement;
      if (p) { const s = Array.from(p.children).filter(c => c.tagName === node.tagName); if (s.length > 1) seg += `:nth-of-type(${s.indexOf(node) + 1})`; }
      parts.unshift(seg); node = node.parentElement;
    }
    return parts.join(" > ");
  }

  function truncate(s, max) { if (!s) return ""; s = s.replace(/\s+/g, " ").trim(); return s.length > max ? s.slice(0, max) + "\u2026" : s; }
  function truncateHtml(s, max) { if (!s) return ""; s = s.replace(/\s+/g, " ").trim(); return s.length > max ? s.slice(0, max) + "\u2026" : s; }

  function bestDirectSelector(el) {
    const tag = el.tagName.toLowerCase();
    const attrs = ["data-testid","data-test","data-cy","data-qa","data-test-id"];
    for (const name of attrs) {
      const value = el.getAttribute(name);
      if (!value) continue;
      const selector = `[${name}="${escapeAttr(value)}"]`;
      if (isUniqueSelector(selector)) return selector;
      const tagged = `${tag}${selector}`;
      if (isUniqueSelector(tagged)) return tagged;
    }
    if (el.id && isStableToken(el.id)) {
      const selector = `#${escapeIdent(el.id)}`;
      if (isUniqueSelector(selector)) return selector;
    }
    for (const name of ["aria-label","name","title"]) {
      const value = el.getAttribute(name);
      if (!value || value.length > 80) continue;
      const selector = `${tag}[${name}="${escapeAttr(value)}"]`;
      if (isUniqueSelector(selector)) return selector;
    }
    const classSelector = semanticClassSelector(el);
    if (classSelector && isUniqueSelector(classSelector)) return classSelector;
    return null;
  }

  function stableSegment(el) {
    const direct = bestDirectSelector(el);
    if (direct) return direct;
    if (el.id && isStableToken(el.id)) return `#${escapeIdent(el.id)}`;
    const cls = stableClasses(el)[0];
    if (cls) return `${el.tagName.toLowerCase()}.${escapeIdent(cls)}`;
    return null;
  }

  function semanticClassSelector(el) {
    const classes = stableClasses(el).slice(0, 2);
    if (!classes.length) return null;
    return `${el.tagName.toLowerCase()}${classes.map(c => "." + escapeIdent(c)).join("")}`;
  }

  function stableClasses(el) {
    return Array.from(el.classList).filter(isStableClass);
  }

  function isStableClass(cls) {
    if (!isStableToken(cls)) return false;
    if (cls.includes(":")) return false;
    if (/^(sm|md|lg|xl|2xl|hover|focus|active|disabled):/.test(cls)) return false;
    if (/^(border|rounded|shadow|ring|flex|grid|block|inline|inline-flex|hidden|relative|absolute|fixed|sticky|static|container)$/.test(cls)) return false;
    if (/^-?(m[trblxy]?|p[trblxy]?|w|h|min-w|max-w|min-h|max-h|text|bg|border|rounded|shadow|grid|flex|gap|space|items|justify|content|self|place|font|leading|tracking|opacity|z|top|right|bottom|left|inset|translate|scale|rotate)-/.test(cls)) return false;
    return true;
  }

  function isStableToken(value) {
    if (!value || value.length > 80) return false;
    if (/^[:_]?r[\w-]*:?$/i.test(value)) return false;
    if (/^[a-f0-9]{6,}$/i.test(value)) return false;
    if (/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}/i.test(value)) return false;
    if (/^(css|sc|_)[-_a-z0-9]{4,}$/i.test(value)) return false;
    if (!/[a-z]/i.test(value)) return false;
    return true;
  }

  function buildLocator(el) {
    const role = explicitOrImplicitRole(el);
    const label = accessibleLabel(el);
    if (role && label) return `${role} "${label}"`;
    if (label) return `${el.tagName.toLowerCase()} "${label}"`;
    return role || null;
  }

  function explicitOrImplicitRole(el) {
    const role = el.getAttribute("role");
    if (role) return role.split(/\s+/)[0];
    const tag = el.tagName.toLowerCase();
    if (tag === "button") return "button";
    if (tag === "a" && el.getAttribute("href")) return "link";
    if (tag === "input") return inputRole(el);
    if (tag === "select") return "combobox";
    if (tag === "textarea") return "textbox";
    if (/^h[1-6]$/.test(tag)) return "heading";
    if (tag === "img") return "img";
    return null;
  }

  function inputRole(el) {
    const type = (el.getAttribute("type") || "text").toLowerCase();
    if (type === "checkbox" || type === "radio" || type === "button" || type === "searchbox") return type;
    if (type === "submit" || type === "reset") return "button";
    return "textbox";
  }

  function accessibleLabel(el) {
    const direct = el.getAttribute("aria-label") || el.getAttribute("title") || el.getAttribute("placeholder") || el.getAttribute("alt") || el.getAttribute("name");
    if (direct) return truncate(direct, 48);
    const text = truncate(visibleText(el), 48);
    return text || null;
  }

  function visibleText(el) {
    return (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
  }

  function isUniqueSelector(selector) {
    try { return document.querySelectorAll(selector).length === 1; }
    catch(_) { return false; }
  }

  function escapeIdent(value) {
    if (window.CSS && CSS.escape) return CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  function escapeAttr(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  // ── Boot ───────────────────────────────────────────────────
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
