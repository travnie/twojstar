# Paint.NET plugins

Shared home for Paint.NET extensions maintained in this repository.

## Current plugins

- [`ico/`](ico/) — ICO import/export FileType plugin for Paint.NET 5.1 and 5.2+.
- [`ai/`](ai/) — local AI restoration pack with Real-ESRGAN **AI Restore**, FBCNN **AI DeJPEG**, and SCUNet **AI Denoise**. Smart Transparency/matting remains a proposal, not shipped. SVG is handled by an existing external plugin.

Stable release assets remain separate so users can install only what they need:

- [`paintdotnet-ico.zip`](https://github.com/travnie/twojstar/releases/latest/download/paintdotnet-ico.zip)
- [`paintdotnet-ai.zip`](https://github.com/travnie/twojstar/releases/latest/download/paintdotnet-ai.zip)

## Direction

Keep future Paint.NET work here instead of creating new top-level projects.

The AI pack should grow by capability/profile rather than by making a new directory for every model:

- **Fast** — small Real-ESRGAN model, low friction, current-size restoration.
- **Restore+** — FBCNN DeJPEG and SCUNet Denoise with explicit performance/storage trade-offs.
- **Heavy** — intentionally out of scope for now; do not grow a local plugin into a multi-gigabyte model manager by accident.

SVG/SVGZ import is already available from the independently installed [Scalable Vector Graphics FileType plugin](https://github.com/otuncelli/Scalable-Vector-Graphics-Plugin-for-Paint.NET), including optional element/group layers and image tracing. Do not duplicate it in this repository or ship its GPL-2.0 code inside these addon ZIPs. Investigate specific compatibility gaps upstream first.

**Deferred:** True one-click 2x/4x document enlargement waits for a stable host API that can resize/create a destination document. Until then, use native resize followed by AI refinement rather than violating the effect contract.

Both plugins share one CI workflow, with separate Windows build jobs and release artifacts. The rolling release keeps their downloadable packages independent.
