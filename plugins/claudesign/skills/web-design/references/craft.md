# Craft pass

Run before delivering any visual (page, artifact, deck, doc). Silent: apply, don't narrate.

## Interrogate defaults

- Focal point clear within 2 s? Hierarchy survives a squint?
- Max 3 hierarchy levels, built from size + weight + spacing, not size alone.
- Each font, color, radius chosen or defaulted? Defaulted → decide.
- Grid underneath? Alignment intentional? Spacing encodes relationships (closer = related)?
- Every element earning its space? Remove one thing and check.
- Similar things identical; variations follow a rule.

## Moves that read as designed

| Want | Move |
|---|---|
| Intentional | near-black text (#111–#1a1a1a, tinted), off-white bg, one radius scale, one spacing scale |
| Premium | generous section padding, display tracking −1 to −2%, colored low-opacity shadows, hairline borders |
| Clean | whitespace instead of borders, 2-3 sizes per view, single accent, muted secondary text instead of smaller text |
| Modern | larger type contrast (display vs body ≥2.5×), restrained motion 150-250 ms ease-out, real product imagery |
| Data clear | title states the finding, direct labels over legends, gray non-focus series, bars start at 0, no 3D/dual axes, source line |

## Typography

Body 16-18px, line-height 1.5-1.7, measure 60-75ch. Headings line-height 1.1-1.25. Real quotes/apostrophes, `text-wrap: balance` for headings, `pretty` for paragraphs. Fallback font metrics matched (`size-adjust`) to avoid layout shift.

## Color

60/30/10 neutral/secondary/accent. Neutrals with slight temperature. Color carries meaning, never alone (pair with icon/text). Dark mode: not inverted — raise surfaces with lighter tints, desaturate accents, re-check contrast.

## Motion

Purposeful only (feedback, continuity, orientation). Entry 200-300 ms, exit faster. Respect `prefers-reduced-motion`. View Transitions / scroll-driven animations for platform-native motion (Baseline check via `chrome-web`).

## States (every interactive element)

default · hover · focus-visible · active · disabled · loading · empty · error · success. Missing state = unfinished.
