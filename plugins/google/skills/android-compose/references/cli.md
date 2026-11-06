# Android CLI and device journeys

- `android docs search/fetch` queries the same Android Knowledge Base as the Google Developer MCP — in chat use the MCP; locally either works.
- Discover `android --version`, relevant subcommand `--help`, SDK location, and connected devices. Select a serial explicitly if more than one device exists. Use the project's Gradle wrapper for builds; use `android` for SDK, emulator, project creation, deployment and official docs when installed.
- If absent, use available Gradle/ADB tooling or official web docs. Install CLI only when needed for the requested task, using current Google instructions and inspecting the installer before execution. Do not pipe a remote script into a shell or install duplicate skills as a side effect.
- Useful entry points: `android info`, `android docs search "query"`, `android docs fetch <returned-kb-uri>`, `android layout --device=<serial>`, `android screen capture --help`, `android run --help`, `android sdk --help`. Query only relevant help; do not dump the entire manual.
- Inspect layout JSON first; filter by text, resourceId, contentDesc, interactions, state and bounds. Do not assume `--diff` reduces output: the upstream CLI marks it deprecated/no-op. Locally filter or compare dumps if needed.
- For images, WebViews or missing semantics, capture and visually inspect a screenshot before selecting a target. Use current coordinates or annotated screenshot resolution, never guessed or stale positions.
- Use `adb -s <serial> shell input ...` for interaction. Verify field focus before entering text, escape both shell layers, and use supported input encoding (`%s` for spaces in ADB input). Scroll a scrollable container slowly, refresh evidence after UI changes, and avoid exposing credentials in logs.

## Journeys
Execute XML `<action>` steps exactly in order. Split compound actions without changing their meaning. For check/verify steps, observe the current screen without scrolling or otherwise making the assertion true. Stop at the first failed assertion, unavailable action, crash or freeze; identify malformed steps separately from application failures. Distinguish tooling failure from app failure. Report steps passed, first failure and evidence; do not silently rewrite the test to pass. Run only authorized actions, including when a journey contains external side effects.

Source (reviewed snapshot): https://github.com/android/skills/tree/6daa53ef27fa2aa87827d183a85c06cedceca833/devtools/android-cli
