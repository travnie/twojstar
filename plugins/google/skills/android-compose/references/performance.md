# Compose performance and ANRs

Condensed from Google's `android/skills` `jetpack-compose/jetpack-compose-performance` and `performance/anr-audit-and-fix` (pinned in `NOTICE.md`). Upstream ships per-category reference files with approved fix patterns — fetch the matching one before editing code, not just this summary.

## Before tuning Compose
Measure release builds only (debuggable ART is not representative), with R8 on and Baseline Profiles for critical journeys. Verify with benchmarks or traces; recomposition counts alone are not a result.

## Compose audit — the checks that matter
- **Defer state reads** to layout/draw: lambda modifiers (`offset { }`, `graphicsLayer { }`), lambda providers (`() -> Float`) to children. Never write state after it was read in the same pass (backwards write → loops, first-frame pop).
- **`remember` costs slots.** Key on every input it reads; don't wrap a value only to overwrite it immediately. `derivedStateOf` for real derivations (on Compose 1.13+ `computedStateOf` for cheap conditions on fast inputs); plain getters for trivial expressions. Replace `produceState` + `snapshotFlow` over Compose state with synchronous derivation.
- **Stability isn't the goal.** Strong Skipping already skips unstable params. Don't add `@Stable`/`@Immutable`/`ImmutableList` to models with collections (O(N) equals per pass); remove existing ones only for large lazy-list feeds. Make composables cheap instead of forcing skips.
- **Lazy lists:** primitive `key` **and** `contentType` on every item; `itemsIndexed` instead of `indexOf`; selection as `Set`/map in state with `isSelected: () -> Boolean`; resolve `CompositionLocal`s and collect Flows once in the parent; small bounded lists → plain `Column`/`Row`. No `LaunchedEffect` impressions in items (prefetch fires them) — `Modifier.onVisibilityChanged` with a dwell threshold.
- **Layout:** avoid `onGloballyPositioned` (`onPlaced`/`onLayoutRectChanged`/`onVisibilityChanged`), `BoxWithConstraints`/`SubcomposeLayout` in hot paths, deep intrinsic chains, decorative wrapper `Box`es. Floating content anchored via a custom `Layout`, not tracked coordinates.
- **Effects:** no side effects in the body; `SideEffect` (keys only on 1.12+) instead of non-suspending `LaunchedEffect` or empty `DisposableEffect`; `rememberUpdatedState` in long-running effects; `collectAsStateWithLifecycle()` for producing Flows; blocking I/O to `Dispatchers.IO`; `delay()` over `Handler.postDelayed`.
- **Drawing:** `drawWithCache` for `Path`/`Paint`/`Brush`; `Path.rewind()` in hot loops; Coil `AsyncImage` for network images; primitive collections over `Pair`/boxed sets.
- **Custom modifiers:** migrate `Modifier.composed` to `ModifierNodeElement` + `Modifier.Node`.
Scan all categories before reporting; don't stop at the first hit.

## ANR
- **Static audit:** list candidates, then *prove* the executing thread (trace callers) and *prove* the call blocks before reporting; list dismissed candidates with a one-line reason. Off-main mutation of an attached View is also a sync-barrier-leak ANR risk, not only a crash.
- **Trace triage:** findings strictly from the dump. Propose app fixes only for app defects or app resource overload, never for external bottlenecks (system, other processes).
