# Android & Chrome (Google Dev) plugin

<img src="assets/icon.svg" width="96" alt="Google Dev">

Google developer platforms with live docs. Replaces the `android` plugin (uninstall it first; same MCP URL, so the existing Google Developer connector and sign-in are reused).

## Components

| Component | What it does |
|---|---|
| MCP `google-developer` | `https://developerknowledge.googleapis.com/mcp` — `search_documents`, `get_documents`, `answer_query` over developer.android.com, developer.chrome.com, web.dev, Firebase, Google Cloud, ai.google.dev, Flutter/Dart, Go, Maps, Workspace |
| Skill `android-compose` | Recon-first Android/Kotlin/Compose: architecture, Gradle/AGP 9, Nav 3, testing, Compose performance, ANRs, R8, security, identity, widgets, Media3/Cast, on-device AI. Builds through CI |
| Skill `chrome-web` | Manifest V3 extensions (runtime traps, permissions, side panel, userScripts), Chrome Web Store publishing, Baseline-aware web platform APIs. `scripts/check_mv3.py` static check + headless Chromium load test |

Other Google products (Firebase, Cloud, Gemini API, Maps) need no skill: query the MCP directly.

## Surfaces

- **claude.ai chat / Cowork:** skills + the remote MCP. The cloud sandbox has Playwright Chromium for extension load tests.
- **Claude Code / Codex:** same, plus `npx modern-web-guidance@latest` for Google's curated web guides. Google recommends an API key in the `X-Goog-Api-Key` header for the MCP — set it in the client's MCP config, never in this plugin.

## Upstream

`android-compose` refs: [android/skills](https://github.com/android/skills) (Apache-2.0) at `6daa53e`. `chrome-web` refs: Google Modern Web Guidance 0.0.194 (Apache-2.0), re-verified 2026-11; Chrome Extension Builder 2.3.0 (MIT) for test ideas. Attribution in each skill's `NOTICE.md`. Not an official Google product.

## twojstar package

Canonical source here is the portable `plugin.json` + `mcp.json` + `skills/`; the Claude Code marketplace entry and the Codex overlay are generated (`plugins/_shared/`).

```sh
python -m pip install -r plugins/_shared/requirements.txt
python plugins/_shared/package_plugin.py plugins/google /tmp/google-2.1.1.zip
```

Claude Code: `/plugin install google@twojstar` (after `/plugin marketplace add travnie/twojstar`).
