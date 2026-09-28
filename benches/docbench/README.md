# Doc Bench — Document & PDF Studio

Local-first document toolbox in the Bench family. Files are processed in the
browser and are not uploaded.

Documents can open UTF-8 text files regardless of filename extension. Recognized formats now include TXT/Markdown, JSON-family, YAML/XML, INI/config files, Windows Batch/CMD and PowerShell scripts, Unix shell scripts and dotfiles, .env files, common Linux/Android configuration names, and M3U/M3U8/PLS playlists (with XSPF treated as XML). UTF-8 BOM and
line-ending handling are preserved. Markdown gets a safe
rendered preview, JSON-family/YAML/XML get collapsible tree views, and supported
browsers can save changes directly back to a chosen local file or choose any filename/extension in Save as. Script, playlist and loose config formats are deliberately kept as raw text instead of being auto-rewritten without a format-specific parser. TXT and Markdown files can also be merged in picker order into a new editable `merged.txt` or `merged.md` document, with mixed TXT/Markdown output promoted to Markdown. JSON/JSONC smart merge recursively combines objects, concatenates arrays and reports scalar/type conflicts while letting later files win; it emits strict `merged.json` without coercing source number lexemes. JSONL/NDJSON merge validates every record and appends them into `merged.jsonl`. The merge queue accepts multi-select where the browser supports it; on Android the fallback picker intentionally adds one file per selection and automatically merges as soon as the second file is queued. Download remains
available as the portable fallback.

PDF tools cover local DOCX→PDF conversion, structure-first PDF→DOCX export, preview, merge, page deletion/reordering, single-page
extraction, split-to-ZIP, bookmark, document-metadata and embedded-file editing,
lossless optimization, optional lossy image recompression and Fast Web View. Bookmark
trees, metadata and attachments are rebuilt or preserved as needed and verified
before every PDF download. Metadata edits keep trailer Info and XMP consistent; PDF/A XMP keeps
foreign extension blocks intact. PDF→DOCX extracts text in the current page order and maps the edited PDF bookmark tree to Word Heading 1–6 styles plus Word bookmarks; it is structural rather than pixel-perfect layout conversion.

## Local

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
