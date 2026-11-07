# Skills over MCP

A server serves Agent Skills (`SKILL.md` + supporting files) next to its tools. Extension `io.modelcontextprotocol/skills`, SEP-2640 **Final**; spec in `modelcontextprotocol/ext-skills`, guide at modelcontextprotocol.io/extensions/skills (via `mcp-docs`). SDK and host support is still rolling out: check the client matrix (`/extensions/client-matrix`) before promising it works anywhere.

## When

- Tools do things, resources expose content, prompts return messages. A skill teaches the model how to *combine* them: multi-step workflows, policies, templates, references that would otherwise bloat tool descriptions.
- Never replace an executable capability with prose.
- Host support missing → ship the same skill in a plugin (`plugin-dev`) instead; both can share one source directory.

## Server side

Declare in `server/discover` (spec 2026-07-28+):

```json
{ "capabilities": { "resources": {},
    "extensions": { "io.modelcontextprotocol/skills": { "directoryRead": true } } } }
```

- Must implement `skills/list` (paginated, cacheable) and `skills/get` (by URI, works even for unlisted skills). Files are served with plain `resources/read`; `resources/directory/read` only if `directoryRead: true`.
- Entry = `uri` of `SKILL.md` (prefer `skill://<name>/SKILL.md`), the **unchanged** `frontmatter`, and `resources`: a full manifest (every file: URI, SHA-256 `digest`, byte `size`) or `"dynamic"`. Never split one entry across pages.
- List/get/read results carry `resultType: "complete"`, `ttlMs`, `cacheScope`.
- `SKILL.md` frontmatter needs `name` + `description`; the parent directory name must equal `name`. Relative links resolve against the skill root.
- Limits: ≤512 files and ≤16 MiB per skill (hosts must accept at least that).
- Errors: unknown skill/file/dir → `-32602`; internal → `-32603`.
- Manifests must be computed from the bytes actually served. A stale digest makes hosts reject the skill.

## Host behaviour to design for

- Reading `SKILL.md` does not activate it. The host verifies size, digest and frontmatter, asks for approval, then loads.
- Approval binds to the whole manifest. Any changed, added or removed file revokes it, so don't churn files casually.
- No prefetch: files are read only when the model asks. Keep `SKILL.md` small and link everything else.
- Content is untrusted. `allowed-tools` and script execution need explicit per-skill approval; cross-server reads need per-call approval.
- `"dynamic"` skills may be declined; use them only for truly generated content.

## Implementations

mcp-use's TS SDK auto-discovers a `skills/` directory beside the server (`skills: true|false|{directory}`). Otherwise implement the two methods and the resource reads yourself. Look up current SDK support in the ext-skills `docs/implementations.md`.
