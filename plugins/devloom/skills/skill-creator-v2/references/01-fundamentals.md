# Fundamentals

## What a skill is

A skill is a set of instructions — packaged as a simple folder — that teaches Claude how to handle specific tasks or workflows. Instead of re-explaining your preferences, processes, and domain expertise in every conversation, a skill lets you teach Claude once and benefit every time.

Skills are most valuable when you have **repeatable workflows**: generating frontend designs from specs, conducting research with a consistent methodology, creating documents that follow a team style guide, or orchestrating multi-step processes. They work alongside Claude's built-in capabilities (code execution, document creation). For MCP integrations, skills add a layer that turns raw tool access into reliable, optimized workflows.

**Who it's for:** developers who want Claude to follow specific workflows consistently, power users standardizing their own processes, and teams standardizing how Claude works across an organization.

**What you can expect:** you can build a functional skill in a single sitting — roughly 15–30 minutes for a first working skill using the `skill-creator`.

### Two paths through the guide

- **Standalone skills** → focus on Fundamentals, Planning and Design, and capability categories 1–2.
- **Enhancing an MCP integration** → the "Skills + Connectors" material and category 3.

Both paths share the same technical requirements; you pick what's relevant.

## What a skill is, structurally

A skill is a folder containing:

- **`SKILL.md`** (required) — instructions in Markdown with YAML frontmatter.
- **`scripts/`** (optional) — executable code (Python, Bash, etc.).
- **`references/`** (optional) — documentation loaded as needed.
- **`assets/`** (optional) — templates, fonts, icons used in output.
- **`agents/openai.yaml`** (default) — interface manifest (display name, icon, brand color) for OpenAI Codex; see `references/openai-compat.md`.

## Core design principles

### Progressive disclosure

Skills use a **three-level system** so Claude loads only what it needs:

1. **First level — YAML frontmatter.** Always loaded in Claude's system prompt. Provides just enough for Claude to know *when* each skill should be used, without loading all of it into context.
2. **Second level — SKILL.md body.** Loaded when Claude judges the skill relevant to the task. Contains the full instructions and guidance.
3. **Third level — linked files.** Additional bundled files Claude can choose to navigate and discover only as needed.

This progressive disclosure minimizes token usage while preserving specialized expertise.

### Composability

Claude can load multiple skills simultaneously. Your skill should work well alongside others — don't assume it's the only capability available.

### Portability

Skills work identically across Claude.ai, Claude Code, and the API. Create a skill once and it works across all surfaces without modification, *provided the environment supports any dependencies the skill requires*. The same folder is also directly usable by OpenAI Codex and other Agent Skills-standard tools; `agents/openai.yaml` (added by default — see the file list above) is the one piece specific to that side.

## For MCP builders: skills + connectors

> Building standalone skills without MCP? Skip to Planning and Design — you can always return here later.

If you already have a working MCP server, you've done the hard part. Skills are the **knowledge layer on top** — capturing the workflows and best practices you already know, so Claude applies them consistently.

**The kitchen analogy:**

- MCP provides the professional kitchen: access to tools, ingredients, and equipment.
- Skills provide the recipes: step-by-step instructions on how to create something valuable.

Together they let users accomplish complex tasks without figuring out every step themselves.

### How they work together

| MCP (connectivity) | Skills (knowledge) |
|---|---|
| Connects Claude to your service (Notion, Asana, Linear, etc.) | Teaches Claude how to use your service effectively |
| Provides real-time data access and tool invocation | Captures workflows and best practices |
| What Claude *can* do | How Claude *should* do it |

### Why this matters for MCP users

**Without skills:** users connect your MCP but don't know what to do next; support tickets ask "how do I do X with your integration"; each conversation starts from scratch; results are inconsistent because users prompt differently each time; users blame your connector when the real issue is workflow guidance.

**With skills:** pre-built workflows activate automatically when needed; tool usage is consistent and reliable; best practices are embedded in every interaction; the learning curve for your integration drops.
