# ChatGPT file viewer idea

Status: portable plugin foundation scaffolded; MCP App/file entrypoint not implemented. Recorded 2026-10-01.

## Current foundation

The portable Agent Plugins 1.0 scaffold lives in `plugin/` with root
`plugin.json`, a bundled `docbench-files` Skill and existing Docbench branding.
It is listed in the repo marketplace for local authoring/testing. It intentionally
has no `mcp.json` or app binding yet; those arrive only with a real MCP App/runtime.

Reuse Docbench's existing document parsers, previews and preservation rules in
an MCP App rather than building another document editor. OpenAI MCP Extensions
can register file entrypoints so opening a supported attachment in ChatGPT
launches the Docbench viewer/editor.

Start with Markdown, plain UTF-8 text and JSON/JSONC; expand only after verifying
format fidelity. File entrypoints advertise explicit extensions, so they do not
replace the website's ability to open text regardless of its extension. An
explicit file picker remains useful for unknown extensions.

Use the host-provided opaque resource URI with `resources/read`, subscriptions
and `openai/resources/write`. Write only when the host advertises `writable`,
use its ETag with `ifMatch`, and show conflicts instead of overwriting a newer
version. Preserve BOM, EOL, number lexemes and metadata as the website does.
Keep file contents in the app/host; a remote Worker must not become a document
upload or processing service. Never treat file contents as model instructions.

The published platform table currently lists file entrypoints and file-resource
access for ChatGPT Desktop only. Keep the standalone website as the Android/web
path; test host capabilities and provide a clear fallback. A sidebar or thread
entrypoint can be a later addition. This UI integration is independent of Sign
in with ChatGPT and does not require adding user accounts.

## Aistee workspace and Cloudflare boundary

Docbench should not grow a second file library. Aistee Project Library is the
canonical workspace/storage model for Aistee-owned projects, documents, prompts,
instructions, skills and generated artifacts; Docbench supplies editing,
inspection, validation and conversion capabilities over those assets.

Keep the standalone Docbench website and ChatGPT file-entrypoint flow local-first.
A host-provided attachment should still be read and written through the host
resource APIs when available, without routing the file through Cloudflare just
because the MCP server is remote.

For optional Aistee cross-device sync, stay on the existing Cloudflare stack:

- Worker: narrow sync/auth/MCP control plane.
- R2: file/object bytes.
- D1: asset metadata, revisions, origin/storage references and searchable index
  state.
- Durable Objects: deferred until live collaboration, leases or stronger
  coordination are actually required.

The initial sync model should use stable asset IDs plus optimistic
revision/ETag checks. Conflicts must be surfaced rather than last-write-wins
overwriting a newer copy. Local use remains fully functional with sync disabled;
cloud enablement is explicit and does not create an Aistee account wall.

Docbench transformations exposed to Aistee should use a small typed result
contract such as `kind`, `content`, `warnings` and `sourceIds`, then let the
user preview/save the result into Project Library. Cloudflare storage, local
Aistee storage and provider-hosted files have separate lifecycles and deletion
receipts.

Suggested implementation order:

1. Keep the existing skills-only plugin package as the workflow foundation.
2. Add the MCP App/file entrypoint for Markdown, UTF-8 text and JSON/JSONC,
   preserving host-native resource access and conflict handling.
3. Wire Docbench typed transforms to Aistee Project Library editing/save-back.
4. Add optional Aistee Cloudflare sync using R2 + D1 after local revision
   semantics are stable.
5. Add richer indexing or collaborative coordination only when the simpler model
   proves insufficient.

First prototype validation: attachment opens, edits round-trip without changing
text fidelity, external changes update the viewer, stale ETags show conflicts,
read-only files cannot be saved, and unsupported hosts retain the website path.

References:

- https://github.com/openai/mcp-extensions
- https://github.com/openai/mcp-extensions/blob/main/docs/spec.md#file-extension-entrypoint
- https://developers.openai.com/plugins/build/extensions
