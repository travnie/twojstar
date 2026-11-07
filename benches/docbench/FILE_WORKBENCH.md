# File Workbench: research and direction

Status: working product direction / engine evaluation (2026-11-08).
Not a claim that proposed features already ship.

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

## Explorer and manager experience

**Target UX, not yet shipped:** Files becomes the primary explorer and task
workspace, with Documents/PDF retained as specialist workspaces. The current
Files tab already accepts up to 100 files, offers a bounded header inspector,
one-file preview and read-only ZIP listing. It still lacks **multi-selection
for batch actions**, directory browsing, extraction, packing and preview dialogs.

- **Desktop:** source/tree and breadcrumbs on the left; searchable sortable
  file table or thumbnail grid in the center; contextual inspector on the right.
  Resize/collapse panels without replacing document editing features.
- **Mobile:** one main pane, a selection toolbar, a bottom-sheet inspector and
  fullscreen preview on demand. Never require hover or desktop-only shortcuts.
- **Selection:** distinguish focused/previewed item from selected items. Use
  checkbox/tap selection, Shift range, Ctrl/Cmd toggle and explicit Select all
  *visible*. Keep selection stable after search, sorting and view switching.
  Always show batch count, total bytes and action eligibility.
- **Preview:** single click/tap can open a lightbox for images, mini-player
  for audio, or video/document viewer; Escape, backdrop, focus restoration,
  next/previous navigation and keyboard accessibility are mandatory. A docked
  mini-player may persist while browsing without keeping abandoned Blob URLs.
  Cancel superseded previews and use an active-item generation token to reject
  late async results. Unsupported formats show metadata, not a blank panel.
- **Actions:** create ZIP from selected files; inspect/compare/hash, extract
  selected archive entries, and export a report. Queue operations with
  progress, cancel, validation and honest partial failure states. Do not expose
  destructive filesystem actions without a writable, explicit user grant.
- **Source types:** local Files/Blobs, picker/dropped directories, read-only
  virtual archive entries, transient OPFS results. All must use the *same*
  explorer and preview components; do not fork them per archive codec.
- **Scale:** virtualize very large lists and generate thumbnails only for
  visible rows. Do not preload every file, preview, image decoder or WAV stream.

**Browser permissions:** prefer standard file pickers/drag-and-drop. Offer
`showDirectoryPicker()` only in a supported **secure context** (HTTPS or
localhost) with user activation; offline `file://` builds need a fallback.
`webkitdirectory` can import folders without persistent handles. For dropped
folders, traverse `DataTransferItem` directory entries using supported APIs
and preserve relative paths; the current shared `bindFileDrop` exposes only
a flat `File[]` and must not be treated as a directory-tree parser.
Firefox and Safari do not support the full File System Access picker family.
Android pickers and
directory handling need explicit tests; a read-only imported folder is **not**
a filesystem mount. Never imply that the web page can browse or rewrite the
device's entire disk. See [browser support](https://web-platform-dx.github.io/web-features-explorer/features/file-system-access/).

### Internal contract

Keep one canonical **virtual file model**, independent of UI frameworks:

- **Opaque entry ID** unique across all simultaneously mounted sources, plus
  explicit mount/source identity and lifetime. Never derive identity from a
  logical path alone: two archives can both contain `notes.txt`. Store display
  name, relative path, parent, source kind, immutable Blob snapshot or bounded
  read/stream adapter, MIME/signature provenance, size/timestamps and
  capabilities without eagerly copying complete file contents.
- Entry operations: `readRange`, `stream`, `inspect`, `preview`, `listChildren`,
  `extract` and `export`, each gated by adapter capabilities. Preview adapters
  return an explicit bounded Blob URL or supported streaming media source with
  MIME, cancellation and disposal. Native media elements cannot consume a raw
  arbitrary stream; use a tested MediaSource route or bounded temporary file,
  otherwise report unsupported rather than buffer an entire archive entry.
  Do not make a read-only ZIP index look like a full archive editor.
