<div align="center">

# twojstar

**Shared workshop for the small tools, experiments and utilities that are better maintained together.**

[Polski](README_pl.md) · **English** · [简体中文](README_zh.md)

[![Cloudflare](https://workers.cloudflare.com/built-with-cloudflare.svg)](https://www.cloudflare.com/) <a href="https://deepwiki.com/travnie/twojstar"><img src="https://deepwiki.com/badge.svg" alt="DeepWiki"></a>  
[![Docs7](https://raw.githubusercontent.com/travnie/.github/main/assets/badges/docs7.svg)](https://twojstar.docs7.io/)
[![Latest](https://img.shields.io/github/v/release/travnie/twojstar?display_name=tag&include_prereleases&style=for-the-badge&label=latest)](https://github.com/travnie/twojstar/releases/latest) [![license](https://img.shields.io/github/license/travnie/twojstar?style=for-the-badge&logo=opensourceinitiative&logoColor=white)](LICENSE)

[![Codebench](https://img.shields.io/badge/Codebench-barcodes-111827?style=flat-square&logo=qrcode&logoColor=white)](https://codebench.trfny.com) [![Streambench](https://img.shields.io/badge/Streambench-media-7c3aed?style=flat-square&logo=vlcmediaplayer&logoColor=white)](https://streambench.trfny.com) [![Docbench](https://img.shields.io/badge/Docbench-docs_%26_PDF-b45309?style=flat-square&logo=googledocs&logoColor=white)](https://docbench.travny.workers.dev)
[![Weather](https://img.shields.io/badge/Weather-Ko%C5%9Bcielec-16a34a?style=flat-square&logo=cloudflareworkers&logoColor=white)](https://weather.trfny.com)

</div>

---

## 🧭 Workshop map

| project | entry points | purpose |
|---|---|---|
| 🔳 **Benches** | [`benches/`](benches/) · [download](https://github.com/travnie/twojstar/releases/latest/download/benches-portable.zip) · [Codebench](https://codebench.trfny.com) · [Docbench](https://docbench.travny.workers.dev) · [Streambench](https://streambench.trfny.com) | Browser-first QR/barcode, document/PDF and media workshops. |
| 🌦️ **Weather Feed** | [`weather-feed/`](weather-feed/) · [weather.trfny.com](https://weather.trfny.com) | Multi-source weather, air-quality and IMGW alerts for Kościelec/Chrzanów, exposed as web, JSON and Atom. |
| 📰 **Feedboard** | [`feedboard/`](feedboard/) · [download](https://github.com/travnie/twojstar/releases/latest/download/feedboard.zip) | Windows 11 feed widget/provider with RSS/Atom/JSON Feed support and a small settings app. |
| 🛸 **SpaceMolt** | [`spacemolt/`](spacemolt/) · [`smx`](spacemolt/smx/) | Official v2 CLI companion and SpaceMolt tooling. |
| 🌀 **Loopling** | [`pets/loopling/`](pets/loopling/) · [previews](pets/loopling/gallery/) | Procedurally generated ChatGPT/Codex desktop pet with installers, animation atlas, previews and source art. |
| 📱 **Xiaomi ADB Tools** | [`xiaomi-adb-tools/`](xiaomi-adb-tools/) · [download](https://github.com/travnie/twojstar/releases/latest/download/xiaomi-adb-tools.zip) | Maintained desktop ADB/Fastboot utility with platform-specific JavaFX builds. |
| 🎨 **Paint.NET plugins** | [`addons/paintdotnet/`](addons/paintdotnet/) · [`ICO`](addons/paintdotnet/ico/) · [`AI Restore`](addons/paintdotnet/ai/) | ICO import/export plus local AI Restore, DeJPEG and Denoise effects. |
| 🎚️ **Audacity plugins** | [`addons/audacity/`](addons/audacity/) · [`VST3`](addons/audacity/vst3/) · [Windows](https://github.com/travnie/twojstar/releases/latest/download/audacity-auto-declip-windows.zip) · [Linux](https://github.com/travnie/twojstar/releases/latest/download/audacity-auto-declip-linux.zip) | Local-first audio restoration and workflow effects, starting with Auto Declip. |
| ⌨️ **Intent Keyboard** | [`intent-keyboard/`](intent-keyboard/) | Multiplatform semantic input experiment: rough intent in, natural text out, with tone, translation and protected facts. |
| 💾 **Remotely Save GDrive patch** | [`addons/remotely-save-gdrive-patch/`](addons/remotely-save-gdrive-patch/) | Personal-use Google Drive dedup/update patch with a non-redistributing verification harness. |

## 📦 One rolling release

GitHub **Latest** is the repository-wide rolling snapshot. Product workflows can keep detailed build artifacts internally; the central publisher exposes only compact product bundles:

- [`benches-portable.zip`](https://github.com/travnie/twojstar/releases/latest/download/benches-portable.zip) — Codebench, Docbench and Streambench portable builds,
- [`feedboard.zip`](https://github.com/travnie/twojstar/releases/latest/download/feedboard.zip) — Feedboard sideload package, certificate, verified installer and dependencies,
- [`xiaomi-adb-tools.zip`](https://github.com/travnie/twojstar/releases/latest/download/xiaomi-adb-tools.zip) — all five platform-specific Xiaomi ADB Tools JARs,
- [`paintdotnet-ico.zip`](https://github.com/travnie/twojstar/releases/latest/download/paintdotnet-ico.zip) — Paint.NET ICO plugin package,
- [`paintdotnet-ai.zip`](https://github.com/travnie/twojstar/releases/latest/download/paintdotnet-ai.zip) — Paint.NET AI Restore, DeJPEG and Denoise plugin package,
- [`audacity-auto-declip-windows.zip`](https://github.com/travnie/twojstar/releases/latest/download/audacity-auto-declip-windows.zip) — Auto Declip VST3 for Windows x64,
- [`audacity-auto-declip-linux.zip`](https://github.com/travnie/twojstar/releases/latest/download/audacity-auto-declip-linux.zip) — Auto Declip VST3 for Linux x64,
- [`SHA256SUMS`](https://github.com/travnie/twojstar/releases/latest/download/SHA256SUMS) — checksums for the seven product bundles.

The publisher assembles a complete draft first and moves the GitHub `Latest` pointer only after all required bundles are uploaded.

➡️ **[Open the current unified Latest](https://github.com/travnie/twojstar/releases/latest)**

## ⚙️ Maintenance

- Project-specific CI remains path-filtered so unrelated workshop changes do not rebuild everything.

## 📜 [License](LICENSE)

Repository-level code is under the [ISC License](https://spdx.org/licenses/ISC). Some projects may retain their own license files where required, such as Xiaomi ADB Tools' original MIT notice.

<div align="center">

<sub>one workshop · one rolling latest · fewer tiny repos</sub>

</div>

---
## 💬 Quote from the drawer

<!-- markdownlint-disable MD033 -->
<!--STARTS_HERE_QUOTE_README-->
<i>❝All the domain names such as Google, Log In or Sign Up were free until 1995, but now everyone has to pay for every new domain name.❞</i>
<!--ENDS_HERE_QUOTE_README-->
<!-- markdownlint-enable MD033 -->

## 📰 Recently on the air

<!--README_FEED:START-->
- [Star History Monthly October 2026 | Execution](https://www.star-history.com/blog/execution)
- [Time for Saudi Clarity on Normalization with Israel](https://carnegieendowment.org/research/2026/10/time-for-saudi-clarity-on-normalization-with-israel)
- [Pożar pociągu w Balinie. Iskry zapaliły benzynę w 1909 r. - Przelom.pl - portal ziemi chrzanowskiej](https://news.google.com/atom/articles/CBMioAFBVV95cUxPV1JPdk93VlQtRjY4bVoxQ0ljXzcxX3cwWXhvM2ZHSUE0VDdjNlhTR0xQSzlMa0tnYXItbHBieXBmUkVyajN6R1BWamRHU19sTC02Q3oxRXpRcWphS3V1LU1fcWJCN0FVMDg0Qm12Nk0tWTdMRVhRU0ZEWVM1ZGxRd3ZXQm1pdEJsRWhNZWtFSVMyOUdXTVRqdWVDc1czX3NB?oc=5)
- [Serbia's Vucic concedes defeat to student led movement in parliamentary election](https://www.reuters.com/world/europe/serbias-vucic-concedes-defeat-student-led-movement-parliamentary-election-2026-10-25/)
- [Będzie duży przełom w polityce Serbii? Zamknięto lokale wyborcze - Radio Zet](https://news.google.com/atom/articles/CBMiogFBVV95cUxPUXJYdUlWWGtzZnhBRTcwOTA0Sy1wRjBhYnVpRmxjWUhYbGNHS0hsOGNDMnl6RUdxZTNwY2dUWjhYc2MyanBNa2RxS09xQm5hT3JvSXk0OGZ0VHNYb3F0SUdNX1N4ZWdBdEZ5Z0ppVnB5U2FnNU10Z2ZLXzdYNVdOcnF5Wk1VczFzM2RwNE05Q0ttWk96VnFkLUxSWTJFakc1LXc?oc=5)
- [Komisje bez kamer. Czego obawiają się krzeszowiccy radni? - krzeszowiceone.pl](https://news.google.com/atom/articles/CBMiqAFBVV95cUxQMWZFUDVHWkNUVXU2V3NyUGZwcnVUZGF2MEFXRllQcldzd0dBeWY3WkhnQ3R2UGFhVzRXUmkyMWNRQ1VxZXFmVWhOS2c3MnhjcEJsdWpsUkVmemE5anFzUFlDMy16Wk02OTVQM0ppd0NOT2dTb1g5MmdUb090dXZuWGtJdFdoV19yS1o0X3hmcTNVX294Rl9fT3VPVFhGTGVxVnVKQlczcULSAa4BQVVfeXFMT0p4SHVfX2VsRmxFdzdFRmtkU19UVVFxcENYN0VSUTAtVUNoMWo1ZjJ5Q2owbkNxc1VncDhhVWpwUFdNd1Y5WTFYNTNDbDJDdGxxWFZDMDFmR1VweTBLbXhtSkc1eGkwdVpmM3V3VUVrN0tIZzRueFBfSnB6MXgwZ3hzb2gxMjRvUDZVUGI2SDc0UDN2cUVsaUIzU1N4WHV5c0V1ZW9RcW1ZVi1SOVJB?oc=5)
<!--README_FEED:END-->
