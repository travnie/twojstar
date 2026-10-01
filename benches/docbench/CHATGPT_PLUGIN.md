# ChatGPT file viewer idea

Status: planned, not implemented. Recorded 2026-10-01.

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

First prototype validation: attachment opens, edits round-trip without changing
text fidelity, external changes update the viewer, stale ETags show conflicts,
read-only files cannot be saved, and unsupported hosts retain the website path.

References:

- https://github.com/openai/mcp-extensions
- https://github.com/openai/mcp-extensions/blob/main/docs/spec.md#file-extension-entrypoint
- https://developers.openai.com/plugins/build/extensions
