# Auto Declip quality corpus

This directory contains the host-independent quality harness for Auto Declip. It complements, rather than replaces, the Audacity host/latency checks in `../AutoDeclipHostLatencyFixture.py`.

## Corpus

The measured corpus uses eight 10-second excerpts from the EBU Sound Quality Assessment Material (SQAM): castanets, organ, harpsichord, English female and male speech, trumpet, piano, and orchestra. Exact source track numbers and excerpt offsets are in `corpus.json`.

The source audio is not committed. Each excerpt is converted to uncompressed PCM WAV, peak-normalized to `0.90`, then receives deterministic two-sample full-scale clipping at 2–8 separated, naturally high-level, same-polarity peaks. Across the eight excerpts this produces 39 repair events.

`benchmark.py prepare` writes the normalized clean reference, damaged fixture, linear baseline, cubic-Hermite baseline, and event metadata. `AutoDeclipQualityRunner` renders either the declip core alone or the default VST3 DSP pipeline (`declip -> de-click -> de-hum`, `Denoise` Off) directly from the maintained C++ DSP sources.

## Metrics

`benchmark.py score` reports normalized RMSE in the injected clipping samples, RMSE in a small context window around each event, improvement in dB relative to the damaged fixture, and the maximum absolute change outside all evaluation windows.

The corpus is diagnostic. It is deliberately not tuned to make Auto Declip look good, and the checked-in result should be updated when the repair algorithm changes.

## Recorded comparison

The 2026-09-16 run is stored in `results.json`. The comparison used the current Auto Declip sources at `f940fe4`, deterministic linear and cubic-Hermite baselines, and Audacity Clip Fix 2.3.0-2 semantics with `Threshold=95%` and `Gain=0 dB`.

Mean per-recording improvement in the injected samples was:

| Method | Improvement vs damaged |
| --- | ---: |
| Linear interpolation | +21.22 dB |
| Cubic Hermite | +28.00 dB |
| Auto Declip core | +8.26 dB |
| Auto Declip default pipeline | +9.17 dB |
| Audacity Clip Fix 2.3.0-2 | +23.69 dB |

The default pipeline intentionally also runs de-click and de-hum, so it is not expected to be sample-identical outside the injected clipping windows. For apples-to-apples declipping quality, compare `autodeclip_core` with the interpolation and Clip Fix baselines.

This run exposes a real quality gap: the current conservative Auto Declip core improves the injected damage, but trails Clip Fix and the interpolation baselines on most of this corpus. Corpus coverage and baseline comparison are therefore complete, while closing that gap remains a separate stability gate.

## Reproduce

1. Obtain EBU SQAM and extract the tracks listed in `corpus.json`.
2. Convert the listed 10-second excerpts to PCM16 WAV, for example with ffmpeg.
3. Run `python benchmark.py prepare <excerpt.wav> <prepared-dir>` for each excerpt.
4. Build `AutoDeclipQualityRunner` with the normal CMake test build and render both `core` and `pipeline` outputs from each `damaged.wav`.
5. For the Clip Fix comparison, process the same damaged WAV with Audacity Clip Fix 2.3.0-2 at `95%` threshold and `0 dB` gain, or use an independently implemented source-equivalent adapter.
6. Run `python benchmark.py score <prepared-dir> --autodeclip <core.wav> --clipfix <clipfix.wav> --json`; pipeline output can be scored under an additional method through the Python API.

The repository intentionally does not copy Audacity's GPL Clip Fix implementation. The recorded comparison used a temporary local source-equivalent adapter outside the repository. Audacity's experimental `mod-script-pipe` is also not part of this benchmark; host behavior is covered separately.