# Audacity VST3

Cross-platform VST3 **audio effects** aimed first at Audacity and usable in other compatible hosts.

## Auto Declip 0.1

The first released effect is intentionally conservative. Its repair pipeline handles short full-scale clipping plateaus, isolated single-sample impulse clicks, and narrow mains hum without pretending that severely missing audio can be recovered by a magic button.

Current detector/repair rules:

- clipping threshold: `|sample| >= 0.995`,
- repair only consecutive runs of **2–32 samples**,
- the declipping stage preserves isolated full-scale samples unless the de-click stage sees strong smooth-context evidence for a one-sample impulse,
- de-click requires two smooth context samples on each side and leaves multi-sample transients alone,
- longer clipping is preserved for a future stronger restoration stage,
- de-hum uses narrow Q=35 notches at 50/60 Hz plus 100/120 and 150/180 Hz harmonics,
- de-hum adds no algorithmic latency and resets its filter state after a non-finite sample,
- audio outside the narrow repair bands remains effectively transparent; broadband `Denoise` is exported as an explicit VST3 on/off parameter and defaults to **Off**,
- repaired runs are reconstructed with bounded cubic Hermite interpolation using clean edge values and slopes,
- output is capped just below full scale,
- fixed **66-sample pipeline latency** (64 declip + 2 de-click), reported to the VST3 host,
- mono and stereo, 32-bit and 64-bit floating-point processing,
- fixed memory only in the audio path; no allocations, files, network or model loading.

### De-noise core prototype

`DeNoiseDsp` is a separate conservative broadband downward expander for low-level stationary noise. It uses fixed-memory envelope/gain smoothing, has no algorithmic latency, never hard-mutes the floor, and resets safely after non-finite input. It is wired behind the explicit `Denoise` VST3 parameter, defaults to **Off**, and the selected state is stored with the host project/preset. Quiet ambience and reverb tails are therefore not altered unless the user enables broadband repair.

### Audacity host validation

On **Audacity 4.0**, Travny Auto Declip passes the current host-validation matrix: plug-in scanning/discovery succeeds, the effect loads, Audacity's fallback/generated parameter UI exposes `Denoise`, the toggle starts **Off** and can be switched **On**, Apply succeeds, and Audacity remains responsive afterward. The dedicated VST3 state round-trip regression also passes, confirming that the serialized `Denoise` state survives component/controller save-and-restore.

Reopening the destructive effect creates a fresh effect instance, so seeing `Denoise` return to its default **Off** state in a newly opened effect window is expected host lifecycle behavior. It is not evidence that VST3 state serialization failed.

On **Audacity 3.7.9 for Windows x64**, an end-to-end Apply → Export check verifies host latency compensation at 48 kHz. A 512-frame mono fixture remained exactly 512 frames with best correlation lag `0` (`corr=0.998620`) while its clipping plateau was repaired. A deliberately hostile **48-frame** selection, shorter than the plug-in's reported 66-sample latency and containing its own four-sample clipping plateau, also remained exactly 48 frames with best lag `0` (`corr=0.999272`) and repaired the plateau. This rules out the characteristic uncompensated 66-sample leading delay / end truncation for those measured host cases.

`tests/AutoDeclipHostLatencyFixture.py` generates and verifies both fixtures without third-party Python packages. For the recorded run, Audacity used a 48 kHz mono project, the complete imported track was selected, `Travny Auto Declip` was applied once, and the processed selection was exported as uncompressed mono PCM24 WAV. The verifier accepts only uncompressed mono PCM16/24/32 WAV and requires identical frame count and rate. The 512-frame case searches timing displacement through ±80 samples; the 48-frame case can correlate only through ±23 samples, so it additionally relies on exact output length, non-silent energy, zero-lag correlation and a repaired plateau to reject the characteristic output of an uncompensated 66-sample delay. The tested plug-in binary SHA-256 was `BD6CFFB103E157EBAACB12E8DEB79AF40E1E049DD7D8FF70EA26B5E0788A143D`.

