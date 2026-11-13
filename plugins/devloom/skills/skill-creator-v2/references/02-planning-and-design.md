# Planning and design

## Start with use cases

Before writing any code, identify **2–3 concrete use cases** your skill should enable.

A good use-case definition is shaped like this:

```
Use Case: Project Sprint Planning
Trigger: User says "help me plan this sprint" or "create sprint tasks"
Steps:
1. Fetch current project status from Linear (via MCP)
2. Analyze team velocity and capacity
3. Suggest task prioritization
4. Create tasks in Linear with proper labels and estimates
Result: Fully planned sprint with tasks created
```

**Ask yourself:** What does a user want to accomplish? What multi-step workflows does this require? Which tools are needed (built-in or MCP)? What domain knowledge or best practices should be embedded?

## Common skill use-case categories

Anthropic has observed three common categories.

**Category 1 — Document & asset creation.** Creating consistent, high-quality output: documents, presentations, apps, designs, code. Real example: the `frontend-design` skill (also the `docx`, `pptx`, `xlsx`, `pdf` skills). Key techniques: embedded style guides and brand standards, template structures for consistent output, quality checklists before finalizing, and no external tools required (uses Claude's built-in capabilities).

**Category 2 — Workflow automation.** Multi-step processes that benefit from consistent methodology, including coordination across multiple MCP servers. Real example: the `skill-creator` skill. Key techniques: step-by-step workflow with validation gates, templates for common structures, built-in review and improvement suggestions, iterative refinement loops.

**Category 3 — MCP enhancement.** Workflow guidance that enhances the tool access an MCP server provides. Real example: a `sentry-code-review` skill that analyzes and fixes detected bugs in GitHub pull requests using Sentry's error-monitoring data via its MCP server. Key techniques: coordinates multiple MCP calls in sequence, embeds domain expertise, provides context users would otherwise have to specify, and handles common MCP errors.

## Define success criteria

How will you know your skill is working? These are **aspirational targets — rough benchmarks rather than precise thresholds.** Aim for rigor but accept an element of vibes-based assessment; Anthropic is actively developing more robust measurement guidance and tooling.

**Quantitative metrics:**

- **Skill triggers on ~90% of relevant queries.** *Measure:* run 10–20 test queries that should trigger your skill; track how often it loads automatically vs. requires explicit invocation.
- **Completes the workflow in X tool calls.** *Measure:* compare the same task with and without the skill enabled; count tool calls and total tokens consumed.
- **Zero failed API calls per workflow.** *Measure:* monitor MCP server logs during test runs; track retry rates and error codes.

**Qualitative metrics:**

- **Users don't need to prompt Claude about next steps.** *Assess:* note how often you need to redirect or clarify during testing; ask beta users for feedback.
- **Workflows complete without user correction.** *Assess:* run the same request 3–5 times; compare outputs for structural consistency and quality.
- **Consistent results across sessions.** *Assess:* can a new user accomplish the task on the first try with minimal guidance?

## Technical requirements

### File structure

```
your-skill-name/
├── SKILL.md              # Required - main skill file
├── scripts/              # Optional - executable code
│   ├── process_data.py   # Example
│   └── validate.sh       # Example
├── references/           # Optional - documentation
│   ├── api-guide.md      # Example
│   └── examples/         # Example
└── assets/               # Optional - templates, etc.
    └── report-template.md # Example
```

### Critical rules

**SKILL.md naming:** must be exactly `SKILL.md` (case-sensitive). No variations accepted (`SKILL.MD`, `skill.md`, etc.).

**Skill folder naming:** kebab-case only.

- `notion-project-setup` ✅
- `Notion Project Setup` ❌ (no spaces)
- `notion_project_setup` ❌ (no underscores)
- `NotionProjectSetup` ❌ (no capitals)

**No README.md:** don't include a `README.md` inside your skill folder; all documentation goes in `SKILL.md` or `references/`. (When distributing via GitHub you'll still want a *repo-level* README for human users — see Distribution and sharing.)

## YAML frontmatter — the most important part

The YAML frontmatter is how Claude decides whether to load your skill. Get this right.

**Minimal required format:**

