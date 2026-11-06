# Site / page review

See it rendered first (Playwright 375/768/1440, light+dark, keyboard). Can't render → review code and say the result wasn't seen.

## Checklist

| Area | Look for |
|---|---|
| Message | Hero doesn't say what + for whom; >1 primary action; CTA below the fold on phone |
| Generic look | Default gradients, glass everywhere, all centered, identical feature cards, emoji icons, stock art that says nothing |
| Consistency | Values off DESIGN.md/tokens; one-off styles; several button styles for one job; mixed icon sets |
| Copy | Vague claims, filler, invented proof, "Submit"/"Learn more" everywhere, jargon |
| Layout | Horizontal scroll, uneven rhythm, lines >75ch, broken mobile nav, false floor (no scroll cue) |
| Feedback | No loading/success/error states, silent actions, >1 s without feedback |
| Accessibility | Contrast <4.5:1, missing alt/labels, heading order, no focus ring, color-only meaning, targets <24px |
| Speed | Huge images, CLS while loading, FOIT, heavy JS for small effects — measure via Lighthouse/PSI, not guess |
| Basics | Title, meta description, OG image, favicon, 404, dead links |

## Order findings by cost to visitors

1. **Must fix** — blocks a task, breaks a11y, hides what the site is.
2. **Should fix** — generic, inconsistent, unfinished.
3. **Nice** — polish.

Keep real problems apart from taste. Severity scale for usability issues (Nielsen): 4 catastrophe (blocks task) · 3 major · 2 minor · 1 cosmetic.

## Feedback formula

**What's wrong** + **principle it breaks** + **why it matters to the user** + **concrete fix in the site's own style**.

> Nav shows 12 top-level items (Hick's law) — scanning takes too long on mobile. Group into 5 with a "More" disclosure.

Not: "I don't like the nav" / "make it pop". Then ask which items to fix.
