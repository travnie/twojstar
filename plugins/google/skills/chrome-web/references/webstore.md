# Chrome Web Store publishing

Policies change; confirm against developer.chrome.com/docs/webstore (program policies, "What's new") via the Google Developer MCP before quoting limits.

## CHROMEWEBSTORE.md (project root, not shipped in the ZIP)

One copy-paste source for the dashboard. Create it when publishing is on the table; update when manifest permissions, data handling, UI or version change.

```markdown
# Chrome Web Store — <name>   (Last updated: <date>)
## Listing
- Name (= manifest `name`):
- Short description (≤132 chars, = manifest `description`):
- Category / Language:
- Single purpose (one sentence, dashboard only):
- Detailed description (plain text, no markdown rendering):
## Graphics
| Asset | Size | File |  — store icon 128×128 PNG (req), screenshots 1280×800 (or 640×400) full-bleed, 1–5 (≥1 req), small promo 440×280, marquee 1400×560
## Permissions justification
| permission / host | why, in user terms |
## Privacy
| data type (PII, auth, location, web history, user activity, website content, communications, health, financial) | collected? | leaves device? | purpose | shared? |
- Privacy policy URL (live, public, matches the table)
## Version history
| version | date | changes | status |
## Rejection log
| date | policy cited | fix | resubmitted |
```

## Copy rules

- Lead with function: "Highlights search terms on any page and saves them to a local list", not "Makes browsing easier".
- No implementation words (MutationObserver, service worker, chrome.storage, React) — translate to benefit ("works on pages that load content as you scroll").
- No superlatives, keyword stuffing, other brands in the name ("YouTube Downloader" = trademark rejection), fake status claims ("Editor's Choice").
- Detailed description shape: one-line summary → FEATURES (• bullets) → HOW TO USE → PRIVACY → PERMISSIONS (explain install warnings) → SUPPORT (contact required).

## Top rejection causes → fix

| Cause | Fix |
|---|---|
| Excess permissions / unused leftovers | Drop unused; `activeTab` or optional permissions; narrow host patterns instead of `<all_urls>` |
| Vague single purpose | One narrow sentence; split unrelated features into separate extensions |
| Functionality ≠ description | Remove unbuilt features from copy |
| Privacy policy missing / unreachable / mismatched | Public URL, no login wall, same data as the disclosure form |
| Disclosure mismatch | Audit every `fetch`, analytics, error reporting; `storage.sync` counts as off-device (Google servers) |
| Remote code | Bundle all JS; JSON fetch OK, script fetch not |
| Obfuscation | Minify only; don't ship source maps |

## Package

Version must be greater than the published one. ZIP only what Chrome loads (build output dir with `manifest.json` at its root):

```bash
cd dist && zip -r ../ext-v$(node -p "require('./manifest.json').version").zip . \
  -x '*.map' '.DS_Store' '*.test.*'
```

Exclude `.git`, `node_modules`, `.env`, configs, tests, `CHROMEWEBSTORE.md`, README, store assets. Run `scripts/check_mv3.py` on the exact directory you zip.

## Review

Usually 1–3 business days for new items, faster for updates; deferred publishing lets the user publish manually after approval (window limited — check current docs). Appeals go through the Developer Dashboard. Publishing itself is the user's action: prepare everything, don't submit for them.
