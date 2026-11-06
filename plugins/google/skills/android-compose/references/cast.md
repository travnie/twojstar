# Media3 Cast

Inspect current player/service/UI architecture, custom receiver options and queue behavior. Align all Media3 artifacts to one compatible version; current upstream's unified CastPlayer recipe uses Media3 1.9+. Do not infer that older Media3 had no Cast APIs.

1. Add `media3-cast`, ExoPlayer/session and only the UI artifacts actually used. Register the appropriate options provider under application and INTERNET permission. Preserve custom receiver IDs/options until a verified replacement exists.
2. Prefer unified `CastPlayer` for local/remote playback, owned by `MediaSessionService` or `MediaLibraryService`, and pass it directly to the MediaSession. Use current builder signatures; remove duplicate forwarding logic as migration becomes complete.
3. Use `RemoteCastPlayer` only when remote-only control or existing architecture requires explicit handoff. Transfer playlist, index, position and playback intent; reset ended/TIME_END_OF_SOURCE positions appropriately, stop/clear the old player, prepare the new one and update the session.
4. For Compose use native MediaRouteButton and compatible Media3 player UI. Observe device-info changes and refresh affected video surfaces when local/remote playback changes. For Views use MediaRouteButtonFactory with supported Activity/theme setup and rebind PlayerView when necessary to avoid equality-check stale surfaces.
5. Release controllers, listeners, players and session according to ownership. Preserve service lifecycle and background playback requirements.
6. Remove unused legacy SDK wrappers/dependencies/manifests only after migration and reference checks. Keep working custom options and unrelated layouts.

Verify cast connect/disconnect/reconnect, pause/seek, queue/position handoff, app backgrounding, ended playback, receiver/network errors and remote media accessibility. Report receiver testing unavailable when no Cast device exists; compilation alone is not a Cast test.

Docs: https://developer.android.com/media/media3/cast/create-castplayer and https://developer.android.com/media/media3/cast/customize-castoptions .

Source (reviewed snapshot): https://github.com/android/skills/tree/6daa53ef27fa2aa87827d183a85c06cedceca833/media/media3-cast-integration
