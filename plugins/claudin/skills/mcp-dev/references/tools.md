# Tool design

Tool list = prompt. Every schema costs tokens every turn on every host.

## Descriptions

One-line manpage: what it does, what it returns, what it does **not** do, sibling to use instead.

```
search_issues — Keyword search over issue title+body, newest first, up to `limit`.
Does not search comments or PRs (use search_comments / search_prs).
```

Directory rejects descriptions that instruct ("always call X first", "ignore other tools", promotions, hidden/encoded text, "fetch your instructions from URL"). Freeform-endpoint tools must name/link the target API docs.

## Schemas

Constrain everything: regex IDs, `int` with min/max/default, `enum` for choices, `.describe()` on every param including defaults. Flat objects beat nesting. Return `structuredContent` with an `outputSchema` when the client parses results; still include a short text summary.

## Results

- JSON for data, short confirmation + ID for mutations ("Created issue #123").
- Paginate/truncate and say so ("10 of 847 — refine query").
- No raw HTML, no full API dumps, no data the task didn't ask for.
- Errors: `isError: true` + what failed + how to recover ("Item 42 not found; use search_items"). No bare "Internal Server Error".
- Deterministic `tools/list` order (cache-friendly, spec 2026-07-28 SHOULD).

## Annotations

| Hint | Set when | Claude effect |
|---|---|---|
| `title` | always | display name |
| `readOnlyHint: true` | no side effects | may auto-run without confirm |
| `destructiveHint: true` | deletes/overwrites | always prompts |
| `idempotentHint: true` | safe to retry | |
| `openWorldHint: true` | touches external world | |

OpenAI extras live in `_meta` (`openai/toolInvocation/invoking|invoked` ≤64 chars status text, `openai/fileParams`); prefer standard `_meta.ui.*` where it exists.

## Knowledge-source servers: `search` + `fetch`

Read-only data source (docs, tickets, wiki, CRM) meant for ChatGPT company knowledge / deep research → implement the standard tools, exact names and shapes, before anything custom (developers.openai.com/plugins/build/mcp-server#company-knowledge-compatibility; schemas at platform.openai.com/docs/mcp):

- `search(query: string)` → one `text` content item, JSON `{ "results": [{ "id", "title", "url" }] }`
- `fetch(id: string)` → one `text` content item, JSON `{ "id", "title", "text", "url", "metadata"? }`
- both `readOnlyHint: true`; `url` absolute and user-openable (citations); internal ids stay in `id`.

Claude handles them like any tool, so one server serves both hosts.

## Wrapping an OpenAPI / REST API

Curate, don't mirror. >~30 operations → filter by tag, path prefix, explicit allowlist or GET-only, and keep the filter as a visible constant users can edit.

- Name: `operationId` → snake_case, fallback `method_path`, normalized to `[a-z0-9_]`, ≤60 chars. Collisions: disambiguate deterministically (method suffix) before publishing, and log it.
- Description: the spec's `summary` as the first line, plus only the parts of `description` that change how to call it (limits, pagination). Don't paraphrase, don't paste essays: every word ships in each `tools/list`. Empty → `METHOD /path` plus a warning to fix the spec.
- Params, flattened into one argument list: path → required; query → required only if the spec says so; JSON body object → splat its properties (primitive/array body → one `body` arg). Same name in two sources → prefix by source (`path_id`, `query_id`, `body_id`). Headers only when they're real input (idempotency key), prefixed `header_`; auth comes from env/OAuth, never from the model. Cookies: skip and warn.
- Results: 2xx JSON as is, truncated with a "showing N of M" note when large (declare `outputSchema` when the spec has one); binary → "saved N bytes to <path>", never inline blobs; SSE/NDJSON → accumulate up to a time/byte cap and say when cut; non-2xx → `isError` with status + body.
- Skip `webhooks`/`callbacks`, `deprecated` and `x-internal` operations by default and say so. Hints follow actual behaviour, not the verb: `readOnlyHint` only for verified side-effect-free calls (usually GET, but check), `destructiveHint` for deletes and overwrites.

## Counts and patterns

| Tools | Pattern |
|---|---|
| 1-15 | one per action |
| 15-30 | audit near-duplicates |
| 30+ | search + execute (+ promoted top 3-5) |

Cross-call state: server-minted handles passed as normal arguments (sessions are gone in 2026-07-28). Need user input mid-call → elicitation (now a multi-round-trip `input_required` result); check client capabilities and keep a plain-argument fallback. Rich input → MCP App.

## Other primitives

Resources (host-attached context, `ui://` for apps), prompts (user-invoked templates), sampling (server asks the model; capability-gated). Most servers need only tools.