```text
long-in.wav   C69691548DEEB994A18256F8BAA40E3FBFF174D50FC46E76EC97AEA108BCF328
long-out.wav  BF4E996831038DE22E2AEA6DA749DCD207CF9D87786F72BF34CF5E63765BFE04
short-in.wav  5437641D201B92568E248FFB30CB289B9EB6837F66C6232493F0816B0009CD36
short-out.wav 2DFBC22C7350AD15CF24E246514ECF2B5936604444901451C46F3F4335A5C986
```

Generate `long` or `short`, apply Auto Declip with the settings above, then run `verify <kind> <input.wav> <output.wav>`. The measured result is specifically the Audacity 3.7.9 host path; the separate Audacity 4.0 scan/load/Apply validation is not presented as an equivalent latency measurement.

## Smart Transition 0.1 prototype

Smart Transition is the first implementation from the [`../smart-edit/`](../smart-edit/) track. It targets the little click/thump/level jump left after a cut or join.

The prototype is deliberately deterministic DSP first:

- 100 ms bounded lookahead, clamped to 1024–8192 samples,
- mono/stereo shared seam detection without signed cross-channel cancellation,
- block-partition-independent candidate ordering and score quantization,
- short local DC and level matching,
- a bounded S-curve/Hermite bridge around the accepted seam,
- one high-confidence seam per VST3 processing run,
- exact same-format determinism tests across arbitrary input chunking,
- no allocation, network, model loading or background helper in the audio path.

The effect currently uses conservative fixed defaults while the host contract is being validated. The planned `Mode`, `Max transition`, `Strength` and `Repair` host parameters are still required before calling 0.1 release-ready.

### Why it is not in Latest yet

CI builds and packages `TravnySmartTransition.vst3` for Windows and Linux as an **experimental workflow artifact**, but the repository-wide rolling **Latest** release intentionally does not publish it yet.

Generic VST3 `ProcessData` does not provide a portable end-of-selection marker. The host-independent DSP core can finalize a late seam and shrink context for a short selection when its caller invokes `drainFrame()`, but the current VST3 adapter does not capture such a boundary and only calls `processFrame()`. End-of-selection behavior therefore remains a release gate even though the validated Audacity fixture below produces the expected output.

Windows host validation on **Audacity 3.7.9** now passes discovery, Preview, Apply, Undo, cancellation, and host responsiveness. An 80-frame stereo fixture at 48 kHz with its seam at frame 40 was processed end-to-end: Apply preserved all 80 output frames and repaired the seam, validating Audacity's observed output for this specific case. Preview → Stop → Cancel left no Smart Transition undo entry, and the next Apply produced byte-identical PCM to the earlier Apply, confirming state reset and deterministic reprocessing for the same fixture.

Audacity 4.0 has not yet been claimed as equivalent Smart Transition processing validation here. Any 4.0 scan/discovery evidence should be treated as host recognition only until Preview/Apply behavior and the end-of-selection contract are explicitly exercised there.

Before promotion, the adapter or host test harness must explicitly exercise end-of-selection handling for late seams and short selections, different real host block sizes must produce the same plan/output contract, and the planned `Mode`, `Max transition`, `Strength`, and `Repair` parameters remain required for 0.1. Until those gates pass, the workflow ZIP stays a development artifact rather than a supported release.

## Released packages

Ready-to-copy Auto Declip packages are published in the repository-wide GitHub **Latest** release:

