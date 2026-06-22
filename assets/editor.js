/**
 * Selector — visual element picker with per-element annotations.
 * Inject via bookmarklet. Click = select, Shift+click = multi, Drag = marquee.
 */
(function () {
  "use strict";
  if (document.querySelector(".ai-editor-root")) return;

  const NS = "ai-editor";
  const AI_ID = "data-ai-id";
  const VERSION = "0.3.3";

  // ── i18n ─────────────────────────────────────────────────────
  const DICT = {
    en: {
      selecting:"Selecting", paused:"Paused", copyPrompt:"Copy Prompt", copyScreenshot:"Copy Screenshot",
      copied:"Copied", screenshotCopied:"Screenshot Copied", screenshotFailed:"Screenshot Failed",
      settings:"Settings", lang:"Language", addInstruction:"Add instruction",
      instrPlaceholder:"Instruction for this element\u2026", clear:"Clear", done:"Done",
      clearAll:"Clear all", minimize:"Minimize", restore:"Restore", close:"Close",
      groupGeneral:"General",
      skSelect:"Select", skMulti:"Multi", skNavigate:"Navigate", skPause:"Pause",
      skCopy:"Copy", skScreenshot:"Screenshot", skUndo:"Undo", skClear:"Clear",
      optCombined:"Screenshot + text combined", optCombinedDesc:"Copy screenshot and prompt text together",
      errUnsupported:"Browser not supported", errCancelled:"Screen choice cancelled",
      errPermission:"Screen recording blocked", errClipboard:"Clipboard blocked",
      errCapture:"Screenshot failed", errEmpty:"Selected area is empty",
    },
    zh: {
      selecting:"\u9009\u62e9\u4e2d", paused:"\u5df2\u6682\u505c", copyPrompt:"\u590d\u5236\u63d0\u793a\u8bcd", copyScreenshot:"\u590d\u5236\u622a\u56fe",
      copied:"\u5df2\u590d\u5236", screenshotCopied:"\u622a\u56fe\u5df2\u590d\u5236", screenshotFailed:"\u622a\u56fe\u5931\u8d25",
      settings:"\u8bbe\u7f6e", lang:"\u8bed\u8a00", addInstruction:"\u6dfb\u52a0\u6307\u4ee4",
      instrPlaceholder:"\u6b64\u5143\u7d20\u7684\u4fee\u6539\u6307\u4ee4\u2026", clear:"\u6e05\u9664", done:"\u5b8c\u6210",
      clearAll:"\u6e05\u9664\u5168\u90e8", minimize:"\u6700\u5c0f\u5316", restore:"\u6062\u590d", close:"\u5173\u95ed",
      groupGeneral:"\u901a\u7528",
      skSelect:"\u9009\u62e9", skMulti:"\u591a\u9009", skNavigate:"\u5bfc\u822a", skPause:"\u6682\u505c",
      skCopy:"\u590d\u5236", skScreenshot:"\u622a\u56fe", skUndo:"\u64a4\u9500", skClear:"\u6e05\u9664",
      optCombined:"\u622a\u56fe + \u6587\u672c\u5408\u5e76", optCombinedDesc:"\u540c\u65f6\u590d\u5236\u622a\u56fe\u548c\u63d0\u793a\u8bcd\u6587\u672c",
      errUnsupported:"\u6d4f\u89c8\u5668\u4e0d\u652f\u6301", errCancelled:"\u5df2\u53d6\u6d88\u5c4f\u5e55\u9009\u62e9",
      errPermission:"\u5c4f\u5e55\u5f55\u5236\u6743\u9650\u53d7\u9650", errClipboard:"\u526a\u8d34\u677f\u6743\u9650\u53d7\u9650",
      errCapture:"\u622a\u56fe\u5931\u8d25", errEmpty:"\u9009\u4e2d\u533a\u57df\u65e0\u6cd5\u622a\u56fe",
    }
  };
  let lang = "en";
  try { lang = localStorage.getItem(NS + "-lang") || "en"; } catch(_) {}
  function t(k) { return (DICT[lang] && DICT[lang][k]) || DICT.en[k] || k; }

  // ── Settings ─────────────────────────────────────────────────
  const DEFAULTS = { combined:false };
  let settings = Object.assign({}, DEFAULTS);
  try { var s = JSON.parse(localStorage.getItem(NS + "-settings")); if (s) settings = Object.assign({}, DEFAULTS, s); } catch(_) {}
  function saveSettings() { try { localStorage.setItem(NS + "-settings", JSON.stringify(settings)); } catch(_) {} }

  // ── State ────────────────────────────────────────────────────
  let selectedElements = [], chatPanel = null, hoverBox = null, aiIdCounter = 0;
  let rafPending = false, lastMoveTarget = null, minimized = false, paused = false;
  const selOverlays = new Map(), annotations = new Map(), listeners = [];
  let dragState = null, wasJustDragging = false, activePopover = null;
  const selectionHistory = [];
  let screenshotBtn = null, settingsOpen = false, settingsPanel = null;

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
      if(activePopover) removeAnnotationPopover();
      else if(settingsOpen) closeSettings();
      else if(selectedElements.length>0){ pushHistory(); clearSelection(); updateTags(); }
      else togglePaused();
      return;
    }
    if(mod&&e.key.toLowerCase()==="c"&&!e.shiftKey&&selectedElements.length>0){ e.preventDefault(); copyPrompt(); return; }
    if(mod&&e.shiftKey&&e.key.toLowerCase()==="c"&&selectedElements.length>0){ e.preventDefault(); captureScreenshot(); return; }
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

  function mkToggle(key) {
    const row = document.createElement("div"); row.className = `${NS}-setting-row`;
    row.dataset.settingKey = key;
    const info = document.createElement("div"); info.className = `${NS}-setting-info`;
    const lbl = document.createElement("span"); lbl.className = `${NS}-setting-label`; lbl.textContent = t("opt" + key[0].toUpperCase() + key.slice(1));
    const desc = document.createElement("span"); desc.className = `${NS}-setting-desc`; desc.textContent = t("opt" + key[0].toUpperCase() + key.slice(1) + "Desc");
    info.appendChild(lbl); info.appendChild(desc);
    const toggle = document.createElement("label"); toggle.className = `${NS}-toggle`;
    const input = document.createElement("input"); input.type = "checkbox"; input.checked = !!settings[key];
    const slider = document.createElement("span"); slider.className = `${NS}-toggle-slider`;
    toggle.appendChild(input); toggle.appendChild(slider);
    input.onchange = () => {
      settings[key] = input.checked; saveSettings();
      // Visual feedback: flash the row
      row.classList.remove(`${NS}-setting-flash`);
      void row.offsetWidth; // force reflow to restart animation
      row.classList.add(`${NS}-setting-flash`);
    };
    row.appendChild(info); row.appendChild(toggle); return row;
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
      try { localStorage.setItem(NS + "-lang", lang); } catch(_) {}
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
    if (cb && !cb.classList.contains(`${NS}-copy-done`)) cb.textContent = t("copyPrompt");
    if (screenshotBtn && !screenshotBtn.classList.contains(`${NS}-screenshot-done`) && !screenshotBtn.classList.contains(`${NS}-screenshot-error`))
      setScreenshotButtonIdle();
    const minBtn = chatPanel.querySelector('[data-action="minimize"]');
    if (minBtn) minBtn.title = minimized ? t("restore") : t("minimize");
    const closeBtn = chatPanel.querySelector('[data-action="close"]');
    if (closeBtn) closeBtn.title = t("close");
    const settingsBtnEl = chatPanel.querySelector('[data-action="settings"]');
    if (settingsBtnEl) settingsBtnEl.title = t("settings");
    updateShortcuts();
  }

  function updateShortcuts() {
    const sc = chatPanel.querySelector(`.${NS}-shortcuts`); if (!sc) return;
    sc.innerHTML = [
      `<span><kbd>Click</kbd> ${t("skSelect")}</span>`,
      `<span><kbd>Shift</kbd> ${t("skMulti")}</span>`,
      `<span><kbd>\u2190\u2191\u2192\u2193</kbd> ${t("skNavigate")}</span>`,
      `<span><kbd>\u2318C</kbd> ${t("skCopy")}</span>`,
      `<span><kbd>\u2318Z</kbd> ${t("skUndo")}</span>`,
      `<span><kbd>Esc</kbd> ${selectedElements.length ? t("skClear") : t("skPause")}</span>`,
    ].join("");
  }

  // ── Chat panel ──────────────────────────────────────────────
  function createChatPanel() {
    chatPanel = document.createElement("div"); chatPanel.className = `${NS}-root ${NS}-chat`;
    chatPanel.innerHTML = `
      <div class="${NS}-drag-handle">
        <span class="${NS}-drag-title">
          <span class="${NS}-status-dot"></span>
          <span class="${NS}-status-label">Selecting</span>
          <span class="${NS}-version">v${VERSION}</span>
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
        </div>
      </div>`;
    document.body.appendChild(chatPanel);
    chatPanel.querySelector(`.${NS}-copy-btn`).onclick = () => copyPrompt();
    screenshotBtn = chatPanel.querySelector(`.${NS}-screenshot-btn`);
    screenshotBtn.onclick = () => captureScreenshot();
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
  function showCopyFeedback(msg) {
    const btn=chatPanel.querySelector(`.${NS}-copy-btn`);
    if (copyTimer) clearTimeout(copyTimer);
    btn.classList.add(`${NS}-copy-done`);
    btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg> ${msg}`;
    copyTimer = setTimeout(() => { btn.classList.remove(`${NS}-copy-done`); btn.textContent = t("copyPrompt"); copyTimer = null; }, 2000);
  }
  function copyPrompt() {
    const text = buildPromptText(); if (!text) return;
    writeToClipboard(text); showCopyFeedback(t("copied"));
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

  async function captureScreenshot() {
    if (selectedElements.length === 0) return;
    if (!navigator.clipboard || !window.ClipboardItem || !navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      showScreenshotError("unsupported");
      return;
    }

    const image = defer();
    let itemData = { "image/png": image.promise };
    if (settings.combined) {
      const text = buildPromptText();
      if (text) {
        itemData = {
          "text/html": image.promise.then(blob => screenshotHtmlBlob(text, blob)),
          "text/plain": new Blob([text], { type: "text/plain" }),
          "image/png": image.promise,
        };
      }
    }

    let writePromise;
    try {
      writePromise = navigator.clipboard.write([new ClipboardItem(itemData)]);
    } catch (err) {
      showScreenshotError("clipboard", err);
      return;
    }

    let captureError = null;
    captureScreenshotBlob().then(image.resolve, err => { captureError = err; image.reject(err); });
    try {
      await writePromise;
      showScreenshotFeedback(t("screenshotCopied"));
    } catch (err) {
      showScreenshotError(classifyScreenshotError(captureError || err, captureError ? "capture" : "clipboard"), captureError || err);
    }
  }

  function showScreenshotError(code, err) {
    const key = {
      unsupported: "errUnsupported",
      cancelled: "errCancelled",
      permission: "errPermission",
      clipboard: "errClipboard",
      empty: "errEmpty",
      capture: "errCapture",
    }[code] || "errCapture";
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

  async function captureScreenshotBlob() {
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
