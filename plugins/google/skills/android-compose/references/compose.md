# Compose migration, adaptive UI and config-change state

## XML / Views migration
Migrate the requested layout; otherwise choose a small low-coupling candidate. Inspect callers, binding, theme tokens, resources, accessibility, state, navigation and lifecycle. Capture a baseline using available screenshots/tests. If rendering is unavailable, continue code work and state the visual verification gap.

Add only compatible Compose/compiler dependencies and minimal theme bridging. Preserve shared XML themes and existing design tokens. Use `ComposeView` with an appropriate composition disposal strategy for Compose in Views; use `AndroidView`/binding for retained Views when necessary. Preserve state, callbacks, focus, semantics and lifecycle. Add a preview. Compare visual output and behavior, replace callers, and remove XML/resources/tests only after checking remaining references and equivalent coverage. Do not convert navigation or the entire app as an incidental requirement.

## Adaptive layouts
Baseline compact/medium/expanded windows, rotation, font scale, keyboard and pointer use. Adapt to available window space and capabilities, not phone/tablet labels alone.

- Preserve navigation visibility behavior while using compatible `NavigationSuiteScaffold` APIs to switch bar/rail. Keep each top-level destination's scroll/app-bar state independent.
- In Navigation 3 apps, prefer Material adaptive `SceneStrategy` for list-detail/supporting-pane relationships. Supply pane metadata and detail placeholders, avoid a redundant back arrow in a visible detail pane, and restore fullscreen behavior on compact windows. Do not force list-detail onto media that needs the space.
- Use adaptive lazy-grid cells for large lazy collections. Evaluate non-lazy Grid, FlexBox and MediaQuery only when supported by the project's dependency versions and stability policy. The reviewed upstream introduces them in Compose 1.11 beta; verify current status and signatures. Do not introduce alpha/beta dependencies solely to satisfy a generic adaptive request.
- Preserve existing Navigation 2/Views architecture unless migration is in scope. Existing adaptive APIs remain possible; Navigation 3 is not a universal prerequisite.
- Run relevant previews/screenshots and behavioral checks. Inspect screenshot diffs before updating baselines; never overwrite them just to get green tests.

## State across configuration changes
Never add `android:configChanges` or `android:screenOrientation` to dodge recreation — it hides state-loss bugs and breaks adaptive resource reloading. Fix the state instead; audit every `remember`, not just `mutableStateOf`:
- User input and interactive UI state (drafts, queries, toggles) → `rememberSaveable`, keyed on the owning ID where relevant. Custom types: `Saver` via `stateSaver =` when the block returns `MutableState<T>` (not `saver =`), or `@Serializable` + `rememberSerializable`.
- Scroll: `remember { LazyListState() }` / `LazyGridState()` / `ScrollState(0)` lose position — use `rememberLazyListState()`, `rememberLazyGridState()`, `rememberLazyStaggeredGridState()`, `rememberScrollState()`.
- Navigation 3 back stacks: follow the current "save and manage navigation state" guide.
- ExoPlayer created in composition: persist position and `playWhenReady` with `rememberSaveable`, update them continuously (listener + periodic loop, not only `onDispose`), restore with `seekTo` before `prepare()`. Better: own the player outside composition (`references/widgets-media.md`).

## Desktop and foldables
Keyboard shortcuts, tooltips, custom pointer icons and tabletop posture are part of the upstream adaptive workflow now; pull the current guide via live docs when the task targets ChromeOS/desktop windows or foldables. Don't add them to a phone-only change.

## Compose Styles
Upstream withdrew its Styles skill (2026-10). `androidx.compose.foundation.style` was alpha; treat any Styles work as live-docs-only and don't introduce it unasked.

Source (reviewed snapshot): https://github.com/android/skills/tree/6daa53ef27fa2aa87827d183a85c06cedceca833/jetpack-compose
