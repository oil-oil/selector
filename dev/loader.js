(function () {
  "use strict";

  const loader = document.currentScript;
  const assetBase = loader?.dataset.selectorBase || "/__selector_dev__";
  const styleId = "selector-dev-style";
  const scriptId = "selector-dev-script";
  let originalAiIds = null;

  function isRunning() {
    return Boolean(document.querySelector(".ai-editor-root"));
  }

  function rememberAiIds() {
    originalAiIds = new Map();
    document.querySelectorAll("[data-ai-id]").forEach((element) => {
      originalAiIds.set(element, element.getAttribute("data-ai-id"));
    });
  }

  function restoreAiIds() {
    document.querySelectorAll("[data-ai-id]").forEach((element) => {
      if (originalAiIds?.has(element)) {
        element.setAttribute("data-ai-id", originalAiIds.get(element));
      } else {
        element.removeAttribute("data-ai-id");
      }
    });
    originalAiIds = null;
  }

  function start() {
    if (isRunning()) return;
    rememberAiIds();

    if (!document.getElementById(styleId)) {
      const style = document.createElement("link");
      style.id = styleId;
      style.rel = "stylesheet";
      style.href = `${assetBase}/editor.css`;
      document.head.appendChild(style);
    }

    document.getElementById(scriptId)?.remove();
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = `${assetBase}/editor.js?v=${Date.now()}`;
    script.onerror = restoreAiIds;
    document.head.appendChild(script);
  }

  function stop() {
    if (typeof window.__SELECTOR_DESTROY__ === "function") {
      window.__SELECTOR_DESTROY__();
    }
    restoreAiIds();
  }

  function toggle() {
    if (isRunning()) stop();
    else start();
  }

  document.addEventListener("keydown", (event) => {
    if (
      event.code !== "KeyS" ||
      !event.altKey ||
      !event.shiftKey ||
      event.ctrlKey ||
      event.metaKey
    ) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    toggle();
  }, true);

  window.__SELECTOR_TOGGLE__ = toggle;
})();