- Keep **selection state separate from active preview**, stable across list
  reordering and filtering. A batch `createArchive` action consumes a validated
  selected-ID snapshot, resolves entries, preserves safe relative paths and
  handles name collisions deterministically. Never implement per-entry `pack`.
- For writable directory handles, pin `File` snapshots per job or revalidate
  source version/content before publishing an archive or report; abort if a
  source changes after validation. Do not pretend size/timestamp checks alone
  guarantee immutable contents.
- File work occurs in lazy task-specific modules and Web Workers. Worker
  requests include cancellation and byte/entry/time budgets. Revoke object
  URLs; clean temporary OPFS data; never read whole GB-scale archives merely
  to populate thumbnails or the file tree.
- Reuse the existing shared Bench primitives for truly common functionality
  (local file drop, sizes, maybe later job progress/notifications). Keep each
  Bench's shell, permission boundary, styling and Cloudflare Worker separate.

### Beyond ordinary preview: file diagnostics

These are candidate *utilities*, not promises of shipped detection accuracy:

- **Text/code:** carry the existing token counter, hidden-Unicode/control-char
  inspection, encoding/EOL checks and format validation into the explorer;
  compare versions, spot duplicate content and report suspicious byte/name
  mismatches with deterministic evidence.
- **Archives:** compression ratios, duplicate names, traversal and symlink
  warnings, encrypted entries, structure map, safe nested previews and a
  reproducibility/round-trip report. Size estimates must not claim ZIP64 support
  until the selected engine actually supports it.
- **Images:** EXIF/GPS privacy inspection, ICC/orientation, palette and
  histograms; side-by-side difference, perceptual duplicate candidates,
  visually lossless export comparisons and codec size/quality bake-offs.
- **Audio:** codec/tag/cover-art inspector, waveform/spectrogram, clipping,
  long-silence detection, channel/bitrate analysis, volume comparison and
  optional local trim/convert without mandatory FFmpeg loading.
- **Video:** stream/track inventory, dimensions/rotation, duration, timecode,
  poster frames and metadata anomalies; avoid implying every codec can play
  merely because its container can be read.
- **Cross-format:** hashes, exact-duplicate grouping, a comparison view, audit
  export, and **local benchmark runs** recording engine, version, browser,
  resource usage and correctness. All warnings are explainable heuristics,
  not a malware verdict or guarantee of corruption detection.

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

**UI plane:** evolve the existing Docbench shell; start with the Files
explorer as an isolated, mountable UI surface rather than rewrite the PDF and
document editors. Svelte 5 is the leading candidate, subject to a measured
prototype and normal/portable build proof. Reuse existing Bench workspace
infrastructure without merging product Worker boundaries. Load codecs and
archive engines lazily, never all at startup.

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

Choose technologies **per responsibility**, not one language per feature or
multiple live UI runtimes. Keep a stable JS/TS interface for `File`, `Blob`,
streams, workers and the capability registry. Rust/C/C++ compiled to WASM can
implement selected codecs/parsers. Python, Dart and Swift are optional
experiments, not drop-in Web Worker runtimes for arbitrary native libraries.
A framework may render a view; it must not own the canonical file model.

**Leading UI bake-off:**

