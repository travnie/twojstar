# Navigation 3 and predictive back

## Navigation 3
Inventory routes, arguments, graphs, deep links, tab stacks, results, auth gates and entry lifecycles. Migrate string-based routes to type-safe models as needed before replacing Navigation 2. Check current migration docs and library versions; do not equate a renamed NavHost with completed migration.

Use serializable `NavKey` destinations, an owned/saveable back stack, `NavDisplay` and an entry provider. Pass stable IDs and typed arguments rather than large mutable objects. Configure entry-scoped saved state/ViewModels with the compatible decorators; test config changes and process recreation (current guide: "Save and manage navigation state" for Navigation 3, including multiple back stacks).

Preserve each tab's history, selected destination and root/back policy. Validate deep-link scheme/host/path and arguments; construct a synthetic stack where appropriate and preserve authentication gates. Use explicit state/events for returning results. Choose matching recipes for dialogs, bottom sheets, animation, custom Scenes, Material list-detail/supporting panes and Hilt/Koin modular entry registration; fetch only that recipe from upstream. Navigation 3's built-in back behavior is the default.

## NavigationEvent for custom Compose interception
Use low-level handlers only when built-in navigation does not cover the requested behavior. Verify dependency/SDK requirements (reviewed upstream compileSdk 36+) and predictive-back manifest behavior across target SDKs.

- Use the built-in `ComponentActivity` dispatcher owner; do not override it with a recursive delegate. Dialogs/sheets backed by ComponentDialog provide their own owner.
- For tabs/pages/nested containers, create linked child owners using `rememberNavigationEventDispatcherOwner(enabled = isSelected)` and scope them to the subtree. Hidden pages must not intercept back.
- Bind each `NavigationEventState` to exactly one active `NavigationBackHandler`. Put conditional behavior inside that handler rather than registering duplicates.
- Handle progress, cancellation and completion; commit navigation only on completion. Preserve unsaved-work behavior.
- Compose handles disposal. For manually managed dispatchers/handlers, remove handlers and dispose owned dispatchers at teardown.

Verify system/hardware back, cancelled gestures, dialogs, tab switching, root exit, deep links and restored state. Primary docs: https://developer.android.com/guide/navigation/navigation-3 and https://developer.android.com/guide/navigation/navigation-event .

Source (reviewed snapshot): https://github.com/android/skills/tree/6daa53ef27fa2aa87827d183a85c06cedceca833/navigation
