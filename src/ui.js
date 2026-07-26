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
  const SHARINGAN_ICON_SRC = "data:image/png;base64,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";
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
    const label = pendingGenPrompt ? t(pendingResultCopyKey || "copyGenPrompt") : copyButtonLabel();
    if (pendingGenPrompt) btn.textContent = label;
    else btn.innerHTML = settings.sharingan ? `${SHARINGAN_ICON}<span>${label}</span>` : label;
    btn.title = label;
    btn.setAttribute("aria-label", label);
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
