# [Docbench](https://docbench.travny.workers.dev/)

[![Bench CI](https://github.com/travnie/twojstar/actions/workflows/benches-release.yml/badge.svg?branch=main)](https://github.com/travnie/twojstar/actions/workflows/benches-release.yml) [![pdfjs-dist](https://img.shields.io/badge/pdfjs-dist-CB3837?logo=npm&logoColor=white&style=flat-square)](https://www.npmjs.com/package/pdfjs-dist) [![pdf-lib](https://img.shields.io/badge/pdf-lib-CB3837?logo=npm&logoColor=white&style=flat-square)](https://www.npmjs.com/package/@cantoo/pdf-lib) [![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-F38020?logo=cloudflareworkers&logoColor=white&style=flat-square)](https://developers.cloudflare.com/workers/)

Local-first file workbench with document and PDF tools. Files is the starting explorer; supported text, PDF and DOCX entries open contextually in existing tools. **User files remain in the browser**: never silently upload, rename or rewrite originals. Preserving PDF bookmarks, metadata, attachments and text/EOL fidelity is a release boundary.

## Implemented

- **Documents:** preview/edit TXT, Markdown, JSON/JSONC/JSONL, XML/YAML, scripts/configs and playlists; safe HTML rendering; direct save where supported, otherwise download. TXT/Markdown and structured JSON merges; conflict reporting without number coercion. The Documents editor provides Undo/Redo toolbar buttons and Ctrl/Cmd+Z / Ctrl+Y or Ctrl/Cmd+Shift+Z shortcuts, with bounded in-memory history. Repeated Backspace is grouped; formatting, JSON transformations and WebMCP edits are covered. History resets when loading, merging or creating a document, and does not reverse saved disk writes. Inspection-guided text repairs can preview and explicitly apply removal of suspicious directional, control and invisible characters, with optional unusual-space normalization and one-step undo. Truncated scans and context-dependent findings stay manual.
- **PDF:** DOCX↔PDF (structure-first PDF→DOCX, not pixel-perfect), merge/split, reorder/delete, extract, bookmarks, metadata, attachments and optimization. Verify structure and attachments before downloads.
- **Files (home):** local folder/drop import, search/sort, independent selection and preview, signature/MIME and metadata inspection; read-only ZIP folder navigation, selective extraction with CRC-32 verification (stored/DEFLATE entries), and local ZIP packing for up to 100 selected files. ZIP exports preserve safe folder paths, rename duplicate names, show progress and support cancellation. Native Save As streams large output (up to 512 MiB source); download fallback is capped at 56 MiB source and 64 MiB output, with no ZIP64 or encryption. Responsive explorer, preview and inspector panes. Context actions open text/PDF editors or the existing DOCX→PDF converter; unsupported files remain inspectable without pretending to be editable. Image preview ≤48 MiB, text preview ≤128 KiB; unsupported codecs shown as unsupported. The read-only modal can navigate the filtered visible list with Previous/Next or arrow keys (media controls keep their own keys); each preview cancels stale reads and releases media URLs on change or close. Audio can play in an explicit mini-player while browsing other files; removing the source, leaving Files or closing the player revokes its object URL.
- **WebMCP:** bounded workspace snapshots and visible selection from the **same UI/store**, not a parallel hidden file engine. Includes read-only repair previews (category counts, offsets, codepoints and operation examples); actual repair requires the visible document UI. No arbitrary filesystem paths or system pickers.

## Source map

| Concern | Source |
| --- | --- |
| File selection/preview | `public/file-store.mjs`, `public/file-routing.mjs`, `public/files-workspace.mjs` |
| Local ZIP packing | `public/zip-pack.mjs` |
| ZIP folder index | `public/zip-index.mjs`, `public/zip-tree.mjs` |
| ZIP validation/extraction | `public/zip-extract.mjs` |
| Document formats, merges | `public/document-formats.js`, `public/document-merge.mjs` |
| Undo/Redo | `public/document-history.js` |
| History model | `public/document-history-core.js` |
| PDF/editor features | `public/pdf-app.mjs`, `public/pdf-core.mjs`, `public/docx-converter.mjs`, `public/pdf-to-docx.mjs`, `public/document-enhancements.mjs` |
| Shared file ingress | [`../shared/local-files.js`](../shared/local-files.js); generated consumer copy, **do not edit** |
| Future archive/codec work | [`FILE_WORKBENCH.md`](FILE_WORKBENCH.md); research, **not shipped** |
| ChatGPT plugin | [`plugin/`](plugin/) / [`CHATGPT_PLUGIN.md`](CHATGPT_PLUGIN.md) |

```sh
cd benches
npm ci
npm run check:docbench
npm run dev --workspace=docbench
```

Build also produces ignored `public/portable.html`. Cloudflare Workers Builds: root `benches`, commands `npm run build:docbench`, `npm run deploy:docbench`, `npm run preview:docbench`. Watch `benches/docbench/**`, `benches/shared/**`, `benches/scripts/**`, `benches/package.json` and `benches/package-lock.json`. ZIP64, encrypted ZIP extraction, non-DEFLATE codecs, PAR2 recovery data, and broader archive/media engines are not implemented yet. ZIP extraction validates local headers, advertised sizes, compression ratios and CRC-32; single-file downloads use bounded memory or native Save As, and multi-file extraction requires a writable folder picker. Extracted files are never silently overwritten: multi-file output goes into a new dedicated folder.

## Embedded file ingress (v1)

Android and other first-party shells can pass a browser `File` to
`globalThis.DocBenchFiles.importFile(file)`. Check for `DocBenchFiles.version === 1`
first; when absent, subscribe with `document.addEventListener` to the one-shot
`docbench:files-ready` event and recheck the interface (the event is dispatched
on `document` and is not replayed). This synchronous API returns `{ ok: true, id }` on acceptance or
`{ ok: false, error }` when the shared queue is full, the file is invalid,
or a specialist file open is still pending. In the last case, retry the import.
`DocBenchFiles.version === 1` identifies the contract. It imports into the
**existing** Files store, clears filters and opens Files; the user can then
inspect or explicitly open a supported editor/converter. No file bytes leave the
browser, no original is overwritten and no element IDs are part of this API.

Older portable builds do not expose this method. Native clients may retain a
legacy picker fallback until their pinned offline Bench is updated. Update the
Kanarek staging commit and all three portable hashes together only after
cross-app import/export checks pass.
