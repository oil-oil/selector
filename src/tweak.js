  // ── Live Visual Tweaks ─────────────────────────────────────
  const TWEAK_PAD_PROPS = ["padding-top", "padding-right", "padding-bottom", "padding-left"];
  const TWEAK_MAR_PROPS = ["margin-top", "margin-right", "margin-bottom", "margin-left"];
  const TWEAK_ALL_PROPS = [
    ...TWEAK_PAD_PROPS,
    ...TWEAK_MAR_PROPS,
    "gap",
    "font-size",
    "font-weight",
    "border-radius",
    "opacity",
    "width",
    "height",
    "color",
    "background-color",
  ];

  let tweakRepositionRaf = false;
  let colorProbeCtx = null;

  function scheduleTweakOverlaySync() {
    if (tweakRepositionRaf) return;
    tweakRepositionRaf = true;
    requestAnimationFrame(() => {
      tweakRepositionRaf = false;
      positionAllOverlays();
    });
  }

  function hasTweaks(aiId) {
    const entry = tweaks.get(aiId);
    return !!(entry && Object.keys(entry.props).length > 0);
  }

  function hasElementFeedback(aiId) {
    return annotations.has(aiId) || hasTweaks(aiId);
  }

  function toHexByte(n) {
    const clamped = Math.max(0, Math.min(255, Math.round(n)));
    return clamped.toString(16).padStart(2, "0");
  }

  function normalizeCssColor(raw) {
    const s = String(raw || "").trim();
    if (!s) return "";
    if (/^#[0-9a-f]{6}$/i.test(s)) return s.toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(s)) {
      return ("#" + s[1] + s[1] + s[2] + s[2] + s[3] + s[3]).toLowerCase();
    }
    if (s.toLowerCase() === "transparent") return "transparent";
    const rgbaComma = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
    if (rgbaComma) {
      const a = rgbaComma[4] !== undefined ? parseFloat(rgbaComma[4]) : 1;
      if (a === 0) return "transparent";
      const hex = "#" + toHexByte(rgbaComma[1]) + toHexByte(rgbaComma[2]) + toHexByte(rgbaComma[3]);
      return a < 1 ? `rgba(${Math.round(rgbaComma[1])}, ${Math.round(rgbaComma[2])}, ${Math.round(rgbaComma[3])}, ${Number(a.toFixed(2))})` : hex;
    }
    const rgbaSpace = s.match(/^rgba?\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.%]+))?\s*\)$/i);
    if (rgbaSpace) {
      let a = 1;
      if (rgbaSpace[4] !== undefined) {
        a = rgbaSpace[4].endsWith("%") ? parseFloat(rgbaSpace[4]) / 100 : parseFloat(rgbaSpace[4]);
      }
      if (a === 0) return "transparent";
      const hex = "#" + toHexByte(rgbaSpace[1]) + toHexByte(rgbaSpace[2]) + toHexByte(rgbaSpace[3]);
      return a < 1 ? `rgba(${Math.round(rgbaSpace[1])}, ${Math.round(rgbaSpace[2])}, ${Math.round(rgbaSpace[3])}, ${Number(a.toFixed(2))})` : hex;
    }
    try {
      if (!colorProbeCtx) {
        const c = document.createElement("canvas");
        c.width = 1;
        c.height = 1;
        colorProbeCtx = c.getContext("2d");
      }
      if (colorProbeCtx) {
        colorProbeCtx.fillStyle = "#010203";
        colorProbeCtx.fillStyle = s;
        const resolved = colorProbeCtx.fillStyle;
        if (typeof resolved === "string" && /^#[0-9a-f]{6}$/i.test(resolved)) {
          return resolved.toLowerCase();
        }
        if (typeof resolved === "string" && resolved.startsWith("rgba(")) {
          return normalizeCssColor(resolved);
        }
      }
    } catch (_) {}
    return s;
  }

  function normalizeBaselineProp(prop, raw) {
    const val = String(raw || "").trim();
    if (prop === "color" || prop === "background-color") return normalizeCssColor(val);
    if (prop === "gap" && val === "normal") return "0px";
    if (prop === "opacity") {
      const n = parseFloat(val);
      return Number.isFinite(n) ? String(Number(n.toFixed(2))) : val;
    }
    return val;
  }

  function normalizeCssScalar(prop, val) {
    const s = String(val || "").replace(/[\r\n]+/g, " ").trim();
    if (!s) return "";
    if (prop === "color" || prop === "background-color") return normalizeCssColor(s);
    if (prop === "opacity") {
      const n = Math.max(0, Math.min(1, parseFloat(s)));
      return Number.isFinite(n) ? String(Number(n.toFixed(2))) : s;
    }
    if (prop === "font-weight") return s;
    if (/^-?\d+(?:\.\d+)?$/.test(s)) return s + "px";
    return s;
  }

  function numericPx(val, fallback) {
    const n = parseFloat(String(val || ""));
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : (fallback || 0);
  }

  function readComputedBaseline(el, prop) {
    try {
      const cs = getComputedStyle(el);
      return normalizeBaselineProp(prop, cs.getPropertyValue(prop));
    } catch (_) {
      return "";
    }
  }

  function ensureTweakEntry(el) {
    const aiId = el.getAttribute(AI_ID);
    let entry = tweaks.get(aiId);
    if (!entry) {
      entry = {
        el,
        origCssText: el.style.cssText || "",
        props: {},
      };
      tweaks.set(aiId, entry);
    } else {
      entry.el = el;
    }
    return entry;
  }

  function restoreOrigInlineCss(el, origCssText) {
    if (!el) return;
    if (origCssText) el.style.cssText = origCssText;
    else el.removeAttribute("style");
  }

  function reapplyEntryStyles(entry) {
    if (!entry || !entry.el || !entry.el.isConnected) return;
    restoreOrigInlineCss(entry.el, entry.origCssText);
    for (const [prop, info] of Object.entries(entry.props)) {
      entry.el.style.setProperty(prop, info.currentValue, "important");
    }
  }

  function applyElementTweak(el, prop, rawValue) {
    if (!el || !el.isConnected) return;
    const aiId = el.getAttribute(AI_ID);
    if (!aiId) return;
    const entry = ensureTweakEntry(el);
    const existing = entry.props[prop];
    const baseline = existing ? existing.baselineComputed : readComputedBaseline(el, prop);
    const nextVal = normalizeCssScalar(prop, rawValue);
    if (!nextVal || nextVal === baseline) {
      delete entry.props[prop];
      reapplyEntryStyles(entry);
      if (Object.keys(entry.props).length === 0) tweaks.delete(aiId);
    } else {
      entry.props[prop] = {
        baselineComputed: baseline,
        currentValue: nextVal,
      };
      el.style.setProperty(prop, nextVal, "important");
    }
    scheduleTweakOverlaySync();
    if (typeof updateTags === "function") updateTags();
    if (typeof updateDevPill === "function") updateDevPill();
  }

  function resetElementTweaks(el, prop) {
    if (!el) return;
    const aiId = el.getAttribute(AI_ID);
    const entry = tweaks.get(aiId);
    if (!entry) return;
    if (prop) {
      delete entry.props[prop];
      reapplyEntryStyles(entry);
      if (Object.keys(entry.props).length === 0) tweaks.delete(aiId);
    } else {
      restoreOrigInlineCss(entry.el, entry.origCssText);
      tweaks.delete(aiId);
    }
    scheduleTweakOverlaySync();
    if (typeof updateTags === "function") updateTags();
    if (typeof updateDevPill === "function") updateDevPill();
  }

  function revertTweaksForAiId(aiId) {
    const entry = tweaks.get(aiId);
    if (!entry) return;
    restoreOrigInlineCss(entry.el, entry.origCssText);
    tweaks.delete(aiId);
  }

  function revertAllTweaks() {
    for (const [, entry] of tweaks) {
      restoreOrigInlineCss(entry.el, entry.origCssText);
    }
    tweaks.clear();
  }

  function withCleanTweaks(el, fn) {
    const aiId = el && el.getAttribute ? el.getAttribute(AI_ID) : null;
    const entry = aiId ? tweaks.get(aiId) : null;
    if (!entry || !Object.keys(entry.props).length) return fn();
    restoreOrigInlineCss(el, entry.origCssText);
    try {
      return fn();
    } finally {
      reapplyEntryStyles(entry);
    }
  }

  function getElementStyleDiff(aiId) {
    const entry = tweaks.get(aiId);
    if (!entry) return [];
    const out = [];
    for (const [prop, info] of Object.entries(entry.props)) {
      if (info.currentValue !== info.baselineComputed) {
        out.push({ prop, before: info.baselineComputed, after: info.currentValue });
      }
    }
    return out;
  }

  function snapshotTweaksState() {
    const snap = new Map();
    for (const [aiId, entry] of tweaks) {
      const clonedProps = {};
      for (const [k, v] of Object.entries(entry.props)) {
        clonedProps[k] = { baselineComputed: v.baselineComputed, currentValue: v.currentValue };
      }
      snap.set(aiId, { el: entry.el, origCssText: entry.origCssText, props: clonedProps });
    }
    return snap;
  }

  function restoreTweaksSnapshot(snap) {
    for (const [aiId, entry] of tweaks) {
      if (!snap || !snap.has(aiId)) {
        restoreOrigInlineCss(entry.el, entry.origCssText);
      }
    }
    tweaks.clear();
    if (!snap) return;
    for (const [aiId, entry] of snap) {
      const clonedProps = {};
      for (const [k, v] of Object.entries(entry.props)) {
        clonedProps[k] = { baselineComputed: v.baselineComputed, currentValue: v.currentValue };
      }
      const restored = { el: entry.el, origCssText: entry.origCssText, props: clonedProps };
      tweaks.set(aiId, restored);
      reapplyEntryStyles(restored);
    }
    scheduleTweakOverlaySync();
  }

  function currentTweakDisplayValue(el, prop) {
    const aiId = el.getAttribute(AI_ID);
    const entry = tweaks.get(aiId);
    if (entry && entry.props[prop]) return entry.props[prop].currentValue;
    return readComputedBaseline(el, prop);
  }

  function renderTweakPanel(container, el, opts) {
    container.innerHTML = "";
    const aiId = el.getAttribute(AI_ID);
    const onTweakChange = opts && typeof opts.onTweakChange === "function" ? opts.onTweakChange : null;
    const hideTopBar = !!(opts && opts.hideTopBar);
    const stopAll = (node) => {
      node.addEventListener("keydown", (e) => {
        if (e.key === "Escape") return;
        e.stopPropagation();
      });
      node.addEventListener("click", (e) => e.stopPropagation());
    };

    let resetAllBtn = null;
    if (!hideTopBar) {
      const topBar = document.createElement("div");
      topBar.className = `${NS}-tweak-topbar`;
      const elTag = document.createElement("span");
      elTag.className = `${NS}-tweak-elname`;
      elTag.textContent = elementLabel(el);
      resetAllBtn = document.createElement("button");
      resetAllBtn.type = "button";
      resetAllBtn.className = `${NS}-tweak-reset-all`;
      resetAllBtn.textContent = t("tweakResetAll");
      resetAllBtn.disabled = !hasTweaks(aiId);
      resetAllBtn.onclick = (e) => {
        e.stopPropagation();
        resetElementTweaks(el);
        renderTweakPanel(container, el, opts);
      };
      topBar.appendChild(elTag);
      topBar.appendChild(resetAllBtn);
      container.appendChild(topBar);
    }

    const syncResetAll = () => {
      if (resetAllBtn) resetAllBtn.disabled = !hasTweaks(aiId);
      if (onTweakChange) onTweakChange(hasTweaks(aiId));
    };

    const mkSection = (titleText) => {
      const sec = document.createElement("div");
      sec.className = `${NS}-tweak-section`;
      const hd = document.createElement("div");
      hd.className = `${NS}-tweak-section-title`;
      hd.textContent = titleText;
      sec.appendChild(hd);
      container.appendChild(sec);
      return sec;
    };

    const mkQuadRow = (sec, labelText, props) => {
      const row = document.createElement("div");
      row.className = `${NS}-tweak-block`;
      const head = document.createElement("div");
      head.className = `${NS}-tweak-block-head`;
      const lbl = document.createElement("span");
      lbl.className = `${NS}-tweak-label`;
      lbl.textContent = labelText;
      head.appendChild(lbl);
      const grid = document.createElement("div");
      grid.className = `${NS}-quad-grid`;
      const sides = ["T", "R", "B", "L"];
      props.forEach((prop, idx) => {
        const cell = document.createElement("label");
        cell.className = `${NS}-quad-cell`;
        const tag = document.createElement("span");
        tag.className = `${NS}-quad-side`;
        tag.textContent = sides[idx];
        const inp = document.createElement("input");
        inp.type = "number";
        inp.className = `${NS}-tweak-num`;
        inp.value = String(numericPx(currentTweakDisplayValue(el, prop), 0));
        inp.step = "1";
        stopAll(inp);
        inp.addEventListener("input", () => {
          if (inp.value === "") return;
          applyElementTweak(el, prop, inp.value + "px");
          syncResetAll();
        });
        cell.appendChild(tag);
        cell.appendChild(inp);
        grid.appendChild(cell);
      });
      row.appendChild(head);
      row.appendChild(grid);
      sec.appendChild(row);
    };

    const mkRangeRow = (sec, labelText, prop, min, max, step, unit) => {
      const row = document.createElement("div");
      row.className = `${NS}-tweak-row`;
      const lbl = document.createElement("span");
      lbl.className = `${NS}-tweak-label`;
      lbl.textContent = labelText;
      const ctrl = document.createElement("div");
      ctrl.className = `${NS}-tweak-ctrl`;
      const initNum = numericPx(currentTweakDisplayValue(el, prop), min);
      const range = document.createElement("input");
      range.type = "range";
      range.className = `${NS}-tweak-range`;
      range.min = String(min);
      range.max = String(max);
      range.step = String(step);
      range.value = String(Math.max(min, Math.min(max, initNum)));
      const num = document.createElement("input");
      num.type = "number";
      num.className = `${NS}-tweak-num ${NS}-tweak-num-sm`;
      num.step = String(step);
      num.value = String(initNum);
      stopAll(range);
      stopAll(num);
      range.addEventListener("input", () => {
        num.value = range.value;
        applyElementTweak(el, prop, range.value + unit);
        syncResetAll();
      });
      num.addEventListener("input", () => {
        if (num.value === "") return;
        const n = parseFloat(num.value);
        if (Number.isFinite(n)) range.value = String(Math.max(min, Math.min(max, n)));
        applyElementTweak(el, prop, num.value + unit);
        syncResetAll();
      });
      ctrl.appendChild(range);
      ctrl.appendChild(num);
      row.appendChild(lbl);
      row.appendChild(ctrl);
      sec.appendChild(row);
    };

    const mkTextRow = (sec, labelText, prop, placeholder) => {
      const row = document.createElement("div");
      row.className = `${NS}-tweak-row`;
      const lbl = document.createElement("span");
      lbl.className = `${NS}-tweak-label`;
      lbl.textContent = labelText;
      const inp = document.createElement("input");
      inp.type = "text";
      inp.className = `${NS}-tweak-text`;
      inp.value = currentTweakDisplayValue(el, prop);
      inp.placeholder = placeholder || "";
      stopAll(inp);
      inp.addEventListener("change", () => {
        const v = inp.value.trim();
        if (!v) resetElementTweaks(el, prop);
        else applyElementTweak(el, prop, v);
        syncResetAll();
      });
      row.appendChild(lbl);
      row.appendChild(inp);
      sec.appendChild(row);
    };

    const mkWeightRow = (sec) => {
      const row = document.createElement("div");
      row.className = `${NS}-tweak-row`;
      const lbl = document.createElement("span");
      lbl.className = `${NS}-tweak-label`;
      lbl.textContent = t("tweakFontWeight");
      const sel = document.createElement("select");
      sel.className = `${NS}-tweak-select`;
      const cur = String(currentTweakDisplayValue(el, "font-weight") || "400");
      const weights = ["300", "400", "500", "600", "700", "800"];
      if (!weights.includes(cur)) weights.unshift(cur);
      weights.forEach(w => {
        const o = document.createElement("option");
        o.value = w;
        o.textContent = w;
        if (w === cur) o.selected = true;
        sel.appendChild(o);
      });
      stopAll(sel);
      sel.addEventListener("change", () => {
        applyElementTweak(el, "font-weight", sel.value);
        syncResetAll();
      });
      row.appendChild(lbl);
      row.appendChild(sel);
      sec.appendChild(row);
    };

    const mkColorRow = (sec, labelText, prop) => {
      const row = document.createElement("div");
      row.className = `${NS}-tweak-row`;
      const lbl = document.createElement("span");
      lbl.className = `${NS}-tweak-label`;
      lbl.textContent = labelText;
      const ctrl = document.createElement("div");
      ctrl.className = `${NS}-tweak-ctrl`;
      const cur = currentTweakDisplayValue(el, prop);
      const picker = document.createElement("input");
      picker.type = "color";
      picker.className = `${NS}-tweak-color`;
      picker.value = /^#[0-9a-f]{6}$/i.test(cur) ? cur : "#ffffff";
      const txt = document.createElement("input");
      txt.type = "text";
      txt.className = `${NS}-tweak-text`;
      txt.value = cur;
      stopAll(picker);
      stopAll(txt);
      picker.addEventListener("input", () => {
        txt.value = picker.value;
        applyElementTweak(el, prop, picker.value);
        syncResetAll();
      });
      txt.addEventListener("change", () => {
        const v = txt.value.trim();
        if (!v) resetElementTweaks(el, prop);
        else {
          applyElementTweak(el, prop, v);
          const norm = normalizeCssColor(v);
          if (/^#[0-9a-f]{6}$/i.test(norm)) picker.value = norm;
        }
        syncResetAll();
      });
      ctrl.appendChild(picker);
      ctrl.appendChild(txt);
      row.appendChild(lbl);
      row.appendChild(ctrl);
      sec.appendChild(row);
    };

    const spacingSec = mkSection(t("tweakSpacing"));
    mkQuadRow(spacingSec, t("tweakPadding"), TWEAK_PAD_PROPS);
    mkQuadRow(spacingSec, t("tweakMargin"), TWEAK_MAR_PROPS);
    mkRangeRow(spacingSec, t("tweakGap"), "gap", 0, 64, 1, "px");

    const boxSec = mkSection(t("tweakTypography"));
    mkRangeRow(boxSec, t("tweakFontSize"), "font-size", 10, 64, 1, "px");
    mkWeightRow(boxSec);
    mkRangeRow(boxSec, t("tweakRadius"), "border-radius", 0, 48, 1, "px");
    mkRangeRow(boxSec, t("tweakOpacity"), "opacity", 0, 1, 0.05, "");
    mkTextRow(boxSec, t("tweakWidth"), "width", t("tweakAuto"));
    mkTextRow(boxSec, t("tweakHeight"), "height", t("tweakAuto"));

    const colorSec = mkSection(t("tweakColors"));
    mkColorRow(colorSec, t("tweakColor"), "color");
    mkColorRow(colorSec, t("tweakBg"), "background-color");
  }
