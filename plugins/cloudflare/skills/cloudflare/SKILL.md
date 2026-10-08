---
name: "cloudflare"
description: "Cloudflare platform: Workers, Pages, KV/D1/R2, cron, Workers AI, AI Gateway, Agents SDK, MCP on Workers, REST API, wrangler. Use for any Cloudflare, Worker or binding task and Workers code review. Prefer live docs over memory."
---

# Cloudflare Platform Skill

Synced with `github.com/cloudflare/skills` (2026-10-01): the `cloudflare` router's references for the products below, plus the upstream `wrangler`, `workers-best-practices` and `agents-sdk` skills folded in as references. Start from the user's goal, pick the product, then read that reference's README and follow its links.

Your knowledge of Cloudflare APIs, types, limits and pricing may be outdated. **Prefer retrieval over pre-training.** The references are task routes into the docs, not copies of them: they deliberately avoid restating commands, signatures and numeric limits. When a reference and the docs disagree, **trust the docs**.

## In claude.ai chat

- **Docs work normally.** Use the Cloudflare MCP connector's `docs` tool if connected, else fetch `https://developers.cloudflare.com/<product>/llms.txt` or the `.../index.md` pages the references link to.
- **No repo on disk.** References that say "read the installed `config-schema.json` / `wrangler --help`" mean a local checkout. In chat, `git clone` a **public** repo in the sandbox and `npm ci` (offline checks work: `wrangler types`, `tsc --noEmit`, `wrangler deploy --dry-run`), or read config from the live docs. Private repo → github connector; never ask for a token in chat.
- **No account auth.** Nothing here deploys, writes secrets, or touches remote D1/KV/R2 on the user's account — write the commands/config for the user, or use the Cloudflare MCP connector's API tool when it's connected and the user asked for the change.
- **`compatibility_date`**: new Worker → today's date; existing Worker → don't bump casually (read the compatibility-flags docs first). Never copy a date from an example.

## cf CLI check (do this first)

If the project has a `cloudflare.config.ts`, or the user asks for the `cf` CLI, skip the Wrangler guidance and follow the [Cloudflare CLI docs](https://developers.cloudflare.com/cf/index.md) ([with coding agents](https://developers.cloudflare.com/cf/agents/index.md)). `cf` is beta — retrieve its docs, use `cf cli search "<task>"`; never run `cf dev/build/deploy` in a project that still has a Wrangler config. Product guidance below still applies.

## What are you trying to build?

New sites and apps — static, SPA or full-stack — go on **Workers + Workers Static Assets**. Keep existing Pages projects on Pages during unrelated maintenance; migrate only when asked.

| Need | Product | Reference |
|---|---|---|
| API, webhook, edge logic, production Worker code | Workers | `references/workers/` (best practices: config, runtime patterns, platform APIs) |
| New website / SPA / full-stack app | Workers + Static Assets | `references/static-assets/` |
| Existing Pages site / its server endpoints | Pages + Pages Functions | `references/pages/`, `references/pages-functions/` |
| Scheduled job | Cron Triggers | `references/cron-triggers/` |
| Give a Worker access to a resource | Bindings | `references/bindings/` |
| Read-heavy config / cache, stale-tolerant | KV | `references/kv/` |
| Relational records, SQL | D1 | `references/d1/` |
| Files, uploads, large objects | R2 | `references/r2/` |
| Run a model at the edge (text, embeddings, images, speech) | Workers AI | `references/workers-ai/` |
| Proxy / cache / log / rate-limit / route calls to any AI provider | AI Gateway | `references/ai-gateway/` |
| Stateful AI agent, chat agent, MCP server or client, scheduled/durable agent work | Agents SDK | `references/agents-sdk/` |
| Automate account config, IaC via HTTP | REST API | `references/api/` |
| Run, configure, deploy, Previews, secrets, environments | Wrangler | `references/wrangler/` |

Not bundled — go straight to docs (Cloudflare MCP `docs` tool or the [directory](https://developers.cloudflare.com/directory/index.md)): Durable Objects, Workflows, Queues, Containers, Sandbox, Dynamic Workers, Workers for Platforms, Hyperdrive, Vectorize, AI Search, Browser Rendering, Secrets Store, Artifacts, Basin/K2, Tunnel, WAF/DDoS/Bot Management/API Shield/Turnstile, Images, Stream, Realtime, Email, Zaraz, Observability/Tail Workers/Analytics Engine, Terraform/Pulumi, Flagship, Workers Builds/Previews internals. Upstream has dedicated skills for some of these (`durable-objects`, `sandbox-*`, `turnstile-spin`, `web-perf`, `cloudflare-email-service`, `nextjs-on-cloudflare`) — not installed here; use their docs.

When products could overlap, decide on the deciding requirement: data shape, consistency (KV eventual vs D1/DO strong), coordination (Durable Objects), execution lifecycle (cron vs Workflows vs Queues), and how much infra the user wants to run. Check current limits and pricing before promising a fit — especially on the free tier.

## Working principles

- Read the reference README, then only the linked sub-file the task needs (configuration / api / patterns / gotchas). Don't load whole trees.
- Writing or reviewing Worker code → `references/workers/README.md` first; it routes to `configuration.md`, `runtime-patterns.md` (streaming, `waitUntil`, no floating promises, no request-scoped global state, Web Crypto) and `platform-apis.md` (binding access, serialization boundaries).
- After touching config or bindings in TypeScript, regenerate types with `wrangler types` — never hand-edit generated declarations.
- Treat `wrangler secret put/delete` as a deploy. Rollbacks don't roll back data in bound resources.
- Report what changed, the target environment, checks actually run, and remaining gaps; link the docs the answer depended on.
