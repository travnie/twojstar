# Papagenerator

A zero-backend, mobile-friendly image sticker editor. Runs entirely in the browser; uploaded photos never leave the device.

## Features

- Upload a photo or start with the demo gradient.
- Add original papaj-inspired cartoon stickers, a yellow halo, or a custom transparent PNG.
- Drag, rotate, resize, duplicate, layer, delete.
- Export PNG at the source image resolution.
- Browser-only rendering; no accounts, storage, cookies, or analytics.
- Brainrot helpers in `brainrot.js`; production editor logic stays readable.

## Run

Serve this directory with any static file server:

```sh
python -m http.server 8000 --directory papagenerator
```

Open http://localhost:8000.

## Vercel

Create a Vercel project from `travnie/twojstar`, set **Root Directory** to `papagenerator`, Framework Preset **Other**, and leave Build Command empty. No environment variables required.

## Assets

Starter stickers are original inline SVG cartoons, not downloaded images of a real person. You may upload your own sticker files.

## License

See the repository license.
