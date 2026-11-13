# Claudesign

<img src="assets/icon.svg" width="96" alt="Claudesign">

One design plugin instead of four (design-skills, Website Design, frontend-design, Naming).

| Skill | Covers |
|---|---|
| `web-design` | Direction from the project and references, `DESIGN.md` + tokens, anti-slop defaults, landing/pricing page workflow with honest copy, Playwright checks at 375/768/1440, prioritized site reviews, craft pass |
| `ux-design` | Heuristic critique procedure with severity, WCAG 2.2 AA audit (5 layers, 2.2 deltas, EAA note), UX writing patterns and benchmarks, interaction states and latency thresholds, research/JTBD/journey/service blueprint/design-system governance picker |
| `naming` | Unchanged v7: metaphor territories, phonosemantics, availability checks, Polish/Portuguese language notes |

Not bundled on purpose: aesthetic direction lives in the built-in `frontend-design` skill; charts in `dataviz`; brand-system token dumps (Carbon, Polaris, Spectrum, SLDS) — their live docs are fetched instead.

## Surfaces

- **claude.ai chat:** all three skills. Visual deliverables go to the Design artifact type, shareable sites to published HTML artifacts; the sandbox renders with Playwright.
- **Claude Code / Codex:** same skills; files go to the repo.

Optional, not configured: UXKIN MCP (`https://uxkin.com/mcp`, paid) for design systems scraped from real sites — add it yourself if wanted.

Sources and licenses: each skill's `NOTICE.md` / `LICENSE.txt`.

## twojstar package

Canonical source here is the portable `plugin.json` + `mcp.json` + `skills/`; the Claude Code marketplace entry and the Codex overlay are generated (`plugins/_shared/`).

```sh
python -m pip install -r plugins/_shared/requirements.txt
python plugins/_shared/package_plugin.py plugins/claudesign /tmp/claudesign-1.0.3.zip
```

Claude Code: `/plugin install claudesign@twojstar` (after `/plugin marketplace add travnie/twojstar`).
