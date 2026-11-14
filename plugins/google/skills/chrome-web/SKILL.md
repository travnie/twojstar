---
name: "chrome-web"
description: "Chrome extensions (MV3, chrome.*/browser.* APIs, side panel, content/user scripts, Web Store publishing) and modern web platform (Baseline, CSS/JS APIs, Core Web Vitals, built-in AI). Checks live developer.chrome.com and web.dev via Google Developer MCP."
license: Complete terms in LICENSE.txt
---

# Chrome extensions + web platform

Google's browser side, next to `android-compose`. Visual direction and UX → design plugin / `frontend-design`. Hosting → `cloudflare`.

## Live docs first

APIs move every Chrome release (4 weeks). Everything below is a trap list, not a spec.

| Source | Use for |
|---|---|
| **Google Developer MCP** `search_documents` → `get_documents` | developer.chrome.com (extensions API reference, manifest keys, **What's new in extensions**, Web Store policy) and web.dev (guides, Baseline, CWV). `answer_query` = synthesized, low quota |
| `npx -y modern-web-guidance@latest search "<task>"` → `retrieve <id>` | Google's curated web-platform guides (dialogs, popovers, anchor positioning, view transitions, forms/autofill, passkeys, INP/LCP, built-in AI) with Baseline fallbacks. Claude Code / any shell with network and approval. Chat default stays the MCP |
| MDN / caniuse (WebFetch) | Per-browser compat when the user targets Safari/Firefox too |

Use `google-developer-knowledge` for retrieval failures, auth/REST fallback, and upstream discovery. Cite retrieved pages. If no source is reachable, mark API details unverified; do not invent signatures. Failed lookup is not evidence of API absence.

## Extensions: hard rules

- **MV3 only.** `background.service_worker`, `chrome.action`, `chrome.scripting`, `host_permissions` separate, no remote code, no inline `<script>`/handlers.
- **Namespace.** Docs now show `browser.*` (Chrome 148+); `chrome.*` still works. Keep `chrome.*` when `minimum_chrome_version` < 148 or repo already uses it.
- **Service worker dies after ~30 s idle.** No state in globals → `chrome.storage` (`session` for ephemeral); `chrome.alarms` not `setTimeout`; register listeners synchronously at top level.
- **Least privilege.** `activeTab` / optional permissions / narrow host patterns; every permission needs a one-line user-facing reason (store review reads it).
- **Every referenced file exists** (icons, notification `iconUrl`, pages) or drop the reference.

Before writing extension code read `references/extensions.md` (≈20 runtime traps that compile fine and fail silently). Publishing → `references/webstore.md`.

## Web platform work

- Default target **Baseline Widely available** without fallback. **Newly available** → feature-detect + fallback per the guide. Limited → only with explicit user OK.
- Project has its own browser policy (Electron/Tauri, "Safari 17.4+", "no polyfills") → follow it; when the user states one, suggest writing it to `CLAUDE.md`/`AGENTS.md`.
- Prefer platform over deps: `<dialog>`/`popover`, anchor positioning, `:has()`, container queries, View Transitions, `content-visibility`, `fetchpriority`, `scheduler.yield()`.

## Verify

1. **Static:** `python3 scripts/check_mv3.py <ext-dir>` — MV3 keys, missing files, icon sizes, MV2 leftovers, inline scripts, broad hosts, risky permissions. Not proof of runtime.
2. **Runtime:** Playwright bundled Chromium loads unpacked extensions headless when available in the current environment. Branded Chrome dropped `--load-extension`.

```js
const { chromium } = require('playwright');
const ctx = await chromium.launchPersistentContext('', { channel: 'chromium',
  args: [`--disable-extensions-except=${dir}`, `--load-extension=${dir}`] });
const sw = ctx.serviceWorkers()[0] ?? await ctx.waitForEvent('serviceworker');
const id = new URL(sw.url()).host;               // then page.goto(`chrome-extension://${id}/popup.html`)
```

Test: fresh install, popup close/reopen, SW restart (state survives), deny/revoke permission, restricted URL (`chrome://`, Web Store), offline. Toolbar clicks, real side panel UX, OAuth and store install warnings → manual check in real Chrome; say which cases ran and which didn't.

## Chat vs Claude Code

| | Chat (cloud sandbox) | Claude Code |
|---|---|---|
| Docs | Google Developer MCP | MCP + `modern-web-guidance` CLI |
| Checks | `check_mv3.py`, Playwright Chromium | same, plus the user's own Chrome profile only if they ask |
| Deliver | zipped extension via file send; load unpacked steps | write to repo; CI if a workflow exists |
