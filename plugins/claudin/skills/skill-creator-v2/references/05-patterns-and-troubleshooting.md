# Patterns and troubleshooting

These patterns emerged from skills created by early adopters and internal teams. They are common approaches that work well, not prescriptive templates.

## Choosing your approach: problem-first vs. tool-first

Think of it like a hardware store. You might walk in with a problem ("I need to fix a kitchen cabinet") and be pointed to the right tools — or you might pick a new drill and ask how to use it for your job. Skills work the same way:

- **Problem-first:** "I need to set up a project workspace" → your skill orchestrates the right MCP calls in the right sequence. Users describe outcomes; the skill handles the tools.
- **Tool-first:** "I have Notion MCP connected" → your skill teaches Claude the optimal workflows and best practices. Users have access; the skill provides expertise.

Most skills lean one direction. Knowing which framing fits your use case helps you choose the right pattern below.

## Pattern 1: Sequential workflow orchestration

**Use when:** users need multi-step processes in a specific order.

```
## Workflow: Onboard New Customer

### Step 1: Create Account
Call MCP tool: `create_customer`
Parameters: name, email, company

### Step 2: Setup Payment
Call MCP tool: `setup_payment_method`
Wait for: payment method verification

### Step 3: Create Subscription
Call MCP tool: `create_subscription`
Parameters: plan_id, customer_id (from Step 1)

### Step 4: Send Welcome Email
Call MCP tool: `send_email`
Template: welcome_email_template
```

**Key techniques:** explicit step ordering, dependencies between steps, validation at each stage, rollback instructions for failures.

## Pattern 2: Multi-MCP coordination

**Use when:** workflows span multiple services.

```
### Phase 1: Design Export (Figma MCP)
1. Export design assets from Figma
2. Generate design specifications
3. Create asset manifest

### Phase 2: Asset Storage (Drive MCP)
1. Create project folder in Drive
2. Upload all assets
3. Generate shareable links

### Phase 3: Task Creation (Linear MCP)
1. Create development tasks
2. Attach asset links to tasks
3. Assign to engineering team

### Phase 4: Notification (Slack MCP)
1. Post handoff summary to #engineering
2. Include asset links and task references
```

**Key techniques:** clear phase separation, data passing between MCPs, validation before moving to the next phase, centralized error handling.

## Pattern 3: Iterative refinement

**Use when:** output quality improves with iteration.

```
## Iterative Report Creation

### Initial Draft
1. Fetch data via MCP
2. Generate first draft report
3. Save to temporary file

### Quality Check
1. Run validation script: `scripts/check_report.py`
2. Identify issues:
   - Missing sections
   - Inconsistent formatting
   - Data validation errors

### Refinement Loop
1. Address each identified issue
2. Regenerate affected sections
3. Re-validate
4. Repeat until quality threshold met

### Finalization
1. Apply final formatting
2. Generate summary
3. Save final version
```

**Key techniques:** explicit quality criteria, iterative improvement, validation scripts, knowing when to stop iterating.

## Pattern 4: Context-aware tool selection

**Use when:** same outcome, different tools depending on context.

```
## Smart File Storage

### Decision Tree
1. Check file type and size
2. Determine best storage location:
   - Large files (>10MB): Use cloud storage MCP
   - Collaborative docs: Use Notion/Docs MCP
   - Code files: Use GitHub MCP
   - Temporary files: Use local storage

### Execute Storage
Based on decision:
- Call appropriate MCP tool
- Apply service-specific metadata
- Generate access link

### Provide Context to User
Explain why that storage was chosen
```

**Key techniques:** clear decision criteria, fallback options, transparency about choices.

## Pattern 5: Domain-specific intelligence

**Use when:** your skill adds specialized knowledge beyond tool access.

```
## Payment Processing with Compliance

### Before Processing (Compliance Check)
1. Fetch transaction details via MCP
2. Apply compliance rules:
   - Check sanctions lists
   - Verify jurisdiction allowances
   - Assess risk level
3. Document compliance decision

### Processing
IF compliance passed:
  - Call payment processing MCP tool
  - Apply appropriate fraud checks
  - Process transaction
ELSE:
  - Flag for review
  - Create compliance case

### Audit Trail
- Log all compliance checks
- Record processing decisions
- Generate audit report
```

