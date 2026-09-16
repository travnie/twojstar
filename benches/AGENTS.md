# Benches workspace

Codebench, Docbench and Streambench share dependency installation/CI here;
products and Cloudflare Workers stay separate.

- Run `npm ci` in `benches/`; keep one workspace `package-lock.json`.
- Put runtime dependencies in owning workspace `package.json`.
- Prefer shared scripts only for genuinely common build mechanics.
- Do not merge Worker entry points/security boundaries just to reduce files.
- Shared workspace tooling changes must validate all three Benches.
- Product-only changes should run owning workspace check.

Docbench stays local-first: preserve text/EOL fidelity, PDF bookmarks, metadata
and attachment integrity. Streambench relay changes must preserve its constrained,
non-open-proxy boundary. Codebench user payloads stay browser-only.
