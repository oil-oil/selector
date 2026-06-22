# Selector

Point at any element. Tell your AI what to change.

A bookmarklet that lets you visually select elements on any web page, add instructions, and copy a structured prompt — paste it into Claude Code, Codex, Cursor, or any AI coding assistant.

## Install

1. Visit the **[install page](https://oil-oil.github.io/selector/)**
2. Drag the **Selector** button to your bookmarks bar (one-time)
3. Done

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
| **⌘⇧C** | Copy selected area screenshot |
| **⌘Z** | Undo last selection change |
| **Space** | Pause / resume selecting |
| **Esc** | Clear selection |

The copied prompt includes lightweight element metadata (tag, stable selector, locator, text, React component info) plus any per-element instructions you added. Optional settings can add styles, HTML snippets, parent context, or React props when you need more detail.

## Example output

```
Page: /dashboard

1. .hero-title <h1>
   selector: [data-testid="hero-title"]
   locator: heading "Welcome to the Dashboard"
   source: src/components/Hero.tsx:12
   react: Layout › Hero
   text: "Welcome to the Dashboard"
   instruction: Make this red and larger

2. .sidebar <nav>
   selector: body > aside > nav
   locator: nav "Home Settings Profile Logout"
   text: "Home Settings Profile Logout"
   instruction: Add an "Analytics" link after "Settings"
```

## How it works

The bookmarklet injects `editor.css` + `editor.js` into the current page. Everything runs client-side — no data is sent anywhere. The code is bundled into the bookmark at install time, so it works offline after that.

## Development

```bash
git clone https://github.com/oil-oil/selector.git
cd selector
# Edit assets/editor.js and assets/editor.css
# Push to main — GitHub Pages auto-deploys
```

## License

MIT
