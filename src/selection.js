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

  function resolveNestedTargetFromSelection(e) {
    if (selectedElements.length !== 1) return null;
    const root = selectedElements[0];
    const r = root.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return null;
    const stack = document.elementsFromPoint ? document.elementsFromPoint(e.clientX, e.clientY) : [e.target];
    for (const el of stack) {
      const nested = resolveNestedTarget(root, el);
      if (nested) return nested;
    }
    return resolveNestedTarget(root, e.target);
  }

  function resolveNestedTarget(root, el) {
    const action = closestActionElement(el);
    if (action && action !== root && root.contains(action) && !isEditorElement(action) && isVisible(action)) return action;
    let cur = el;
    while (cur && cur !== root && cur !== document.body && cur !== document.documentElement) {
      if (!root.contains(cur)) return null;
      if (isEditorElement(cur)) { cur = cur.parentElement; continue; }
      if (isVisible(cur) && isMeaningful(cur)) return cur;
      cur = cur.parentElement;
    }
    return null;
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
    lastMoveTarget = resolveNestedTargetFromSelection(e) || resolveTarget(e.target);
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
    pushHistory(); const el = resolveNestedTargetFromSelection(e) || resolveTarget(e.target);
    if (e.shiftKey) toggleElement(el); else { clearUnannotatedSelections(); addSelection(el); }
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
    const markdownBtn = document.createElement("button");
    markdownBtn.className = `${NS}-root ${NS}-annotate-btn ${NS}-markdown-btn`; markdownBtn.title = t("copyMarkdown");
    markdownBtn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h5"/></svg>';
    markdownBtn.onclick = (e) => { e.stopPropagation(); e.preventDefault(); copyAsMarkdown([el]); };
    document.body.appendChild(box); document.body.appendChild(label); document.body.appendChild(annotateBtn); document.body.appendChild(markdownBtn);
    selOverlays.set(aiId, { box, corners, label, annotateBtn, markdownBtn }); positionSelOverlay(el);
  }
  function positionSelOverlay(el) {
    const aiId = el.getAttribute(AI_ID), ov = selOverlays.get(aiId); if (!ov) return;
    const r = el.getBoundingClientRect(), pad = 2;
    ov.box.style.top=(r.top-pad)+"px"; ov.box.style.left=(r.left-pad)+"px"; ov.box.style.width=(r.width+pad*2)+"px"; ov.box.style.height=(r.height+pad*2)+"px";
    const cs=6, pos=[{top:r.top-pad-cs/2,left:r.left-pad-cs/2},{top:r.top-pad-cs/2,left:r.right+pad-cs/2},{top:r.bottom+pad-cs/2,left:r.left-pad-cs/2},{top:r.bottom+pad-cs/2,left:r.right+pad-cs/2}];
    for (let i=0;i<4;i++) { ov.corners[i].style.top=pos[i].top+"px"; ov.corners[i].style.left=pos[i].left+"px"; }
    const toolbarTop = r.top-pad-20;
    ov.label.style.top=toolbarTop+"px"; ov.label.style.left=(r.left-pad)+"px";
    ov.markdownBtn.style.top=toolbarTop+"px"; ov.markdownBtn.style.left=(r.right+pad-20)+"px";
    ov.annotateBtn.style.top=toolbarTop+"px"; ov.annotateBtn.style.left=(r.right+pad-44)+"px";
    ov.annotateBtn.classList.toggle(`${NS}-has-note`, annotations.has(aiId));
  }
  function positionAllOverlays() { for (const el of selectedElements) positionSelOverlay(el); }
  function destroySelOverlay(aiId) { const ov=selOverlays.get(aiId); if(!ov)return; ov.box.remove(); ov.corners.forEach(c=>c.remove()); ov.label.remove(); ov.annotateBtn.remove(); ov.markdownBtn.remove(); selOverlays.delete(aiId); }
  function destroyAllOverlays() { for (const [aiId] of selOverlays) destroySelOverlay(aiId); }
  function addSelection(el) { if (!selectedElements.includes(el)) { selectedElements.push(el); createSelOverlay(el); } }
  function removeSelection(el) { const idx=selectedElements.indexOf(el); if(idx>=0){ selectedElements.splice(idx,1); destroySelOverlay(el.getAttribute(AI_ID)); annotations.delete(el.getAttribute(AI_ID)); } }
  function toggleElement(el) { selectedElements.includes(el) ? removeSelection(el) : addSelection(el); }
  function clearSelection() { destroyAllOverlays(); selectedElements=[]; annotations.clear(); removeAnnotationPopover(); }
  function clearUnannotatedSelections() { for (const el of selectedElements.slice()) { if (!annotations.has(el.getAttribute(AI_ID))) removeSelection(el); } removeAnnotationPopover(); }

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
    // ⌘C also works with NO selection while a result panel is open (⌘M with
    // no selection falls back to the page body, so there may be nothing
    // selected) — copyPrompt()'s pendingGenPrompt branch handles it.
    if(mod&&e.key.toLowerCase()==="c"&&!e.shiftKey&&(selectedElements.length>0||pendingGenPrompt)){ e.preventDefault(); copyPrompt(); return; }
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