**Key techniques:** domain expertise embedded in logic, compliance before action, comprehensive documentation, clear governance.

---

# Troubleshooting

## Skill won't upload

**Error: "Could not find SKILL.md in uploaded folder."** Cause: file not named exactly `SKILL.md`. Solution: rename to `SKILL.md` (case-sensitive); verify with `ls -la`.

**Error: "Invalid frontmatter."** Cause: YAML formatting issue. Common mistakes:

```
# Wrong - missing delimiters
name: my-skill
description: Does things

# Wrong - unclosed quotes
name: my-skill
description: "Does things

# Correct
---
name: my-skill
description: Does things
---
```

**Error: "Invalid skill name."** Cause: name has spaces or capitals.

```
# Wrong
name: My Cool Skill

# Correct
name: my-cool-skill
```

## Skill doesn't trigger

**Symptom:** skill never loads automatically. **Fix:** revise your description field (see "The description field" for good/bad examples).

Quick checklist: Is it too generic? ("Helps with projects" won't work.) Does it include trigger phrases users would actually say? Does it mention relevant file types if applicable?

**Debugging approach:** ask Claude "When would you use the [skill name] skill?" Claude will quote the description back; adjust based on what's missing.

## Skill triggers too often

**Symptom:** skill loads for unrelated queries.

**1. Add negative triggers:**

```
description: Advanced data analysis for CSV files. Use for statistical
modeling, regression, clustering. Do NOT use for simple data exploration
(use data-viz skill instead).
```

**2. Be more specific:**

```
# Too broad
description: Processes documents

# More specific
description: Processes PDF legal documents for contract review
```

**3. Clarify scope:**

```
description: PayFlow payment processing for e-commerce. Use specifically
for online payment workflows, not for general financial queries.
```

## MCP connection issues

**Symptom:** skill loads but MCP calls fail. Checklist:

1. **Verify MCP server is connected** — Claude.ai: Settings → Extensions → [Your Service]; should show "Connected" status.
2. **Check authentication** — API keys valid and not expired; proper permissions/scopes granted; OAuth tokens refreshed.
3. **Test MCP independently** — ask Claude to call the MCP directly (without the skill): "Use [Service] MCP to fetch my projects." If this fails, the issue is the MCP, not the skill.
4. **Verify tool names** — skill references correct MCP tool names; check MCP server documentation; tool names are case-sensitive.

## Instructions not followed

**Symptom:** skill loads but Claude doesn't follow instructions. Common causes:

1. **Instructions too verbose** — keep instructions concise; use bullet points and numbered lists; move detailed reference to separate files.
2. **Instructions buried** — put critical instructions at the top; use `## Important` or `## Critical` headers; repeat key points if needed.
3. **Ambiguous language:**

```
# Bad
Make sure to validate things properly

# Good
CRITICAL: Before calling create_project, verify:
- Project name is non-empty
- At least one team member assigned
- Start date is not in the past
```

   **Advanced technique:** for critical validations, consider bundling a script that performs the checks programmatically rather than relying on language instructions. Code is deterministic; language interpretation isn't. (See the Office skills — `docx`, `pptx`, `xlsx`, `pdf` — for examples of this pattern.)

4. **Model "laziness"** — add explicit encouragement:

```
## Performance Notes
- Take your time to do this thoroughly
- Quality is more important than speed
- Do not skip validation steps
```

   Note: adding this to *user prompts* is more effective than putting it in `SKILL.md`.

## Large context issues

**Symptom:** skill seems slow or responses degraded. Causes: skill content too large; too many skills enabled simultaneously; all content loaded instead of using progressive disclosure. Solutions:

1. **Optimize SKILL.md size** — move detailed docs to `references/`; link to references instead of inlining; keep `SKILL.md` under ~5,000 words.
2. **Reduce enabled skills** — evaluate if you have more than ~20–50 skills enabled simultaneously; recommend selective enablement; consider skill "packs" for related capabilities.
