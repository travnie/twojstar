# MCP Apps (interactive UI in chat)

One standard for both hosts: ChatGPT is fully MCP Apps-compatible since 2026-02; Claude renders MCP Apps in chat/desktop (check `claude-ai-docs` `/connectors/building/mcp-apps/getting-started` for current surfaces). SDK: `@modelcontextprotocol/ext-apps` (2.x as of 2026-11 — `npm view @modelcontextprotocol/ext-apps version`; old guides pin 1.x).

## Wiring

Spec + guide: modelcontextprotocol.io/extensions/apps (via `mcp-docs`).

1. Register a resource `ui://<app>/<view>` with MIME `text/html;profile=mcp-app` (SDK constant `RESOURCE_MIME_TYPE`) containing a self-contained HTML bundle (inline JS/CSS; external assets need CSP declarations).
2. Tool descriptor `_meta.ui.resourceUri` → that resource. `_meta.ui.visibility`: `["model","app"]` default; `["app"]` for UI-only helper tools.
3. Tool returns data (`structuredContent`) — the view renders it; keep text content for the model.

## Bridge: standard first, OpenAI alias second

| Need | MCP Apps standard | ChatGPT alias (compat only) |
|---|---|---|
| link tool → UI | `_meta.ui.resourceUri` | `_meta["openai/outputTemplate"]` |
| tool input | `ui/initialize` + `ui/notifications/tool-input` | `window.openai.toolInput` |
| tool result | `ui/notifications/tool-result` | `window.openai.toolOutput` |
| call a tool from UI | `tools/call` | `window.openai.callTool` |
| follow-up message | `ui/message` | `window.openai.sendFollowUpMessage` |
| open link | `ui/open-link` | `window.openai.openExternal` |

ChatGPT-only extras (checkout, file upload, modals, `widgetState`): feature-detect, never branch on host name. Migrating an Apps SDK (`window.openai`, skybridge) app = swap to the standard column; keep aliases only for old clients.

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
