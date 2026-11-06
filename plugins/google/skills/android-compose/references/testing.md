# Android test setup

Inventory existing JUnit version, DI/fakes/mocks, Robolectric, Compose/Views, screenshot tools, source sets, device tests and CI before adding dependencies. Preserve the stack; do not install DI, coverage, mocking and every test framework merely because tests were requested.

Choose the smallest useful layer:
- Pure business logic: JVM tests with fakes and controlled dispatchers/clocks; preserve JUnit4/5 conventions. Mock only when a useful fake/seam is impractical.
- Android host behavior: Robolectric where it fits. Compose/Espresso tests can run in test with supported Robolectric setup; device tests live in androidTest.
- Instrumented DI: use the existing framework's runner/rules and test compiler configurations (for example Hilt runner, HiltAndroidRule and kspAndroidTest).
- SQLite/Room/SQLDelight: verify important queries/migrations against the actual relevant engine, using in-memory device databases where required.
- UI behavior: prefer semantic matchers; use test tags when semantics cannot identify the element clearly. Cover state changes, actions, restoration and relevant back/deep-link/tab flows.
- Screenshots: test meaningful compact/medium/expanded windows, theme/font scale and important states. For systematic adaptive coverage, upstream suggests widths 400/610/900 dp crossed with heights 400/500/1000 dp plus font scale 1.5. Use targeted cases for narrow changes.
- Compose Preview screenshots: select the setup supported by the installed AGP. Reviewed upstream adds testOptions screenshot test suites at AGP 9.5.0-alpha03; older projects use their compatible standalone plugin. Verify current docs, never combine both in one module, and do not upgrade AGP solely for screenshots.
- System UI/journeys: a small set of real device/emulator tests with UI Automator when crossing app boundaries; use existing device screenshot tools (e.g. Dropshots) if appropriate.

Keep external services deterministic using fakes. Inspect screenshot diffs before accepting baselines. Discover actual tasks and execute the relevant suite; compile-only and dry-run results are not passed tests. Add coverage only when requested or required by the repository. Document repeatable commands in the existing project documentation rather than creating parallel instructions.

Docs: https://developer.android.com/training/testing and https://developer.android.com/studio/preview/compose-screenshot-testing .

Source (reviewed snapshot): https://github.com/android/skills/tree/6daa53ef27fa2aa87827d183a85c06cedceca833/testing/testing-setup
