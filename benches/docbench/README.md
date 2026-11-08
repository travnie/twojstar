# Doc Bench — Document & PDF Studio

Local-first document toolbox in the Bench family. Files are processed in the
browser and are not uploaded.

Documents can open UTF-8 text files regardless of filename extension. Recognized formats now include TXT/Markdown, JSON-family, YAML/XML, INI/config files, Windows Batch/CMD and PowerShell scripts, Unix shell scripts and dotfiles, .env files, common Linux/Android configuration names, and M3U/M3U8/PLS playlists (with XSPF treated as XML). Generic or unknown filenames get conservative content sniffing for several common formats, while explicit format extensions keep priority. UTF-8 BOM and
line-ending handling are preserved. Markdown gets a safe
rendered preview, JSON-family/YAML/XML get collapsible tree views, and supported
browsers with a writable File System Access handle save changes directly back to the opened local file; otherwise Docbench offers Save as where supported or clearly falls back to downloading an edited copy. Script, playlist and loose config formats are deliberately kept as raw text instead of being auto-rewritten without a format-specific parser. TXT and Markdown files can also be merged in picker order into a new editable `merged.txt` or `merged.md` document, with mixed TXT/Markdown output promoted to Markdown. JSON/JSONC smart merge recursively combines objects, concatenates arrays and reports scalar/type conflicts while letting later files win; it emits strict `merged.json` without coercing source number lexemes. JSONL/NDJSON merge validates every record and appends them into `merged.jsonl`. The merge queue accepts multi-select where the browser supports it; on Android the fallback picker intentionally adds one file per selection and automatically merges as soon as the second file is queued. Download remains
available as the portable fallback.

PDF tools cover local DOCX→PDF conversion, structure-first PDF→DOCX export, preview, merge, page deletion/reordering, single-page
extraction, split-to-ZIP, bookmark, document-metadata and embedded-file editing,
lossless optimization, optional lossy image recompression and Fast Web View. Bookmark
trees, metadata and attachments are rebuilt or preserved as needed and verified
before every PDF download. Metadata edits keep trailer Info and XMP consistent; PDF/A XMP keeps
foreign extension blocks intact. PDF→DOCX extracts text in the current page order and maps the edited PDF bookmark tree to Word Heading 1–6 styles plus Word bookmarks; it is structural rather than pixel-perfect layout conversion.

## Files workspace

**Files** is a local-first explorer and inspector: drag/drop, pick files or
import an entire folder (where the browser allows), up to 100 files. It has
search, sort, folder filtering, list/grid views, independent multi-selection,
and a native preview dialog. Use Ctrl/Cmd for toggles, Shift for a range,
or Select visible. Removal acts on the selection, not the active preview.
Inspect 4 KiB signatures, filename/MIME discrepancies, timestamps, sizes,
and local inspection time. Preview supported images, audio/video through native
browser decoders, text as source, or a bounded hex header. ZIP shows a
**read-only central-directory index** without unpacking anything. Unsupported
codecs (including JPEG XL/Opus on some browsers) stay clearly unsupported, not
silently converted. Image previews are capped at 48 MiB, text at 128 KiB.
No files are uploaded, and object URLs are released when switching files.
The canonical queue/selection model is `public/file-store.mjs`; the UI and
WebMCP read the same store. Browser WebMCP supports bounded workspace
snapshots, format inspection, visible selection and focus. It cannot open
system pickers or access arbitrary filesystem paths. Batch ZIP creation,
archive extraction and a new Svelte renderer are not yet shipped.

The broader archive, image, audio, metadata and benchmark plan, candidate
engines, Jaspr and WASM research remain in
[`FILE_WORKBENCH.md`](FILE_WORKBENCH.md). ZIP extraction, other archive
engines and additional codecs are not shipped yet.

## Local

The ChatGPT plugin foundation and planned file-viewer integration are recorded in
[`CHATGPT_PLUGIN.md`](CHATGPT_PLUGIN.md); the portable package lives in [`plugin/`](plugin/).

```sh
cd benches
npm ci
npm run dev --workspace=docbench
```

`npm run build` vendors browser dependencies and creates
`public/portable.html`.

## Deploy via Cloudflare Workers Builds

Use `benches` as the root directory, `npm run build:docbench` as the build
command, `npm run deploy:docbench` as the deploy command and
`npm run preview:docbench` for non-production branches. Build watch includes
should cover `benches/docbench/*`, `benches/package.json` and `benches/package-lock.json`; exclude `*.md`.
