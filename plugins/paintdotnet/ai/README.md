# Paint.NET AI

Local AI/restoration pack for Paint.NET. **AI Restore** stays the fast, small general default; **AI DeJPEG** and **AI Denoise** add stronger 1x restoration for compression artifacts and real-world noise without changing the canvas size.

## Profiles

### Fast — current AI Restore

- Real-ESRGAN `realesr-general-x4v3` via ONNX Runtime
- local processing only; the plugin never uploads images or downloads models at runtime
- preserves the original canvas dimensions and alpha channel
- deterministic 128 px restoration tiles with the model's full 34 px receptive-field context
- bounded tile cache avoids repeating the same expensive inference across Paint.NET render regions
- active ONNX inference is terminated when Paint.NET cancels rendering
- downsamples the model's 4x reconstruction back to the current canvas and blends it with the source
- **Strength** controls how much of the restored result is applied

### Restore+ — DeJPEG and Denoise

Both effects reuse the same local ONNX Runtime, cancellation and bounded tile cache as AI Restore.

- **AI DeJPEG** — FBCNN Color FP16. `Strength` controls FBCNN's compression-removal input; 50 is the default. Uses 16 px tile context and applies the model at the current image size.
- **AI Denoise** — SCUNet Color Real-PSNR FP16. `Strength` blends the denoised result with the source; 75 is the default. Uses 128 px context to avoid SCUNet tile seams.
- Existing alpha is preserved; RGB inference never changes document dimensions.
- No network access at runtime. Models are bundled and checksum-verified by CI.

The models are not tiny: FBCNN is about 144 MB and SCUNet about 38 MB. They are still practical for local desktop inference, but the release ZIP is intentionally larger than the Fast-only prototype.

## Acceleration

- Windows ML `2.3.42` supplies the ONNX Runtime and bundled DirectML execution provider.
- Sessions request `MAX_PERFORMANCE`, so capable Windows systems prefer their fastest available accelerator and fall back to CPU when needed.
- The runtime stays self-contained: no execution-provider or model downloads happen while Paint.NET is running.
- Windows ML requires Windows 10 19H1 (build 18362) or newer.

## Upscaling

A normal Paint.NET effect renders into the current document bounds, so true 2x/4x document enlargement must not be faked inside an effect.

For Paint.NET 5.x the safe paths are:

1. **Restore at current size** — all current AI effects keep the existing canvas dimensions.
2. **Resize then refine** — user resizes the image with Paint.NET, then runs AI Restore to reconstruct detail and suppress interpolation artifacts.
3. **True one-click upscale later** — only when there is a stable host/document API that can create or resize the destination document without relying on private internals. Paint.NET 5.2's modern FileType system is useful infrastructure, but a FileType plugin is not a general document-resize command.

## Smart Transparency

The first useful version should produce a matte, not delete pixels blindly:

- preserve existing alpha when it is already cleaner than the predicted matte,
- expose `Subject / Portrait / Auto` modes rather than pretending one segmentation model fits everything,
- keep hair/fur/soft edges semi-transparent,
- optional edge decontamination for background colour spill,
- preview through the normal Paint.NET effect pipeline,
- no network dependency.

## SVG utility

SVG belongs in the same Paint.NET plugin hub but as a **FileType/utility component**, not as an AI effect.

The goal is robust SVG raster import for the annoying real-world cases:

- `viewBox`, transforms and nested groups,
- gradients, masks and clip paths,
- opacity and transparent backgrounds,
- embedded raster images,
- sensible sizing/DPI controls,
- predictable font fallback warnings instead of silent layout changes,
- an import preview before rasterization.

`Svg.Skia` + SkiaSharp is a promising MIT-licensed renderer candidate. Paint.NET remains a raster editor, so importing SVG means rendering it to pixels; the pack should not pretend it can preserve arbitrary SVG as editable vector objects. Exporting a raster document back to SVG merely by embedding a PNG is not a useful feature and is out of scope.

Paint.NET 5.2's modern FileType plugin system is especially interesting here because it is decoupled from the old `Document`/`Layer` plugin contract and supports richer pixel formats.

## Packaging direction

The **current** release layout remains the source of truth:

```text
Common/
└── Travny.PaintDotNet.AI/
    ├── Microsoft.ML.OnnxRuntime.dll
    ├── Microsoft.Windows.AI.MachineLearning.dll
    ├── onnxruntime.dll
    ├── DirectML.dll
    └── model/
        ├── realesr-general-x4v3.onnx
        ├── fbcnn_color_fp16.onnx
        └── scunet_color_real_psnr_fp16.onnx
Paint.NET-5.1/
Paint.NET-5.2+/
licenses/
Install.bat
```

The release stays one downloadable `paintdotnet-ai.zip`. The installer chooses the Paint.NET adapter and copies the complete shared runtime/model payload; there is no runtime model downloader.

The package ships separate adapters for **Paint.NET 5.1.x** and **Paint.NET 5.2+**, while sharing one ONNX Runtime/model payload.

## Install

Use the release ZIP and run `Install.bat`, then choose the installation type and Paint.NET version. The installer distinguishes a standard Classic install, Microsoft Store, and a custom Classic folder. Classic targets request administrator permission and install the complete plugin folder to:

`C:\Program Files\paint.net\Effects\Travny.PaintDotNet.AI`

Microsoft Store builds fall back to `Documents\Paint.NET App Files\Effects\Travny.PaintDotNet.AI`.

Portable Paint.NET users can create `Effects\Travny.PaintDotNet.AI`, copy everything from `Common\Travny.PaintDotNet.AI` into it, then add the matching adapter DLL from `Paint.NET-5.1` or `Paint.NET-5.2+`.

## Model provenance

CI pins and verifies every bundled model before packaging:

- Real-ESRGAN `realesr-general-x4v3.onnx`: SHA-256 `1940a93ee08283a0a7286183186357b1688fe9fa8ede74604b424586aaddf112`.
- FBCNN Color FP16: SHA-256 `1a678ff4f721b557fd8a7e560b99cb94ba92f201545c7181c703e7808b93e922`.
- SCUNet Color Real-PSNR FP16: SHA-256 `8923b09e240e0078b3247964e9b105cbfbb4da01e260b29a961d038f8fa7791a`.

FBCNN and SCUNet upstream projects are Apache-2.0 licensed. Their license texts, ONNX Runtime and Real-ESRGAN notices, plus the Windows ML runtime license and third-party notices are shipped in `licenses/`. The DeJPEG Android application itself is only a model/behavior reference; its AGPL application code is not copied into this plugin.