```yaml
---
name: your-skill-name
description: What it does. Use when user asks to [specific phrases].
---
```

That's all you need to start.

### Field requirements

**`name`** (required): kebab-case only; no spaces or capitals; should match the folder name.

**`description`** (required): **must include BOTH** what the skill does **and** when to use it (trigger conditions). Under 1024 characters. No XML tags (`<` or `>`). Include specific tasks users might say. Mention file types if relevant.

**`license`** (optional): use if making the skill open source; common choices are MIT, Apache-2.0.

**`compatibility`** (optional): 1–500 characters; indicates environment requirements, e.g. intended product, required system packages, network-access needs.

**`metadata`** (optional): any custom key-value pairs; suggested keys are `author`, `version`, `mcp-server`. Example:

```yaml
metadata:
    author: ProjectHub
    version: 1.0.0
    mcp-server: projecthub
```

### Security restrictions

**Forbidden in frontmatter:** XML angle brackets (`<` `>`); skills with "claude" or "anthropic" in the `name` (reserved). **Why:** frontmatter appears in Claude's system prompt, so malicious content could inject instructions.

## Writing effective skills

### The description field

Per Anthropic's engineering guidance, this metadata provides just enough information for Claude to know when each skill should be used without loading all of it into context — this is the first level of progressive disclosure.

**Structure:**

```
[What it does] + [When to use it] + [Key capabilities]
```

**Good descriptions** (specific, actionable, with trigger phrases):

```
# Good - specific and actionable
description: Analyzes Figma design files and generates developer
handoff documentation. Use when user uploads .fig files, asks for
"design specs", "component documentation", or "design-to-code handoff".

# Good - includes trigger phrases
description: Manages Linear project workflows including sprint planning,
task creation, and status tracking. Use when user mentions "sprint",
"Linear tasks", "project planning", or asks to "create tickets".

# Good - clear value proposition
description: End-to-end customer onboarding workflow for PayFlow. Handles
account creation, payment setup, and subscription management. Use when
user says "onboard new customer", "set up subscription", or "create
PayFlow account".
```

**Bad descriptions:**

```
# Too vague
description: Helps with projects.

# Missing triggers
description: Creates sophisticated multi-page documentation systems.

# Too technical, no user triggers
description: Implements the Project entity model with hierarchical relationships.
```

### Writing the main instructions

After the frontmatter, write the actual instructions in Markdown. Recommended structure (adapt the template; replace bracketed sections):

```markdown
---
name: your-skill
description: [...]
---

# Your Skill Name

## Instructions

### Step 1: [First Major Step]
Clear explanation of what happens.

Example:
\`\`\`bash
python scripts/fetch_data.py --project-id PROJECT_ID
Expected output: [describe what success looks like]
\`\`\`

(Add more steps as needed)

## Examples

### Example 1: [common scenario]
User says: "Set up a new marketing campaign"
Actions:
1. Fetch existing campaigns via MCP
2. Create new campaign with provided parameters
Result: Campaign created with confirmation link

(Add more examples as needed)

## Troubleshooting

### Error: [Common error message]
Cause: [Why it happens]
Solution: [How to fix]

(Add more error cases as needed)
```

## Best practices for instructions

**Be specific and actionable.**

Good:

```
Run `python scripts/validate.py --input {filename}` to check data format.
If validation fails, common issues include:
- Missing required fields (add them to the CSV)
- Invalid date formats (use YYYY-MM-DD)
```

Bad:

```
Validate the data before proceeding.
```

**Include error handling.** Document common failure modes inline, e.g.:

```
## Common Issues

### MCP Connection Failed
If you see "Connection refused":
1. Verify MCP server is running: Check Settings > Extensions
2. Confirm API key is valid
3. Try reconnecting: Settings > Extensions > [Your Service] > Reconnect
```

**Reference bundled resources clearly.** Point Claude at the right file before it acts:

```
Before writing queries, consult `references/api-patterns.md` for:
- Rate limiting guidance
- Pagination patterns
- Error codes and handling
```

**Use progressive disclosure.** Keep `SKILL.md` focused on core instructions; move detailed documentation to `references/` and link to it.
