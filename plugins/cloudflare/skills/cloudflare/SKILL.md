---
name: "cloudflare"
description: "Cloudflare platform: Workers, Pages, KV/D1/R2, cron, Durable Objects, Workers AI, AI Gateway, Agents SDK, MCP on Workers, framework apps incl. Next.js (vinext), local dev and debugging, REST API, cf CLI, wrangler, Workers profiling, Cloudflare error pages (52x, 1xxx, 403). Use for any Cloudflare, Worker or binding task and Workers code review. Prefer live docs over memory."
---

# Cloudflare Platform Skill

Synced with `github.com/cloudflare/skills` at `cbf893b` (2026-11-10): the `cloudflare` router's references for the products below, plus the upstream `cf-cli`, `wrangler`, `workers-best-practices`, `workers-profiling`, `workers-development`, `agents-sdk`, `durable-objects`, `nextjs-on-cloudflare`, `frameworks-on-cloudflare` and `cloudflare-app-bootstrap` skills folded in as references. Start from the user's goal, pick the product, then read that reference's README and follow its links.

Your knowledge of Cloudflare APIs, types, limits and pricing may be outdated. **Prefer retrieval over pre-training.** The references are task routes into the docs, not copies of them: they deliberately avoid restating commands, signatures and numeric limits. When a reference and the docs disagree, **trust the docs**.

## Where you run

