# Next.js on Cloudflare

Folded in from upstream `nextjs-on-cloudflare`. Use when starting a Next.js app on Workers, moving an existing one to Workers, or choosing between vinext and OpenNext.

**Default to vinext, not OpenNext, for new Next.js projects on Workers** — that is what the [Cloudflare Next.js guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/index.md) recommends. Keep existing OpenNext setups during unrelated maintenance and respect an explicit user choice.

## Why vinext

[vinext](https://github.com/cloudflare/vinext) reimplements the Next.js API surface on Vite: App Router, Pages Router, RSC and supported `next/*` imports; Vite HMR and plugins; local execution in workerd with real bindings; incremental migration alongside an existing Next.js setup. It is not full Next.js parity — check current compatibility for the features the app actually needs.

## Workflow

vinext maintains its own agent skills in [`.agents/skills`](https://github.com/cloudflare/vinext/tree/main/.agents/skills). They change faster than this reference, so read the current ones instead of working from memory:

- **Terminal with npx (Claude Code, Codex):** install them if missing with `npx skills add cloudflare/vinext`, then follow the applicable `SKILL.md`.
- **Chat sandbox (claude.ai, ChatGPT):** don't install; read the upstream `SKILL.md` and its references directly (shallow clone of `cloudflare/vinext`, or GitHub MCP `get_file_contents`).

Then by case:

- **New project:** vinext's [new-project setup](https://github.com/cloudflare/vinext#starting-a-new-vinext-project) via `create-vinext-app` with the Cloudflare target. The migration skill needs an existing Next.js project — don't run it on an empty directory.
- **Existing Next.js project:** the upstream [`migrate-to-vinext`](https://github.com/cloudflare/vinext/blob/main/.agents/skills/migrate-to-vinext/SKILL.md) skill, including its compatibility check; pick Cloudflare as the deployment target.
- **Dev and deploy:** the current [Workers integration docs](https://github.com/cloudflare/vinext#cloudflare-workers). CLI choice still follows `SKILL.md` → *Choose the CLI*.
