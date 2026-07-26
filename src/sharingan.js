/**
 * Sharingan report module — inlined into editor.js's IIFE at build/install time
 * by index.html's bookmarklet builder. Not loadable on its own.
 *
 * Contract: this fragment runs inside editor.js's closure, so it can use any
 * symbol defined there (selectedElements, currentPageContext, isEditorElement,
 * NS, AI_ID, annotations, buildElementContext, etc.). Likewise, anything it
 * defines is visible to editor.js (settings.sharingan code path calls
 * buildSharinganReport / sharinganFilename / SHARINGAN_CLIPBOARD_CHAR_LIMIT).
 *
 * Indented with two spaces because the host IIFE is two spaces deep.
 */
  // ── Sharingan report ───────────────────────────────────────
  function buildSharinganReport() {
    if (selectedElements.length === 0) return "";
    const pageContext = currentPageContext();
    const colorScheme = (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
    const lines = [
      "# Selector Sharingan Report",
      "",
      `- Captured at: ${new Date().toISOString()}`,
      `- Page: ${location.href}`,
    ];
    if (pageContext.page && pageContext.page !== location.href) lines.push(`- Route: ${pageContext.page}`);
    if (pageContext.query) lines.push(`- Query: ${pageContext.query}`);
    lines.push(
      `- Viewport: ${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio || 1}x`,
      `- Scroll: ${Math.round(window.scrollX || window.pageXOffset || 0)},${Math.round(window.scrollY || window.pageYOffset || 0)}`,
      `- Color scheme: ${colorScheme}`,
      `- Selected: ${selectedElements.length}`,
      ""
    );

    appendMarkdownSection(lines, "Document Context", codeBlock(getDocumentContextReport(), "text"));

    try {
      selectedElements.forEach((el, i) => {
        perElementEmittedRules = new Set();
        const aiId = el.getAttribute(AI_ID);
        const note = annotations.get(aiId);
        const ctx = buildElementContext(el, i + 1, note);
        const replicaRoot = getReplicaRoot(el);
        lines.push(`## Element ${i + 1}: ${ctx.title} <${ctx.tag}>`, "");
        if (note) appendMarkdownSection(lines, "Instruction", note);
        appendMarkdownSection(lines, "Identity", codeBlock(getIdentityReport(el, ctx), "text"));
        appendMarkdownSection(lines, "Geometry", codeBlock(getGeometryReport(el), "text"));
        const rootReport = getReplicaRootReport(el, replicaRoot);
        if (rootReport) appendMarkdownSection(lines, "Replica Root", codeBlock(rootReport, "text"));
        appendMarkdownSection(lines, "DOM Snapshot", codeBlock(sanitizedOuterHtml(el), "html"));
        const sprite = getSvgSpriteReport(el);
        if (sprite) appendMarkdownSection(lines, "Referenced SVG Symbols", codeBlock(sprite, "html"));
        const parentSnapshot = getParentSnapshotReport(el, i + 1);
        if (parentSnapshot) appendMarkdownSection(lines, "Parent Snapshot", codeBlock(parentSnapshot, "html"));
        const runtime = getRuntimeStateReport(el);
        if (runtime) appendMarkdownSection(lines, "Runtime State", codeBlock(runtime, "text"));
        const textDiff = getTextContentDiffReport(el);
        if (textDiff) appendMarkdownSection(lines, "Text Content", codeBlock(textDiff, "text"));
        appendMarkdownSection(lines, "Effective Style", codeBlock(getComputedStyleReport(el), "css"));
        const vars = getCssVariablesReport(el);
        if (vars && vars !== "none") appendMarkdownSection(lines, "CSS Custom Properties", codeBlock(vars, "css"));
        const stylePack = getReplicaStylePackReport(replicaRoot, el);
        if (stylePack) appendMarkdownSection(lines, "Replica Style Pack", codeBlock(stylePack, "text"));
        const normal = getMatchedCssRulesReport(el);
        if (normal) appendMarkdownSection(lines, "Matched Rules", codeBlock(normal, "css"));
        const interactive = getInteractiveStatesReport(el);
        if (interactive) appendMarkdownSection(lines, "Interactive State Rules", codeBlock(interactive, "css"));
        const colorRules = getColorSchemeRulesReport(el);
        if (colorRules) appendMarkdownSection(lines, "Color Scheme Rules", codeBlock(colorRules, "css"));
        const ancestors = getAncestorChainReport(el);
        if (ancestors) appendMarkdownSection(lines, "Ancestor Chain", codeBlock(ancestors, "text"));
        const pseudo = getPseudoElementsReport(el);
        if (pseudo) appendMarkdownSection(lines, "Pseudo Elements", codeBlock(pseudo, "css"));
        const fontUsage = getFontUsageReport(replicaRoot, el);
        if (fontUsage) appendMarkdownSection(lines, "Font Usage", codeBlock(fontUsage, "text"));
        const fonts = getFontFacesReport(replicaRoot || el);
        if (fonts) appendMarkdownSection(lines, "Font Faces", codeBlock(fonts, "css"));
        const animationRuntime = getAnimationRuntimeReport(replicaRoot || el, el);
        if (animationRuntime) appendMarkdownSection(lines, "Animation Runtime", codeBlock(animationRuntime, "text"));
        const keyframes = getKeyframesReport(replicaRoot || el);
        if (keyframes) appendMarkdownSection(lines, "Keyframes", codeBlock(keyframes, "css"));
        const media = getMediaAssetsReport(el);
        if (media) appendMarkdownSection(lines, "Media Assets", codeBlock(media, "text"));
        const outline = getChildrenOutlineReport(el);
        if (outline) appendMarkdownSection(lines, "Children Outline", codeBlock(outline, "text"));
        const react = getReactDetailsReport(el);
        if (react && react !== "none") appendMarkdownSection(lines, "React Details", codeBlock(react, "json"));
        appendMarkdownSection(lines, "Context", codeBlock(getContextReport(el), "text"));
      });
    } finally {
      releaseStyleBaseline();
      perElementEmittedRules = null;
    }

    return lines.join("\n");
  }

  function appendMarkdownSection(lines, title, body) {
    if (!body) return;
    lines.push(`### ${title}`, "", body, "");
  }

  function codeBlock(value, lang) {
    value = value == null ? "" : String(value);
    const runs = value.match(/`{3,}/g);
    const size = runs ? Math.max(...runs.map(run => run.length)) + 1 : 3;
    const fence = "`".repeat(size);
    return `${fence}${lang || ""}\n${value}\n${fence}`;
  }

  function sharinganFilename() {
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
    const slug = safeFilename((document.title || location.hostname || "page").slice(0, 48)) || "page";
    return `selector-sharingan-${slug}-${stamp}.md`;
  }

  function screenshotFilename() {
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
    const slug = safeFilename((document.title || location.hostname || "page").slice(0, 42)) || "page";
    return `selector-screenshot-${slug}-${stamp}.png`;
  }

  function appendScreenshotReference(text, filename) {
    const path = `~/Downloads/${filename}`;
    const ref = `Screenshot file: ${path}`;
    return text ? `${text}\n\n${ref}` : ref;
  }

  function safeFilename(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "-").replace(/^-+|-+$/g, "");
  }

  function downloadMarkdown(text, filename) {
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    downloadBlob(blob, filename);
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function getIdentityReport(el, ctx) {
    const rows = [
      ["tag", el.tagName.toLowerCase()],
      ["role", explicitOrImplicitRole(el) || ""],
      ["label", accessibleLabel(el) || ""],
      ["selector", ctx.selector || buildSelector(el)],
      ["locator", ctx.locator],
      ["xpath", buildXPath(el)],
      ["domPath", buildDomPath(el)],
      ["source", ctx.source],
      ["react", ctx.react],
      ["aiId", el.getAttribute(AI_ID)],
    ];
    return rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\n") || "none";
  }

  function getGeometryReport(el) {
    const r = el.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset || 0;
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const rows = [
      `viewport: x=${round2(r.x)} y=${round2(r.y)} w=${round2(r.width)} h=${round2(r.height)}`,
      `document: x=${round2(r.left + scrollX)} y=${round2(r.top + scrollY)}`,
    ];
    const box = `offset=${el.offsetWidth || 0}x${el.offsetHeight || 0} client=${el.clientWidth || 0}x${el.clientHeight || 0} scroll=${el.scrollWidth || 0}x${el.scrollHeight || 0}`;
    if (box !== "offset=0x0 client=0x0 scroll=0x0") rows.push(`box: ${box}`);
    return rows.join("\n");
  }

  // Replica Root — the selected element is often only a rendering layer
  // (for example an SVG wire layer). For faithful reconstruction we also name
  // the nearest visual module root that owns the surrounding siblings.
  const REPLICA_ROOT_CLASS_HINT = /(stage|scene|diagram|canvas|module|widget|panel|card|hero|section|shell|surface|frame|board|graph|chart|flow|timeline|workspace|viewport)/i;
  const REPLICA_ROOT_TAGS = new Set(["section","article","main","aside","nav","header","footer","figure"]);

  function getReplicaRoot(el) {
    if (!el || !el.parentElement) return el;
    const selected = safeRect(el);
    let node = el.parentElement;
    let best = node;
    let depth = 0;
    while (node && node !== document.body && node !== document.documentElement && depth++ < 12) {
      if (isEditorElement(node)) { node = node.parentElement; continue; }
      const rect = safeRect(node);
      if (rect.width < 16 || rect.height < 16) { node = node.parentElement; continue; }
      const signal = replicaRootSignal(node);
      const surroundsSelected = rect.width >= selected.width && rect.height >= selected.height;
      if (signal && surroundsSelected) {
        best = node;
        if (/stage|scene|diagram|canvas|widget|module|flow|chart|graph/i.test(signal)) return node;
      }
      node = node.parentElement;
    }
    return best || el;
  }

  function replicaRootSignal(node) {
    const tag = (node.tagName || "").toLowerCase();
    const cls = Array.from(node.classList || []).join(" ");
    const id = node.id || "";
    const role = node.getAttribute && (node.getAttribute("role") || "");
    const data = node.getAttribute && (node.getAttribute("data-node") || node.getAttribute("data-section") || "");
    const haystack = `${tag} ${id} ${cls} ${role} ${data}`;
    const hinted = haystack.match(REPLICA_ROOT_CLASS_HINT);
    if (hinted) return hinted[0];
    if (REPLICA_ROOT_TAGS.has(tag)) return tag;
    const children = Array.from(node.children || []).filter(child => !isEditorElement(child));
    if (children.length >= 3) return "multi-child-container";
    return "";
  }

  function getReplicaRootReport(el, root) {
    if (!root || root === el) return "";
    const rr = safeRect(root);
    const er = safeRect(el);
    const children = Array.from(root.children || []).filter(child => !isEditorElement(child));
    return [
      `root: ${describeElement(root)}`,
      `reason: nearest visual module/container around selected element`,
      `root viewport: x=${round2(rr.x)} y=${round2(rr.y)} w=${round2(rr.width)} h=${round2(rr.height)}`,
      `selected within root: x=${round2(er.x - rr.x)} y=${round2(er.y - rr.y)} w=${round2(er.width)} h=${round2(er.height)}`,
      children.length ? `direct children: ${children.length}` : "",
      `relation: ${root === el.parentElement ? "selected element is a direct child of this root" : "selected element is nested inside this root"}`,
    ].filter(Boolean).join("\n");
  }

  function safeRect(el) {
    try { return el.getBoundingClientRect(); }
    catch (_) { return { x: 0, y: 0, left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 }; }
  }

  function sanitizedOuterHtml(el) {
    const imageInlines = buildImageInlineMap(el);
    const clone = el.cloneNode(true);
    sanitizeReportClone(clone);
    applyImageInlineMap(el, clone, imageInlines);
    const html = clone.outerHTML || "";
    const limited = limitText(html, 200000, "HTML truncated");
    sharinganDomTruncated = limited.length !== html.length;
    return limited;
  }

  let sharinganDomTruncated = false;

  // Inline same-origin (or CORS-OK) <img> sources as data URLs via canvas
  // drawing — synchronous because the browser already cached/decoded the pixels.
  // Skips huge images and CORS-tainted sources (canvas.toDataURL throws).
  const IMAGE_INLINE_PIXEL_LIMIT = 1_000_000;  // 1MP
  const IMAGE_INLINE_DATAURL_LIMIT = 120_000;  // ~90KB binary

  function buildImageInlineMap(root) {
    const map = new Map();
    const imgs = root.tagName && root.tagName.toLowerCase() === "img"
      ? [root]
      : (root.querySelectorAll ? Array.from(root.querySelectorAll("img")) : []);
    imgs.forEach(img => {
      if (!img.complete || !img.naturalWidth || !img.naturalHeight) return;
      const src = img.getAttribute("src") || "";
      if (!src || src.startsWith("data:")) return;
      if (img.naturalWidth * img.naturalHeight > IMAGE_INLINE_PIXEL_LIMIT) return;
      // ── Host asset cache seam (HOST_CONTRACT.md §1.4) ─────────
      // The extension can inline ANY origin. copyPrompt() pre-warms an async
      // cross-origin fetch cache via HOST.prepareAssets() BEFORE this synchronous
      // pipeline runs, then exposes a SYNCHRONOUS cache lookup here. A cache hit
      // short-circuits the same-origin-only canvas path below; a miss falls
      // through to the EXISTING canvas inlining (bookmarklet path, unchanged).
      if (HOST.cachedAssetDataURL) {
        try {
          const hosted = HOST.cachedAssetDataURL(src);
          if (hosted && typeof hosted === "string" && hosted.indexOf("data:") === 0) {
            map.set(img, hosted);
            return;
          }
        } catch (_) { /* fall through to same-origin canvas inlining */ }
      }
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d").drawImage(img, 0, 0);
        const dataURL = canvas.toDataURL();
        if (dataURL.length > IMAGE_INLINE_DATAURL_LIMIT) return;
        map.set(img, dataURL);
      } catch (_) { /* tainted by CORS — skip silently */ }
    });
    return map;
  }

  function applyImageInlineMap(original, clone, map) {
    if (!map.size) return;
    const origImgs = original.tagName && original.tagName.toLowerCase() === "img"
      ? [original]
      : Array.from(original.querySelectorAll("img"));
    const cloneImgs = clone.tagName && clone.tagName.toLowerCase() === "img"
      ? [clone]
      : Array.from(clone.querySelectorAll("img"));
    origImgs.forEach((origImg, i) => {
      const inlined = map.get(origImg);
      if (!inlined) return;
      const target = cloneImgs[i];
      if (!target) return;
      target.setAttribute("src", inlined);
      target.removeAttribute("srcset");  // inlined dataURL trumps srcset
    });
  }

  function sanitizeReportClone(root) {
    if (!root || root.nodeType !== 1) return;
    const nodes = [root, ...Array.from(root.querySelectorAll("*"))];
    nodes.forEach(node => {
      node.removeAttribute(AI_ID);
      if (isEditorElement(node)) { node.remove(); return; }
      for (const attr of Array.from(node.attributes || [])) {
        if (isSensitiveName(attr.name) || isTokenLikeValue(attr.value)) node.setAttribute(attr.name, maskedValue(attr.value));
      }
      if (/^(input|textarea)$/i.test(node.tagName || "")) {
        const type = (node.getAttribute("type") || "").toLowerCase();
        if (type === "password") node.setAttribute("value", "[masked password]");
      }
    });
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let textNode;
    while ((textNode = walker.nextNode())) {
      const original = textNode.nodeValue || "";
      const masked = maskSensitiveText(original);
      if (masked !== original) textNode.nodeValue = masked;
    }
  }

  // Parent Snapshot — outerHTML of el.parentElement with the selected element
  // itself replaced by a marker comment (avoids double-emitting the selected
  // element's DOM, which already appears in DOM Snapshot above). Siblings get
  // sanitized + image-inlined identically to DOM Snapshot. When parent has
  // many children (e.g. a long list) we keep head 12 + tail 12 + the selected
  // element and replace the middle with an "omitted" comment.
  const PARENT_SNAPSHOT_TOTAL_CAP = 100000;
  const PARENT_SNAPSHOT_KEEP_HEAD = 12;
  const PARENT_SNAPSHOT_KEEP_TAIL = 12;
  const PARENT_SNAPSHOT_MAX_KEEP = 30;

  function getParentSnapshotReport(el, elementOrdinal) {
    const parent = el.parentElement;
    if (!parent || parent === document.body || parent === document.documentElement) return "";
    const siblings = Array.from(parent.children || []).filter(c => !isEditorElement(c));
    if (siblings.length <= 1) return "";  // no siblings → nothing meaningful beyond DOM Snapshot
    const idx = siblings.indexOf(el);
    if (idx < 0) return "";
    const total = siblings.length;

    let keep;
    if (total <= PARENT_SNAPSHOT_MAX_KEEP) {
      keep = siblings.map((_, i) => i);
    } else {
      const set = new Set();
      for (let i = 0; i < PARENT_SNAPSHOT_KEEP_HEAD; i++) set.add(i);
      for (let i = Math.max(0, total - PARENT_SNAPSHOT_KEEP_TAIL); i < total; i++) set.add(i);
      set.add(idx);
      keep = Array.from(set).sort((a, b) => a - b);
    }

    const parentClone = parent.cloneNode(false);  // shallow — we'll append manually
    sanitizeReportClone(parentClone);              // sanitize parent's own attrs

    let lastKept = -1;
    keep.forEach(i => {
      if (i > lastKept + 1) {
        const skipped = i - lastKept - 1;
        parentClone.appendChild(
          document.createComment(` … ${skipped} sibling${skipped > 1 ? "s" : ""} omitted (indices ${lastKept + 2}-${i}) … `)
        );
      }
      lastKept = i;
      if (i === idx) {
        parentClone.appendChild(
          document.createComment(` ◇ SELECTED ELEMENT ${elementOrdinal} — see DOM Snapshot above ◇ `)
        );
        return;
      }
      const sib = siblings[i];
      const sibClone = sib.cloneNode(true);
      sanitizeReportClone(sibClone);
      const inlines = buildImageInlineMap(sib);
      applyImageInlineMap(sib, sibClone, inlines);
      parentClone.appendChild(sibClone);
    });
    if (lastKept < total - 1) {
      const skipped = total - 1 - lastKept;
      parentClone.appendChild(
        document.createComment(` … ${skipped} sibling${skipped > 1 ? "s" : ""} omitted (tail, indices ${lastKept + 2}-${total}) … `)
      );
    }

    const html = parentClone.outerHTML || "";
    return limitText(html, PARENT_SNAPSHOT_TOTAL_CAP, "Parent snapshot truncated");
  }

  function maskSensitiveText(text) {
    if (!text || text.length < 20) return text;
    return String(text)
      .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{8,}\b/g, "[masked jwt]")
      .replace(/\b(sk|pk|rk)-[A-Za-z0-9]{20,}\b/g, "[masked api key]")
      .replace(/\bghp_[A-Za-z0-9]{20,}\b/g, "[masked github token]")
      .replace(/\b(AIza|AKIA|ASIA)[A-Za-z0-9_-]{16,}\b/g, "[masked cloud key]")
      .replace(/\bBearer\s+[A-Za-z0-9._-]{20,}/gi, "Bearer [masked]");
  }

  // Runtime-only state — properties that are NOT visible in the DOM Snapshot (the
  // snapshot already shows every attribute and the current "value" attribute).
  // We deliberately exclude data also visible in outerHTML.
  function getRuntimeStateReport(el) {
    const rows = elementStateRows(el);
    const descendants = formDescendantStateRows(el);
    if (descendants.length) {
      if (rows.length) rows.push("");
      rows.push("[form descendants]", ...descendants);
    }
    return rows.length ? rows.join("\n") : "";
  }

  function elementStateRows(el) {
    const rows = [];
    if (/^(input|textarea|select)$/i.test(el.tagName || "") && "value" in el) {
      const attrValue = el.getAttribute("value");
      if (el.value !== (attrValue == null ? "" : attrValue)) {
        rows.push(`value: ${safeReportValue(el.getAttribute("name") || "value", el.value, 5000)}`);
      }
    }
    if ("checked" in el && el.checked !== el.hasAttribute("checked")) rows.push(`checked: ${!!el.checked}`);
    if ("selected" in el && el.selected !== el.hasAttribute("selected")) rows.push(`selected: ${!!el.selected}`);
    if ("disabled" in el && el.disabled !== el.hasAttribute("disabled")) rows.push(`disabled: ${!!el.disabled}`);
    if ("open" in el && el.open !== el.hasAttribute("open")) rows.push(`open: ${!!el.open}`);
    return rows;
  }

  function formDescendantStateRows(el) {
    const fields = Array.from(el.querySelectorAll ? el.querySelectorAll("input,textarea,select,option") : []).slice(0, 40);
    const rows = fields.map(field => {
      const name = field.getAttribute("name") || field.getAttribute("aria-label") || field.getAttribute("placeholder") || "";
      const value = "value" in field ? safeReportValue(name || "value", field.value, 1000) : "";
      const flags = [];
      if ("checked" in field) flags.push(`checked=${!!field.checked}`);
      if ("selected" in field) flags.push(`selected=${!!field.selected}`);
      if ("disabled" in field) flags.push(`disabled=${!!field.disabled}`);
      return `${describeElement(field)}${name ? ` name="${name}"` : ""}${value ? ` value="${value}"` : ""}${flags.length ? ` ${flags.join(" ")}` : ""}`;
    });
    if (fields.length === 40 && el.querySelectorAll("input,textarea,select,option").length > 40) rows.push("... form state truncated after 40 descendants");
    return rows;
  }

  // Effective Style — output only values that diverge from BOTH:
  //   1. the browser baseline for the tag (computed in an `all:initial` host)
  //   2. the page's root/body style for inherited properties (color, font-*)
  // Document Context already prints the root font/color, and CSS Custom
  // Properties are deduped against :root — so an inherited value that equals
  // root is silently dropped here.
  //
  // STYLE_REDUNDANT is a blocklist for the "other" sweep — CSS Logical
  // Properties (block-size, inset-*-end, border-block-*) and WebKit aliases
  // (-webkit-text-fill-color, -webkit-locale, text-rendering) are physical
  // equivalents of properties already in STYLE_GROUPS and pollute the report.
  const STYLE_GROUPS = [
    ["layout", ["display","position","top","right","bottom","left","z-index","float","clear","box-sizing","visibility","opacity","pointer-events","cursor","contain","isolation"]],
    ["box", ["width","height","min-width","max-width","min-height","max-height","margin-top","margin-right","margin-bottom","margin-left","padding-top","padding-right","padding-bottom","padding-left","overflow","overflow-x","overflow-y"]],
    ["border", ["border-top-width","border-right-width","border-bottom-width","border-left-width","border-top-style","border-right-style","border-bottom-style","border-left-style","border-top-color","border-right-color","border-bottom-color","border-left-color","border-radius","border-top-left-radius","border-top-right-radius","border-bottom-right-radius","border-bottom-left-radius","outline-width","outline-style","outline-color","outline-offset"]],
    ["flex-grid", ["flex-direction","flex-wrap","flex-grow","flex-shrink","flex-basis","align-items","align-content","align-self","justify-content","justify-items","justify-self","gap","row-gap","column-gap","grid-template-columns","grid-template-rows","grid-auto-columns","grid-auto-rows","grid-auto-flow","grid-column","grid-row"]],
    ["typography", ["font-family","font-size","font-weight","font-style","font-stretch","line-height","letter-spacing","text-align","text-transform","text-decoration-line","text-decoration-style","text-decoration-color","white-space","word-break","overflow-wrap","text-overflow"]],
    ["color-background", ["color","background-color","background-image","background-size","background-position","background-repeat","background-origin","background-clip","background-blend-mode","fill","stroke","accent-color"]],
    ["effects", ["box-shadow","text-shadow","filter","backdrop-filter","mix-blend-mode","clip-path","mask-image","mask-size"]],
    ["transform-motion", ["transform","transform-origin","translate","rotate","scale","transition-property","transition-duration","transition-timing-function","transition-delay","animation-name","animation-duration","animation-timing-function","animation-delay","animation-iteration-count","animation-direction","animation-fill-mode"]],
  ];
  // Always emit these even if equal to the tag baseline — but suppress when
  // equal to the page's root/body value (because Document Context already says
  // so). These are typically inherited and AI consumers want concrete numbers.
  const STYLE_ALWAYS_VS_ROOT = new Set(["color","background-color","font-family","font-size","font-weight","line-height","display"]);
  // Physical/logical/webkit aliases — already covered by STYLE_GROUPS so we
  // skip them in the "other" sweep instead of double-printing.
  const STYLE_REDUNDANT = new Set([
    "block-size","inline-size","min-block-size","min-inline-size","max-block-size","max-inline-size",
    "border-block-start-color","border-block-end-color","border-inline-start-color","border-inline-end-color",
    "border-block-start-style","border-block-end-style","border-inline-start-style","border-inline-end-style",
    "border-block-start-width","border-block-end-width","border-inline-start-width","border-inline-end-width",
    "border-block-start","border-block-end","border-inline-start","border-inline-end",
    "border-start-start-radius","border-start-end-radius","border-end-start-radius","border-end-end-radius",
    "inset-block-start","inset-block-end","inset-inline-start","inset-inline-end","inset-block","inset-inline",
    "margin-block-start","margin-block-end","margin-inline-start","margin-inline-end","margin-block","margin-inline",
    "padding-block-start","padding-block-end","padding-inline-start","padding-inline-end","padding-block","padding-inline",
    "column-rule-color","column-rule-style","column-rule-width",
    "perspective-origin","overflow-clip-margin","text-emphasis-color",
    "scroll-margin","scroll-padding",
    "scroll-margin-block-start","scroll-margin-block-end","scroll-margin-inline-start","scroll-margin-inline-end",
    "scroll-padding-block-start","scroll-padding-block-end","scroll-padding-inline-start","scroll-padding-inline-end",
    "-webkit-text-fill-color","-webkit-text-stroke-color","-webkit-text-stroke-width",
    "-webkit-locale","-webkit-tap-highlight-color","-webkit-font-smoothing","-webkit-user-select",
    "-webkit-border-image","-webkit-rtl-ordering","-webkit-print-color-adjust",
    "text-rendering","caret-color",
  ]);

  const styleBaselineCache = new Map();
  let styleBaselineHost = null;
  let pageStyleSnapshotCache = null;
  let rootCssVarSnapshot = null;

  function ensureStyleBaselineHost() {
    if (styleBaselineHost && styleBaselineHost.isConnected) return styleBaselineHost;
    styleBaselineHost = document.createElement("div");
    styleBaselineHost.className = `${NS}-baseline-host`;
    styleBaselineHost.setAttribute("aria-hidden", "true");
    styleBaselineHost.style.cssText = "all:initial !important;position:absolute !important;left:-99999px !important;top:-99999px !important;width:0 !important;height:0 !important;overflow:hidden !important;visibility:hidden !important;pointer-events:none !important;contain:strict;";
    (document.body || document.documentElement).appendChild(styleBaselineHost);
    return styleBaselineHost;
  }

  function releaseStyleBaseline() {
    if (styleBaselineHost && styleBaselineHost.parentNode) styleBaselineHost.parentNode.removeChild(styleBaselineHost);
    styleBaselineHost = null;
    styleBaselineCache.clear();
    pageStyleSnapshotCache = null;
    rootCssVarSnapshot = null;
  }

  function getStyleBaseline(tagName) {
    const tag = String(tagName || "div").toLowerCase();
    if (styleBaselineCache.has(tag)) return styleBaselineCache.get(tag);
    let probe;
    try { probe = document.createElement(tag); }
    catch (_) { probe = document.createElement("div"); }
    const host = ensureStyleBaselineHost();
    host.appendChild(probe);
    const cs = getComputedStyle(probe);
    const snap = {};
    for (let i = 0; i < cs.length; i++) {
      const name = cs[i];
      snap[name] = cs.getPropertyValue(name);
    }
    host.removeChild(probe);
    styleBaselineCache.set(tag, snap);
    return snap;
  }

  // Page-level "what would I inherit if I didn't override anything" snapshot —
  // taken from body (or html) so we can drop element values that just match the
  // inherited root and are already covered by Document Context.
  function getPageStyleSnapshot() {
    if (pageStyleSnapshotCache) return pageStyleSnapshotCache;
    const source = document.body ? getComputedStyle(document.body) : getComputedStyle(document.documentElement);
    const snap = {};
    STYLE_ALWAYS_VS_ROOT.forEach(p => { snap[p] = (source.getPropertyValue(p) || "").trim(); });
    pageStyleSnapshotCache = snap;
    return snap;
  }

  function getRootCssVars() {
    if (rootCssVarSnapshot) return rootCssVarSnapshot;
    const cs = getComputedStyle(document.documentElement);
    const map = new Map();
    for (let i = 0; i < cs.length; i++) {
      const name = cs[i];
      if (name && name.startsWith("--")) map.set(name, cs.getPropertyValue(name).trim());
    }
    rootCssVarSnapshot = map;
    return map;
  }

  function hasAnyBorder(cs) {
    return ["border-top-width","border-right-width","border-bottom-width","border-left-width"]
      .some(p => parseFloat(cs.getPropertyValue(p)) > 0);
  }
  function hasAnyOutline(cs) {
    return parseFloat(cs.getPropertyValue("outline-width")) > 0;
  }
  function hasAnyRadius(cs) {
    return ["border-top-left-radius","border-top-right-radius","border-bottom-right-radius","border-bottom-left-radius"]
      .some(p => parseFloat(cs.getPropertyValue(p)) > 0);
  }

  function getComputedStyleReport(el) {
    const cs = getComputedStyle(el);
    const baseline = getStyleBaseline(el.tagName);
    const root = getPageStyleSnapshot();
    const noBorder = !hasAnyBorder(cs);
    const noOutline = !hasAnyOutline(cs);
    const noRadius = !hasAnyRadius(cs);
    const buckets = STYLE_GROUPS.map(([name]) => ({ name, rows: [] }));
    const seen = new Set();
    STYLE_GROUPS.forEach(([name, props], idx) => {
      props.forEach(prop => {
        seen.add(prop);
        // Collapse border/outline/radius when geometrically inert
        if (noBorder && /^border-(top|right|bottom|left)-(color|style)$/.test(prop)) return;
        if (noOutline && /^outline-(color|style|offset)$/.test(prop)) return;
        if (noRadius && /^border-(top-left|top-right|bottom-left|bottom-right)-radius$/.test(prop)) return;
        const value = cssValue(cs, prop);
        if (STYLE_ALWAYS_VS_ROOT.has(prop)) {
          if (value !== root[prop]) buckets[idx].rows.push(`  ${prop}: ${value}`);
          // else: equals page root → already in Document Context
        } else if (value !== (baseline[prop] || "")) {
          buckets[idx].rows.push(`  ${prop}: ${value}`);
        }
      });
    });
    const extra = [];
    for (let i = 0; i < cs.length; i++) {
      const prop = cs[i];
      if (!prop || seen.has(prop) || prop.startsWith("--")) continue;
      if (STYLE_REDUNDANT.has(prop)) continue;
      const value = cssValue(cs, prop);
      const base = baseline[prop];
      if (base !== undefined && value !== base) extra.push(`  ${prop}: ${value}`);
    }
    const sections = buckets.filter(b => b.rows.length).map(b => `${b.name}:\n${b.rows.join("\n")}`);
    if (extra.length) sections.push(`other:\n${extra.join("\n")}`);
    return sections.join("\n\n") || "matches page defaults";
  }

  const REPLICA_STYLE_MAX_GROUPS = 32;
  const REPLICA_STYLE_MAX_VARIANTS = 8;
  const REPLICA_STYLE_PROPS = [
    "display","position","top","right","bottom","left","z-index",
    "width","height","min-width","min-height","padding-top","padding-right","padding-bottom","padding-left",
    "margin-top","margin-right","margin-bottom","margin-left","overflow","overflow-x","overflow-y",
    "flex-direction","align-items","justify-content","gap","grid-template-columns","grid-template-rows",
    "font-family","font-size","font-weight","font-style","line-height","letter-spacing","text-align","text-transform","white-space",
    "color","background-color","background-image","fill","stroke","stroke-width","opacity",
    "border-top-width","border-right-width","border-bottom-width","border-left-width","border-top-color","border-right-color","border-bottom-color","border-left-color","border-radius",
    "box-shadow","text-shadow","filter","backdrop-filter","clip-path","mask-image",
    "transform","transform-origin","transition-property","transition-duration","transition-timing-function","transition-delay",
    "animation-name","animation-duration","animation-timing-function","animation-delay","animation-fill-mode","animation-play-state",
  ];

  function getReplicaStylePackReport(root, selected) {
    if (!root || !root.querySelectorAll) return "";
    const groups = collectReplicaStyleGroups(root, selected);
    if (!groups.length) return "";
    const rows = [
      `scope: ${describeElement(root)}`,
      `strategy: one computed-style sample per repeated selector signature; repeated instances are listed as variants`,
      "",
    ];
    groups.slice(0, REPLICA_STYLE_MAX_GROUPS).forEach((group, idx) => {
      rows.push(`[${idx + 1}] ${group.key}  (${group.items.length} instance${group.items.length > 1 ? "s" : ""})`);
      rows.push(`sample: ${describeElement(group.sample)} rect=${rectSize(group.sample)}${visibleSnippet(group.sample)}`);
      const variants = group.items.slice(0, REPLICA_STYLE_MAX_VARIANTS).map(item => `  - ${variantLine(item)}`);
      if (variants.length) rows.push("variants:", ...variants);
      if (group.items.length > REPLICA_STYLE_MAX_VARIANTS) {
        rows.push(`  - ${group.items.length - REPLICA_STYLE_MAX_VARIANTS} more similar variant${group.items.length - REPLICA_STYLE_MAX_VARIANTS > 1 ? "s" : ""} folded`);
      }
      const style = getReplicaStyleSubset(group.sample);
      if (style) rows.push("style:", style);
      rows.push("");
    });
    if (groups.length > REPLICA_STYLE_MAX_GROUPS) {
      rows.push(`${groups.length - REPLICA_STYLE_MAX_GROUPS} low-signal style group${groups.length - REPLICA_STYLE_MAX_GROUPS > 1 ? "s" : ""} not sampled; DOM Snapshot still contains them.`);
    }
    return rows.join("\n").trim();
  }

  function collectReplicaStyleGroups(root, selected) {
    const nodes = collectReplicaStyleNodes(root, selected);
    const map = new Map();
    nodes.forEach(node => {
      const key = replicaStyleKey(node);
      if (!key) return;
      if (!map.has(key)) map.set(key, { key, sample: node, items: [], score: 0 });
      const group = map.get(key);
      group.items.push(node);
      group.score = Math.max(group.score, replicaNodeScore(node, root, selected));
      if (replicaNodeScore(node, root, selected) > replicaNodeScore(group.sample, root, selected)) group.sample = node;
    });
    return Array.from(map.values()).sort((a, b) => b.score - a.score || b.items.length - a.items.length || a.key.localeCompare(b.key));
  }

  function collectReplicaStyleNodes(root, selected) {
    const out = [];
    const seen = new Set();
    const push = (node) => {
      if (!node || node.nodeType !== 1 || isEditorElement(node)) return;
      if (seen.has(node)) return;
      const r = safeRect(node);
      if (r.width <= 0 && r.height <= 0) return;
      seen.add(node);
      out.push(node);
    };
    push(root);
    push(selected);
    Array.from(root.children || []).forEach(push);
    Array.from(root.querySelectorAll("*")).forEach(node => {
      if (out.length > 650) return;
      if (!isReplicaStyleSampleCandidate(node, root, selected)) return;
      push(node);
    });
    return out;
  }

  function isReplicaStyleSampleCandidate(node, root, selected) {
    if (node === root || node === selected) return true;
    const tag = (node.tagName || "").toLowerCase();
    const cls = node.classList && node.classList.length;
    if (cls) return true;
    if (node.id || node.getAttribute("role") || node.getAttribute("data-node") || node.getAttribute("aria-label")) return true;
    return /^(svg|path|circle|rect|text|g|img|canvas|video|button|a|input|textarea|select)$/.test(tag);
  }

  function replicaStyleKey(node) {
    const tag = (node.tagName || "").toLowerCase();
    if (!tag) return "";
    const classes = Array.from(node.classList || []).filter(isStableClass).slice(0, 5);
    if (classes.length) return `${tag}.${classes.join(".")}`;
    if (node.id) return `${tag}#${node.id}`;
    const role = node.getAttribute && node.getAttribute("role");
    if (role) return `${tag}[role=${role}]`;
    const aria = node.getAttribute && node.getAttribute("aria-label");
    if (aria) return `${tag}[aria-label]`;
    return tag;
  }

  function replicaNodeScore(node, root, selected) {
    let score = 0;
    if (node === root) score += 1000;
    if (node === selected) score += 950;
    if (node.parentElement === root) score += 400;
    const r = safeRect(node);
    score += Math.min(240, Math.sqrt(Math.max(0, r.width * r.height)) / 2);
    const cls = Array.from(node.classList || []).join(" ");
    if (/active|selected|current|open|dark|featured|primary|hero|stage|label|card|actor|outcome|memory|slat|wave/i.test(cls)) score += 120;
    if (directText(node)) score += 40;
    return score;
  }

  function getReplicaStyleSubset(node) {
    const cs = getComputedStyle(node);
    const baseline = getStyleBaseline(node.tagName);
    const root = getPageStyleSnapshot();
    const rows = [];
    REPLICA_STYLE_PROPS.forEach(prop => {
      const value = cssValue(cs, prop);
      if (!value) return;
      if (prop === "background-color" && /rgba\(0,\s*0,\s*0,\s*0\)/.test(value)) return;
      if (prop === "background-image" && value === "none") return;
      if (prop === "border-radius" && value === "0px") return;
      if (/^border-(top|right|bottom|left)-width$/.test(prop) && parseFloat(value) === 0) return;
      if (/^border-(top|right|bottom|left)-color$/.test(prop) && !hasAnyBorder(cs)) return;
      if (prop.startsWith("animation-") && (cs.animationName === "none" || !cs.animationName)) return;
      if (prop.startsWith("transition-") && isZeroDurationList(cs.transitionDuration)) return;
      if (STYLE_ALWAYS_VS_ROOT.has(prop)) {
        if (value === root[prop]) return;
      } else if (value === (baseline[prop] || "")) {
        return;
      }
      rows.push(`  ${prop}: ${value}`);
    });
    return rows.join("\n");
  }

  function variantLine(node) {
    const data = ["data-node","data-step","data-state","aria-label","title"].map(name => {
      const value = node.getAttribute && node.getAttribute(name);
      return value ? `${name}="${truncate(value, 40)}"` : "";
    }).filter(Boolean).join(" ");
    return `${describeElement(node)} rect=${rectSize(node)}${data ? ` ${data}` : ""}${visibleSnippet(node)}`;
  }

  function rectSize(node) {
    const r = safeRect(node);
    return `${round2(r.width)}x${round2(r.height)}`;
  }

  function visibleSnippet(node) {
    const text = (node.innerText || directText(node) || "").replace(/\s+/g, " ").trim();
    return text ? ` text="${truncate(text, 70)}"` : "";
  }

  function isZeroDurationList(value) {
    return String(value || "").split(",").every(part => {
      const v = part.trim();
      return !v || v === "0s" || v === "0ms";
    });
  }

  // CSS Custom Properties — only emit variables that DIFFER from :root (or
  // aren't on :root at all). Document Context already prints every :root var,
  // so an element-level snapshot would otherwise re-emit ~all of them.
  function getCssVariablesReport(el) {
    const cs = getComputedStyle(el);
    const rootVars = getRootCssVars();
    const rows = [];
    for (let i = 0; i < cs.length; i++) {
      const name = cs[i];
      if (!name || !name.startsWith("--")) continue;
      const value = cs.getPropertyValue(name).trim();
      if (rootVars.get(name) === value) continue;  // identical to :root → covered by Document Context
      const annotation = rootVars.has(name) ? " /* overrides :root */" : "";
      rows.push(`${name}: ${limitText(value, 1000, "value truncated")}${annotation}`);
      if (rows.length >= 120) {
        rows.push("... CSS variables truncated after 120 entries");
        break;
      }
    }
    return rows.join("\n");
  }

  // Three flavors of matched-rule extraction share one walker. Modes:
  //   normal: selector matches the element as-is (no pseudo-class hypotheticals)
  //   interactive: selector contains a pseudo-class like :hover/:focus/:active/:checked/:disabled
  //                and matches after stripping that pseudo-class
  //   color-scheme: rule is wrapped in @media (prefers-color-scheme: ...) and matches normally
  const INTERACTIVE_PSEUDO = [":hover",":focus-visible",":focus-within",":focus",":active",":disabled",":checked",":indeterminate",":required",":invalid",":valid",":placeholder-shown",":target",":visited"];

  // Matched rules carry an origin tag:
  //   "self"             — rule.matches(el) directly
  //   "descendant"       — rule matches a child of el (probed via el.querySelector)
  //   "self+descendant"  — both
  // Universal/global selectors ("*", "body", "html", ":root") only do self
  // probing — Document Context already covers their effect, descendant scope
  // would just inflate noise. Functional pseudos (:has/:is/:where/:not) skip
  // descendant probing because querySelector's absolute matching diverges
  // from the CSS engine's relative matching for those.
  const SELECTOR_GLOBAL = new Set(["*","html","body",":root","html *","body *"]);
  const SELECTOR_FUNCTIONAL_PSEUDO = /:(has|is|where|not)\s*\(/i;

  function buildDescendantHints(el) {
    // Cheap pre-filter: collect every className/tagName/id token used anywhere
    // in the element subtree. If a selector contains none of them, we can skip
    // the querySelector probe entirely.
    const tokens = new Set();
    const visit = (node) => {
      if (!node || node.nodeType !== 1) return;
      if (isEditorElement(node)) return;
      tokens.add(node.tagName.toLowerCase());
      if (node.id) tokens.add(`#${node.id}`);
      const cls = node.classList;
      if (cls && cls.length) for (let i = 0; i < cls.length; i++) tokens.add(`.${cls[i]}`);
    };
    visit(el);
    if (el.querySelectorAll) {
      Array.from(el.querySelectorAll("*")).forEach(visit);
    }
    return tokens;
  }

  function selectorTouchesDescendants(selectorText, hints) {
    // Conservative: if any token in the selector matches a descendant hint,
    // it's worth probing. If selector is just "*"/tag-only universal, skip.
    if (SELECTOR_GLOBAL.has(selectorText.trim())) return false;
    for (const token of hints) {
      // crude substring match — fine for filtering, not authoritative
      if (selectorText.indexOf(token) !== -1) return true;
    }
    return false;
  }

  function getMatchedCssRulesReport(el) {
    const state = makeRuleState({ maxRows: 400, maxChars: 90000 });
    const hints = buildDescendantHints(el);
    const inaccessible = [];
    Array.from(document.styleSheets || []).forEach((sheet, index) => {
      let rules;
      try { rules = sheet.cssRules; }
      catch (_) {
        // ── Host stylesheet seam (HOST_CONTRACT.md §11) ──────
        // Cross-origin stylesheets throw on .cssRules access. The extension
        // pre-warms a cache (copyPrompt → HOST.prepareStyles) that fetches the
        // raw text and parses it into a CSSStyleSheet; here we read the parsed
        // rules synchronously and walk them like any same-origin sheet. Miss →
        // fall back to the existing "Inaccessible stylesheets" note (bookmarklet).
        if (HOST.cachedStylesheetRules) {
          try {
            const hostedRules = HOST.cachedStylesheetRules(sheet.href);
            if (hostedRules) {
              walkCssRules(el, hostedRules, sheetLabel(sheet, index), [], state, "normal", hints);
              return;
            }
          } catch (_) { /* fall through to inaccessible note */ }
        }
        inaccessible.push(sheet.href || `stylesheet #${index + 1}`);
        return;
      }
      walkCssRules(el, rules, sheetLabel(sheet, index), [], state, "normal", hints);
    });
    const rows = state.rows.slice();
    if (inaccessible.length) {
      rows.push("", "/* Inaccessible stylesheets (cross-origin CSS, cannot read text): */");
      inaccessible.slice(0, 20).forEach(item => rows.push(`/* - ${item} */`));
      if (inaccessible.length > 20) rows.push(`/* ... ${inaccessible.length - 20} more */`);
    }
    if (state.truncated) rows.push("", "/* Matched rules truncated to keep the report responsive. Effective Style above remains authoritative. */");
    if (!state.rows.length && !inaccessible.length) return "";
    return rows.join("\n");
  }

  function getInteractiveStatesReport(el) {
    const state = makeRuleState({ maxRows: 200, maxChars: 50000 });
    const hints = buildDescendantHints(el);
    Array.from(document.styleSheets || []).forEach((sheet, index) => {
      let rules;
      try { rules = sheet.cssRules; }
      catch (_) { return; }
      walkCssRules(el, rules, sheetLabel(sheet, index), [], state, "interactive", hints);
    });
    if (state.truncated) state.rows.push("", "/* Interactive rules truncated. */");
    return state.rows.length ? state.rows.join("\n") : "";
  }

  // Ancestor Chain — for an absolutely-positioned / transform-scaled child,
  // the containing-block ancestors decide *where* and *how* it actually renders.
  // We walk up from el.parentElement keeping every "worth-keeping" ancestor
  // (positioned, transformed, scrolling, semantic landmark, id-bearing,
  // flex/grid, or clip/mask container) plus body.
  // Each kept ancestor gets a tight style subset (transform / containing-block
  // properties / background / clip) and its matched CSS rules — but only the
  // rules that haven't already been emitted in the element's own Matched
  // Rules section above, so we never double-print global rules like `* {}`.
  const ANCESTOR_STYLE_PROPS = [
    "display","position","top","right","bottom","left","z-index",
    "width","height",
    "padding-top","padding-right","padding-bottom","padding-left",
    "margin-top","margin-right","margin-bottom","margin-left",
    "overflow","overflow-x","overflow-y",
    "transform","transform-origin","scale","translate","rotate","perspective","perspective-origin",
    "container-type","container-name","contain","isolation",
    "background-color","background-image","clip-path","mask-image","filter","backdrop-filter",
    "box-shadow","border-radius",
    "border-top-width","border-right-width","border-bottom-width","border-left-width",
    "flex-direction","align-items","justify-content","gap","grid-template-columns","grid-template-rows",
  ];
  const ANCESTOR_SEMANTIC_TAGS = new Set([
    "section","main","article","aside","nav","header","footer","form","dialog","figure","svg",
  ]);
  const ANCESTOR_RULES_CHAR_CAP = 6000;

  function isAncestorWorthKeeping(node) {
    let cs;
    try { cs = getComputedStyle(node); } catch (_) { return false; }
    if (cs.position !== "static") return true;
    if (cs.transform && cs.transform !== "none") return true;
    if (cs.perspective && cs.perspective !== "none") return true;
    if (cs.filter && cs.filter !== "none") return true;
    if (cs.contain && cs.contain !== "none" && cs.contain !== "normal") return true;
    if (cs.overflow && cs.overflow !== "visible") return true;
    if (/flex|grid/.test(cs.display)) return true;
    if (cs.clipPath && cs.clipPath !== "none") return true;
    if (cs.maskImage && cs.maskImage !== "none") return true;
    if (cs.backgroundImage && cs.backgroundImage !== "none") return true;
    if (node.id) return true;
    if (ANCESTOR_SEMANTIC_TAGS.has((node.tagName || "").toLowerCase())) return true;
    return false;
  }

  function collectAncestorChain(el) {
    const chain = [];
    const immediate = el.parentElement;
    let node = immediate;
    let depth = 0;
    while (node && node !== document.documentElement && depth++ < 40) {
      if (isEditorElement(node)) { node = node.parentElement; continue; }
      const keep = (node === immediate) || (node === document.body) || isAncestorWorthKeeping(node);
      if (keep) chain.push(node);
      if (node === document.body) break;
      node = node.parentElement;
    }
    return chain;
  }

  function getAncestorStyleSubset(node) {
    const cs = getComputedStyle(node);
    const baseline = getStyleBaseline(node.tagName);
    const rows = [];
    ANCESTOR_STYLE_PROPS.forEach(prop => {
      const v = cssValue(cs, prop);
      if (!v) return;
      if (v === (baseline[prop] || "")) return;
      if (prop === "background-color" && /rgba\(0,\s*0,\s*0,\s*0\)/.test(v)) return;
      if (prop === "background-image" && v === "none") return;
      if (prop === "border-radius" && v === "0px") return;
      if (/^border-(top|right|bottom|left)-width$/.test(prop) && parseFloat(v) === 0) return;
      rows.push(`  ${prop}: ${v}`);
    });
    return rows.join("\n");
  }

  function getAncestorMatchedRules(node) {
    const ownTokens = (typeof stableClasses === "function" ? stableClasses(node) : []);
    if (!ownTokens.length && !node.id) return "";
    const state = makeRuleState({ maxRows: 60, maxChars: ANCESTOR_RULES_CHAR_CAP });
    state.dedupCheck = true;
    Array.from(document.styleSheets || []).forEach((sheet, idx) => {
      let rules; try { rules = sheet.cssRules; } catch (_) { return; }
      walkCssRules(node, rules, sheetLabel(sheet, idx), [], state, "normal", null);
    });
    return state.rows.join("\n");
  }

  function getAncestorChainReport(el) {
    const chain = collectAncestorChain(el);
    if (!chain.length) return "";
    const blocks = [];
    chain.forEach((entry, i) => {
      const node = entry;
      const annotation = (i === 0) ? "  (immediate parent — also visible in Parent Snapshot open tag)" : "";
      const head = `[${i + 1}] ${describeElement(node)}${annotation}`;
      const style = getAncestorStyleSubset(node);
      const rules = getAncestorMatchedRules(node);
      const parts = [head];
      if (style) parts.push("style:\n" + style);
      if (rules) parts.push("rules (not already in Matched Rules above):\n" + rules);
      const block = parts.join("\n");
      blocks.push(block);
    });
    return blocks.join("\n\n");
  }

  function getColorSchemeRulesReport(el) {
    const state = makeRuleState({ maxRows: 120, maxChars: 30000 });
    const hints = buildDescendantHints(el);
    Array.from(document.styleSheets || []).forEach((sheet, index) => {
      let rules;
      try { rules = sheet.cssRules; }
      catch (_) { return; }
      walkCssRules(el, rules, sheetLabel(sheet, index), [], state, "color-scheme", hints);
    });
    if (state.truncated) state.rows.push("", "/* Color-scheme rules truncated. */");
    return state.rows.length ? state.rows.join("\n") : "";
  }

  function makeRuleState(opts) {
    return { rows: [], chars: 0, truncated: false, maxRows: opts.maxRows, maxChars: opts.maxChars };
  }

  // Per-element dedup signal: every (source, selectorText) pair emitted during
  // the element's own Matched/Interactive/Color-scheme walks gets recorded.
  // The Ancestor Chain rule walk (state.dedupCheck === true) consults this set
  // and skips re-emitting the same rule against an ancestor — that rule
  // already appeared above; what we want from ancestors is what's net-new.
  let perElementEmittedRules = null;

  function walkCssRules(el, rules, source, wrappers, state, mode, hints) {
    if (!rules || state.truncated) return;
    for (const rule of Array.from(rules)) {
      if (state.truncated) break;
      if (rule.selectorText && rule.style) {
        const match = ruleMatchesForMode(el, rule.selectorText, mode, hints);
        if (!match) continue;
        if (mode === "color-scheme" && !wrappersContainColorScheme(wrappers)) continue;
        const dedupKey = `${source}::${rule.selectorText}`;
        if (state.dedupCheck && perElementEmittedRules && perElementEmittedRules.has(dedupKey)) continue;
        let text = compactCssRule(rule.cssText || "");
        // Origin tag: self-only is the default, only annotate descendant hits.
        if (match.origin === "descendant") {
          const where = match.descendantEl ? describeElement(match.descendantEl) : "child";
          const approx = match.approx ? " (approx — selector uses :has/:is/:where/:not)" : "";
          text = `/* matches: descendant — first hit: ${where}${approx} */\n${text}`;
        } else if (match.origin === "self+descendant") {
          const where = match.descendantEl ? describeElement(match.descendantEl) : "child";
          text = `/* matches: self + descendant ${where} */\n${text}`;
        }
        if (mode === "interactive" && match.matchedPart && match.matchedPart !== rule.selectorText) {
          text = `/* matches via ${match.matchedPart} */\n${text}`;
        }
        if (wrappers.length) text = `${wrappers.join(" ")} { ${text} }`;
        text = `/* ${source} */\n${text}`;
        if (state.chars + text.length > state.maxChars || state.rows.length >= state.maxRows) {
          state.truncated = true;
          break;
        }
        state.rows.push(text);
        state.chars += text.length;
        if (perElementEmittedRules) perElementEmittedRules.add(dedupKey);
        continue;
      }
      if (rule.cssRules) {
        const label = groupRuleLabel(rule);
        walkCssRules(el, rule.cssRules, source, label ? [...wrappers, label] : wrappers, state, mode, hints);
      }
    }
  }

  function ruleMatchesForMode(el, selectorText, mode, hints) {
    const parts = splitSelector(selectorText);
    const result = { origin: null, matchedPart: null, descendantEl: null, approx: false };

    const probeDescendant = (probeSelector, partForReport) => {
      if (result.origin === "self+descendant" || result.descendantEl) return;
      if (!probeSelector || probeSelector === "*") return;
      if (SELECTOR_GLOBAL.has(probeSelector.trim())) return;
      if (hints && !selectorTouchesDescendants(probeSelector, hints)) return;
      const approx = SELECTOR_FUNCTIONAL_PSEUDO.test(probeSelector);
      try {
        const hit = el.querySelector(probeSelector);
        if (hit && hit !== el) {
          result.descendantEl = hit;
          result.matchedPart = result.matchedPart || partForReport;
          result.approx = approx;
        }
      } catch (_) {}
    };

    if (mode === "interactive") {
      for (const part of parts) {
        if (!hasInteractivePseudo(part)) continue;
        const stripped = stripInteractivePseudo(part);
        if (!stripped) continue;
        try { if (el.matches(stripped)) { result.origin = "self"; result.matchedPart = part; break; } } catch (_) {}
      }
      // even if self matched, also probe descendants — gives full picture
      for (const part of parts) {
        if (!hasInteractivePseudo(part)) continue;
        const stripped = stripInteractivePseudo(part);
        probeDescendant(stripped, part);
      }
    } else {
      // normal / color-scheme: self probe first
      for (const part of parts) {
        if (mode === "normal" && hasInteractivePseudo(part)) continue;
        try { if (el.matches(part)) { result.origin = "self"; result.matchedPart = part; break; } } catch (_) {}
        const cleanedPart = part.replace(/::[a-z-]+(\([^)]*\))?$/i, "");
        if (cleanedPart && cleanedPart !== part) {
          try { if (el.matches(cleanedPart)) { result.origin = "self"; result.matchedPart = part; break; } } catch (_) {}
        }
      }
      // descendant probe
      for (const part of parts) {
        if (mode === "normal" && hasInteractivePseudo(part)) continue;
        const cleaned = part.replace(/::[a-z-]+(\([^)]*\))?$/i, "") || part;
        probeDescendant(cleaned, part);
      }
    }

    if (result.descendantEl && result.origin === "self") result.origin = "self+descendant";
    else if (result.descendantEl && !result.origin) result.origin = "descendant";
    if (!result.origin) return null;
    return result;
  }

  function splitSelector(selectorText) {
    return String(selectorText || "").split(",").map(p => p.trim()).filter(Boolean);
  }

  function hasInteractivePseudo(selector) {
    return INTERACTIVE_PSEUDO.some(p => new RegExp(p + "(?![\\w-])").test(selector));
  }

  function stripInteractivePseudo(selector) {
    let out = selector;
    INTERACTIVE_PSEUDO.forEach(p => {
      out = out.replace(new RegExp(p.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&") + "(\\([^)]*\\))?", "g"), "");
    });
    out = out.replace(/\s+/g, " ").trim();
    return out || "*";
  }

  function wrappersContainColorScheme(wrappers) {
    return wrappers.some(w => /prefers-color-scheme/i.test(w));
  }

  function sheetLabel(sheet, index) {
    if (sheet.href) {
      try {
        const url = new URL(sheet.href, location.href);
        return url.pathname.split("/").pop() || url.href;
      } catch(_) {
        return sheet.href;
      }
    }
    const owner = sheet.ownerNode;
    if (owner && owner.id) return `style#${owner.id}`;
    return `inline style #${index + 1}`;
  }

  function groupRuleLabel(rule) {
    if (rule.conditionText) return `@media/supports ${rule.conditionText}`;
    if (rule.name) return `@${rule.name}`;
    const text = String(rule.cssText || "").split("{")[0].trim();
    return text && text.startsWith("@") ? text : "";
  }

  function compactCssRule(text) {
    return limitText(String(text || "").replace(/\s+/g, " ").trim(), 1600, "rule truncated");
  }

  // Pseudo-elements: only emit when ::before/::after actually renders something
  // (content != none/normal), and only the properties that diverge from the
  // pseudo-element baseline. Skipping noise like `transform: none`.
  const PSEUDO_PROPS = ["content","display","position","top","right","bottom","left","width","height","margin","padding","color","background-color","background-image","background-size","background-position","border","border-radius","box-shadow","transform","transform-origin","opacity","z-index","font-family","font-size","font-weight","line-height","text-align"];

  function getPseudoElementsReport(el) {
    const parts = [pseudoElementReport(el, "::before"), pseudoElementReport(el, "::after")].filter(Boolean);
    return parts.join("\n\n");
  }

  function pseudoElementReport(el, pseudo) {
    let cs;
    try { cs = getComputedStyle(el, pseudo); }
    catch(_) { return ""; }
    const content = cs.getPropertyValue("content");
    if (!content || content === "none" || content === "normal") return "";
    const baseline = getStyleBaseline(el.tagName);
    const rows = [];
    PSEUDO_PROPS.forEach(prop => {
      const value = cssValue(cs, prop);
      if (prop === "content" || value !== (baseline[prop] || "")) rows.push(`  ${prop}: ${value}`);
    });
    return `${pseudo}:\n${rows.join("\n")}`;
  }

  // Text-content diff — outerHTML already carries the full text. Only worth
  // emitting when innerText (what users see) diverges from textContent (raw
  // DOM text including hidden/display:none nodes).
  function getTextContentDiffReport(el) {
    const inner = (el.innerText || "").replace(/\s+/g, " ").trim();
    const raw = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (!inner && !raw) return "";
    if (inner === raw) return "";
    return `innerText (visible):\n${limitText(inner, 8000, "innerText truncated") || "(empty)"}\n\ntextContent (raw):\n${limitText(raw, 8000, "textContent truncated") || "(empty)"}`;
  }

  // Children outline is redundant when the DOM Snapshot wasn't truncated —
  // the full HTML already shows the tree. Only surface a structural summary
  // (with rendered sizes — info HTML doesn't carry) when the snapshot was cut
  // or when the tree is deep enough that a compact map helps the consumer.
  function getChildrenOutlineReport(el) {
    const children = Array.from(el.children || []).filter(c => !isEditorElement(c));
    if (!children.length) return "";
    const totalDescendants = el.querySelectorAll ? el.querySelectorAll("*").length : children.length;
    if (!sharinganDomTruncated && totalDescendants < 60) return "";
    const state = { count: 0, truncated: false, max: 240 };
    const rows = [];
    children.forEach(child => appendChildStructure(child, 0, rows, state));
    if (state.truncated) rows.push(`... children outline truncated after ${state.max} nodes`);
    return rows.join("\n");
  }

  function appendChildStructure(el, depth, rows, state) {
    if (state.count >= state.max) { state.truncated = true; return; }
    if (isEditorElement(el)) return;
    state.count++;
    const indent = "  ".repeat(depth);
    const r = el.getBoundingClientRect();
    rows.push(`${indent}${describeElement(el)} rect=${round2(r.width)}x${round2(r.height)}`);
    if (depth >= 4) {
      if (el.children.length) rows.push(`${indent}  ... ${el.children.length} deeper children`);
      return;
    }
    Array.from(el.children || []).forEach(child => appendChildStructure(child, depth + 1, rows, state));
  }

  // Media assets — only fields outerHTML does NOT already carry:
  // currentSrc resolution, intrinsic dimensions, video sizing, and CSS
  // background images (which never appear in HTML).
  function getMediaAssetsReport(el) {
    const rows = [];
    const nodes = [el, ...Array.from(el.querySelectorAll ? el.querySelectorAll("img,video,source,iframe,canvas") : [])]
      .filter((node, index, all) => all.indexOf(node) === index)
      .slice(0, 40);
    nodes.forEach(node => {
      const line = mediaNodeReport(node);
      if (line) rows.push(line);
    });
    const bgs = collectBackgroundImages(el);
    bgs.forEach(bg => rows.push(`background-image @ ${bg.selector}: ${limitText(bg.value, 2000, "background-image truncated")}`));
    return rows.join("\n");
  }

  function mediaNodeReport(node) {
    const tag = (node.tagName || "").toLowerCase();
    if (tag === "img") {
      const src = node.getAttribute("src") || "";
      const current = node.currentSrc || "";
      const dims = `${node.naturalWidth || 0}x${node.naturalHeight || 0}`;
      if (current && current !== src) return `${describeElement(node)} currentSrc="${current}" natural=${dims}`;
      if (dims !== "0x0") return `${describeElement(node)} natural=${dims}`;
      return "";
    }
    if (tag === "video") {
      const dims = `${node.videoWidth || 0}x${node.videoHeight || 0}`;
      const src = node.currentSrc || node.getAttribute("src") || "";
      if (!src && dims === "0x0") return "";
      return `${describeElement(node)} currentSrc="${src}" video=${dims}`;
    }
    if (tag === "source") {
      const src = node.getAttribute("src") || node.getAttribute("srcset") || "";
      const type = node.getAttribute("type") || "";
      if (!src && !type) return "";
      return `${describeElement(node)} src="${src}" type="${type}"`;
    }
    if (tag === "iframe") {
      const r = node.getBoundingClientRect();
      let crossOrigin = false;
      try { void node.contentDocument; } catch (_) { crossOrigin = true; }
      return `${describeElement(node)} src="${node.getAttribute("src") || ""}" rendered=${round2(r.width)}x${round2(r.height)}${crossOrigin ? " crossOrigin=true" : ""}`;
    }
    if (tag === "canvas") {
      const ctx = (() => { try { return node.getContext && node.getContext("2d") ? "2d" : (node.getContext && node.getContext("webgl") ? "webgl" : "unknown"); } catch(_) { return "unknown"; } })();
      let snapshot = "";
      try { if (node.width <= 320 && node.height <= 320) snapshot = ` snapshot="${limitText(node.toDataURL(), 5000, "dataURL truncated")}"`; }
      catch(_) {}
      return `${describeElement(node)} bitmap=${node.width || 0}x${node.height || 0} context=${ctx}${snapshot}`;
    }
    return "";
  }

  function collectBackgroundImages(root) {
    const out = [];
    const seenSelectors = new Set();
    const pushIf = (node, label) => {
      const value = (getComputedStyle(node).backgroundImage || "").trim();
      if (!value || value === "none") return;
      if (seenSelectors.has(label)) return;
      seenSelectors.add(label);
      out.push({ selector: label, value });
    };
    pushIf(root, "self");
    if (root.querySelectorAll) {
      Array.from(root.querySelectorAll("*")).slice(0, 50).forEach((node, i) => {
        if (isEditorElement(node)) return;
        pushIf(node, describeElement(node));
        if (out.length >= 20) return;
      });
    }
    return out.slice(0, 20);
  }

  // SVG sprite — when icons are rendered via <use href="#icon-x">, the symbol
  // definition lives elsewhere in the document. Without inlining it the receiving
  // AI sees an empty <use> and can't reproduce the icon.
  function getSvgSpriteReport(el) {
    if (!el.querySelectorAll) return "";
    const uses = Array.from(el.querySelectorAll("use"));
    if (!uses.length) return "";
    const seen = new Set();
    const blocks = [];
    uses.forEach(use => {
      const raw = use.getAttribute("href") || use.getAttribute("xlink:href") || "";
      if (!raw || !raw.startsWith("#")) return;
      const id = raw.slice(1);
      if (seen.has(id)) return;
      seen.add(id);
      const target = document.getElementById(id);
      if (!target) {
        blocks.push(`<!-- #${id} referenced via <use> but not found in document -->`);
        return;
      }
      const symClone = target.cloneNode(true);
      sanitizeReportClone(symClone);
      const inlines = buildImageInlineMap(target);
      applyImageInlineMap(target, symClone, inlines);
      blocks.push(`<!-- #${id} -->\n${limitText(symClone.outerHTML || "", 12000, "symbol truncated")}`);
      if (blocks.length >= 12) return;
    });
    return blocks.join("\n\n");
  }

  function getFontUsageReport(root, selected) {
    if (!root) return "";
    const nodes = collectReplicaStyleNodes(root, selected).slice(0, 320);
    const groups = new Map();
    nodes.forEach(node => {
      const cs = getComputedStyle(node);
      const key = [
        compactCssValue(cs.fontFamily),
        cs.fontStyle,
        cs.fontWeight,
        cs.fontSize,
        cs.lineHeight,
        cs.letterSpacing,
      ].join(" | ");
      if (!groups.has(key)) groups.set(key, { key, sample: node, items: [] });
      groups.get(key).items.push(node);
    });
    const rows = [];
    Array.from(groups.values())
      .sort((a, b) => b.items.length - a.items.length)
      .slice(0, 18)
      .forEach((group, i) => {
        const [family, style, weight, size, lineHeight, letterSpacing] = group.key.split(" | ");
        rows.push(`[${i + 1}] ${family}`);
        rows.push(`  style=${style} weight=${weight} size=${size} line-height=${lineHeight} letter-spacing=${letterSpacing}`);
        rows.push(`  sample: ${describeElement(group.sample)}${visibleSnippet(group.sample)}`);
        if (group.items.length > 1) rows.push(`  used by ${group.items.length} sampled node${group.items.length > 1 ? "s" : ""}`);
      });
    return rows.join("\n");
  }

  function getAnimationRuntimeReport(root, selected) {
    if (!root) return "";
    const rows = [];
    const stateRows = collectActiveStateRows(root, selected);
    if (stateRows.length) rows.push("[active/runtime state]", ...stateRows);

    const cssRows = collectCssAnimationRows(root, selected);
    if (cssRows.length) {
      if (rows.length) rows.push("");
      rows.push("[css animations/transitions]", ...cssRows);
    }

    const svgRows = collectSvgAnimationRows(root);
    if (svgRows.length) {
      if (rows.length) rows.push("");
      rows.push("[svg animation elements]", ...svgRows);
    }
    return rows.join("\n");
  }

  function collectActiveStateRows(root, selected) {
    const rows = [];
    const attrs = ["data-step","data-state","aria-expanded","aria-selected","aria-current","open"];
    [root, selected].forEach(node => {
      if (!node || node.nodeType !== 1) return;
      const found = attrs.map(name => {
        if (name === "open") return node.hasAttribute && node.hasAttribute("open") ? "open=true" : "";
        const value = node.getAttribute && node.getAttribute(name);
        return value ? `${name}="${truncate(value, 80)}"` : "";
      }).filter(Boolean);
      if (found.length) rows.push(`${node === root ? "root" : "selected"} ${describeElement(node)} ${found.join(" ")}`);
    });
    const active = Array.from(root.querySelectorAll ? root.querySelectorAll(".is-active,.active,[aria-selected='true'],[aria-current]") : [])
      .filter(node => !isEditorElement(node))
      .slice(0, 40);
    active.forEach(node => rows.push(`${describeElement(node)} rect=${rectSize(node)}${visibleSnippet(node)}`));
    return rows;
  }

  function collectCssAnimationRows(root, selected) {
    const nodes = collectReplicaStyleNodes(root, selected).slice(0, 420);
    const rows = [];
    const seen = new Set();
    nodes.forEach(node => {
      const cs = getComputedStyle(node);
      const hasAnimation = cs.animationName && cs.animationName !== "none";
      const hasTransition = !isZeroDurationList(cs.transitionDuration);
      if (!hasAnimation && !hasTransition) return;
      const key = [
        replicaStyleKey(node),
        cs.animationName,
        cs.animationDuration,
        cs.animationDelay,
        cs.transitionProperty,
        cs.transitionDuration,
        cs.transitionDelay,
      ].join("|");
      if (seen.has(key)) return;
      seen.add(key);
      rows.push(`${describeElement(node)} rect=${rectSize(node)}`);
      if (hasAnimation) {
        rows.push(`  animation-name=${cs.animationName}; duration=${cs.animationDuration}; delay=${cs.animationDelay}; easing=${cs.animationTimingFunction}; iteration=${cs.animationIterationCount}; fill=${cs.animationFillMode}; play-state=${cs.animationPlayState}`);
      }
      if (hasTransition) {
        rows.push(`  transition-property=${cs.transitionProperty}; duration=${cs.transitionDuration}; delay=${cs.transitionDelay}; easing=${cs.transitionTimingFunction}`);
      }
      if (rows.length >= 80) rows.push("  additional animation rows folded by repeated signature");
    });
    return rows.slice(0, 80);
  }

  function collectSvgAnimationRows(root) {
    const nodes = Array.from(root.querySelectorAll ? root.querySelectorAll("animate,animateMotion,animateTransform,set") : []).slice(0, 40);
    return nodes.map(node => {
      const owner = node.parentElement ? describeElement(node.parentElement) : "";
      const attrs = ["attributeName","dur","begin","fill","repeatCount","path","from","to","values","keyTimes","keySplines"]
        .map(name => {
          const value = node.getAttribute(name);
          return value ? `${name}="${truncate(value, 220)}"` : "";
        })
        .filter(Boolean)
        .join(" ");
      return `${describeElement(node)} in ${owner}${attrs ? ` ${attrs}` : ""}`;
    });
  }

  // @font-face — pull rules for font families actually referenced by the
  // element or its descendants. Without these the receiving AI can't load
  // the correct custom fonts.
  function getFontFacesReport(el) {
    const families = new Set();
    collectUsedFontFamiliesInto(el, families);
    // Ancestors often carry font-family declarations that apply to siblings
    // visible in Parent Snapshot (e.g. .macf-line-label inherits from the
    // ancestor section). Without scanning their subtrees we miss the fonts
    // those rules use.
    expandScopeToAncestors(el).forEach(node => collectUsedFontFamiliesInto(node, families));
    if (!families.size) return "";
    const rows = [];
    const seen = new Set();
    Array.from(document.styleSheets || []).forEach((sheet, index) => {
      let rules;
      try { rules = sheet.cssRules; }
      catch (_) {
        // Cross-origin: reuse the §11 pre-warmed parsed rules if available so we
        // can still surface (and inline) @font-face declarations from that sheet.
        if (HOST.cachedStylesheetRules) {
          try { rules = HOST.cachedStylesheetRules(sheet.href); }
          catch (_) { rules = null; }
        }
        if (!rules) return;
      }
      collectFontFaceRules(rules, sheetLabel(sheet, index), families, rows, seen);
    });
    const loaded = describeLoadedFontFaces(families);
    if (loaded) rows.push(loaded);
    return rows.join("\n\n");
  }

  // Walk up to the body, returning the subset of ancestors we want to
  // *also* scan for keyframe/font-family references. Reuses the same
  // worth-keeping heuristic as the Ancestor Chain section so the two
  // sections agree on which ancestors are load-bearing.
  function expandScopeToAncestors(el) {
    const out = [];
    let node = el.parentElement;
    let depth = 0;
    while (node && node !== document.documentElement && depth++ < 40) {
      if (isEditorElement(node)) { node = node.parentElement; continue; }
      out.push(node);
      if (node === document.body) break;
      node = node.parentElement;
    }
    return out;
  }

  // ── Host font seam (HOST_CONTRACT.md §11) ──────────────────
  // When the extension has pre-warmed a font binary (copyPrompt → prepareStyles
  // → HOST.cachedFontDataURL), rewrite the @font-face `src: url(...)` to the
  // cached dataURL so the receiving AI gets the actual font, not a dead URL.
  // Bookmarklet has no HOST.cachedFontDataURL → returns rule.cssText unchanged.
  function inlineFontFaceSrc(rule, source) {
    const cssText = rule.cssText || "";
    if (!HOST.cachedFontDataURL) return cssText;
    // Resolve relative url()s against the owning stylesheet href (the source
    // label is the sheet href when cross-origin), falling back to document base.
    let baseHref = document.baseURI;
    try {
      const sheetHref = rule.parentStyleSheet && rule.parentStyleSheet.href;
      if (sheetHref) baseHref = sheetHref;
      else if (source && /^https?:/i.test(source)) baseHref = source;
    } catch (_) {}
    return cssText.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (whole, quote, raw) => {
      const target = (raw || "").trim();
      if (!target || target.indexOf("data:") === 0) return whole;
      let abs = target;
      try { abs = new URL(target, baseHref).href; } catch (_) {}
      let hosted = null;
      try { hosted = HOST.cachedFontDataURL(abs); }
      catch (_) { hosted = null; }
      if (hosted && typeof hosted === "string" && hosted.indexOf("data:") === 0) {
        return `url("${hosted}")`;
      }
      return whole;
    });
  }

  function collectFontFaceRules(rules, source, families, rows, seen) {
    if (!rules) return;
    for (const rule of Array.from(rules)) {
      if (rule.type === 5 /* FONT_FACE_RULE */ && rule.style) {
        const family = String(rule.style.getPropertyValue("font-family") || "").replace(/["']/g, "").trim().toLowerCase();
        if (!family) continue;
        if (![...families].some(f => f === family || family.split(",").some(part => part.trim() === f))) continue;
        const key = `${source}::${rule.cssText}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push(`/* ${source} */\n${compactCssRule(inlineFontFaceSrc(rule, source))}`);
      } else if (rule.cssRules) {
        collectFontFaceRules(rule.cssRules, source, families, rows, seen);
      }
    }
  }

  function collectUsedFontFamiliesInto(root, out) {
    if (!root || root.nodeType !== 1) return;
    const pushFromValue = (value) => {
      if (!value) return;
      String(value).split(",").forEach(part => {
        const name = part.trim().replace(/^["']|["']$/g, "").toLowerCase();
        if (name) out.add(name);
      });
    };
    pushFromValue(getComputedStyle(root).fontFamily);
    if (root.querySelectorAll) {
      Array.from(root.querySelectorAll("*")).slice(0, 250).forEach(node => {
        if (isEditorElement(node)) return;
        pushFromValue(getComputedStyle(node).fontFamily);
      });
    }
  }

  function describeLoadedFontFaces(families) {
    if (!document.fonts || typeof document.fonts.values !== "function") return "";
    const rows = [];
    try {
      for (const face of document.fonts.values()) {
        const family = String(face.family || "").replace(/["']/g, "").toLowerCase();
        if (!families.has(family)) continue;
        rows.push(`/* document.fonts: ${face.family} ${face.style || ""} ${face.weight || ""} status=${face.status || "?"} */`);
        if (rows.length >= 20) break;
      }
    } catch (_) {}
    return rows.join("\n");
  }

  // @keyframes — pull definitions referenced by animation-name on this
  // element or any descendant. Without these the consumer sees `animation-name: pulse`
  // with no idea what `pulse` does.
  function getKeyframesReport(el) {
    const names = new Set();
    collectAnimationNamesInto(el, names);
    // Catch animations on ancestor-scope elements too (e.g. .macf-step-copy
    // lives in section#coordination's subtree, not in the selected svg).
    // The Ancestor Chain section emits the rule for them; without expanding
    // here we'd reference `animation: macf-copy-in` but never define it.
    expandScopeToAncestors(el).forEach(node => collectAnimationNamesInto(node, names));
    if (!names.size) return "";
    const rows = [];
    const seen = new Set();
    Array.from(document.styleSheets || []).forEach((sheet, index) => {
      let rules;
      try { rules = sheet.cssRules; }
      catch (_) { return; }
      collectKeyframeRules(rules, sheetLabel(sheet, index), names, rows, seen);
    });
    return rows.join("\n\n");
  }

  function collectKeyframeRules(rules, source, names, rows, seen) {
    if (!rules) return;
    for (const rule of Array.from(rules)) {
      if (rule.type === 7 /* KEYFRAMES_RULE */ && rule.name) {
        if (!names.has(rule.name.toLowerCase())) continue;
        const key = `${source}::${rule.name}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const text = limitText(rule.cssText || "", 4000, "keyframes truncated");
        rows.push(`/* ${source} */\n${text}`);
      } else if (rule.cssRules) {
        collectKeyframeRules(rule.cssRules, source, names, rows, seen);
      }
    }
  }

  function collectAnimationNamesInto(root, out) {
    if (!root || root.nodeType !== 1) return;
    const push = (value) => {
      if (!value || value === "none") return;
      String(value).split(",").forEach(part => {
        const name = part.trim();
        if (name && name !== "none") out.add(name.toLowerCase());
      });
    };
    push(getComputedStyle(root).animationName);
    if (root.querySelectorAll) {
      Array.from(root.querySelectorAll("*")).slice(0, 250).forEach(node => {
        if (isEditorElement(node)) return;
        push(getComputedStyle(node).animationName);
      });
    }
  }

  function getReactDetailsReport(el) {
    const fiber = getReactFiber(el);
    if (!fiber) return "none";
    const rows = [];
    let walker = fiber;
    let count = 0;
    while (walker && count < 8) {
      const name = fiberDisplayName(walker);
      const source = walker._debugSource ? debugSourceText(walker._debugSource) : "";
      const shouldShow = count === 0 || source || isUserComponent(name);
      if (shouldShow) {
        rows.push({
          name,
          tag: walker.tag,
          source,
          key: walker.key == null ? undefined : String(walker.key),
          props: normalizeForReport(walker.memoizedProps, 0, new WeakSet(), "props"),
        });
        count++;
      }
      walker = walker.return;
    }
    return limitText(JSON.stringify(rows, null, 2), 50000, "React details truncated");
  }

  // Document Context — root-level info that decides how the element is
  // styled but lives outside of it: <html>/<body> classes, viewport meta,
  // theme-color, :root CSS variables, and the page's effective root font/
  // colors/background. Without these an AI loses theme switches, design
  // tokens, and the inherited typographic baseline.
  function getDocumentContextReport() {
    const html = document.documentElement;
    const body = document.body;
    const rows = [];
    if (html) {
      const lang = html.getAttribute("lang");
      rows.push(`html: ${describeElement(html)}${lang ? ` lang="${lang}"` : ""}`);
    }
    if (body && body !== html) rows.push(`body: ${describeElement(body)}`);
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) rows.push(`viewport: ${viewport.getAttribute("content") || ""}`);
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) rows.push(`theme-color: ${themeColor.getAttribute("content") || ""}`);
    const charset = document.querySelector("meta[charset]");
    if (charset) rows.push(`charset: ${charset.getAttribute("charset")}`);

    if (html) {
      const cs = getComputedStyle(html);
      const bodyCs = body ? getComputedStyle(body) : cs;
      rows.push("");
      if (cs.colorScheme && cs.colorScheme !== "normal") rows.push(`color-scheme: ${cs.colorScheme}`);
      rows.push(`root font: ${bodyCs.fontSize} / ${bodyCs.lineHeight} ${compactCssValue(bodyCs.fontFamily)}`);
      rows.push(`root color: ${bodyCs.color}`);
      rows.push(`root background-color: ${bodyCs.backgroundColor}`);
      if (bodyCs.backgroundImage && bodyCs.backgroundImage !== "none") {
        rows.push(`root background-image: ${limitText(bodyCs.backgroundImage, 1000, "background truncated")}`);
      }
      const vars = [];
      for (let i = 0; i < cs.length; i++) {
        const name = cs[i];
        if (!name || !name.startsWith("--")) continue;
        vars.push(`  ${name}: ${limitText(cs.getPropertyValue(name).trim(), 200, "var truncated")}`);
        if (vars.length >= 80) { vars.push("  ... root CSS variables truncated"); break; }
      }
      if (vars.length) rows.push("", "root CSS variables:", ...vars);
    }
    return rows.join("\n");
  }

  // Context — parent + siblings + landmark region. The single home for
  // surrounding structure (previously duplicated across Fast Locator,
  // Rendered Layout, and Nearby Context).
  function getContextReport(el) {
    const rows = [];
    const p = el.parentElement;
    if (p && p !== document.body && p !== document.documentElement) {
      rows.push(`parent: ${describeElement(p)}`);
      const pLayout = getParentContextStr(el);
      if (pLayout) rows.push(`parent layout: ${pLayout}`);
    }
    const semantic = getSemanticContextStr(el);
    if (semantic) rows.push(`semantic: ${semantic}`);
    if (p) {
      const siblings = Array.from(p.children || []).filter(child => !isEditorElement(child));
      const index = siblings.indexOf(el);
      rows.push(`sibling: ${index + 1} of ${siblings.length}`);
      const start = Math.max(0, index - 2);
      const end = Math.min(siblings.length, index + 3);
      siblings.slice(start, end).forEach((sib, i) => {
        const actual = start + i;
        const marker = actual === index ? "►" : " ";
        const text = directText(sib);
        rows.push(`  ${marker} ${actual + 1}: ${describeElement(sib)}${text ? ` text="${truncate(text, 60)}"` : ""}`);
      });
    }
    const region = nearestRegionContext(el);
    if (region) rows.push(`region: ${region}`);
    return rows.join("\n") || "none";
  }

  function buildDomPath(el) {
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1) {
      let part = node.tagName.toLowerCase();
      if (node.id && isStableToken(node.id)) {
        part += `#${node.id}`;
        parts.unshift(part);
        break;
      }
      const cls = stableClasses(node)[0];
      if (cls) part += `.${cls}`;
      const p = node.parentElement;
      if (p) {
        const sameTag = Array.from(p.children).filter(child => child.tagName === node.tagName);
        if (sameTag.length > 1) part += `:nth-of-type(${sameTag.indexOf(node) + 1})`;
      }
      parts.unshift(part);
      if (node === document.documentElement) break;
      node = p;
    }
    return parts.join(" > ");
  }

  function buildXPath(el) {
    if (el.id && isStableToken(el.id)) return `//*[@id=${xpathLiteral(el.id)}]`;
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1) {
      const tag = node.tagName.toLowerCase();
      const p = node.parentElement;
      if (!p) { parts.unshift(tag); break; }
      const sameTag = Array.from(p.children).filter(child => child.tagName === node.tagName);
      const index = sameTag.length > 1 ? `[${sameTag.indexOf(node) + 1}]` : "";
      parts.unshift(`${tag}${index}`);
      node = p;
    }
    return "/" + parts.join("/");
  }

  function xpathLiteral(value) {
    value = String(value);
    if (!value.includes("'")) return `'${value}'`;
    if (!value.includes('"')) return `"${value}"`;
    return "concat(" + value.split("'").map(part => `'${part}'`).join(', "\'", ') + ")";
  }

  function describeElement(el) {
    if (!el || !el.tagName) return "";
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : "";
    const cls = Array.from(el.classList || []).slice(0, 6).map(c => "." + c).join("");
    const role = el.getAttribute("role");
    const testId = el.getAttribute("data-testid") || el.getAttribute("data-test") || el.getAttribute("data-cy") || el.getAttribute("data-qa");
    const label = el.getAttribute("aria-label") || el.getAttribute("title") || "";
    return `<${tag}${id}${cls}>${role ? ` role="${role}"` : ""}${testId ? ` test="${testId}"` : ""}${label ? ` label="${truncate(label, 60)}"` : ""}`;
  }

  function directText(el) {
    if (!el || !el.childNodes) return "";
    return Array.from(el.childNodes).filter(node => node.nodeType === 3).map(node => node.textContent).join(" ").replace(/\s+/g, " ").trim();
  }

  function cssValue(cs, prop) {
    return limitText(String(cs.getPropertyValue(prop) || "").replace(/\s+/g, " ").trim(), 1600, "value truncated");
  }

  function limitText(value, max, label) {
    value = String(value == null ? "" : value);
    if (value.length <= max) return value;
    let cut = value.slice(0, max);
    // If the cut may have sliced through a token-like run of chars, back up
    // to the previous whitespace/delimiter so we never leak a token prefix.
    const tail = cut.slice(-96);
    if (/[A-Za-z0-9._/+=-]{32,}$/.test(tail)) {
      const safeIdx = cut.search(/[\s"'<>(){}[\];,][^\s"'<>(){}[\];,]{0,95}$/);
      if (safeIdx > 0 && cut.length - safeIdx < 128) cut = cut.slice(0, safeIdx);
    }
    return cut + `\n... ${label || "truncated"} (${value.length - cut.length} chars omitted)`;
  }

  function round2(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
  }

  function safeReportValue(name, value, max) {
    if (isSensitiveName(name) || isTokenLikeValue(value)) return maskedValue(value);
    return limitText(String(value == null ? "" : value), max || 2000, "value truncated");
  }

  function isSensitiveName(name) {
    return /(password|passwd|token|secret|authorization|auth|session|cookie|csrf|xsrf|api[_-]?key|apikey|access[_-]?key|private[_-]?key|client[_-]?secret|refresh[_-]?token|id[_-]?token|credential|signature|sig)/i.test(String(name || ""));
  }

  function isTokenLikeValue(value) {
    value = String(value || "");
    if (value.length < 48) return false;
    if (/^eyJ[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+$/i.test(value)) return true;
    if (/^(bearer|basic)\s+/i.test(value)) return true;
    if (/^[a-f0-9]{48,}$/i.test(value)) return true;
    if (/^[a-z0-9_/-]{80,}={0,2}$/i.test(value)) return true;
    return false;
  }

  function maskedValue(value) {
    value = String(value == null ? "" : value);
    return `[masked sensitive value, length ${value.length}]`;
  }

  function fiberDisplayName(fiber) {
    if (!fiber) return "unknown";
    if (typeof fiber.type === "string") return fiber.type;
    if (fiber.type) return fiber.type.displayName || fiber.type.name || fiber.elementType && (fiber.elementType.displayName || fiber.elementType.name) || "anonymous";
    if (fiber.elementType) return fiber.elementType.displayName || fiber.elementType.name || "anonymous";
    return "unknown";
  }

  function debugSourceText(source) {
    if (!source) return "";
    const file = source.fileName ? source.fileName.replace(/^.*?\/src\//, "src/") : "";
    return `${file}${source.lineNumber ? `:${source.lineNumber}` : ""}${source.columnNumber ? `:${source.columnNumber}` : ""}`;
  }

  function normalizeForReport(value, depth, seen, key) {
    if (key && isSensitiveName(key)) return maskedValue(value);
    if (value == null || typeof value === "number" || typeof value === "boolean") return value;
    if (typeof value === "string") return isTokenLikeValue(value) ? maskedValue(value) : limitText(value, 4000, "string truncated");
    if (typeof value === "function") return `[Function ${value.name || "anonymous"}]`;
    if (typeof value === "symbol") return String(value);
    if (typeof Node !== "undefined" && value instanceof Node) return `[${value.nodeType === 1 ? describeElement(value) : "Node"}]`;
    if (depth >= 4) return Array.isArray(value) ? `[Array(${value.length})]` : "[Object]";
    if (typeof value === "object") {
      if (seen.has(value)) return "[Circular]";
      seen.add(value);
      if (value.$$typeof && value.props) return `[ReactElement ${reactElementName(value)}]`;
      if (Array.isArray(value)) return value.slice(0, 30).map((item, i) => normalizeForReport(item, depth + 1, seen, String(i))).concat(value.length > 30 ? [`... ${value.length - 30} more items`] : []);
      const out = {};
      const entries = Object.entries(value).filter(([k]) => !k.startsWith("__")).slice(0, 60);
      entries.forEach(([k, v]) => {
        out[k] = k === "children" ? summarizeReactChildren(v) : normalizeForReport(v, depth + 1, seen, k);
      });
      const total = Object.keys(value).length;
      if (total > entries.length) out.__truncated = `${total - entries.length} more keys`;
      return out;
    }
    return String(value);
  }

  function summarizeReactChildren(value) {
    if (value == null) return value;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
    if (Array.isArray(value)) return `[ReactChildren count=${value.length}]`;
    if (typeof value === "object" && value.$$typeof) return `[ReactElement ${reactElementName(value)}]`;
    return "[ReactChildren]";
  }

  function reactElementName(value) {
    const type = value && value.type;
    if (typeof type === "string") return type;
    return type && (type.displayName || type.name) || "anonymous";
  }
