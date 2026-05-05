# AI Element Picker for Claude & Codex

Visually select any DOM element and copy an AI prompt — for Claude Code, Codex, Cursor, Copilot, or any AI coding assistant.

> Forked from [oil-oil/selector](https://github.com/oil-oil/selector). Added Chrome/Edge/Arc browser extension support.

A browser extension that lets you point and click any element on any webpage, add instructions, and copy a structured AI prompt. Perfect for vibe coding workflows with Claude Code, Codex, Cursor, or GitHub Copilot.

## Install

1. Install from the Chrome Web Store
2. Done — a launcher button appears on every page

Works with Chrome, Edge, and Arc.

## Usage

Click the **●** launcher button in the bottom-left corner of any page to open Selector. Click it again (or press ✕) to close.

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
