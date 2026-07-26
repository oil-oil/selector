<p align="center">
  <img src="assets/readme/hero.svg" width="100%" alt="Selector — point at any web element and copy structured context for your AI coding assistant">
</p>

A bookmarklet that lets you visually select elements on any web page, add instructions, and copy a structured prompt — paste it into Claude Code, Codex, Cursor, or any AI coding assistant.

https://github.com/user-attachments/assets/fb8e9271-d7e0-487f-b013-106cc4c5a40f

## Install

1. Visit the **[install page](https://oil-oil.github.io/selector/)**
2. Drag the **Selector** button to your bookmarks bar (one-time)
3. Done

The install page follows your browser language and includes an English / Chinese toggle.

## Usage

Open any web page, click the **Selector** bookmark.

| Action | What it does |
|---|---|
| **Click** | Select an element |
| **Shift + Click** | Add to selection |
| **Drag** | Marquee select multiple elements |
| **↑ / ↓** | Navigate to parent / child element |
| **← / →** | Navigate to previous / next sibling |
| **✎ button** | Add per-element instruction |
| **⌘C** | Copy prompt to clipboard |
| **⌘M** | Copy selected content as Markdown |
| **⌘⇧C** | Copy selected area screenshot |
| **⌘Z** | Undo last selection change |
| **Esc** | Pause / resume when empty, clear selection when selected |

The copied prompt includes a compact, fact-based element summary: readable element name, stable locator, semantic location, React component info, and filtered props when available. Selector keeps long CSS selectors, layout, parent, or HTML context as fallbacks, and only includes them when the page structure makes that context useful.
Long page URLs are split into a route plus a compact query summary, so filter-heavy local pages stay readable.

Enable **Sharingan mode** in settings when an element needs to be recreated with higher fidelity. In that mode, **⌘C** produces a Markdown replication report covering the document context (root CSS variables, viewport, theme), the element's identity and geometry, a sanitized DOM snapshot with same-origin images inlined as data URLs and referenced SVG sprite symbols folded in, an effective-style diff against the browser baseline (only non-default values), matched CSS rules split into normal / interactive (`:hover` / `:focus` / `:active`) / color-scheme (`prefers-color-scheme`) buckets, `@font-face` and `@keyframes` definitions for the fonts and animations the element actually uses, pseudo-elements, media assets, React fiber details, and surrounding context. Small reports are copied to the clipboard; large reports are downloaded as `.md` files automatically.

When **Screenshot + text combined** is enabled, the main copy button and **⌘C** copy both the prompt text and selected-area screenshot together. Selector also downloads the screenshot as a PNG and appends a `~/Downloads/...png` reference to the prompt, which helps text-only AI inputs find the image.

## Example output

```
Page: https://example.com/dashboard?tab=overview

1. Hero "Welcome to the Dashboard" <h1>
   selector: [data-testid="hero-title"]
   locator: heading "Welcome to the Dashboard"
   source: src/components/Hero.tsx:12
   react: Layout › Hero
   instruction: Make this red and larger

2. nav "Home Settings Profile Logout" <nav>
   locator: nav "Home Settings Profile Logout"
   inside: main "Dashboard"
   instruction: Add an "Analytics" link after "Settings"
```

For long filtered pages, the copied prompt is shortened like this:

```
Page: http://localhost:3000/campaigns/2079fa76-9c77-4900-b11a-086f4464ff2b/settlement
Query: date_from=2026-05-23, date_to=2026-06-22, creator_ids ×2
```

## How it works

The bookmarklet injects `editor.css` + the built editor payload into the current page. Everything runs client-side — no data is sent anywhere. The build step combines the `src/` editor fragments with `src/sharingan.js`, and the install page bundles that result into the bookmark, so it works offline after that.

## Development

```bash
git clone https://github.com/oil-oil/selector.git
cd selector
npm ci
npm run build
# Source files:
#   assets/editor.css     — styles for the in-page editor UI
#   src/*.js              — editor source fragments assembled by scripts/build.js
#   src/sharingan.js      — Sharingan-mode replication report, inlined at build time
# Push to main — GitHub Actions builds dist/ and deploys GitHub Pages
```

<p align="center">
  <a href="https://github.com/oil-oil/beautify-github-readme"><img src="./assets/readme/made-with-beautify.svg" width="300" alt="README made with beautify-github-readme"></a>
</p>

## License

MIT
