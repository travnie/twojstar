# Resources and references

If you're building your first skill, start with the Best Practices Guide, then reference the API docs as needed.

## Official documentation

**Anthropic resources:** Best Practices Guide; Skills Documentation; API Reference; MCP Documentation.

**Blog posts:** "Introducing Agent Skills"; Engineering Blog "Equipping Agents for the Real World"; "Skills Explained"; "How to Create Skills for Claude"; "Building Skills for Claude Code"; "Improving Frontend Design through Skills."

## Example skills

**Public skills repository:** GitHub `anthropics/skills` — contains Anthropic-created skills you can customize.

## Tools and utilities

**`skill-creator` skill:** built into Claude.ai and available for Claude Code; can generate skills from descriptions; reviews and provides recommendations. Use: "Help me build a skill using skill-creator."

**Validation:** `skill-creator` can assess your skills. Ask: "Review this skill and suggest improvements."

## Getting support

**Technical questions:** community forums at the Claude Developers Discord.

**Bug reports:** GitHub issues at `anthropics/skills/issues` — include skill name, error message, and steps to reproduce.

---

# Reference A: Quick checklist

Use this to validate your skill before and after upload. For a faster start, use `skill-creator` to generate the first draft, then run through this list.

**Before you start:** identified 2–3 concrete use cases · tools identified (built-in or MCP) · reviewed this guide and example skills · planned folder structure.

**During development:** folder named in kebab-case · `SKILL.md` exists (exact spelling) · YAML frontmatter has `---` delimiters · `name` field kebab-case, no spaces, no capitals · `description` includes WHAT and WHEN · no XML tags (`<` `>`) anywhere · instructions are clear and actionable · error handling included · examples provided · references clearly linked · `agents/openai.yaml` + icon added (default — see `references/openai-compat.md`) unless the skill is Claude-only.

**Before upload:** tested triggering on obvious tasks · tested triggering on paraphrased requests · verified it doesn't trigger on unrelated topics · functional tests pass · tool integration works (if applicable) · compressed as `.zip` file.

**After upload:** test in real conversations · monitor for under/over-triggering · collect user feedback · iterate on description and instructions · update version in metadata.

---

# Reference B: YAML frontmatter

**Required fields:**

```yaml
---
name: skill-name-in-kebab-case
description: What it does and when to use it. Include specific trigger phrases.
---
```

**All optional fields:**

```yaml
name: skill-name
description: [required description]
license: MIT # Optional: License for open-source
allowed-tools: "Bash(python:*) Bash(npm:*) WebFetch" # Optional: Restrict tool access
metadata: # Optional: Custom fields
  author: Company Name
  version: 1.0.0
  mcp-server: server-name
  category: productivity
  tags: [project-management, automation]
  documentation: https://example.com/docs
  support: support@example.com
```

**Security notes.** Allowed: any standard YAML types (strings, numbers, booleans, lists, objects); custom metadata fields; long descriptions (up to 1024 characters). Forbidden: XML angle brackets (`<` `>`, security restriction); code execution in YAML (uses safe YAML parsing); skills named with a "claude" or "anthropic" prefix (reserved).

---

# Reference C: Complete skill examples

For full, production-ready skills demonstrating the patterns in this guide:

- **Document skills** — PDF, DOCX, PPTX, XLSX creation.
- **Example skills** — various workflow patterns.
- **Partner Skills Directory** — skills from partners such as Asana, Atlassian, Canva, Figma, Sentry, Zapier, and more.

These repositories stay up to date and include additional examples beyond what's covered here. Clone them, modify them for your use case, and use them as templates.
