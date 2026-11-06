# Accessibility audit

Target **WCAG 2.2 AA** (current W3C Recommendation; WCAG 3 is still a working draft — don't audit against it). EU: European Accessibility Act applies since 2025-06-28 via EN 301 549 (WCAG 2.1 AA baseline) — 2.2 AA covers it. Success-criterion wording: fetch `https://www.w3.org/WAI/WCAG22/quickref/` rather than quoting from memory.

## New in 2.2 (most often missed)

| SC | Level | Check |
|---|---|---|
| 2.4.11 Focus Not Obscured (Min) | AA | Sticky header/footer/cookie bar never fully covers the focused element (`scroll-padding`) |
| 2.5.7 Dragging Movements | AA | Every drag (sort, slider, map) has a click/tap alternative |
| 2.5.8 Target Size (Min) | AA | ≥24×24 CSS px or enough spacing; 44px is the comfortable goal |
| 3.2.6 Consistent Help | A | Help/contact in the same place across pages |
| 3.3.7 Redundant Entry | A | Don't re-ask data already given in the flow (autofill or "same as shipping") |
| 3.3.8 Accessible Authentication (Min) | AA | No puzzle/memory test without alternative; allow paste + password managers; passkeys pass |
| 4.1.1 Parsing | — | Removed in 2.2; don't report it |

## 5-layer process

1. **Automated** — axe-core via Playwright (`@axe-core/playwright`) or Lighthouse. Catches ~30-40%; never the whole audit.
2. **Keyboard** — Tab order logical, everything operable, visible focus, no traps, Esc closes overlays, focus returns to trigger.
3. **Screen reader semantics** — accessible names, roles, states; landmarks; heading outline; live regions for async updates (`role=status` / `aria-live=polite`). Inspect the accessibility tree with Playwright `locator.ariaSnapshot()`.
4. **Visual** — contrast (text 4.5:1, large 3:1, UI/graphics 3:1), 200% zoom and 320px reflow without horizontal scroll, text spacing override, color never the only signal, `prefers-reduced-motion`.
5. **Content & cognition** — plain language, clear errors with recovery, consistent navigation, timeouts warned/extendable.

## Most common failures (fix first)

Per WebAIM Million (check webaim.org/projects/million for current numbers): low contrast text, missing alt text, unlabeled inputs, empty links, empty buttons, missing `lang`, then skipped heading levels, invisible focus, custom widgets without roles/states.

## Fix patterns

- Native first: `<button>`, `<a href>`, `<label for>`, `<dialog>`, `<details>`, `<fieldset>/<legend>` beat ARIA. No ARIA is better than wrong ARIA.
- Icon-only button → `aria-label` (or visually-hidden text); decorative image → `alt=""`.
- Errors → text next to field + `aria-describedby` + `aria-invalid`; summary at top on submit, focus moved there.
- Custom widget → follow the ARIA Authoring Practices pattern (fetch `w3.org/WAI/ARIA/apg/patterns/<name>/`) for keys and roles.

## Report shape

| # | Issue | Where | SC + level | Impact (blocker/serious/moderate/minor) | Fix (code) |

Sort by impact, then level (A before AA). State which layers ran and which didn't (e.g. "no real screen reader test"). Conformance claims only after all layers.
