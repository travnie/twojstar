# File Workbench: research and direction

Status: exploration / design notes, not an implementation commitment (2026-11-07).

Docbench is already a **local-first document and PDF studio**. Expand that
existing application into a general-purpose file workbench rather than creating
a parallel app, forked editor, or second file library. Preserve the current
document fidelity rules and browser-only file handling. "Bench" may also mean
**measured comparisons of file engines**, not just a collection of tools.

## Desired experience

- Open a local file without uploading it. Detect type using magic/signatures,
  structure and extension, with confidence and warnings on disagreement.
- Common inspector for name, size, MIME/container/codec, checksums, properties,
  timestamps, encoding, color/audio properties, and format-specific metadata.
- Open an archive as a tree without extracting everything where the format
  permits. Preview selected nested entries with **existing** Docbench PDF,
  document and text viewers or the new image/audio viewers.
- Inspect, selectively extract, extract all, create and update archives where
  the engine supports it; expose format, level, method and encryption options
  conditionally rather than promising unsupported combinations.
- Support browser-native formats and modern alternatives, not merely historic
  JPEG/MP3/ZIP defaults. Missing browser decode must not mean missing metadata.
- Keep Save as/download and the existing writable File System Access path where
  available; handle Android's more limited picker/storage APIs explicitly.
- Optional offline/portable use; no mandatory backend, accounts or cloud sync.

### Format exploration matrix

These are **investigation targets**, not a claim of existing implementation.
Track each format separately as detect / metadata / preview or playback /
extract / encode or pack / encrypted support / tested browsers.

- **Archives/containers**
  - First: ZIP/ZIP64 (AES and non-Deflate methods), 7z, RAR/RAR5, TAR,
    gzip, bzip2, xz and zstd.
  - Later: multi-volume, solid and password-protected archives; CAB,
    ISO/UDF, AR/CPIO, WIM/DMG and read-only disk image exploration.
- **Images**
  - First: JPEG, PNG/APNG, GIF, WebP, AVIF, SVG, BMP, TIFF and ICO.
  - Later: **JPEG XL (JXL)**, HEIF/HEIC, QOI, animated/multipage images,
    camera RAW; color profiles and orientation.
- **Audio**
  - First: **MP3 and Opus** (Ogg Opus / WebM Opus), Vorbis, FLAC,
    WAV/PCM, AAC/M4A and AIFF.
  - Later: ALAC, WavPack, additional supported codecs, waveforms,
    spectrograms and album art.
- **Existing documents**
  - First: TXT, Markdown, JSON-family, YAML/XML, PDF, DOCX and currently
    supported configs/playlists.
  - Later: route archive entries into current preview/editing tools;
    preserve existing fidelity guarantees.
- **Metadata**
  - First: hashes, signatures, MIME, timestamps, EXIF, XMP, IPTC, ICC,
    ID3, Vorbis comments and container/codec data.
  - Later: compare embedded versus filesystem metadata; report unknown
    fields; display privacy-sensitive GPS explicitly.

"Supports Opus" must distinguish container from codec; likewise JPEG XL
preview may need WASM even when a browser understands JPEG. Do not conflate
**detection**, **decoding**, **rendering**, **encoding** and **lossless metadata
extraction**. Native API support varies across Chrome, Firefox, Safari and
Android.

## Proposed architecture

**Data plane:** user browser, local `File`/`Blob`/streams, Web Workers and
on-demand WebAssembly. **Docbench file operations stay browser-only: files are
not uploaded.** Cloudflare Worker serves the UI/assets and narrow API endpoints
that do not receive file contents; its memory/CPU quota is not a browser
processing limit. A server-only conversion would require a separate, explicitly
approved future product change with visible upload consent, retention/deletion
policy and matching updates to the local-first contract here and in the
[ChatGPT file viewer plan](CHATGPT_PLUGIN.md). R2/Containers are **not**
authorized or in scope for this workbench implementation.

**UI plane:** current Docbench UI until a measured prototype justifies change.
Share the existing Bench workspace infrastructure, not Worker security
boundaries. Use lazy loading so opening a TXT does not download an audio codec
or every archive engine.

**Common capabilities (proposal, not a directory specification):**

- File detection and input abstraction: sniffed format, capabilities and
  confidence; support random-access range reads and streaming where possible.
