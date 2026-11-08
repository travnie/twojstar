# Paint.NET ICO FileType

[![Paint.NET CI](https://github.com/travnie/twojstar/actions/workflows/paintdotnet-ci.yml/badge.svg?branch=main)](https://github.com/travnie/twojstar/actions/workflows/paintdotnet-ci.yml) [![C Sharp](https://img.shields.io/badge/C_Sharp-512BD4?logo=dotnet&logoColor=white&style=flat-square)](https://dotnet.microsoft.com/en-us/languages/csharp)

Dependency-free C# codec for multi-frame Windows `.ico` files. [Latest ZIP](https://github.com/travnie/twojstar/releases/latest/download/paintdotnet-ico.zip) includes adapters and `Install.bat` for Paint.NET 5.1 and 5.2+.

## Source / behavior

- Opens PNG-backed and BMP/DIB-backed ICO frames as named layers; skips malformed frames. Exports multiple sizes (16–256 px), alpha and optional aspect-ratio padding.
- `PaintDotNetIco.Modern.csproj`: Paint.NET **5.2+** FileTypes API / **.NET 11 preview** SDK.
- `PaintDotNetIco.csproj`: Paint.NET **5.1** compatibility API / **.NET 9** SDK.
- Shared codec is plain C#, no Pillow/ImageSharp dependency.

## Build

```powershell
dotnet build .\PaintDotNetIco.Modern.csproj -c Release
# Classic adapter: point to a Paint.NET 5.1 installation
dotnet build .\PaintDotNetIco.csproj -c Release -p:PaintDotNetDir='D:\Apps\paint.net-5.1'
```

## Install

Use the release ZIP's `Install.bat` and choose Classic, Store or custom folder; restart Paint.NET. Classic: `C:\Program Files\paint.net\FileTypes`; Store: `Documents\Paint.NET App Files\FileTypes`; portable: `<Paint.NET directory>\FileTypes`. If a portable folder is writable without elevation, use the ZIP's `INSTALL.txt` to copy the matching adapter DLL into its `FileTypes` folder manually; `Install.bat` may request administrator rights and exit when denied. CI builds both adapters; a passing badge does **not** claim untested host compatibility.
