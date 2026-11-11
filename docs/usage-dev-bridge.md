# Selector Dev Bridge & Live Visual Tweaker Guide

## 1. Build and Verify

```bash
npm run check
```

## 2. Wire into a Vite Project

Use the Vite dev plugin in `vite.config.ts`:

```ts
import { defineConfig } from "vite";
import { selectorDevPlugin } from "selector/vite";

export default defineConfig({
  plugins: [
    selectorDevPlugin(), // active only in `vite dev` (`apply: "serve"`)
  ],
});
```

## 3. Wire into a Next.js Project

### App Router (`app/api/selector/[...slug]/route.ts` + `app/layout.tsx`)

Create `app/api/selector/[...slug]/route.ts`:

```ts
import { createNextAppHandler } from "selector/next";

export const dynamic = "force-dynamic";

const handler = createNextAppHandler({ root: process.cwd() });

export const GET = handler;
export const POST = handler;
export const DELETE = handler;
```

In `app/layout.tsx` (dev-only):

```tsx
import Script from "next/script";

// Inside <body>:
{process.env.NODE_ENV === "development" && (
  <Script src="/api/selector/assets/bootstrap.js" strategy="afterInteractive" />
)}
```

### Pages Router (`pages/api/selector/[...slug].ts` + `pages/_app.tsx`)

Create `pages/api/selector/[...slug].ts`:

```ts
import { createNextPagesHandler } from "selector/next";

export default createNextPagesHandler({ root: process.cwd() });
```

In `pages/_app.tsx` (dev-only):

```tsx
import Script from "next/script";

// Inside App component return:
{process.env.NODE_ENV === "development" && (
  <Script src="/api/selector/assets/bootstrap.js" strategy="afterInteractive" />
)}
```

## 4. Daily Workflow (Zero-Clipboard Pull Mode)

1. Start your dev server (`vite dev` or `next dev`). A semi-transparent `Selector` pill appears at bottom-right; normal clicks work undisturbed.
2. Press `Alt+S` (or click the pill) to wake Selector.
3. Click any element -> open the pencil icon to open the unified draggable editor popover: type instructions at the top (saved as `instruction:`), and adjust `Padding`, `Margin`, `Gap`, `Font size`, `Weight`, `Radius`, `Opacity`, `Width/Height`, and `Colors` live below.
4. Click **Send to Workspace** (`投递到工作区`). Selector writes the structured batch (including `styleDiff:` and `source:`) to `.tmp/selector-queue.md` in that project's root and cleanly reverts temporary inline preview styles so HMR reflects real source changes.
5. Switch to your target Agent chat session and send `改ui` (or `check ui`).
