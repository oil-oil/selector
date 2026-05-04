# Selector

Point at any element. Tell your AI what to change.

> Forked from [oil-oil/selector](https://github.com/oil-oil/selector). Added Chrome/Edge/Arc browser extension support.

A browser extension (and bookmarklet) that lets you visually select elements on any web page, add instructions, and copy a structured prompt — paste it into Claude Code, Codex, Cursor, or any AI coding assistant.

## Install

### Extension (recommended — Chrome, Edge, Arc)

1. Visit the **[install page](https://oil-oil.github.io/selector/)**
2. Install from the Chrome Web Store
3. Done — a launcher button appears on every page

### Bookmarklet (other browsers)

1. Visit the **[install page](https://oil-oil.github.io/selector/)**
2. Drag the **Selector** button to your bookmarks bar (one-time)
3. Done

## Usage

**Extension:** Click the **●** launcher button in the bottom-left corner of any page to open Selector. Click it again (or press ✕) to close.

**Bookmarklet:** Open any web page, click the **Selector** bookmark.

| Action | What it does |
|---|---|
| **Click** | Select an element |
| **Shift + Click** | Add to selection |
| **Drag** | Marquee select multiple elements |
| **↑ / ↓** | Navigate to parent / child element |
| **← / →** | Navigate to previous / next sibling |
| **✎ button** | Add per-element instruction |
| **⌘C** | Copy prompt to clipboard |
| **⌘Z** | Undo last selection change |
| **Space** | Pause / resume selecting |
| **Esc** | Clear selection |

The copied prompt includes element metadata (tag, selector, text, React component info) plus any per-element instructions you added.

## Example output

```
Page: /dashboard

1. .hero-title <h1>
   selector: body > main > section > h1
   source: src/components/Hero.tsx:12
   react: Layout › Hero
   text: "Welcome to the Dashboard"
   html: <h1 class="hero-title">Welcome to the Dashboard</h1>
   instruction: Make this red and larger

2. .sidebar <nav>
   selector: body > aside > nav
   text: "Home Settings Profile Logout"
   html: <nav class="sidebar">…
   instruction: Add an "Analytics" link after "Settings"
```

## How it works

The extension declares `assets/editor.css` + `assets/editor.js` as content scripts injected into all pages. A small launcher button (bottom-left) appears on every page; clicking it activates the full picker UI. Everything runs client-side — no data is sent anywhere.

The bookmarklet works the same way — the install page fetches and bundles the assets into a `javascript:` URI at load time.

## Development

```bash
git clone https://github.com/oil-oil/selector.git
cd selector
# Edit assets/editor.js and assets/editor.css
# Load unpacked extension: chrome://extensions → Developer Mode → Load unpacked → repo root
# Push to main — GitHub Pages auto-deploys the install page
```

## License

MIT
