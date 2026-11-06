# Edge-to-edge and IME

Inspect each Activity/window, manifest soft-input mode, Compose/View roots, Scaffold, bars, text fields, lists, dialogs and existing inset consumption. Check OS plus target SDK enforcement and use compatible enableEdgeToEdge APIs; do not opt out as the fix.

- Call the appropriate edge-to-edge setup for affected Activities; preserve adjustResize where required for IME inset delivery.
- Trace which ancestor owns system-bar/cutout/IME insets. Apply them once to interactive content while allowing intended backgrounds to draw behind bars.
- For Scaffold content, apply innerPadding and consumeWindowInsets(innerPadding). Determine whether contentWindowInsets already includes IME before adding imePadding. Put IME padding before verticalScroll. Supported inset rulers/fitInside can avoid double application, but verify the Compose version first.
- For lazy lists, use contentPadding rather than padding the whole viewport when content should scroll behind system bars; consume the same insets appropriately for descendants. Keep first/last rows and FABs reachable.
- Activity enableEdgeToEdge handles system icon contrast; if using WindowCompat directly, configure light/dark icon appearance appropriately. For bottom-bar designs, evaluate API-gated navigation-bar contrast enforcement rather than globally disabling it.
- Fullscreen Compose dialogs (`usePlatformDefaultWidth=false` plus fillMaxSize) need compatible decorFitsSystemWindows=false handling and their own content safety insets.
- For Views, use compatible WindowInsets handling and avoid duplicate root/child padding.

Verify gesture and three-button navigation, light/dark, cutouts, landscape, long lists, dialogs, IME opening/closing and large fonts. Screenshot tests without real system UI do not establish edge-to-edge correctness; include available device evidence or state the gap.

Docs: https://developer.android.com/develop/ui/compose/system/insets and https://developer.android.com/develop/ui/views/layout/edge-to-edge .

Source (reviewed snapshot): https://github.com/android/skills/tree/6daa53ef27fa2aa87827d183a85c06cedceca833/system/edge-to-edge
