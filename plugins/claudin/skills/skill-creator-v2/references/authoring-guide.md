
# Skill authoring guide

Anthropic's official guide to building skills, restructured as a navigable reference. Live source: the Claude docs MCPs (`claude-code-docs` `/en/skills`, `claude-ai-docs`). This is the *doctrine* — the rules and patterns. Build/eval/package workflow: `SKILL.md`; claude.ai upload allowlist and chat-porting fixes: `claude-ai-compat.md`.

> One caveat worth flagging: the guide's frontmatter advice is the authoring-side view. The claude.ai / Skills API **upload validator** is stricter and is the binding contract — when shipping to claude.ai, `claude-ai-compat.md` + `quick_validate` win over anything here.

## Quick lookup (the facts you reach for most)

| Rule | Value |
|---|---|
| `SKILL.md` filename | Exactly `SKILL.md`, case-sensitive — no `skill.md` / `SKILL.MD` |
| Skill folder name | kebab-case only: no spaces, no underscores, no capitals; match folder to `name` |
| `name` | kebab-case; reserved: can't be prefixed "claude" or "anthropic" |
| `description` | Required; must state **WHAT** it does **and WHEN** to use it; under **1024 characters**; **no angle brackets** (`<` `>`) |
| Frontmatter fields | `name`, `description` (required); `license`, `allowed-tools`, `compatibility`, `metadata` (optional) |
| `compatibility` | 1–500 chars; environment needs (product, packages, network) |
| `metadata` | Any custom key-value pairs; suggested `author`, `version`, `mcp-server` |
| `allowed-tools` | Optional tool restriction, e.g. `"Bash(python:*) Bash(npm:*) WebFetch"` |
| No `README.md` | Not inside the skill folder; docs go in `SKILL.md` or `references/` (repo-level README is fine) |
| Progressive disclosure | 3 levels: frontmatter (always) → SKILL.md body (when relevant) → linked files (on demand) |
| Keep SKILL.md | Under ~5,000 words; move detail to `references/` |
| Too many skills | Slowdowns appear past ~20–50 enabled simultaneously |
| Triggering target | ~90% of relevant queries (aspirational) |

**Minimal valid frontmatter:**

```yaml
---
name: your-skill-name
description: What it does. Use when user asks to [specific phrases].
---
```

## File structure

```
your-skill-name/
├── SKILL.md         # Required
├── scripts/         # Optional - executable code
├── references/      # Optional - docs loaded as needed
├── assets/          # Optional - templates, fonts, icons
└── agents/
    └── openai.yaml  # Default - OpenAI/Codex interface manifest, see references/openai-compat.md
```

## Navigation

| Chapter | Covers |
|---|---|
| [01 Fundamentals](references/01-fundamentals.md) | What a skill is; the folder; progressive disclosure / composability / portability; skills + MCP (the kitchen analogy) |
| [02 Planning and design](references/02-planning-and-design.md) | Use cases; the 3 use-case categories; success criteria; **technical requirements**; **frontmatter field rules**; writing descriptions (good/bad); instruction best practices |
| [03 Testing and iteration](references/03-testing-and-iteration.md) | Triggering / functional / performance tests; example test suites; using `skill-creator`; iterating on under/over-trigger signals |
| [04 Distribution and sharing](references/04-distribution-and-sharing.md) | Distribution model; Agent Skills open standard; **Skills API** (`/v1/skills`, `container.skills`); GitHub hosting; positioning |
| [05 Patterns and troubleshooting](references/05-patterns-and-troubleshooting.md) | Problem- vs tool-first; the **5 patterns**; the full **troubleshooting** set |
| [06 Resources and references](references/06-resources-and-references.md) | Official docs/blogs; support; **Reference A** quick checklist; **Reference B** full YAML frontmatter; **Reference C** example skills |

## The five workflow patterns (→ chapter 05)

1. **Sequential workflow orchestration** — multi-step in a fixed order; explicit ordering, dependencies, validation, rollback.
2. **Multi-MCP coordination** — workflows spanning services; clear phases, data passed between MCPs.
3. **Iterative refinement** — quality improves with loops; explicit criteria, validation scripts, a stop condition.
4. **Context-aware tool selection** — same outcome, different tool by context; decision tree + fallbacks + transparency.
5. **Domain-specific intelligence** — embeds expertise beyond tool access (e.g. compliance-before-action, audit trail).

## Common questions → where to look

| Question | Go to |
|---|---|
| What can/can't go in frontmatter? Char limits? | Quick lookup above; [02](references/02-planning-and-design.md); [Reference B in 06](references/06-resources-and-references.md) |
| How do I write a description that triggers? | [02 “The description field”](references/02-planning-and-design.md) |
| Why won't my skill trigger / why does it over-trigger? | [05 Troubleshooting](references/05-patterns-and-troubleshooting.md); [03 iteration signals](references/03-testing-and-iteration.md) |
| Skill loads but Claude ignores the instructions | [05 “Instructions not followed”](references/05-patterns-and-troubleshooting.md) |
| How do I test triggering / output / performance? | [03](references/03-testing-and-iteration.md) |
| How do I ship it (Claude.ai, Claude Code, API)? | [04](references/04-distribution-and-sharing.md) |
| What metrics say it's working? | [02 “Define success criteria”](references/02-planning-and-design.md) |
| Pre/post-upload checklist | [Reference A in 06](references/06-resources-and-references.md) |
| It's slow / responses degraded | [05 “Large context issues”](references/05-patterns-and-troubleshooting.md) |
