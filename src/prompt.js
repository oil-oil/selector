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
