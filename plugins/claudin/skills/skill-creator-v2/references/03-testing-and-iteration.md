# Testing and iteration

Skills can be tested at varying levels of rigor depending on your needs:

- **Manual testing in Claude.ai** — run queries directly and observe behavior. Fast iteration, no setup required.
- **Scripted testing in Claude Code** — automate test cases for repeatable validation across changes.
- **Programmatic testing via the Skills API** — build evaluation suites that run systematically against defined test sets.

Choose the approach that matches your quality requirements and the visibility of your skill. A skill used internally by a small team has different testing needs than one deployed to thousands of enterprise users.

> **Pro tip: iterate on a single task before expanding.** The most effective skill creators iterate on a single challenging task until Claude succeeds, then extract the winning approach into a skill. This leverages Claude's in-context learning and gives faster signal than broad testing. Once you have a working foundation, expand to multiple test cases for coverage.

## Recommended testing approach

Effective skills testing typically covers three areas.

### 1. Triggering tests

**Goal:** ensure your skill loads at the right times.

Test cases: triggers on obvious tasks ✅; triggers on paraphrased requests ✅; does **not** trigger on unrelated topics ❌.

Example test suite:

```
Should trigger:
- "Help me set up a new ProjectHub workspace"
- "I need to create a project in ProjectHub"
- "Initialize a ProjectHub project for Q4 planning"

Should NOT trigger:
- "What's the weather in San Francisco?"
- "Help me write Python code"
- "Create a spreadsheet" (unless ProjectHub skill handles sheets)
```

### 2. Functional tests

**Goal:** verify the skill produces correct outputs.

Test cases: valid outputs generated; API calls succeed; error handling works; edge cases covered.

Example:

```
Test: Create project with 5 tasks
Given: Project name "Q4 Planning", 5 task descriptions
When: Skill executes workflow
Then:
  - Project created in ProjectHub
  - 5 tasks created with correct properties
  - All tasks linked to project
  - No API errors
```

### 3. Performance comparison

**Goal:** prove the skill improves results vs. baseline. Use the metrics from "Define success criteria." A comparison might look like:

```
Without skill:
- User provides instructions each time
- 15 back-and-forth messages
- 3 failed API calls requiring retry
- 12,000 tokens consumed

With skill:
- Automatic workflow execution
- 2 clarifying questions only
- 0 failed API calls
- 6,000 tokens consumed
```

## Using the skill-creator skill

The `skill-creator` skill — available in Claude.ai via the plugin directory or downloadable for Claude Code — can help you build and iterate on skills. If you have an MCP server and know your top 2–3 workflows, you can build and test a functional skill in a single sitting, often in 15–30 minutes.

**Creating skills:** generate skills from natural-language descriptions; produce properly formatted `SKILL.md` with frontmatter; suggest trigger phrases and structure.

**Reviewing skills:** flag common issues (vague descriptions, missing triggers, structural problems); identify potential over/under-triggering risks; suggest test cases based on the skill's stated purpose.

**Iterative improvement:** after using your skill and encountering edge cases or failures, bring those examples back to `skill-creator`. Example: "Use the issues & solution identified in this chat to improve how the skill handles [specific edge case]."

**To use:**

```
"Use the skill-creator skill to help me build a skill for [your use case]"
```

> Note: `skill-creator` helps you design and refine skills but does not execute automated test suites or produce quantitative evaluation results.

## Iteration based on feedback

Skills are living documents. Plan to iterate based on the signals below.

**Under-triggering signals:** the skill doesn't load when it should; users manually enable it; support questions about when to use it. **Solution:** add more detail and nuance to the description — this may include keywords, particularly for technical terms.

**Over-triggering signals:** the skill loads for irrelevant queries; users disable it; confusion about its purpose. **Solution:** add negative triggers; be more specific.

**Execution issues:** inconsistent results; API-call failures; user corrections needed. **Solution:** improve instructions; add error handling.