- Preview registry: `canPreview`, `preview`, `inspectMetadata`, optional
  `listEntries`, `extractEntry`, `createArchive`; abort/progress/error
  results, memory budget, clear unsupported reasons.
- Nested archive entries represented as virtual files, handed back to the same
  registry. Avoid full extraction just to show a table of contents.
- Central metadata schema with source/provenance and format-specific extensions.
  Calculate expensive hashes only on demand.
- Decode/transform in a Web Worker; consider OPFS for explicitly temporary,
  potentially large output. Define cleanup, cancel, quota/failure behavior.
  Never assume OPFS can write directly to the user's Downloads directory.
- Keep resource limits per operation (bytes, expanded size, ratio, entry count,
  depth, CPU-ish elapsed time); validate archive paths and links; prevent
  Zip Slip, bombs and unbounded allocations. Display truncated/unsupported
  results accurately, never as successful complete extraction.

Cloudflare deployment constraints to monitor: Worker isolates have tight RAM
and CPU budgets; per-asset size limits also matter for large WASM binaries.
The current project serves static assets through its Worker, uses a restrictive
CSP, vendors browser dependencies and builds `public/portable.html`. Test all
changes against **both** normal and portable output before adding codecs,
workers or headers. See [Workers limits](https://developers.cloudflare.com/workers/platform/limits/).

## Candidate engines (evaluate, do not install all)

| Job | Candidate | Why investigate / caveat |
| --- | --- | --- |
| Existing PDF split ZIP | [fflate](https://github.com/101arrowz/fflate) | Already used. Keep for its current task until benchmarks justify replacing it. |
| General ZIP read/write | [zip.js](https://github.com/gildas-lormeau/zip.js) | Streaming, ZIP64, split archives, encryption, custom compression engines; compare output size, compatibility and cost against fflate. |
| Broad archive reading | [exav-unpack](https://www.exav.org/unpack/) / [WASM API](https://www.exav.org/unpack/wasm/) | Rust, file/Blob streaming, archive and nested container inspection with explicit safety budgets; **beta**, verify real formats, memory and provenance. |
| Broad archive alternative | [Filing](https://github.com/xlianghang/filing), [libarchivejs](https://github.com/nika-begiashvili/libarchivejs) | libarchive/WASM; benchmark actual entry-level access, passwords, streaming, release history and licensing. |
| 7z-specific OPFS | [un7z-opfs](https://github.com/caiiiycuk/un7z-opfs) | Web Worker writes decompressed 7z entries directly to OPFS. **7z only; input resides in WASM memory; Chromium-oriented tests; LGPL/unRAR restrictions**. |
| Image codecs | [jSquash](https://github.com/jamsinclair/jSquash) | WASM modules including JXL, AVIF, QOI, WebP, JPEG; load only required codec. |
| Image codec fork | [ckellet/jSquash](https://github.com/ckellet/jSquash) | Investigate claimed SIMD/memory/ICC improvements. Fork is **not** automatically more current or safer than upstream. |
| Rich image engine | [wasm-vips](https://github.com/kleisauke/wasm-vips) | libvips pipelines; early development, WASM SIMD/exception handling and **COOP/COEP + SharedArrayBuffer** requirements can affect Docbench deployment. |
| HEIF and properties | libheif WASM builds; [exifr](https://github.com/MikeKovarik/exifr) | Verify HEIC/HEIF support, patent/licensing/build size; exifr for EXIF/XMP-style metadata, not full image rendering. |
| Media container tooling | [Mediabunny](https://mediabunny.dev/) | Browser-native TypeScript/WebCodecs-driven MP4, WebM/Matroska, MP3, WAV, Ogg, FLAC, AAC etc.; inspect tracks, metadata, extraction and later conversion. Actual codec availability is browser-dependent. |
| Deep media inspection | [MediaInfo.js](https://github.com/buzz/mediainfo.js), [music-metadata](https://github.com/Borewit/music-metadata) | Compare technical format/container details, ID3/Vorbis tags and art; no need to decode everything to inspect it. |
| Heavy conversion fallback | [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) | Optional, heavyweight and device-sensitive; not the default just to play Opus/MP3. |

Check upstream activity, maintained forks, releases, licenses (including codecs
and transitive native code), integrity and reproducibility of WASM builds,
security advisories, payload weight, CSP/isolation requirements and actual
mobile compatibility before selecting any engine. **Do not claim multi-format
packing or encrypted RAR/7z writing based only on reading support.**

## UI and language experiments

TypeScript is **not** a product requirement. Keep current TS/JS integration
where it works; use Rust or C/C++ compiled to WASM for specialized parsers or
codecs. Python, Dart and Swift are exploratory alternatives, not drop-in
Worker runtimes for arbitrary native libraries.

[Jaspr](https://jaspr.site/) is a serious Dart option: real HTML/DOM/CSS,
component model, static generation and server rendering. It was used for the
official Dart/Flutter site migration
([Flutter account, 2026](https://flutter.dev/blog/we-rebuilt-flutters-websites-with-dart-and-jaspr)).
A **static Jaspr client build** can be served through Workers Static Assets;
that does not imply Dart SSR runs directly in the normal Worker. JavaScript
interop can wrap existing PDF/file engines, but bridging, bundle cost and WASM
startup must be measured. Prototype one file-tree/inspector view, **not** a
whole-app rewrite. Compare with the current UI and incremental Web Components
(Lit), Svelte or Solid only when a concrete UI problem warrants change.

## The other meaning of "Bench": engine bake-off

A Bench is a useful tool **and** a place to validate competing implementations.
Run reproducible comparisons before dependency migrations; publish measured
results and trade-offs, not synthetic winners. Reuse a common test convention
across Codebench, Docbench and Streambench **only if there is actual overlap**.

First comparison set:

1. ZIP: current fflate vs zip.js (create, list, selective extraction, ZIP64,
   encryption, output compatibility).
2. Archive readers: exav vs libarchive-based choices vs 7z-specific path
   (format coverage, solid archives, passwords, memory, nested previews).
3. Images: native decode vs jSquash/JXL vs wasm-vips (load, memory, ICC,
   animated and very large files, output fidelity).
4. Media: native playback/metadata vs Mediabunny vs MediaInfo.js /
   music-metadata; Ogg Opus, WebM Opus, FLAC, AAC, artwork.
5. UI prototype: current approach vs Jaspr (bundle weight, startup, mobile
   responsiveness, keyboard accessibility, JS/WASM interoperability).

**Protocol:** pin exact versions/commit SHAs; capture hardware, browser and
settings; repeat cold/warm runs; track bytes downloaded, startup, wall time,
throughput, peak memory where measurable, output hashes or correctness,
cancellation, file handle leaks and failures. Include tiny/large and
compressed/incompressible inputs; UTF-8/unicode and hostile filenames; corrupt,
truncated, malicious, multi-volume and encrypted archives; deep nesting and
expansion bombs under bounded tests; phone memory pressure (Android) and
desktop Chrome/Firefox/Safari as available. Include legal, redistributable
fixtures. Mark untested platforms honestly. Benchmarking must not block normal
file operations or send user data to analytics.

## Practical sequencing

1. **Research/corpus first:** current dependency audit, capability matrix,
   licenses and small reproducible fixtures. Document measured results beside
   these notes; do not preselect a winner from README claims.
2. **Shared inspector:** detection, metadata panel, safe virtual-file/preview
   contract, capability errors and progress/cancel.
3. **Archive read path:** ZIP first, then 7z/RAR/TAR/modern compression; tree,
   selective preview and temp extraction with strict budgets.
4. **Viewer modules:** image formats including **JXL/AVIF/HEIC**, then audio
   including **Opus/FLAC**; lazy engines, native-first with tested fallback.
5. **Creation and advanced controls:** ZIP creation/settings first; add other
   writable formats only when round-trip tests justify them.
6. **Optional extras:** local conversion, batch operations and offline
   packaging. Any R2/Containers proposal remains separately gated by explicit
   approval, consent and a documented privacy-contract change.

Non-goals for this design stage: reimplement Docbench PDF/text editors,
mandatory cloud uploads, new standalone "filebench" service, wholesale UI
rewrite, unsupported all-format claims, unbounded archive extraction.

## Existing boundaries and related docs

- [Docbench README](README.md): currently shipped features and build commands.
- [ChatGPT file viewer idea](CHATGPT_PLUGIN.md): MCP file-entrypoint and Aistee
  integration; do not duplicate its storage/sync model here.
- [Benches workspace](../README.md): shared tooling, separate Workers.
- [Bench scoped rules](../AGENTS.md): local-first and format fidelity.

This page is a **living evaluation record**. Promote an option from candidate
to selected only after documenting tests, compatibility, license, constraints
and why it wins.
