# Home-screen widgets and media playback

Two areas where ordinary Android instincts are wrong, and the failures are crashes or silent regressions rather than compile errors.

## Widgets (RemoteViews / AppWidget)

A widget runs **in the launcher's process via RemoteViews**. Most normal Android code does not apply.

1. **Allowlisted views only.** Widget layouts may use only RemoteViews-approved views. No custom views, no arbitrary `ViewGroup`s. A scrim must be an `ImageView` with a drawable `src`, never a bare `View` — a bare `View` crashes at inflation and surfaces as a `RemoteViewLayout` error in `lintDebug`, which is the only warning you'll get before a user's launcher throws.
2. **No implicit mutable `PendingIntent`.** Illegal on Android 14+. Route clicks through an explicit redirect Activity with a fill-in intent.
3. **Unique `data` URI per action + widget ID.** `FLAG_UPDATE_CURRENT` collapses PendingIntents that differ only in extras, so several widget buttons silently become one. Give each a distinct `data` URI (`myapp://<action>/<widgetId>`) and `FLAG_IMMUTABLE`.
4. **Keep last good.** On a failed or empty fetch, keep the previous items. A widget that blanks on a flaky network is worse than a stale one, and it's the single most common widget bug.
5. **Push, don't poll.** `updatePeriodMillis = 0` and have the service or worker push updates. Polling burns battery for nothing.
6. **No image loader in the widget path.** Coil/Glide's normal machinery doesn't fit RemoteViews' bitmap lifecycle. Use a dedicated small bitmap cache and hand RemoteViews a `Bitmap`.
7. **Gate background refresh** on battery, network, and widget visibility (via `WorkManager` constraints). Those gates are the difference between a widget and a battery complaint.

### Glance widgets (androidx.glance)
Same process model, different footguns. Condensed from upstream `system/glance-appwidget-updates-and-memory` (pinned in `NOTICE.md`); layout templates live in upstream `glance-canonical-layouts` — fetch when building a new widget UI.
- **Bitmap cap.** `system_server` fixes the RemoteViews bitmap budget (~`6 * width * height` bytes of the default display) at boot; unfolding or a resolution switch doesn't raise it. Downsample every image to the widget's `maxWidthDp x maxHeightDp` (`RGB_565`, `ALPHA_8` for masks) and split the cap across distinct images. On targetSdk 37, bitmap-backed `Icon`s count too.
- **Decode once.** `SizeMode.Responsive`/`Exact` call `provideContent` several times per update — decode shared bitmaps in `provideGlance` before it, pass `ImageProvider(bitmap)`.
- **`content://` images** bypass the IPC cap but the launcher decodes them full-size: downsample to `cacheDir`, expose via `FileProvider`, `grantUriPermission` to the home app (`<queries>` for `CATEGORY_HOME`). Never `Uri.fromFile`.
- **State writes don't redraw.** `updateAppWidgetState` only writes DataStore — follow with `update(context, glanceId)` / `updateAll(context)`.
- **`ActionCallback`** needs a public zero-arg constructor (pass data via `ActionParameters.Key`) and an R8 keep for `<init>()`.
- **No foreground service from the receiver** (`ForegroundServiceStartNotAllowedException`): periodic sync via `enqueueUniquePeriodicWork(KEEP)` in `onUpdate`, one-off work from `onReceive`.
- Classic `AppWidgetProvider`: replacing images needs `updateAppWidget`, not `partiallyUpdateAppWidget`.

## Media playback (Media3 / ExoPlayer)

Casting (CastPlayer / RemoteCastPlayer, local↔remote handoff): `references/cast.md`.

- **One engine, one session, in a service.** A single `ExoPlayer` + `MediaSession` inside a `MediaSessionService` with `foregroundServiceType="mediaPlayback"` — this is what keeps playback and the system media notification / lock-screen controls alive with no Activity. Never spin up a second player for a second UI surface.
- **Two client shapes.** A same-process Activity can bind the service directly with a plain `LocalBinder`, skipping the `MediaController`/`SessionToken` round-trip. A **widget cannot hold a live binder** — it must drive playback through service actions (broadcast intents) and receive state back via an explicit widget update from the service.
- **Per-item request headers need a resolver.** Media3's `MediaItem` has no per-item headers field. Keep a URL-keyed header map in the service, repopulated whenever the playlist is set, and wrap `DefaultHttpDataSource` in a `ResolvingDataSource` that injects `User-Agent`/`Referer` per URL. Streams behind geo or hotlink protection need this. Wire the resolver as the player's `MediaSourceFactory`.
- **Any edit path that touches a stream must carry its headers through.** Dropping `userAgent`/`referrer` on an unrelated edit silently kills a stream that worked — a classic regression, and invisible until someone plays that one station.
- **`@UnstableApi` opt-in belongs at file level on the service**, not on the class. File-level means external callers (Activity, widget) don't each need their own opt-in. Keep the service's public surface in your own types and don't leak unstable Media3 types out of it.
- **Permissions:** `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, `POST_NOTIFICATIONS`, `WAKE_LOCK`. Expected, not bloat — don't strip them in a cleanup pass.

## Playlist codecs (M3U and friends)

Keep parse/serialize codecs **pure Kotlin** so they're testable without an emulator.

- M3U attributes live in two places: `#EXTINF` attrs (`tvg-logo`, `group-title`, `user-agent`, `referrer`) **and** `#EXTVLCOPT:http-user-agent=` / `http-referrer=` (also spelled `referer=`) lines. Read both, and serialize **both** forms back out for VLC compatibility.
- Derive a stable `id` from the stream URL (a hash) so re-importing the same playlist doesn't mint new identities and duplicate everything.
