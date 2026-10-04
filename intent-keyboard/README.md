# Intent Keyboard

> Working name and early-stage experiment.

A semantic input layer that treats typed text as **intent**, not final copy. Rough, abbreviated or multilingual input can be rendered into cleaner text while preserving protected facts.

```text
raw intent
    ↓
semantic cleanup
    ↓
tone / recipient / language
    ↓
safety checks
    ↓
platform text input
```

Example:

```text
tomorrow maybe 6 not sure yet
```

can become:

```text
I should be there around 6 PM tomorrow, but I am not certain yet.
```

## Current prototype

The shared engine lives in Kotlin Multiplatform `commonMain`; platform input hooks stay native.

- **Android:** real `InputMethodService` IME with a private intent buffer, Raw/Natural/Civilized modes, debounced preview, explicit Render/Revert/Commit and optional translation/tone/recipient settings.
- **Local model:** LiteRT-LM path with a managed Qwen3 0.6B INT4 no-think model or manual `.litertlm` import. The exact runtime version lives in `gradle/libs.versions.toml`.
- **Remote fallback:** optional OpenAI-compatible provider, disabled by default. A ready local model is tried first.
- **iOS/iPadOS:** Keyboard Extension with debounced preview and safe commit/Revert; `RequestsOpenAccess=false`, so the current extension has no remote-provider path.
- **Desktop:** JVM/Swing proof using the same core and an explicit clipboard output boundary; it does not install an input method or global hooks.

See [docs/concept.md](docs/concept.md) for architecture and detailed implementation status.

## Android flow

1. Install the debug APK produced by **Intent keyboard CI**.
2. Install the recommended offline model or import a `.litertlm` model.
3. Enable Intent Keyboard in Android settings.
4. Type into the keyboard-owned draft, choose a render mode, review the preview, then Commit.
5. Configure a remote provider only if local fallback behavior is insufficient.

The keyboard mirrors its owned draft into host composing text. Cursor movement, editor changes and host-side composition loss are treated as ownership boundaries rather than guessed around.

## Rendering and safety

- `MechanicalRenderer` is the deterministic fallback.
- `SemanticPromptCompiler` and `ModelSemanticRenderer` provide the provider-neutral model path.
- Local inference is serialized so one LiteRT-LM engine owns a render at a time; stale previews are cancelled or ignored.
- Every render uses a fresh model conversation, so previous keyboard drafts are not inherited as chat history.
- Exact times, supported currency values, HTTP(S) URLs and quoted/backtick literals receive automatic VERBATIM protection.
- General semantic-lock equivalence is not implemented yet; unsafe rewritten output fails closed instead of being guessed safe.
- Sensitive/password fields bypass semantic buffering.

## Privacy and storage

Local processing is the default and no model is bundled in the APK.

Remote configuration stores enablement, HTTPS base URL and model name as app-private preferences. An optional bearer token is encrypted with Android Keystore-backed AES-GCM and is never read back into the UI, logged or exported. `android:allowBackup="false"` remains enabled.

Runtime diagnostics keep only bounded process-local timing/count data, never draft or completion text.

## Validation

Android host-composition behavior and local-model quality/performance require real-device checks:

- [Android editor matrix](docs/android-editor-matrix.md)
- [Android local benchmark](docs/android-local-benchmark.md)

CI covers the shared pipeline, stale-result rejection and platform-independent safety rules; it does not claim compatibility with every editor/WebView or translation quality on real devices.

## Project layout

```text
intent-keyboard/
├── core/                 shared semantic contracts, locks, prompts and providers
├── platforms/
│   ├── android/          installable Android IME
│   ├── ios/              iOS/iPadOS keyboard extension + host
│   └── desktop/          JVM/Swing companion + clipboard sink
├── docs/
└── gradle/
```

## License

Covered by the repository-level [ISC License](../LICENSE). Downloaded model artifacts retain their upstream licenses; the managed model source/license is linked from the Android setup screen.
