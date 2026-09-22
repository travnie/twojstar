# Third-party notices

## js-yaml

- Package: `js-yaml` 5.4.1
- Project: https://github.com/nodeca/js-yaml
- License: MIT

Used for YAML 1.2/1.1 parsing, validation and explicit formatting.

## jsonc-parser

- Package: `jsonc-parser` 3.3.1
- Project: https://github.com/microsoft/node-jsonc-parser
- License: MIT

Used to build the JSON preview tree from source offsets so scalar lexemes stay
exact, including integers outside JavaScript's safe numeric range.

## JSON5

- Package: `json5` 2.2.3
- Project: https://github.com/json5/json5
- License: MIT

Used for local JSON5 parsing and normalization.

## jsonrepair

- Package: `jsonrepair` 3.15.0
- Project: https://github.com/josdejong/jsonrepair
- License: ISC

Used only when the user explicitly requests repair of malformed JSON-family
documents. Repair converts input toward strict JSON.

## Marked

- Package: `marked` 18.0.11
- Project: https://github.com/markedjs/marked
- License: MIT

Used only to tokenize Markdown. Doc Bench renders the resulting tokens into DOM
nodes itself. Raw HTML is not executed and remote Markdown images are not loaded
automatically.

## fflate

- Package: `fflate` 0.8.3
- Project: https://github.com/101arrowz/fflate
- License: MIT

Used locally to package split-page PDF exports into a single ZIP archive. PDF
entries are stored without a second compression pass.

## docx-to-pdf-wasm

- Package: `docx-to-pdf-wasm` 0.1.0
- Project: https://github.com/fforres/cloudflare-worker-docx-to-pdf-wasm
- License: MIT

Used for local DOCX-to-PDF conversion in WebAssembly. Doc Bench enforces the
converter's 32 MiB input safety limit before invoking WASM.

## PDF.js

- Package: `pdfjs-dist` 6.2.108
- Project: https://github.com/mozilla/pdf.js
- License: Apache-2.0

Used for local PDF parsing, rendering and outline/destination inspection. PDF
scripting and eval support are disabled by Doc Bench.

## @cantoo/pdf-lib

- Package: `@cantoo/pdf-lib` 2.9.1
- Project: https://github.com/cantoo-scribe/pdf-lib
- License: MIT

Used to rebuild bookmark trees after structural page operations.

## qpdf-run / qpdf

- Package: `qpdf-run` 0.2.1
- Project: https://github.com/RabbitHols/qpdf-run
- Wrapper license: MIT
- qpdf project: https://github.com/qpdf/qpdf
- qpdf license: Apache-2.0

Used to run qpdf locally in a Web Worker for content-preserving page selection,
merge, lossless structural optimization and linearization.

## Space Grotesk / Space Mono

- Packages: `@fontsource-variable/space-grotesk` 5.3.0 and
  `@fontsource/space-mono` 5.3.0
- Project: https://fontsource.org/
- Font licenses: SIL Open Font License 1.1

Used for the shared Bench UI and monospace document/status typography. Font
files are self-hosted and embedded in the portable build.

All browser assets are copied locally during the build. Production and portable
builds do not load these runtimes or fonts from a CDN.