- [Windows x64](https://github.com/travnie/twojstar/releases/latest/download/audacity-auto-declip-windows.zip)
- [Linux x64](https://github.com/travnie/twojstar/releases/latest/download/audacity-auto-declip-linux.zip)

Each archive contains the `TravnyAutoDeclip.vst3` bundle plus a tiny `INSTALL.txt`. On Windows x64, copy the `.vst3` bundle to `C:\Program Files\Common Files\VST3`; on Linux, use your standard VST3 plug-in directory. Then rescan effects in Audacity. The repository does not install a background helper and the plug-ins perform no runtime downloads.

## Layout

```text
vst3/
├── CMakeLists.txt
├── src/autodeclip/
│   ├── AutoDeclipDsp.*
│   ├── AutoDeclipProcessor.*
│   └── ... VST3 adapter files
├── src/smarttransition/
│   ├── SmartTransitionDsp.*
│   ├── SmartTransitionProcessor.*
│   └── ... VST3 adapter files
└── tests/
    ├── AutoDeclipDspTests.cpp
    └── SmartTransitionDspTests.cpp
```

Both DSP cores are independent of the VST3 SDK so they can be unit-tested on Windows and Linux without the host adapter.

## Build the DSP tests only

No third-party SDK is needed:

```bash
cmake -S plugins/audacity/vst3 -B plugins/audacity/vst3/build -DBUILD_TESTING=ON
cmake --build plugins/audacity/vst3/build --config Release
ctest --test-dir plugins/audacity/vst3/build -C Release --output-on-failure
```

## Build the VST3 effects

Use a separately reviewed Steinberg VST3 SDK 3.8+ checkout. The repository does **not** download or execute an SDK at configure time.

```bash
cmake -S plugins/audacity/vst3 -B plugins/audacity/vst3/build-sdk \
  -DVST3_SDK_ROOT=/path/to/vst3sdk \
  -DBUILD_TESTING=ON \
  -DSMTG_CREATE_PLUGIN_LINK=OFF
cmake --build plugins/audacity/vst3/build-sdk --config Release \
  --target TravnyAutoDeclip TravnySmartTransition
```

CI pins Steinberg VST3 SDK **3.8.0** by commit and checks its submodules recursively on both Windows and Linux. VSTGUI and SDK examples are disabled because neither effect needs them.

## Product rules

- **Format:** VST3 audio effect.
- **Language:** C++20.
- **Build:** CMake is the source of truth.
- **Targets:** Windows x64 and Linux x64 first; macOS can follow without redesigning DSP.
- **Runtime:** local/offline, deterministic, no telemetry/login/background service/runtime download.
- **UI:** host parameters first; custom GUI only when an effect genuinely needs one.
- **Performance:** bounded memory and real-time-safe processing where applicable.

## Before calling Auto Declip stable

Current release gates:

- [x] Steinberg VST3 validator passes on the packaged bundle on Windows and Linux.
- [x] Audacity 4 scans and loads the effect; fallback UI exposes `Denoise`, and VST3 state round-trip is covered.
- [x] Audacity 3.7.9 host latency compensation is verified end to end at 48 kHz, including a 48-frame clipped selection shorter than the reported 66-sample latency; the reproducible fixture/checker is in `tests/AutoDeclipHostLatencyFixture.py`.
- [x] Mono/stereo and 32/64-bit processor paths are covered.
- [x] A clipping run crossing a process-block boundary renders identically to the same signal in one block.
- [x] A strongly hard-limited fixture below the clip threshold passes through unchanged.
- [x] A generated clipping fixture verifies that cubic repair cuts reference error by at least 98%.
- [x] A broader real-recording corpus is covered with eight 10-second EBU SQAM excerpts and 39 deterministic clipping events; methodology and results live in 	ests/quality/.
- [x] Repair quality is compared against Audacity Clip Fix 2.3.0-2 plus deterministic linear and cubic-Hermite baselines.
- [x] Close the declip-core repair-quality gap: cubic Hermite improves injected damage by +28.00 dB on average, versus +23.69 dB for Clip Fix on the recorded corpus.
- [ ] Bound the default pipeline quality impact before calling Auto Declip stable: declip -> de-click -> de-hum reaches +17.84 dB on the same injected-region metric and intentionally changes samples outside the clipping windows.

Steinberg's sample `audiohost` is not used as a CI gate: in SDK 3.8 it depends on JACK and is interactive. Neural declipping is a later stage, not a branding sticker glued over an interpolation function.
