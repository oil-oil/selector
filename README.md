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

The copied prompt includes a compact, fact-based element summary: readable element name, stable locator, semantic location, React component info, and filtered props when available. Selector keeps long CSS selectors, layout, parent, or HTML context as fallbacks, and only includes them when the page structure makes that context useful.
Long page URLs are split into a route plus a compact query summary, so filter-heavy local pages stay readable.

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
