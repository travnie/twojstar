# [Papagenerator](https://travny.pages.dev/papagenerator/)

[![HTML Canvas](https://img.shields.io/badge/HTML_Canvas-E34F26?logo=html5&logoColor=white&style=flat-square)](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API) [![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=white&style=flat-square)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

Static, mobile-first sticker editor. No backend, account, cookies, analytics or server-side uploads. Users can select local photos and sticker files; all canvas work remains in the browser.

## Run

```sh
python -m http.server 8000 --directory papagenerator
# visit http://localhost:8000
```

Use an ordinary static host; Vercel may use `papagenerator/` as the project root with no build step. The [TRAVNY Pages build](https://github.com/trvny/trvny/blob/main/pages/README.md) **pins this directory to a commit** and copies it into the existing hub; do not create a second maintained editor.

## Source / limits

- Photo or blank canvas; original cartoon stickers, halo, custom transparent PNG. Drag, rotate, resize, duplicate, reorder, remove.
- PNG export caps at 4096 pixels per edge / 12 megapixels; larger photos scale down.
- `brainrot.js` contains optional meme-language browser math; examples in `brainrot/` and `rickroll/` are **not** runtime dependencies. External [Brainrot](https://github.com/Brainrotlang/brainrot) / [Rickroll-Lang](https://github.com/Rick-Lang/rickroll-lang) interpreters are only for those demos.
- Original inline SVG starter art; custom user images stay local. [Repository license](../LICENSE).
