---
name: selector
description: >-
  Visual element picker that bridges browser → Claude Code. Start a local server
  so the Selector bookmarklet's "Send to Claude Code" button delivers element
  prompts directly into this session. Trigger when user says: /selector, start
  selector, 启动 selector, 用 selector, open selector server.
---

# Selector Skill

Selector is a browser bookmarklet that lets users click on page elements and
send structured prompts directly to Claude Code — no copy-paste needed.

## How it works

1. This skill starts `server/index.js` as a background task
2. The server listens on `localhost:7734` for POST requests from the bookmarklet
3. When the user clicks "Send to Claude Code" in the browser, the prompt arrives here
4. Read the task output and act on the prompt immediately

## Workflow

### Step 1 — Start the server

```bash
node /path/to/selector/server/index.js
```

Use `Bash` with `run_in_background: true`. Parse stdout for the line:
```
SELECTOR_READY port=7734
```
to confirm the server is up before proceeding.

### Step 2 — Tell the user

Once the server is ready, inform the user:

> Selector server is running on port 7734.
> Open any page, click the **Selector** bookmark, select elements, then click **Send to Claude Code**.
> I'll receive the prompt and act on it directly.

If the user hasn't installed the bookmarklet yet, point them to the install page:
`open http://localhost:PORT` (serve index.html) or direct them to the GitHub Pages URL.

### Step 3 — Monitor for incoming prompts

Use `TaskOutput` to read the server's stdout. New prompts arrive wrapped like:

```
========== SELECTOR ==========
Page: /some/path

1. .hero-title <h1>
   selector: section > h1
   text: "Welcome to our product"
   html: <h1 class="hero-title">Welcome to our product</h1>
   instruction: make this more compelling
==============================
```

Poll with `TaskOutput` after telling the user you're ready. When a prompt arrives,
parse everything between the `===` lines and handle it as a normal code change request.

### Step 4 — Handle the prompt

Treat the received prompt exactly as if the user had pasted it into the chat:
- Read the referenced file / component
- Make the requested change
- Confirm what was done

### Step 5 — Stay alive

After handling a prompt, go back to monitoring (re-read TaskOutput). Keep the
server running until the user says to stop or closes the session.

## Notes

- The server runs on `127.0.0.1` only — no external access
- CORS is open for `localhost` origins (bookmarklet needs this)
- The Send button only appears in the bookmarklet when the server is reachable
- Multiple prompts can queue up; process them in order
