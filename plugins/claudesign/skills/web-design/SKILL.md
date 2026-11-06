---
name: "web-design"
description: "Design and build websites, landing/pricing pages and app UI that don't look AI-generated: direction, DESIGN.md + tokens, honest copy, responsive build, rendered checks, prioritized reviews. Use for 'make it look good', 'redesign', 'review my site', design systems."
license: MIT
---

# Web design

Decisions on purpose, written down once, checked on a real render. Aesthetic taste (type pairing, bold direction) → also load `frontend-design` when present; this skill adds the system, the page workflow and the review. Usability/a11y depth → `ux-design`. Charts → `dataviz`.

## 1. Read before deciding

Existing CSS vars / Tailwind theme / tokens, fonts, logo, brand colors, built pages, `DESIGN.md`. Brand exists → keep it, build around it. Missing and it matters: audience, feeling (calm / technical / playful / premium), 2-3 sites they like. No examples available → say the direction isn't based on real references.

## 2. DESIGN.md (root) before pages

One decision per line, value + role, light and dark if both exist. Then mirror into code (CSS vars / Tailwind theme) so pages use names, never raw values.

```markdown
# DESIGN.md
## Color      neutral scale (text/bg/border) · primary = actions+links · ≤1 accent · success/warn/error · dark values
## Type       1-2 families · 6-8 step scale with line-heights · weights used · body ≥16px · measure 60-75ch
## Space      one 4/8 scale · section rhythm · content max-width
## Shape      radius scale · ≤2 shadows (or none) · border style
## Components button primary/secondary/quiet (hover/focus/disabled) · link · input · card · nav · footer
## Imagery    one icon set · photo/screenshot/illustration rules
## Motion     durations, easing, reduced-motion behavior
```

Contrast: body text ≥4.5:1, large text and UI parts ≥3:1. Named brand systems (Material 3, Carbon, Polaris, Spectrum, SLDS, Fluent) → their live docs win over this file; fetch, don't recall.

## 3. Anti-slop defaults

Avoid unless the brief asks: purple→blue gradient by habit, glassmorphism everywhere, gradient headline text, everything centered, three identical icon cards, emoji as icons, abstract blob hero, pure #000 on #fff, 4+ font sizes per view, mixed radii, shadows without purpose, Chart.js/Excel default colors.

Do instead: one strong focal point per view; asymmetry on purpose; real product visuals (screenshots, demos) over icons-in-cards; tinted neutrals; tight tracking on display sizes; `tabular-nums` for numbers; whitespace as the separator before borders.

## 4. Page workflow

1. **Facts first.** What it does, for whom, the one action, real prices/quotes/numbers/logos. Never invent testimonials, logos, user counts, ratings, awards — leave a marked placeholder.
2. **Section plan,** each with one job; show it when the page is new. Typical product page: hero (what + for whom + one CTA + real visual) → proof (only if real) → how it works / what you get → pricing → objections FAQ → closing CTA.
3. **Copy.** Specific > impressive ("Find a flat in Berlin without agents"). Buttons say what happens. Ban: seamless, cutting-edge, unlock, elevate, revolutionize, game-changer.
4. **Build.** Tokens only. Mobile first, no horizontal scroll, tap targets ≥44px (WCAG min 24). Semantic HTML: one `h1`, ordered headings, real buttons/links, labels, visible focus, skip link. Images sized + `alt`, hero eager with `fetchpriority="high"`, rest lazy. `prefers-reduced-motion`. Title, meta description, OG image (`web-asset-generator`). Prefer platform features (`<dialog>`, `popover`, container queries) — `chrome-web` for Baseline status.
5. **Check rendered** — next section.

## 5. Check on a real render

Never call a page checked from code alone. Playwright (preinstalled in the cloud sandbox) at 375 / 768 / 1440, light + dark, keyboard-only pass; look at the screenshots yourself. Fix in one batch, re-check, stop when it holds. Report what was checked and what wasn't.

## Reviews

Existing site → `references/review.md` (checklist, severity order, feedback formula). Change nothing until the user picks fixes.

## Where it runs

| | Chat (claude.ai) | Claude Code |
|---|---|---|
| Mockup / poster / screens to look at | Design artifact type (Artifact quickstart) — this skill supplies the decisions | HTML in repo or preview server |
| Site to share | Published HTML artifact | Repo + deploy (`cloudflare`) |
| Rendered check | Playwright in sandbox | Playwright / dev server |

Polish checklist and technique moves: `references/craft.md`.
