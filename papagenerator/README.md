# Papagenerator

A zero-backend, mobile-friendly image sticker editor. Runs entirely in the browser; uploaded photos never leave the device.

## Features

- Upload a photo or start with the demo gradient.
- Add original papaj-inspired cartoon stickers, a yellow halo, or a custom transparent PNG.
- Drag, rotate, resize, duplicate, layer, delete.
- Export PNG at the source image resolution.
- Browser-only rendering; no accounts, storage, cookies, or analytics.
- Brainrot-flavored browser math in `brainrot.js`; production editor logic stays readable.
- Executable Brainrot and Rickroll-Lang examples in `brainrot/` and `rickroll/`.

## Run

Serve this directory with any static file server:

```sh
python -m http.server 8000 --directory papagenerator
```

Open http://localhost:8000.

## Vercel

Create a Vercel project from `travnie/twojstar`, set **Root Directory** to `papagenerator`, Framework Preset **Other**, and leave Build Command empty. No environment variables required.

## Meme-language demos

These are real source files in their respective esoteric languages, but optional demos rather than browser runtime dependencies:

- `brainrot/center.brainrot`: calculate the default papaj spawn coordinates with `skibidi`, `rizz`, `yapping` and `bussin`.
- `rickroll/hello.rr`: a Rickroll-Lang welcome line.

Run with the external [Brainrot](https://github.com/Brainrotlang/brainrot) or [Rickroll-Lang](https://github.com/Rick-Lang/rickroll-lang) interpreter respectively. The Vercel deployment runs only HTML and JavaScript.

## Assets

Starter stickers are original inline SVG cartoons, not downloaded images of a real person. You may upload your own sticker files.

## License

See the repository license.
