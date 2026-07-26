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
