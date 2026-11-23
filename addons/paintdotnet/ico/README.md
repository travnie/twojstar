# Paint.NET ICO FileType

[![Paint.NET CI](https://github.com/travnie/twojstar/actions/workflows/paintdotnet-ci.yml/badge.svg?branch=main)](https://github.com/travnie/twojstar/actions/workflows/paintdotnet-ci.yml) [![C Sharp](https://img.shields.io/badge/C_Sharp-512BD4?logo=dotnet&logoColor=white&style=flat-square)](https://dotnet.microsoft.com/en-us/languages/csharp)

Dependency-free C# codec for multi-frame Windows `.ico` files (v0.2.1). [Latest ZIP](https://github.com/travnie/twojstar/releases/latest/download/paintdotnet-ico.zip) includes adapters and `Install.bat` for Paint.NET 5.1 and 5.2+.

## Source / behavior

- Opens PNG-backed and BMP/DIB-backed ICO frames as named layers; skips malformed frames. Exports multiple sizes (16–256 px), alpha and optional aspect-ratio padding.
- `PaintDotNetIco.Modern.csproj`: Paint.NET **5.2+** FileTypes API / **.NET 11 stable** SDK, compiled against the official Paint.NET 5.2 GA assemblies.
- `PaintDotNetIco.csproj`: Paint.NET **5.1** compatibility API / **.NET 9** SDK.
- Shared codec is plain C#, no Pillow/ImageSharp dependency.
- v0.2.1 distinguishes the dialog-free multi-frame loader from older DLLs that also reported v0.2.0. Paint.NET's Save As preview reopens the temporary ICO, so loading must never open a picker.

## Build

```powershell
dotnet build .\PaintDotNetIco.Modern.csproj -c Release
# Classic adapter: point to a Paint.NET 5.1 installation
dotnet build .\PaintDotNetIco.csproj -c Release -p:PaintDotNetDir='D:\Apps\paint.net-5.1'
```

## Install

Use the release ZIP's `Install.bat` and choose Classic, Store or custom folder; restart Paint.NET. Classic: `C:\Program Files\paint.net\FileTypes`; Store: `Documents\Paint.NET App Files\FileTypes`; portable: `<Paint.NET directory>\FileTypes`. If a portable folder is writable without elevation, use the ZIP's `INSTALL.txt` to copy the matching adapter DLL into its `FileTypes` folder manually; `Install.bat` may request administrator rights and exit when denied. CI builds both adapters against SHA-verified Paint.NET 5.1.12 and **5.2 stable** references and runs codec smoke tests. A passing badge does **not** establish in-app host compatibility.

## Manual 5.2 host check

Install the `Paint.NET-5.2+` DLL, restart Paint.NET 5.2, then verify:

1. `Windows Icon (*.ico)` appears in the **Open** and **Save As** format lists (FileType plugins do not appear in the Effects menu).
2. Open a multi-frame ICO with PNG-backed and BMP/DIB-backed frames. Confirm the decoded sizes are separate named layers, with transparency intact.
3. Use a **non-square** source, save 16, 32, 48 and 256 px entries with **Preserve aspect ratio** on and off, then reopen and verify sizes, alpha and transparent padding.
4. During **Save As**, check that the preview renders without an additional **Open Windows Icon** dialog.
5. If the format is missing, inspect **Settings → Plugin Errors** before assuming the decoder is broken.

CI and the rolling release do **not** enforce this in-app check. Use the checklist for manual host verification; do not treat a successful build as proof of Paint.NET UI compatibility.