- **Docs:** the bundled Cloudflare MCP's `docs` / `search` tools first, else `https://developers.cloudflare.com/<product>/llms.txt` or the `.../index.md` pages the references link to.
- **Account access = the bundled Cloudflare MCP** (`execute` → `cloudflare.request()` against the REST API, authorized by OAuth as the user's account). Reads (D1 `.../d1/database/{id}/query`, KV, Worker settings, logs) are fine. Deploys, writes, secrets, deletes → only when the user asked. Never ask for or paste an API token.
- **Chat sandbox (claude.ai, ChatGPT):** no `wrangler`/`cf` login. Clone the repo with the host's GitHub path; type-checks, tests, builds and deploys go through the repo's CI / Workers Builds — don't reinstall and rebuild locally what a workflow already does. Local `wrangler types` / `--dry-run` only when no workflow covers it.
- **Local agent (Claude Code, Codex, other CLIs):** the project's own scripts and CLI apply; local dev, Local Explorer and debugging → `references/workers-development/`.
- **`compatibility_date`**: new Worker → today's date; existing Worker → don't bump casually (read the compatibility-flags docs first). Never copy a date from an example.

## Choose the CLI (do this first)

Upstream default is now the `cf` CLI (beta) unless the project already uses Wrangler:

- `wrangler.jsonc` / `wrangler.json` / `wrangler.toml` and no `cloudflare.config.ts` → Wrangler for dev, build, deploy (`references/wrangler/`). `cf` resource commands (DNS, zones, storage) are fine alongside. `cf migrate` only when asked.
- `cloudflare.config.ts`, a new project, or no Cloudflare config → `cf` (`references/cf-cli/`). Don't install Wrangler or create a Wrangler config.
- Exceptions, checked first: the user explicitly asks for Wrangler → Wrangler. A new **framework** project is created with C3 per `references/frameworks/` and then has Wrangler config, so the first bullet applies.

Many docs pages show only Wrangler commands and config; in a `cf` project don't run them or add a Wrangler config. One CLI per project, apart from the `npx wrangler` commands `references/cf-cli/` lists as not yet supported by `cf`. Where a reference or doc names a Wrangler command, find the `cf` equivalent with `cf cli search "<task>"` or the [Wrangler to cf reference](https://developers.cloudflare.com/cf/wrangler/reference/index.md) — never translate from memory.

## What are you trying to build?

New sites and apps — static, SPA or full-stack — go on **Workers + Workers Static Assets**. Keep existing Pages projects on Pages during unrelated maintenance; migrate only when asked.

| Need | Product | Reference |
|---|---|---|
| API, webhook, edge logic, production Worker code | Workers | `references/workers/` (best practices: config, runtime patterns, platform APIs) |
| New website / SPA / full-stack app | Workers + Static Assets | `references/static-assets/` |
| Framework app on Workers (Astro, SvelteKit, React Router, TanStack Start, Nuxt, Hono, SPA) | Framework tooling + Workers | `references/frameworks/` |
| Next.js app on Workers (new or migrating) | vinext on Workers | `references/nextjs/` |
| Get an existing app running locally (bindings, secrets, seed data) | Local development | `references/app-bootstrap/` |
| Inspect local binding data, traces or logs; debug a deployed Worker | Local Explorer, Workers observability | `references/workers-development/` |
| Worker far from its regional database / backends | Workers placement | `references/workers/configuration.md` → *Place compute near regional databases* |
| Existing Pages site / its server endpoints | Pages + Pages Functions | `references/pages/`, `references/pages-functions/` |
| Scheduled job | Cron Triggers | `references/cron-triggers/` |
| Give a Worker access to a resource | Bindings | `references/bindings/` |
| Read-heavy config / cache, stale-tolerant | KV | `references/kv/` |
| Relational records, SQL | D1 | `references/d1/` |
| Per-entity coordinated state, strong consistency, WebSockets, alarms | Durable Objects | `references/durable-objects/` |
| Files, uploads, large objects | R2 | `references/r2/` |
| Run a model at the edge (text, embeddings, images, speech) | Workers AI | `references/workers-ai/` |
| Proxy / cache / log / rate-limit / route calls to any AI provider | AI Gateway | `references/ai-gateway/` |
| Stateful AI agent, chat agent, MCP server or client, scheduled/durable agent work | Agents SDK | `references/agents-sdk/` |
| Automate account config via HTTP | REST API | [REST API docs](https://developers.cloudflare.com/fundamentals/api/index.md); the bundled MCP's `execute`; from a terminal, `cf` resource commands |
| Reach an Access-protected page or API from an agent, script or crawler | Access service tokens | [Service token docs](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/index.md) |
| Proxied site shows a Cloudflare error page, `52x`, 1xxx code or Cloudflare `403` | Error triage | `references/http-errors/` (decide: zone config or origin) |
| Run, configure, deploy, Previews, secrets, environments | `cf` CLI / Wrangler | `references/cf-cli/` (new projects), `references/wrangler/` (Wrangler projects) |
| Profile CPU or memory of a deployed Worker / DO | Workers profiling | `references/workers-profiling/` |

Not bundled — go straight to docs (Cloudflare MCP `docs` tool or the [directory](https://developers.cloudflare.com/directory/index.md)): Workflows, Queues, Containers, Sandbox, Dynamic Workers, Workers for Platforms, Hyperdrive, Vectorize, AI Search, Browser Rendering, Secrets Store, Artifacts, Basin/K2, Tunnel, WAF/DDoS/Bot Management/API Shield/Turnstile, Images, Stream, Realtime, Email, Zaraz, Observability/Tail Workers/Analytics Engine, Terraform/Pulumi, Flagship, GraphQL Analytics API, Gateway Forward Workers, Workers Builds/Previews internals. Upstream has dedicated skills for some of these (`sandbox-*`, `gateway-workers`, `turnstile-spin`, `web-perf`, `cloudflare-email-service`, `cloudflare-one*`) — deliberately not installed; use their docs.

When products could overlap, decide on the deciding requirement: data shape, consistency (KV eventual vs D1/DO strong), coordination (Durable Objects), execution lifecycle (cron vs Workflows vs Queues), and how much infra the user wants to run. Check current limits and pricing before promising a fit — especially on the free tier.

## Working principles

- Read the reference README, then only the linked sub-file the task needs (configuration / api / patterns / gotchas). Don't load whole trees.
- Writing or reviewing Worker code → `references/workers/README.md` first; it routes to `configuration.md`, `runtime-patterns.md` (streaming, `waitUntil`, no floating promises, no request-scoped global state, Web Crypto) and `platform-apis.md` (binding access, serialization boundaries).
- After touching config or bindings in TypeScript, regenerate types (`wrangler types` in Wrangler projects, `cf workers types` in `cf` projects) — never hand-edit generated declarations.
- Treat `wrangler secret put/delete` as a deploy. Rollbacks don't roll back data in bound resources.
- Report what changed, the target environment, checks actually run, and remaining gaps; link the docs the answer depended on.

## Skill feedback

If the user reports that guidance here is wrong, outdated or missing, read `references/skill-feedback.md`.
