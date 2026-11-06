---
name: "ux-design"
description: "UX beyond visuals: heuristic critique, WCAG 2.2 audits, microcopy, interaction states, user research, JTBD, journey maps, design-system governance. Use for 'is this usable', 'audit accessibility', 'write the error messages', 'plan research'."
license: MIT
---

# UX design

How it works for people, not how it looks (`web-design`). Claude knows Nielsen, UX laws, WCAG and Tufte; this skill fixes the **procedure and output shape** so results are actionable instead of a lecture.

## Route

| Task | Do | Read |
|---|---|---|
| Critique a screen/flow/prototype | Critique procedure below | — |
| Accessibility audit / a11y code review | 5-layer audit, report by impact | `references/accessibility.md` |
| Microcopy: buttons, errors, empty states, onboarding, notifications | Patterns + benchmarks | `references/ux-writing.md` |
| Interaction spec: states, transitions, gestures, latency | States table + thresholds below | — |
| Research plan, interviews, usability test, synthesis, JTBD, journey map, service blueprint, metrics, design ops | Method picker | `references/research-strategy.md` |

## Critique procedure

1. **Context before judging:** user, goal, platform, fidelity (sketch ≠ production — don't nitpick pixels on a wireframe).
2. **5-second scan:** what is it, what do I do, where am I.
3. **Heuristic pass** (Nielsen 10) + only the UX laws that actually bite here (Hick, Fitts, Jakob, proximity, Doherty 400 ms, peak-end; don't cite Miller's 7±2 for menu length).
4. **Task walk:** do the primary task; note every extra step (excise), dead end, unclear label, missing feedback.
5. **States & edges:** empty, loading, error, partial, offline, permission denied, long text, many items, first run.
6. **Report:** findings sorted by severity 4→1 (4 blocks task · 3 major · 2 minor · 1 cosmetic). Each: *what* + *principle* + *user impact* + *specific fix*. End with the top 3 fixes. No "I don't like".

Show the page/flow rendered when possible (Playwright screenshots); say when the critique is from code or description only.

## Interaction essentials

- Every element: default, hover, focus-visible, active, disabled, loading, error, success, empty.
- Latency: <100 ms instant · 100 ms–1 s show result, maybe subtle indicator · 1–10 s progress + cancel · >10 s background it, notify on done. Never >1 s without feedback.
- Destructive → confirm or (better) undo. Drag → non-drag alternative (WCAG 2.5.7). Gestures need a visible equivalent.
- Model non-trivial behavior as a state machine (states × events → next state) before UI.

## Output

Lead with the verdict, then the prioritized list. Templates are optional; a tight table beats a filled form. Deliverables people keep (audit report, research plan) → Docs artifact in chat, Markdown in repo in Claude Code.
