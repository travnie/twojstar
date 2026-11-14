# Android & Chrome (Google Dev) plugin

<img src="assets/icon.svg" width="96" alt="Google Dev">

Google developer platforms with live docs. Replaces the `android` plugin (uninstall it first; same MCP URL, but access depends on the host's connection).

## Components

| Component | What it does |
|---|---|
| MCP `google-developer` | `https://developerknowledge.googleapis.com/mcp` — `search_documents`, `get_documents`, `answer_query` over developer.android.com, developer.chrome.com, web.dev, Firebase, Google Cloud, ai.google.dev, Flutter/Dart, Go, Maps, Workspace |
| Skill `android-compose` | Recon-first Android/Kotlin/Compose: architecture, Gradle/AGP 9, Nav 3, testing, Compose performance, ANRs, R8, security, identity, widgets, Media3/Cast, on-device AI. Builds through CI |
| Skill `chrome-web` | Manifest V3 extensions (runtime traps, permissions, side panel, userScripts), Chrome Web Store publishing, Baseline-aware web platform APIs. `scripts/check_mv3.py` static check + headless Chromium load test |
| Skill `google-developer-knowledge` | Focused document retrieval, OAuth/REST fallback, and on-demand upstream skill discovery |

Cloud operations, gcloud, Storage, and Gemini implementation → [Google Dev Kit](../google-dev-kit/README.md). If not installed, use the relevant live upstream skill via `google-developer-knowledge`; no duplicated Cloud workflows here.

## Surfaces

- **claude.ai chat / Cowork:** skills + the remote MCP. Use Playwright Chromium for extension load tests when available.
- **Claude Code / Codex:** same, plus `npx modern-web-guidance@latest` for Google's curated web guides. Google recommends an API key in the `X-Goog-Api-Key` header for the MCP — set it in the client's MCP config, never in this plugin.

## Upstream

`android-compose` refs: [android/skills](https://github.com/android/skills) (Apache-2.0) at `6daa53e`, selectively refreshed against `5815d27` (2026-11-14). `chrome-web` refs: Google Modern Web Guidance 0.0.194 (Apache-2.0), re-verified 2026-11; Chrome Extension Builder 2.3.0 (MIT) for test ideas. Attribution in each skill's `NOTICE.md`. Not an official Google product.

## twojstar package

Canonical source here is the portable `plugin.json` + `mcp.json` + `skills/`; the Claude Code marketplace entry and the Codex overlay are generated (`plugins/_shared/`).

```sh
python -m pip install -r plugins/_shared/requirements.txt
python plugins/_shared/package_plugin.py plugins/google /tmp/google.zip
```

Claude Code: `/plugin install google@twojstar` (after `/plugin marketplace add travnie/twojstar`).
