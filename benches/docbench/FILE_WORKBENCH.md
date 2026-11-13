# File Workbench: research and direction

Status: working product direction / engine evaluation (2026-11-08).
Not a claim that proposed features already ship.

Docbench is already a **local-first document and PDF studio**. Expand that
existing application into a general-purpose file workbench rather than creating
a parallel app, forked editor, or second file library. Preserve the current
document fidelity rules and browser-only file handling. "Bench" can also mean
**hands-on experiments with competing engines**, not a stopwatch contest.
Compile, run, use real files, then keep only genuinely useful discoveries.

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

**Initial Files-first shell (2026-11-09):** Files opens by default, with
responsive explorer/preview/inspector panes and contextual links to the existing
text editor, PDF tools and DOCX converter. The shared file store handles up to
100 files, bounded header inspection, preview, multiselection and read-only ZIP
listing. Remaining goals include batch operations, navigable directory trees,
selective extraction, packing and richer format-specific inspectors.

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

## Experiment routing across the Bench family

Docbench is not the final destination for every good idea. The existing
[Bench workspace](../README.md#experiment-routing) is the routing map:

- **Docbench:** archives, file trees, document editing, standalone file
  inspection, local conversion, metadata and cross-format operations.
- **Codebench:** QR/barcode generation, image/scanner input, SVG/canvas and
  raster output, color/palette tooling, image safety, optical decoding.
  A graphics library may be more useful here than in a general image viewer.
- **Streambench:** live audio/video, radio, playlists, player state, HLS,
  stream/track diagnostics and metadata. Try promising media, waveform and
  container candidates here when they serve live playback better than a
  local-file inspector.
- **Shared Bench primitives:** file/Blob ingress, bounded diagnostics,
  capability schemas, WebMCP registration, progress/cancel or preview
  conventions **only after two real consumers justify sharing**. Each Bench
  owns its UI, Cloudflare Worker, security policy, browser permissions
  and release flow. No copied engines or second canonical registry.
- **Candidate afterlife:** failed or ill-fitting Docbench prototypes may
  move to Codebench/Streambench with their notes and fixtures. A candidate
  can also remain an optional experiment, not a permanent dependency.

Experiment with language and ecosystem *where useful*: Svelte or Jaspr/Dart
for a UI slice; Rust, C/C++, Zig, Swift/JavaScriptKit, or another credible
browser-targeted compiler for a parser/codec. JS/TS interop remains the small
common browser boundary, not the required implementation language. Test a
tiny compiled slice before any wholesale migration. Measure practical
integration and learning value, not novelty for its own sake.

### Practical admission check

1. **Does it compile?** Reproducible, pinned source and basic build in CI.
   If it needs extra runtime features, state those limits and stop early.
2. **Does it run?** Open a real file or stream in the deployed/static build,
   not only in an isolated language playground. Preserve CSP, offline/
   single-file portable output and lazy loading where applicable.
3. **Does it feel useful?** Try normal clicks, touch, open/close, playback,
   batch failures and navigating back on a phone and a desktop. Prefer
   practical success and a usable feature over millisecond rankings.
4. **Does it preserve data/privacy?** Bounded input, readable errors,
   cancellation, cleanup, no silent uploads, destructive actions or
   unsupported-format promises. Archive safety and document fidelity
   remain hard gates regardless of hobby/experiment status.
5. **Where does it fit?** Adopt into the owner Bench, share only a genuinely
   reusable primitive, or keep the exploration notes and move on.
   No compulsory 20-run performance tournament before prototyping.

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

## Complete WebMCP coverage, one UI truth

All three Benches **already** register browser tools through the shared
[`webmcp-lifecycle.js`](../shared/webmcp-lifecycle.js) and the experimental
`document.modelContext` API. Docbench currently exposes document read,
set, validate, format and text-inspection tools. Codebench has QR/barcode
tools and scanner-state reporting; Streambench exposes playlist search and
playback controls.
No second parallel tool system or speculative remote MCP server is needed.

**Target:** every useful, safe capability added to Files/Docs/PDF eventually
gets a matching WebMCP operation, **backed by the same state and adapter as the
visible control**. The agent and user must observe the same result and progress;
WebMCP does not bypass UI validation, permissions, confirmation or capability
checks. Register tools only when their implementation actually ships.

- **Discovery:** `list_file_capabilities`, available engines/formats, limits
  and unsupported reasons. Return observed functionality, not wishlist items.
- **Workspace:** list selected/imported virtual entries (bounded metadata),
  inspect one by opaque ID, navigate/select entries and preview through visible
  controls. Keep per-mount IDs short-lived and reject stale selections.
- **Inspection:** fetch bounded metadata/diagnostics, safe text analyses and
  per-format reports, with explicit opt-in for source text, GPS fields,
  sensitive names or other private content. No raw Blob/base64 by default.
- **Operations:** queue ZIP packing, extraction, conversion, compare or
  export **after the feature exists in the UI**. Use matching capability
  gates, user-visible progress, cancellation and confirmation for
  writes/extraction/large or sensitive output. A browser agent cannot silently
  open the OS picker, mount arbitrary directories or gain writable access.
- **Result contract:** `ok`, `kind`, `sourceIds`, `warnings`, `truncated`,
  `capabilities` and relevant typed data; report unsupported features and
  partial failures without inventing success. Bound all strings, entry counts
  and returned metadata; never treat file content as model instructions.
- **Lifecycle:** register/unregister on workspace or capability availability,
  using the existing shared lifecycle helper. Validate arguments against
  both schema and runtime state. Handle cancellation and stale views; do not
  duplicate hidden business logic for agent calls.
- **Testing:** normal UI still works when WebMCP is absent; test the
  registered tools in a supporting browser, their input/output bounds,
  permissions, file lifetime, stale IDs and visible UI synchronization.
  The platform is experimental, so do not assume all browsers or agent
  hosts implement the same draft.

**Boundary:** WebMCP runs in the webpage/browser, not an authenticated remote
file server. The separate
[ChatGPT file-entrypoint/MCP App plan](CHATGPT_PLUGIN.md) is a host-provided
file resource workflow. It must reuse the same Docbench adapters where
possible, but retain its own host permission/ETag contract. Neither WebMCP
nor the MCP App authorizes uploading local file bytes through the Worker.

Current API reference:
[WebMCP Community Group draft](https://webmachinelearning.github.io/webmcp/).
Keep draft details isolated behind the shared registration helper.

## Archive reliability and recovery data

**Real recovery, not a checkbox.** Keep one archive-capability registry and distinguish
verification (CRC-32/format integrity), hashing (SHA-256 manifest), parity creation
(PAR2 recovery files) and repair (reconstruct damaged or missing data). A CRC or
SHA-256 digest detects damage but cannot replace missing bytes. ZIP has no
universal built-in recovery-record equivalent to RAR's recovery records. Use
separate, interoperable
[PAR2](https://parchive.github.io/doc/Parity%20Volume%20Set%20Specification%20v2.0.html)
volumes, suitable for ZIP, TAR, 7z, RAR and arbitrary files. A sidecar hash
manifest or duplicated ZIP copy is not PAR2.

**User-facing target after the parity engine passes its gates:**

- Archive preset: Smart/Store/Fast/Balanced/Maximum for existing ZIP; later
  format, codec, encryption and dictionary parameters only if supported by
  the chosen engine. Compression independent of protection.
- Recovery preset: Off, 5%, 10%, 20%, Custom; select bounded source block
  size and display estimated parity size before generating. Percentage is
  extra parity capacity, not guaranteed repair probability. Outcomes depend
  on which source blocks fail and which recovery volumes survive.
- Generate a standard main .par2 index and .volNN+MM.par2 parity files after
  successful archive creation. Explicit save destination; source ZIP untouched.
  No incompatible pseudo-PAR records embedded into the ZIP.
- Verify: inspect the selected archive and matching PAR2 volumes, report
  CRC/hash failures, damaged or missing source blocks, available recovery
  blocks and whether repair is possible. Clearly report incomplete checks.
- Repair: reconstruct into a new file or local temporary Blob, verify
  restored content against PAR2 metadata and then offer export. Do not
  overwrite a damaged original or publish partial results. Abort safely
  on insufficient blocks, memory limits or user cancellation.

**Engine gate:** investigate browser-compatible builds of
[par2cmdline](https://github.com/Parchive/par2cmdline) / libpar2 (C++/WASM),
or another maintained PAR2-spec conformant Reed-Solomon implementation with
documented licensing. Compare generated volumes against the native CLI.
Do not route user archives to Cloudflare for parity. Browser, portable, CSP,
Web Worker cancellation and Android memory limits are release gates.
If no vetted engine passes, leave the recovery control absent rather than
shipping a nonworking option.

**Cross-compatibility fixtures:** CLI PAR2 -> browser verify/repair; browser
PAR2 -> CLI verify/repair. Include 0%, 5%, 10% and 20% redundancy profiles;
intact, flipped, truncated, missing and renamed files; sparse versus clustered
block corruption; absent and damaged parity volumes; Unicode names; empty
and multi-file input; resource limits. Assert byte-exact repair, no overwrite,
bounded memory and truthful cannot-repair outcomes. ZIP CRC checks alone are
not recovery.

**Other archive families:** tackle TAR index/extract and ZIP64/AES via
separately vetted readers (zip.js against fflate). Split 7z/RAR/RAR5 read
from write/encrypt/repair capabilities, mind codec licenses, solid archives
and multi-volume constraints. ZIP directory corruption may require restoring
the whole archive with PAR2 *before* the ZIP parser can read it. Never promise
a generic magic Fix ZIP action or upload the archive without explicit consent.

## Candidate engines (evaluate, do not install all)

| Job | Candidate | Why investigate / caveat |
| --- | --- | --- |
| Existing PDF split ZIP | [fflate](https://github.com/101arrowz/fflate) | Already used. Keep for its current task until benchmarks justify replacing it. |
| PAR2 recovery sets | [Parchive/par2cmdline](https://github.com/Parchive/par2cmdline) / [PAR2 spec](https://parchive.github.io/doc/Parity%20Volume%20Set%20Specification%20v2.0.html) | Cross-compatible parity; browser/WASM performance, licensing, correctness and portable CSP not yet validated. |
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

Choose technologies **per responsibility**, not one familiar language for
everything. Keep a small JS/TS interface for `File`, `Blob`, streams,
workers and the capability registry. Rust/C/C++, Zig and Swift compiled
to WASM can own specialized tasks; Dart/Jaspr or Svelte can own an
isolated UI slice. Try credible alternatives, including less conventional
toolchains, when there is a real reason. Any compiled module must expose
a browser-compatible import/interop boundary, not assume a native runtime.
One consistent file model; no duplicate state in multiple frameworks.

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

**Practical gate:** first compile and mount identical small explorer
interactions in the real app, then try keyboard/touch, file selection and
preview, phone and desktop, CSP and portable output. Note obvious slow
startup, runaway memory or huge downloads, but do not let a benchmark
spreadsheet decide the UI. Choose the simplest convincing integration.
Different language modules can coexist across distinct tasks when the
interop/maintenance cost pays for itself; never duplicate the main file state.

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

## The other meaning of "Bench": practical engine experiments

A Bench is both a useful tool and a playground for credible alternatives.
Start with a tiny build that exercises a real file or stream. A passing
compile, basic interop, truthful format support, good mobile behavior and
normal UX beat synthetic microbench winners. Record blockers and useful
findings in this existing file, including candidates better suited to
Codebench or Streambench. Only compare detailed performance when a
real usability, size or memory problem demands it.

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

**Minimum smoke:** pinned toolchain/dependency, one reproducible build, real
import/export or playback, correct result, cancellation/cleanup and understandable
error. Try the built site and portable output, desktop plus Android where
applicable. Keep small legal test fixtures, including malformed/unicode and
large/hostile cases under strict budgets. **Optional diagnostics:** loaded
bytes, memory, wall time and codec quality only to explain actual problems.
Do not mandate repeated runs, hardware rankings or benchmarks before an
experiment can earn a place in the UI. Never send private inputs to analytics.

## Practical sequencing

Existing baseline: deployed Files tab, bounded signature detection, one-file
native preview, read-only ZIP central-directory index, shared local-file
drop/size helper and portable build. They are **not** a file manager yet.

1. **Explorer UI slice:** same current workspace, list/grid and basic virtual
   folders; separate focus from multi-selection; search/sort and selection
   tray; keyboard/mobile handling. Compile Svelte 5 and one credible Dart/
   Jaspr or other atypical slice before deciding; no Documents/PDF rewrite.
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
7. **WebMCP per working slice:** add corresponding capability discovery,
   read/inspect, then safe actions to the existing WebMCP registration.
   Verify agent-visible results, browser restrictions and permission flow
   against the visible UI. Reuse the shared lifecycle helper.
8. **Optional extras:** local batch conversion and offline packaging; a
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
