# [Docbench](https://docbench.travny.workers.dev/)

[![Bench CI](https://github.com/travnie/twojstar/actions/workflows/benches-release.yml/badge.svg?branch=main)](https://github.com/travnie/twojstar/actions/workflows/benches-release.yml) [![pdfjs-dist](https://img.shields.io/badge/pdfjs-dist-CB3837?logo=npm&logoColor=white&style=flat-square)](https://www.npmjs.com/package/pdfjs-dist) [![pdf-lib](https://img.shields.io/badge/pdf-lib-CB3837?logo=npm&logoColor=white&style=flat-square)](https://www.npmjs.com/package/@cantoo/pdf-lib) [![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-F38020?logo=cloudflareworkers&logoColor=white&style=flat-square)](https://developers.cloudflare.com/workers/)

Local-first file workbench with document and PDF tools. Files is the starting explorer; supported text, PDF and DOCX entries open contextually in existing tools. **User files remain in the browser**: never silently upload, rename or rewrite originals. Preserving PDF bookmarks, metadata, attachments and text/EOL fidelity is a release boundary.

## Implemented

- **Documents:** preview/edit TXT, Markdown, JSON/JSONC/JSONL, XML/YAML, scripts/configs and playlists; safe HTML rendering; direct save where supported, otherwise download. TXT/Markdown and structured JSON merges; conflict reporting without number coercion. The Documents editor provides Undo/Redo toolbar buttons and Ctrl/Cmd+Z / Ctrl+Y or Ctrl/Cmd+Shift+Z shortcuts, with bounded in-memory history. Repeated Backspace is grouped; formatting, JSON transformations and WebMCP edits are covered. History resets when loading, merging or creating a document, and does not reverse saved disk writes. Inspection-guided text repairs can preview and explicitly apply removal of suspicious directional, control and invisible characters, with optional unusual-space normalization and one-step undo. Truncated scans and context-dependent findings stay manual.
- **PDF:** DOCX↔PDF (structure-first PDF→DOCX, not pixel-perfect), merge/split, reorder/delete, extract, bookmarks, metadata, attachments and optimization. Verify structure and attachments before downloads.
- **Files (home):** local folder/drop import, search/sort, independent selection and preview, signature/MIME and metadata inspection; read-only ZIP index. Responsive explorer, preview and inspector panes. Context actions open text/PDF editors or the existing DOCX→PDF converter; unsupported files remain inspectable without pretending to be editable. Image preview ≤48 MiB, text preview ≤128 KiB; unsupported codecs shown as unsupported.
- **WebMCP:** bounded workspace snapshots and visible selection from the **same UI/store**, not a parallel hidden file engine. Includes read-only repair previews (category counts, offsets, codepoints and operation examples); actual repair requires the visible document UI. No arbitrary filesystem paths or system pickers.

## Source map

| Concern | Source |
| --- | --- |
| File selection/preview | `public/file-store.mjs`, `public/files-workspace.mjs` |
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

Build also produces ignored `public/portable.html`. Cloudflare Workers Builds: root `benches`, commands `npm run build:docbench`, `npm run deploy:docbench`, `npm run preview:docbench`. Watch `benches/docbench/**`, `benches/shared/**`, `benches/scripts/**`, `benches/package.json` and `benches/package-lock.json`. ZIP extraction and broader archive/media engines are not implemented yet.
