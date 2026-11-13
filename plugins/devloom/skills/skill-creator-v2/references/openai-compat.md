# OpenAI-compat interface (`agents/openai.yaml`)

Claude Code, Claude.ai, and OpenAI Codex (CLI, IDE extension, and the Codex app) all read the same folder: a `SKILL.md` with YAML frontmatter, built on the open [Agent Skills standard](https://agentskills.io). `agents/openai.yaml` is the one OpenAI-specific extra on top of that shared format — an optional manifest that controls how the skill *presents itself* in Codex's UI and tunes its invocation policy. It never changes what the skill does; that's still all in `SKILL.md`.

**Default policy for this skill-creator:** add `agents/openai.yaml` + an icon to every skill you create or bring up to date, the same way you already add a `description`. Skip only when the user says the skill is Claude-only.

Source of truth: <https://developers.openai.com/codex/skills#optional-metadata>. It's a live product surface — re-fetch it if something here looks stale.

## File layout

```
skill-name/
├── SKILL.md
├── assets/
│   └── icon.svg          # referenced from agents/openai.yaml below
└── agents/
    └── openai.yaml
```

Nothing here touches the claude.ai upload allowlist (`references/claude-ai-compat.md`) — that allowlist governs `SKILL.md` frontmatter only. `agents/` and `assets/` are ordinary bundled files, same as `scripts/` or `references/`; `quick_validate.py` and `package_skill.py` don't need to know they exist.

## Schema

```yaml
interface:
  display_name: "Optional user-facing name"
  short_description: "Optional user-facing description"
  icon_small: "./assets/small-logo.svg"
  icon_large: "./assets/large-logo.png"
  brand_color: "#3B82F6"
  default_prompt: "Optional surrounding prompt to use the skill with"

policy:
  allow_implicit_invocation: false

dependencies:
  tools:
    - type: "mcp"
      value: "openaiDeveloperDocs"
      description: "OpenAI Docs MCP server"
      transport: "streamable_http"
      url: "https://developers.openai.com/mcp"
```

Every top-level block is optional. In practice, include `interface` on every skill; add `policy`/`dependencies` only when they apply (see below).

## Field-by-field

| Field | Fill it with | Don't |
|---|---|---|
| `interface.display_name` | A short, human-facing name — usually Title Case of `name` (`skill-creator-v2` → "Skill Creator"). | The kebab-case `name` verbatim. |
| `interface.short_description` | One plain sentence a person reads in a picker UI: what it does. | The SKILL.md `description` verbatim. That field is deliberately long and "pushy" with trigger phrases for Claude's model-based triggering — dropped into a UI card it reads as noisy copy. Write a second, shorter sentence. |
| `interface.icon_small` / `icon_large` | A relative path under `assets/` (e.g. `./assets/icon.svg`). Same file for both is fine unless you made two sizes. | An absolute URL, or a path outside the skill folder. |
| `interface.brand_color` | A hex color if the skill has an obvious one (wraps a branded product, matches an existing palette). | Forcing one when there's no natural fit — omit the field instead of guessing. |
| `interface.default_prompt` | One example invocation, `"Use $skill-name to ..."` — mirrors OpenAI's own system skills (see worked example below). | Required for every skill — fine to omit for broad hub skills where there's no single canonical prompt. |
| `policy.allow_implicit_invocation` | `false` **only** when the user wants the skill to fire *exclusively* on explicit `$skill-name` mention. | Setting it `false` by default. It silently turns off the same auto-triggering Claude relies on `description` for — that's a deliberate narrowing, not a default. |
| `dependencies.tools` | Skills whose instructions assume a specific MCP server is connected — declare it so Codex can prompt the user to connect it. | Adding this to skills with no hard MCP dependency. |

## Icon spec (`assets/icon.svg`)

Default to one SVG icon, reused for both `icon_small` and `icon_large`, unless the user supplies real artwork:

- `viewBox="0 0 20 20"`, monochrome, `fill="currentColor"` (or `stroke="currentColor"`) — never hardcode a color inside the path, so it recolors with the host's light/dark theme.
- One or two simple shapes — legible at 16–20px. No fine detail, no gradients, no embedded raster images.
- Represent the skill's core action or domain (a pencil for editing, a chart for reporting), not a generic AI/sparkle glyph.
- Keep it small — well under 5 KB. It's inlined into a picker UI, not rendered full-size.

If you want to sanity-check a candidate shape before committing to the path data, preview it with `mcp__visualize__show_widget` in SVG mode (or the `web-asset-generator` skill, if installed, to also produce a PNG fallback) — but hand-write the final `currentColor` SVG yourself; a generated raster icon won't recolor with the host theme.

## Worked example

This skill's own manifest, `skill-creator-v2/agents/openai.yaml`:

```yaml
interface:
  display_name: "Skill Creator"
  short_description: "Create, edit, eval, and package agent skills"
  icon_small: "./assets/icon.svg"
  icon_large: "./assets/icon.svg"
  brand_color: "#FFC93C"
  default_prompt: "Use $skill-creator-v2 to create or improve a skill."
```

paired with `skill-creator-v2/assets/icon.svg`.

## Where this fits in the lifecycle

Add these two files right after drafting `SKILL.md` (lifecycle step 3), before the claude.ai compat audit (step 4). The two audits are independent and in either order wouldn't conflict — `quick_validate.py` only ever looks at `SKILL.md`'s frontmatter, so it's blind to `agents/` and `assets/` either way.
