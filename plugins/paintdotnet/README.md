# Paint.NET plugins

Shared home for Paint.NET extensions maintained in this repository.

## Current plugins

- [`ico/`](ico/) — ICO import/export FileType plugin for Paint.NET 5.1 and 5.2+.
- [`ai/`](ai/) — local AI restoration pack with Real-ESRGAN **AI Restore**, FBCNN **AI DeJPEG**, and SCUNet **AI Denoise**. Smart transparency/matting and SVG import remain future work.

Stable release assets remain separate so users can install only what they need:

- [`paintdotnet-ico.zip`](https://github.com/travnie/twojstar/releases/latest/download/paintdotnet-ico.zip)
- [`paintdotnet-ai.zip`](https://github.com/travnie/twojstar/releases/latest/download/paintdotnet-ai.zip)

## Direction

Keep future Paint.NET work here instead of creating new top-level projects.

The AI pack should grow by capability/profile rather than by making a new directory for every model:

- **Fast** — small Real-ESRGAN model, low friction, current-size restoration.
- **Restore+** — FBCNN DeJPEG and SCUNet Denoise with explicit performance/storage trade-offs.
- **Heavy** — intentionally out of scope for now; do not grow a local plugin into a multi-gigabyte model manager by accident.

SVG support belongs to this Paint.NET hub as a FileType/utility component. Paint.NET is still a raster editor, so the useful goal is reliable SVG raster import and transparent handling of SVG edge cases, not pretending arbitrary vector documents remain editable vectors.

True one-click 2x/4x document enlargement waits for a stable host API that can resize/create a destination document. Until then, use native resize followed by AI refinement rather than violating the effect contract.

Each plugin keeps its own build/release workflow when its toolchain differs, while shared repository concerns such as Dependabot cover the whole `plugins/paintdotnet/` tree.
