# Extension runtime traps

Each compiles, loads, and then fails quietly. Checked against developer.chrome.com 2026-11 (Chrome 153 stable). Re-check the API page before relying on version numbers.

## Contexts and lifetime

| Trap | Fix |
|---|---|
| Globals in the service worker reset after ~30 s idle | Persist in `chrome.storage.local` / `.session`; read on every event |
| `setTimeout`/`setInterval` for scheduling | `chrome.alarms` (name ≤ 1024 bytes since Chrome 150, else TypeError) |
| Listener added inside an `await` / callback | Register every event listener synchronously at top level, or wake events are missed |
| Async `runtime.onMessage` handler | Return literal `true`, call `sendResponse` later — works everywhere. Returning a Promise works from 148 but rolls out gradually, and an `async` listener always "responds" (`null`) and pre-empts other listeners. Structured-clone messaging is opt-in since 148 |
| Offscreen document calls `chrome.downloads/tabs/action` | Only `runtime.sendMessage/onMessage/getURL` exist there. Offscreen does Web API work (MediaRecorder, DOM parsing, audio); SW does `chrome.*`. One offscreen doc at a time |
| `chrome.action.*` is `undefined` | Manifest needs `"action": {}` at minimum |
| `chrome.action.onClicked` never fires | It doesn't when `default_popup` is set |

## UI surfaces

| Trap | Fix |
|---|---|
| `side_panel.default_path` but nothing opens it | `sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` (not `...ActionIconClick` — throws, kills SW) with no `default_popup`; or `sidePanel.open({ windowId })` from a user gesture (action click, context menu, shortcut, button on an extension page) |
| `activeTab` from a side-panel/popup button | `activeTab` only comes from action click, context menu, shortcut, omnibox. Side panel needs `tabs` + `host_permissions` |
| `permissions.request()` in SW after an `await` | Gesture survives `sendMessage` for one synchronous turn only — call it first, nothing awaited before |
| DevTools panel path relative to the devtools page | `devtools.panels.create(title, icon, "devtools/panel.html")` — path from extension root |
| Context-menu action silently does something | Confirm with badge flash, notification or injected toast |
| `"tab"` context in `contextMenus` | Tab-strip menu, Chrome 150+ only |

## Tabs, windows, capture

| Trap | Fix |
|---|---|
| `tab.url` / `tab.title` is `undefined` | Needs `tabs` permission or matching host permission — no error thrown |
| `chrome.windows.query()` | Doesn't exist: `getAll`, `getLastFocused`, `getCurrent`, `get` |
| `tabCapture.getMediaStreamId` double click → "active stream" | State machine `idle→starting→recording→stopping` in `storage.session`; ignore clicks in transitional states |
| `desktopCapture.chooseDesktopMedia` from SW | Pass `targetTab` (needs `tabs` for its `url`). Prefer `tabCapture` for tab-only |

## Code execution and CSP

- Extension pages block `eval`, `new Function`, inline script. Run untrusted/generated code in a manifest `sandbox` page via `postMessage`, a Blob-URL iframe, or `srcdoc`. Never `iframe.contentDocument.write` from the extension page.
- No remotely hosted JS (CDN at runtime = store rejection). Fetching JSON is fine.
- Content scripts: isolated world by default; batch big DOM edits with `requestAnimationFrame` + `scheduler.yield()`; scope CSS (Shadow DOM) so host page styles don't leak either way; clean up on SPA navigation.

## userScripts (script managers only)

- Chrome 138+: user enables **Allow User Scripts** per extension on its details page (earlier: Developer mode). API is `undefined` when off; detect with a `try { chrome.userScripts.getScripts(); }` wrapper and show setup instructions.
- Registered scripts vanish on extension update → keep config in `storage`, re-register in `runtime.onInstalled` reason `"update"`.
- Messaging: `configureWorld({ messaging: true })` first; receive on `runtime.onUserScriptMessage`, not `onMessage`.
- `js` entries: exactly one of `code` / `file`. Script `id` can't start with `_`. `userScripts.execute()` (135+) for one-shot runs; 149+ validates syntax synchronously.

## Identity, icons, AI

- `chrome.identity` OAuth client is bound to the extension ID, which differs unpacked vs store. Pin dev ID with manifest `"key"`; after publishing, update the OAuth client with the store ID.
- Manifest icons: real PNGs at 16/32/48/128, one file per size — or omit icons. Runtime images (notifications, `setIcon`) can be data URLs drawn on `OffscreenCanvas`.
- Prompt API (`LanguageModel`) works in SW, popup and side panel without extra permission; extensions also get `LanguageModel.params()`. Check `availability()` first; model download is user-visible.

## Stack choice

Small offline tool → vanilla bundled MV3, no backend. Multi-surface or existing framework → WXT/Plasmo after checking their current docs. Private API keys never ship in the package; proxy through a server (Cloudflare Worker fits).
