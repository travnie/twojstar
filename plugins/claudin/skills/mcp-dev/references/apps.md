# MCP Apps (interactive UI in chat)

One standard for both hosts: ChatGPT is fully MCP Apps-compatible since 2026-02; Claude renders MCP Apps in chat/desktop (check `claude-ai-docs` `/connectors/building/mcp-apps/getting-started` for current surfaces). SDK: `@modelcontextprotocol/ext-apps` (2.x as of 2026-11 — `npm view @modelcontextprotocol/ext-apps version`; old guides pin 1.x).

## Setup that bites

- ext-apps 2.x needs the split SDK v2 packages: `npm install @modelcontextprotocol/ext-apps @modelcontextprotocol/server @modelcontextprotocol/node @modelcontextprotocol/express zod` (+ `client` if the view talks to other servers). Never add the v1 `@modelcontextprotocol/sdk` next to them.
- Bundle the view into one HTML file: `vite` + `vite-plugin-singlefile`. Dev deps: `npm install -D vite vite-plugin-singlefile tsx typescript`. Run TS servers with `tsx` (SDK examples use `bun`).
- Working code beats memory: clone the SDK at the installed version, `git clone --depth 1 --branch "v$(npm view @modelcontextprotocol/ext-apps version)" https://github.com/modelcontextprotocol/ext-apps`, then read `examples/basic-server-{vanillajs,react,vue,svelte}` `docs/migrate_from_openai_apps.md` (OpenAI Apps SDK → MCP Apps) and `docs/migrate-to-2.md` (ext-apps 1.x → 2.x).
- Official step-by-step skills (Claude Code): the `mcp-apps` plugin in that repo (`create-mcp-app`, `add-app-to-server`, `convert-web-app`, `migrate-oai-app`). It's not part of this plugin, so don't assume it's installed.

## Which tools get a UI

| Tool output | UI? |
|---|---|
| lists, tables, search results | yes: filter, sort, select |
| metrics over time | yes: charts, gauges |
| media (maps, PDFs, images, video) | yes: viewer/player |
| confirmations, short text | no, text is fine |
| data only other tools/the view need | app-only tool (`visibility: ["app"]`) |

## Wiring

Spec + guide: modelcontextprotocol.io/extensions/apps (via `mcp-docs`).

1. Register a resource `ui://<app>/<view>` with MIME `text/html;profile=mcp-app` (SDK constant `RESOURCE_MIME_TYPE`) containing a self-contained HTML bundle (inline JS/CSS; external assets need CSP declarations).
2. Tool descriptor `_meta.ui.resourceUri` → that resource. `_meta.ui.visibility`: `["model","app"]` default; `["app"]` for UI-only helper tools.
3. Tool returns data (`structuredContent`) — the view renders it; always keep `content` text as the fallback for non-UI hosts.
4. `_meta.ui.csp` and `_meta.ui.domain` go on the `contents[]` items returned by the resource **read callback**, not in the `registerAppResource()` config. The usual silent failure.
5. View: register every handler (`ontoolinput`, `ontoolresult`, `onhostcontextchanged`, `onteardown`) **before** `app.connect()`, or early messages are lost.
6. Optional: `ontoolinputpartial` (render while args stream), `requestDisplayMode` (fullscreen), `updateModelContext` (keep the model told what the user did in the view), `sendLog` (logs reach the host, not just the iframe console).
7. Mixed hosts: register the app tool only when `getUiCapability(clientCapabilities)` lists `RESOURCE_MIME_TYPE`, else a plain tool. Works where the transport still exposes client capabilities; on stateless 2026-07-28 servers keep one tool and rely on the text fallback.

## Bridge: standard first, OpenAI alias second

| Need | MCP Apps standard | ChatGPT alias (compat only) |
|---|---|---|
| link tool → UI | `_meta.ui.resourceUri` | `_meta["openai/outputTemplate"]` |
| tool input | `ui/initialize` + `ui/notifications/tool-input` | `window.openai.toolInput` |
| tool result | `ui/notifications/tool-result` | `window.openai.toolOutput` |
| call a tool from UI | `tools/call` | `window.openai.callTool` |
| follow-up message | `ui/message` | `window.openai.sendFollowUpMessage` |
| open link | `ui/open-link` | `window.openai.openExternal` |

No MCP Apps equivalent yet (2026-11): `widgetState` (keep state server-side via tool calls; localStorage only as a best-effort cache), file upload/download, modals, `window.openai.view`, `openai/toolInvocation/*` progress text, `openai/widgetDescription` (use `updateModelContext`). Feature-detect, never branch on host name. Migrating an Apps SDK (`window.openai`, skybridge) app = swap to the standard column; keep aliases only for old clients; re-derive CSP from what the app actually fetches.

## Hybrid: one web app, two modes

Existing SPA that must keep working standalone: pick the mode from an explicit signal the MCP build sets (build-time constant, `?mcp=1` in the resource HTML, a `data-mcp` attribute), or from bridge detection (embedded `window.parent !== window` and `app.connect()` succeeding within a short timeout). Never infer it from `window.location.origin`: it reflects the URL, not the iframe sandbox, so an HTTP-served view reads as standalone. Then take the call's arguments from `ontoolinput` (data from `ontoolresult`) instead of URL params, route API calls through app-only tools instead of `fetch`, and treat localStorage as best-effort. Same render code for both modes; host styling only in MCP mode.

## Test locally

`examples/basic-host` from the cloned repo: `SERVERS='["http://localhost:3001/mcp"]' npm run start`, open `:8080`. Then a real host (`mcp-dev` §4).

## Sandbox constraints

- Iframe, no top navigation, no same-origin storage guarantees; persist via tool calls or host state APIs.
- CSP: declare every external origin (images, fetch, fonts) in the resource `_meta.ui.csp`; otherwise blocked.
- Links: through `ui/open-link`; declared HTTPS origins open without a prompt in Claude (allowed link URIs at submission).
- Theme: use host CSS variables / transparent background; test light + dark.
- Payload: keep tool results small; fetch heavy data from the view via `tools/call` (app-only tool) instead of stuffing the first result.
- Abuse: rate-limit app-only tools, validate inputs like any public endpoint.

## Pick one archetype, say which

| Archetype | When | Shape |
|---|---|---|
| tool-only | no UI asked; search/fetch/actions | server only (default for knowledge sources) |
| vanilla-widget | demo, single simple view | server + one HTML resource |
| react-widget | polished, component UI | `server/` + `web/`, built bundle inlined |
| interactive-decoupled | boards, maps, editors, games, dashboards — repeated interaction | data tools + render tools, widget stays mounted |
| submission-ready | only when launch/review is asked | smallest viable + `_meta.ui.domain`, exact CSP, review-safe auth |

## Stateful widgets

- Version the snapshot (`stateVersion`, `lastMutationId`) so retries/rerolls don't clobber newer state.
- `structuredContent` = small, model-visible state; `content` = one-line narration; `_meta` = big or widget-only hydration data (not shown to the model).
- UI-initiated `tools/call` for refresh/filter/toggle — no remount, no model rerun. Reads idempotent; writes carry `destructiveHint` + confirmation.
- Standalone fallback: if no host bridge, apply state locally so the view works in a plain browser during dev.
- Host-specific extras beyond MCP Apps: check openai/mcp-extensions `docs/spec.md` and add only what the target host supports.

## Use elicitation instead when

The UI is a confirm, a pick-one, or a short flat form. Apps are for searchable lists, previews, charts, live updates.
