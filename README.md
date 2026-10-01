<div align="center">

# twojstar

**Shared workshop for the small tools, experiments and utilities that are better maintained together.**

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
| 🛸 **SpaceMolt** | [`spacemolt/`](spacemolt/) · [`smx`](spacemolt/smx/) · [agent plugin](spacemolt/plugin/) | Official v2 CLI companion, game skill, and the full gameplay and documentation MCP servers. |
| 📱 **Xiaomi ADB Tools** | [`xiaomi-adb-tools/`](xiaomi-adb-tools/) · [download](https://github.com/travnie/twojstar/releases/latest/download/xiaomi-adb-tools.zip) | Maintained desktop ADB/Fastboot utility with platform-specific JavaFX builds. |
| 🎨 **Paint.NET plugins** | [`plugins/paintdotnet/`](plugins/paintdotnet/) · [`ICO`](plugins/paintdotnet/ico/) · [`AI Restore`](plugins/paintdotnet/ai/) | ICO import/export plus local AI Restore, DeJPEG and Denoise effects. |
| 🎚️ **Audacity plugins** | [`plugins/audacity/`](plugins/audacity/) · [`VST3`](plugins/audacity/vst3/) · [Windows](https://github.com/travnie/twojstar/releases/latest/download/audacity-auto-declip-windows.zip) · [Linux](https://github.com/travnie/twojstar/releases/latest/download/audacity-auto-declip-linux.zip) | Local-first audio restoration and workflow effects, starting with Auto Declip. |
| ⌨️ **Intent Keyboard** | [`intent-keyboard/`](intent-keyboard/) | Multiplatform semantic input experiment: rough intent in, natural text out, with tone, translation and protected facts. |
| 💾 **Remotely Save GDrive patch** | [`plugins/remotely-save-gdrive-patch/`](plugins/remotely-save-gdrive-patch/) | Personal-use Google Drive dedup/update patch with a non-redistributing verification harness. |

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
<i>❝It does good also to take walks out of doors, that our spirits may be raised and refreshed by the open air and fresh breeze: sometimes we gain strength by driving in a carriage, by travel, by change of air, or by social meals and a more generous allowance of wine. — Seneca❞</i>
<!--ENDS_HERE_QUOTE_README-->
<!-- markdownlint-enable MD033 -->

## 📰 Recently on the air

<!--README_FEED:START-->
- [I LO w Chrzanowie świętuje jubileusz z absolwentami - Przelom.pl - portal ziemi chrzanowskiej](https://news.google.com/atom/articles/CBMi2wFBVV95cUxPS0xvVlI2STRvZTZ1b0l2SnJjQTJ5aEM0V29ZWVNPMkRlQVRpNEh3TkVfdlJqaTJRNExsWEQxd0QtSmpwc2tlVDlSY0pWOU51Tm05WXI2YUE4Si11TERaYWE5TjZfZmY2UFZrSFZxbmJfLWY0RDVlX0l4R3NBNmdOUVpMNHZtSWVaNXhUQW5rd2lMVG5MWnB5UkQ0RzNwaHVmeEV0U1NUMmE1aUhNa3EyaVc5TF84dUJxNXlUQW1xV2NFRW56SUFYZTlzUWZ1XzRyWlk4ZGdCVHA2UVk?oc=5)
- [Mieszkańcy nie kryją strachu. Setki ich działek trafią do polderów - Przelom.pl - portal ziemi chrzanowskiej](https://news.google.com/atom/articles/CBMiuwFBVV95cUxOZHlZb0FrczllSkhvOXVuLUJOX1VMQVMxTnhnMVpZVlFXQVg4bXlSbm9tNHczdGtTZzhHb0d5OHFnZG9nNk13T3RTLXZNUVRaQlNhZjRUeHZUdmI2Z2k3dmpnWEpyOEdGWVJhbklNaGNRVldYZlZDQTdCT0l3bUUxWXhibnAyLW9SWTRvMUs5OFFnYnFpNDlPTkdNcGppRGt2bDdvaXZGY21QeUMtN01WUTl5WWNTVXRnVDZF?oc=5)
- [Fed's Williams sees no urgency for next Fed rate hike](https://www.reuters.com/business/feds-williams-sees-no-urgency-next-fed-rate-hike-2026-09-29/)
- [OpenAI’s latest features take direct aim at the app store model](https://techcrunch.com/2026/09/29/openais-latest-features-take-direct-aim-at-the-app-store-model/)
- [Supreme Court lets Trump resume deporting migrants to countries not their own](https://www.reuters.com/world/supreme-court-lets-trump-resume-third-country-deportations-2026-09-29/)
- [Somali pirates kill 5 crew members before tanker rescue, state authorities say](https://www.reuters.com/world/africa/puntland-forces-rescue-another-hijacked-ship-somali-pirates-2026-09-29/)
<!--README_FEED:END-->