1. **Svelte 5, client-only Files island:** likely easiest incremental route for
   a reactive tree, multi-selection, modal views and progress state. Compile
   into static JS/CSS; no mandatory SvelteKit server. Test
   [Bits UI](https://bits-ui.com/docs/introduction) for accessible dialogs and
   menu primitives and [TanStack Virtual](https://tanstack.com/virtual/latest/docs/introduction)
   when a large list requires windowing. Preserve current styling and the
   document/PDF modules. Check bundle weight, ESM import paths, CSP and
   single-file portable inlining before promotion.
2. **Jaspr/Dart comparison slice:** [Jaspr](https://jaspr.site/) renders
   real HTML/CSS, has client/static modes and [JS interop](https://docs.jaspr.site/dev/client).
   Prototype exactly the same file tree/inspector interactions using a Dart
   client build. Dart-to-JS is the default; WASM remains an experimental
   comparison. A static client build can be served by Workers Static Assets;
   Dart SSR is **not** assumed to run in the existing Worker.
3. **Current vanilla DOM or Lit/Solid:** control baseline. Keep if incremental
   components outperform a framework for startup, accessibility, migration
   safety or portable output.

**Decision gate:** compare identical fixtures and interactions for keyboard/
touch behavior, first usable view, total and incremental asset bytes, idle/
selection memory, 1k+ row responsiveness, testability, Worker CSP, offline
portable packaging, and reuse of the existing file/preview API. Pick **one**
production UI strategy after measurement; do not ship Svelte and Jaspr side by
side just because both are interesting.

**Engine shortlist for first experiments:** keep current fflate for existing
small ZIP/PDF tasks; compare zip.js for large streaming ZIP/ZIP64/encryption.
Try [Mediabunny](https://mediabunny.dev/guide/reading-media-files) for lazy
container/track inspection and conversion;
[music-metadata](https://github.com/Borewit/music-metadata) for rich audio
tags and covers;
[exifr](https://github.com/MikeKovarik/exifr) for EXIF/GPS/ICC; and
[jSquash](https://github.com/jamsinclair/jSquash) for JXL/AVIF/QOI previews
where native browser decoding fails. Use format and browser capability tests
to select the engine; no automatic dependency installation from this list.
Prefer only requested codec WASM; ffmpeg.wasm remains a heavy opt-in fallback.

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
5. UI prototype: **Svelte 5 vs Jaspr vs current DOM**, using identical
   fixtures and interactions (bundle weight, startup, mobile responsiveness,
   keyboard accessibility, JS/WASM interoperability and portable CSP).

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

Existing baseline: deployed Files tab, bounded signature detection, one-file
native preview, read-only ZIP central-directory index, shared local-file
drop/size helper and portable build. They are **not** a file manager yet.

1. **Explorer UI slice:** same current workspace, list/grid and basic virtual
   folders; separate focus from multi-selection; search/sort and selection
   tray; keyboard/mobile handling. Prototype Svelte 5 *against* the existing
   UI before adopting it, rather than rewrite Documents/PDF.
2. **Preview surfaces:** modal image lightbox and audio mini-player, video
   viewer, metadata drawer, same virtual-entry APIs, object URL cleanup and
   constrained native media handling. Keep browser feature fallbacks explicit.
3. **First packing operation:** select multiple local files, stream a ZIP with
   progress/cancel, collision-safe paths and round-trip tests. Benchmark
   zip.js against existing fflate for constrained small files before picking
   the primary archive writer; do not copy GB files into RAM.
4. **Archive explorer:** browse selected nested ZIP entries without full
   inflation, then 7z/RAR/TAR/modern compression through tested read adapters.
   Apply safety budgets before extraction, and do not advertise unsupported
   encryption or writable formats.
5. **Inspector plugins:** exifr / music-metadata / Mediabunny for richer image
   and audio/video reports. Add JXL/AVIF/HEIC/QOI via lazily loaded decoders
   only where needed. Preserve baseline browser and portable UX.
6. **Distinctive diagnostics and Bench Lab:** text token/Unicode analysis from
   inside safe archive entries, metadata privacy review, image/audio
   comparisons, duplicates/hashes and reproducible engine benchmarks.
   Promote proven adapters to the capability registry one at a time.
7. **Optional extras:** local batch conversion and offline packaging; a
   server-only R2/Containers proposal requires separate approval, explicit
   upload consent and a changed privacy contract.

Every slice should expose real, tested behavior; avoid disabled decorative
buttons and unsupported all-format claims. Track platform, correctness, memory
and partial-failure behavior in the same acceptance review.

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
