# Research, strategy, mapping, ops

Pick the lightest method that answers the actual decision. State the decision first: "We need to know X to decide Y."

## Method picker

| Question | Method | Size / effort |
|---|---|---|
| What problems do people have? (generative) | Interviews, contextual inquiry, diary study | 5-8 per segment |
| Can people use this? (evaluative) | Moderated usability test, think-aloud | 5 per round, iterate |
| Which version performs better? | A/B test, first-click test | Needs real traffic / sample-size calc |
| How do people group/label things? | Card sort (open → closed), tree test | 15-30 participants |
| How many / how much? | Survey, analytics, logs | Survey ≥100 for rough %; never for "would you use" |
| What do competitors do? | Competitive teardown (task-based, same scenarios) | 3-5 products |
| Why do people "hire" the product? | JTBD switch interviews | 8-12 recent switchers |

Bias guards: ask about past behavior, not future intent; no leading questions; separate observation from interpretation; one researcher's synthesis gets a second pass.

## Interview guide skeleton

Warm-up (role/context) → last time they did the task (story, step by step) → pains, workarounds, tools → what "better" would mean → wrap ("anything I should have asked?"). Probes: "Tell me more", "Why was that?", "What did you do next?". 45-60 min.

## Usability test plan

Goal · participants (screener) · 3-5 realistic tasks with success criteria · metrics (task success, time, errors, SEQ/SUS) · script · consent · note-taking grid. Report: findings by severity with clips/quotes, not just percentages.

## Synthesis

Atomic notes → affinity clusters → insights ("people X because Y, which means Z") → opportunities (How might we…) → prioritized by impact × confidence × effort. Keep evidence links.

## Strategy frames

- **JTBD:** "When [situation], I want to [motivation], so I can [outcome]." Forces: push, pull, anxiety, habit.
- **Opportunity Solution Tree** (Torres): outcome → opportunities → solutions → assumption tests.
- **Value proposition:** jobs / pains / gains ↔ products / pain relievers / gain creators.
- **Metrics:** HEART (happiness, engagement, adoption, retention, task success) with goal → signal → metric.

## Maps (pick one)

| Map | Shows | Use when |
|---|---|---|
| Customer journey map | one persona, stages, actions, thoughts, emotions, pain points, opportunities | Aligning a team on current experience |
| Service blueprint | journey + frontstage + backstage + support processes, line of visibility | Fixing operations behind the UI |
| Experience map | generic human experience, product-agnostic | Early discovery |
| Empathy map | says / thinks / does / feels | Quick persona alignment |
| User flow | screens + decisions for one task | Before wireframes |

Render maps/flows as a diagram (Whiteboard artifact or Mermaid in chat; Mermaid/Markdown in repo).

## Design systems governance

Tokens tiered: primitive (blue-500) → semantic (color-action-primary) → component (button-bg). Component spec: anatomy, variants, states, props, a11y, do/don't, content rules. Contribution: propose → review → build → document → release with changelog + semver; deprecate with a migration path. Audit: inventory duplicates (buttons, colors, spacing) and consolidate.

## Design ops

Handoff = tokens + specs + states + edge cases + a11y notes + content, not just a picture. Design QA against the built UI before release. Sprints: map → sketch → decide → prototype → test (5 users).
