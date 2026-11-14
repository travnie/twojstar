# Third-party notices

The plugin wrapper and repository integration are ISC-licensed (`LICENSE.txt`). Each skill keeps its own license and attribution below.

## `android-compose`

`SKILL.md`, `references/architecture.md`, `references/widgets-media.md` and the non-recipe parts of `references/gradle-toolchain.md` are original to this skill.

`references/testing.md`, `compose.md`, `performance.md`, the Glance section of `widgets-media.md`, `navigation.md`, `edge-to-edge.md`, `r8.md`, `security.md`, `identity.md`, `cast.md`, `device-ai.md`, `cli.md`, and the "AGP 9 migration recipe" section of `references/gradle-toolchain.md` are derived and condensed from Google LLC [android/skills](https://github.com/android/skills), Apache-2.0, commit `6daa53ef27fa2aa87827d183a85c06cedceca833` (resynced 2026-10-30 from `42dc227`, reviewed at SKILL.md level), via the `android-development` consolidation; merged here 2026-10-04. Modified independent consolidation, not an official Google product. License text: `LICENSE.txt`.

Upstream directory → file: `devtools/android-cli` → cli · `device-ai/appfunctions`, `device-ai/ml-kit-genai-prompt-api` → device-ai · `build-system/agp/agp-9-upgrade` → gradle-toolchain (recipe section) · `jetpack-compose/adaptive`, `jetpack-compose/migration/migrate-xml-views-to-jetpack-compose` → compose (`jetpack-compose/theming/styles` was removed upstream) · `jetpack-compose/jetpack-compose-performance`, `performance/anr-audit-and-fix` → performance · `system/glance-appwidget-updates-and-memory` → widgets-media (Glance section) · `identity/restore-credentials`, `identity/verified-email` → identity · `navigation/navigation-3`, `navigation/navigation-event` → navigation · `media/media3-cast-integration` → cast · `security/android-intent-security`, `security/android-permissions-security` → security · `performance/r8-analyzer` → r8 · `system/edge-to-edge` → edge-to-edge · `testing/testing-setup` → testing.

To refresh: diff those upstream directories against the pinned commit and revise only the affected reference.

Selective Android refresh, 2026-11-14: compared `6daa53e` to `5815d27fda564aa9f07ebdcb5e57ed3e8d904e0d`; incorporated AppFunctions scoped testing, restore-credential fixes, adaptive version routing and Binder UID verification. Other covered diffs were version/sample changes or already reflected in the condensation. Original baseline retained for unrelated references.

## `google-developer-knowledge`

Independent condensed routing and connection diagnosis adapted from the installed Google Developer Knowledge skill and [google/skills](https://github.com/google/skills/tree/67c4dbc8ff6313ef117d938e53bb21315fc281ae/skills/developers) (Google LLC, Apache-2.0); live documentation and upstream catalog linked, not vendored. Apache-2.0 text: `skills/android-compose/LICENSE.txt`.

## `chrome-web`

`references/extensions.md` and `references/webstore.md` are condensed and re-verified (developer.chrome.com, 2026-11) from the `chrome-extensions` skill in Google's **Modern Web Guidance** plugin v0.0.194 (Apache-2.0, license in `LICENSE.txt`). The Playwright test pattern and parts of `scripts/check_mv3.py` follow ideas from **Chrome Extension Builder** 2.3.0 (MIT, Khadin Akbar Ventures LLC); the script itself is original. `SKILL.md` is original. Modified independent consolidation, not an official Google product.

Live source of the web-platform guides: `npx modern-web-guidance@latest` (not bundled).

## Remote MCP servers

Referenced by URL in `mcp.json`, not redistributed: `google-developer` (https://developerknowledge.googleapis.com/mcp).
