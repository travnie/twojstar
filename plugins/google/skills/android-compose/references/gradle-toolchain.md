# Gradle, toolchain, SDK levels

## Version catalog discipline

- Versions live in `gradle/libs.versions.toml` and are referenced as `libs.*`. Never hardcode a version in a module `build.gradle.kts`.
- **Kotlin, AGP, KSP, Hilt and the Compose compiler plugin are a matched set.** Bump one and you must check the others; mismatches break the build in ways invisible from chat. When unsure of a compatible version, read the repo's catalog or look it up — do not guess.
- Treat a major-version jump (Coil 2→3, Retrofit 2→3, okhttp 4→5) as a **deliberate migration** with its own PR, not a routine catalog bump. Retrofit and okhttp must move together or the Dependabot pair lands mismatched.

## AGP 9 and the road to 10

- `android.kotlinOptions { jvmTarget = ... }` was **removed in AGP 9**. Compiler options go in a top-level `kotlin { compilerOptions { jvmTarget = JvmTarget.JVM_17 } }` block (import `org.jetbrains.kotlin.gradle.dsl.JvmTarget`). Don't reintroduce `kotlinOptions`.
- The legacy escape hatch is slated for **complete removal in AGP 10**; the top-level `kotlin {}` block is the forward-compatible form, so migrating now costs nothing later.
- **Built-in Kotlin:** if a project opts out with `android.builtInKotlin=false`, it must **also** set `android.newDsl=false`. Setting only one is the classic failure — first the `kotlin.android` plugin is rejected, then you get "Compose Compiler Gradle plugin is required," because AGP 9 doesn't auto-supply it when built-in Kotlin is off. With built-in Kotlin off, apply `kotlin.android` and `org.jetbrains.kotlin.plugin.compose` explicitly.
- **Hilt vs Kotlin metadata:** Hilt's aggregating step reads Kotlin metadata through a bundled reader that lags the compiler. On a fresh Kotlin bump you may need a `resolutionStrategy.force` on `org.jetbrains.kotlin:kotlin-metadata-jvm` matching your Kotlin version, until Hilt ships a newer reader. If Hilt suddenly fails on classes it compiled fine yesterday, this is why.
- **JDK 17 is a deliberate ceiling** for Android compile targets, not a lag. Don't "upgrade" it as housekeeping.

## AGP 9 migration recipe (from android/skills)

Scope this recipe to Android-only modules. For KMP modules see the `shared/` section below — keep shared targets intact; do not apply this Android-only recipe blindly.

1. Inventory AGP, wrapper, JDK, Kotlin, KSP, Hilt, convention plugins/buildSrc, catalogs, custom variants, kapt processors and screenshot plugins. Read the target release's compatibility table before choosing versions. Use the Upgrade Assistant if available; a requested manual migration can proceed without making the user run Studio first.
2. Migrate Android modules to built-in Kotlin: remove redundant `org.jetbrains.kotlin.android` application there, move compiler configuration as documented, and preserve plugins needed by other module types. Align Compose compiler and Kotlin versions.
3. Migrate legacy AGP extension/variant APIs to public `com.android.build.api.dsl` and `androidComponents` APIs; inspect included builds and convention plugins, not just app Gradle files.
4. Replace kapt processors with KSP only when the actual processor supports it; inspect documented support or the jar's `META-INF/services/com.google.devtools.ksp.processing.SymbolProcessorProvider`. For unsupported processors, use compatible `com.android.legacy-kapt`, not Kotlin kapt with built-in Kotlin. Verify KSP/Hilt compatibility (upstream reviewed KSP 2.3.6 / Hilt 2.59.2 — read the repo catalog for current pins).
5. For custom BuildConfig fields, enable `buildFeatures.buildConfig`, migrate variant field APIs, and preserve literal quotes in String field values.
6. Remove temporary opt-outs such as `android.builtInKotlin`, `android.newDsl`, `android.uniquePackageNames`, `android.enableAppCompileTimeRClass` only when the corresponding migration is complete. Do not mask failures with `android.disallowKotlinSourceSets=false`.
7. Run wrapper `help`, relevant task graph/dry-run, then actual affected compilation and tests. A dry-run does not prove compilation. Verify IDE sync only if Studio is accessible. Avoid `clean` unless stale artifacts are demonstrated. Check Paparazzi compatibility if used.

Primary docs: https://developer.android.com/build/releases/agp-9-0-0-release-notes and https://developer.android.com/build/migrate-to-built-in-kotlin . Fetch target-version release notes for newer AGP.

Source (reviewed snapshot): https://github.com/android/skills/tree/6daa53ef27fa2aa87827d183a85c06cedceca833/build-system/agp/agp-9-upgrade

## SDK levels and Play deadlines

- `compileSdk` should be current; `targetSdk` is the one with an external clock. **Google Play requires targetSdk 36 (Android 16) for all new apps and updates from 2026-08-31.** Below that the app stops being discoverable to users on newer Android versions; existing installs keep working.
- A `targetSdk` bump is a one-line change but not a no-op — read the behaviour-changes page for the target level before merging, since some changes apply only once you target it.
- `minSdk` is a product decision; raising it is the cheapest way to delete compatibility branches, so check whether the code still guards for versions below it.

## Lint

- A `lint-baseline.xml` grandfathers existing warnings while keeping errors enforced. Regenerate it verbatim with `:app:updateLintBaseline` — **never hand-edit it to silence a real error**, which is the whole failure mode a baseline invites.
- Widget layout problems (`RemoteViewLayout`) surface only in lint, so a repo that skips `lintDebug` in CI ships widget crashes.

## CI as the compiler

The typical Android CI job runs `lintDebug assembleDebug testDebugUnitTest`. That run — its conclusion and commit SHA — is the only evidence a change compiles. Report it; don't substitute your own confidence for it.

## Kotlin Multiplatform `shared/` modules

Both repo apps (autka, kanarek) now carry a KMP `:shared` module. The shape that works on AGP 9:

- Plugins `org.jetbrains.kotlin.multiplatform` + **`com.android.kotlin.multiplatform.library`** (the AGP-9 KMP library plugin — not `com.android.library`). Android config goes in `kotlin { android { namespace; compileSdk; minSdk; withHostTestBuilder {} } }`, not a top-level `android {}`.
- Host tests are `androidHostTest` (task `:shared:testAndroidHostTest`); common tests use `kotlin.test` in `commonTest`.
- iOS targets (`iosArm64`, `iosSimulatorArm64`, maybe `iosX64`) compile only on macOS — in CI that's a separate `macos-*` workflow (`:shared:iosSimulatorArm64Test`, XCFramework assembly). Nothing iOS can be verified from chat or the Linux sandbox.
- `commonMain` must not import `android.*`, `androidx.*`, or `java.*`; platform bits go through `expect`/`actual`. A leak passes Android CI and only fails the iOS job — so a `shared/**` change needs **both** workflows green.
- Put pure logic (models, parsers, codecs, math, UI state) in `commonMain`; keep Room/Retrofit/Hilt/Compose/Media3 wiring in `app`.
