# Skill feedback

Use when the user reports that this skill gave wrong or outdated guidance, is missing something, or could be better. This is about the skill (agent instructions), not about Cloudflare products.

## First: whose bug is it?

This skill is Bartek's fork of `github.com/cloudflare/skills` (sync point in `SKILL.md`). Decide before drafting anything:

- **Local adaptation** — the chat-sandbox section, CLI routing tied to trvny/travnie Workers, the "not bundled" list, path rewrites, this file. Fix it in the skill (`skill-creator-v2` lifecycle) and repackage. Nothing goes upstream.
- **Upstream content** — text that came from `cloudflare/skills`. First check whether current upstream `main` already fixed it; if so, that's a resync, not an issue. Otherwise offer an upstream issue (below).

## Upstream issue

GitHub issues are public. Never post until the user has seen the exact title and body and said yes to posting it.

Strip before drafting: credentials, tokens, secrets; account/zone/resource IDs; personal data (names, emails, IPs); internal hostnames and URLs (`*.travny.workers.dev` included); private code, config and logs. Describe the problem in general terms instead.

1. **Ask** whether the user wants to send feedback to the maintainers. No → move on.
2. **Draft** from the conversation using the table below. Name the **upstream** skill and file the text came from (e.g. `workers-best-practices` → `references/runtime-patterns.md` > "Be aware of platform limits"), not this fork's path.
3. **Review** — show the exact title and body, then ask a yes/no like "Post this as a public issue on cloudflare/skills?" Agreeing in step 1 is not approval of the text. Apply requested changes and ask again.
4. **Submit** only after a yes — GitHub MCP `issue_write` (or `gh issue create --repo cloudflare/skills`). Title: `skill-feedback: <upstream-skill>: <summary>`.
5. **Share** the issue URL. On failure, give the approved title and body plus <https://github.com/cloudflare/skills/issues/new>.

| Field | Value |
|-------|-------|
| Type | `bug`, `outdated`, `missing`, or `improvement` |
| Skill | Upstream skill name, e.g. `cloudflare`, `wrangler`, `workers-best-practices` |
| Source | Upstream file and section |
| Agent | Agent and model, if known |
| Task | What the user was trying to do |
| Expected | What should have happened |
| Actual | What the skill said or what happened |
| Impact | Effect on the user |
| Suggested fix | How the skill should change; blank if unsure |
