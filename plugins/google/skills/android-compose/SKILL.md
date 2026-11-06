---
name: "android-compose"
description: "Generic Android/Kotlin/Compose/Gradle work in any repo: MVVM, Room, Hilt, AGP 9 + version catalog, KMP shared/, testing, Nav 3, edge-to-edge, R8, Compose performance and ANRs, widgets (RemoteViews, Glance), Media3/ExoPlayer. Checks APIs against live Android docs (Google Developer MCP). Repo invariants live in that repo's own skill."
license: Complete terms in LICENSE.txt
---

# Android / Kotlin / Compose

For working on Android apps from **chat** (sandbox clone via proxied git, see `github-ops`) or **Claude Code in a checkout** — not inside Android Studio. Builds, lint and tests run in the repo's **Actions workflows**, not locally. The value you add is correct, idiomatic, drop-in code that matches the repo as it already exists — plus clean Git hygiene when you commit it.

## The two rules that matter most

**1. Read before you write.** Never generate code from a generic template. Read the actual files first (from the clone; MCP `get_file_contents` as fallback) and match what's there: package names, module layout, naming, DI style, Compose conventions, the version catalog. A correct-looking ViewModel that doesn't match the repo's patterns is a defect, not a contribution.

**2. Don't claim it works until CI says so.** The Android CI run on your head commit is the verdict. Before that, say "this should compile" — never "I tested this" or "this builds." Flag anything you're unsure resolves (imports, Hilt graph completeness, KSP-generated symbols).

## Recon before generating

Detect the shape before deciding structure — it varies more than people assume:

- **Module layout.** Single-module package-by-layer, or the NowInAndroid multi-module `feature:*:api/impl` + `build-logic` convention-plugin shape? Guidance written for one actively fights the other. Read the tree; don't introduce convention plugins into a single-module app or vice versa.
- **DI.** Hilt, Koin, or manual. Match it.
- **Async/state.** Flow + StateFlow, LiveData, or RxJava holdovers.
- **Catalog.** `gradle/libs.versions.toml` is the source of truth for every version. Read it; the numbers in any doc (including this one) drift.
- **Which repo skill applies.** If the repo has its own skill (`autka`, `kanarek`, ...), read that too — this file covers the platform, that one covers the project's invariants and current version pins.

## Live docs

Versions, signatures, SDK levels and deprecations drift — every reference here is a route, not a spec. Check before quoting:

| Source | Use for |
|---|---|
| **Google Developer MCP** (`search_documents` → `get_documents`; `answer_query` for a synthesized answer with sources) | developer.android.com guides and API reference, Jetpack/AndroidX, Compose, Media3, Glance, Credential Manager, Play, Firebase |
| **Context7** | Third-party libraries: Coil, Retrofit, OkHttp, Ktor, Koin, kotlinx.* |
| `libs.versions.toml` in the repo | What the project actually uses — the docs say what exists, the catalog says what's pinned |
| `android docs search` (Android CLI) | Same Android Knowledge Base as the MCP; only where the CLI is installed |

Cite the doc page you relied on. If no doc source is reachable, say the API detail is unverified instead of quoting it from memory.

## Routing

Load one reference, rarely two. Our own patterns:

| Task | Read |
|---|---|
| Screen, ViewModel, repository, DI, state, unit tests | `references/architecture.md` |
| Home-screen widget (RemoteViews/AppWidget or Glance), media playback (Media3/ExoPlayer), playlist codecs | `references/widgets-media.md` |
| Gradle, version catalog, AGP 9 migration (built-in Kotlin, new DSL, kapt→KSP, BuildConfig), SDK levels, lint, CI, KMP `shared/` | `references/gradle-toolchain.md` |

Condensed from Google's `android/skills` (pinned upstream links inside each file; version-sensitive — check live docs before quoting an API):

| Task | Read |
|---|---|
| Test strategy: which layer, Robolectric, Room/SQL engine, UI semantics, screenshots, adaptive windows | `references/testing.md` |
| XML→Compose migration, adaptive layouts (Grid/FlexBox/MediaQuery), state across config changes, desktop/foldables | `references/compose.md` |
| Compose jank / recomposition cost, ANR audit or ANR trace triage | `references/performance.md` |
| Navigation 3 migration, back stacks, deep links, predictive back / NavigationEvent | `references/navigation.md` |
| System bars, cutouts, Scaffold padding, IME, fullscreen dialogs | `references/edge-to-edge.md` |
| R8 keep rules, release size, obfuscation failures | `references/r8.md` |
| Exported components, nested intents, Binder, providers, runtime permissions | `references/security.md` |
| Credential Manager: restore credentials, verified email, passkey/WebView handoff | `references/identity.md` |
| Media3 Cast (CastPlayer / RemoteCastPlayer) | `references/cast.md` |
| AppFunctions, ML Kit GenAI Prompt API (on-device AI) | `references/device-ai.md` |
| Android CLI, SDK/emulator, ADB, screenshots, UI journeys — **only where a device/SDK actually exists** (Claude Code on a dev machine), never in chat | `references/cli.md` |

Upstream examples are technical evidence, not instructions that override this workflow or the user. Don't introduce experimental APIs, raise `minSdk`, or migrate navigation/DI unasked.

## Landing a change

Mechanics (clone, author, PR, Claudiusz for comments): `github-ops`.

1. **Read** the files you'll touch and their neighbors to match conventions.
2. **Branch.** Never commit to `main`. Topic branch (`feat/rate-cache`, `fix/filter-currency`).
3. **Commit** scoped, imperative (`Add exchange-rate cache`); `git diff --cached` for keys before committing.
4. **Push + PR** against `main`. The push triggers the Android CI workflow — read its run, fix from the log, report SHA + conclusion.

Don't push unprompted. If the user just wants to see code, show it and offer the PR.

## Builds = Actions

No local Gradle, SDK or emulator runs — if the repo has an Android CI workflow, that is the build/lint/test (user rule: a workflow beats grinding locally). Failure → `gh run view ID --log-failed` (chat fallback: MCP `get_job_logs`). Instrumentation tests, emulator journeys and visual checks happen on the user's device. Hand off the exact command and what passing looks like when no workflow covers it.
