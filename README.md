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
| 🧩 **OpenAI Dev Kit** | [`plugins/openai-dev-kit/`](plugins/openai-dev-kit/) | Two developer skills, Plugin Builder artwork, and the official read-only OpenAI docs MCP. |
| ☁️ **Google Dev Kit** | [`plugins/google-dev-kit/`](plugins/google-dev-kit/) | Seven deduplicated Google Cloud/Gemini workflows backed by ten Google MCP endpoints and live docs. |
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
<i>❝An average person normally blinks 20 times a minute, but when using a computer he/she blinks only 7 times a minute.❞</i>
<!--ENDS_HERE_QUOTE_README-->
<!-- markdownlint-enable MD033 -->

## 📰 Recently on the air

<!--README_FEED:START-->
- [The Debt Toll Booth: A Modular Solution to Addressing Sovereign Debt Crises](https://carnegieendowment.org/research/2026/10/the-debt-toll-booth-a-modular-solution-to-addressing-sovereign-debt-crises)
- [Przedwojenny Oświęcim na archiwalnych fotografiach - gazetakrakowska.pl](https://news.google.com/atom/articles/CBMigwJBVV95cUxPYWZlaDhFQnJ2SC1RVm91T2lmby1XUmp2Q1AxRkREQ0lYa3BMVW0yUE56NjY3dEpoZDR4dUl2cE9oRndSRzFDTExHdVZQZjBXQUNKZlppNDNGWDdUYVdMZ053TUl6em1IWmM5XzNaaERSb2lFc3laOVkydFVFNXgyTUd5NE5kemh1NDVDOWlvekFJWk82OHdjRUcyUk9KNlRpSGpjN0k1QnI0TVkwWXpIcXRoV1JoeW1nNGtRbC1NeFNaaDRvTDZfbW0zdWR0czNCOE1yTjdLdXh5aUNRaHlqOFlSMDFfSFlKWXlXZHNXRjh0WkRkZlZobm83TnV3bjVhY1N3?oc=5)
- [Pożar busa w Nowej Wsi - Fakty Oświęcim](https://news.google.com/atom/articles/CBMiY0FVX3lxTE43eWR1Q1hSdTNqaVNBWjVaTUlVaE9EV1NxMWpWbFNrMkRFMFZqRmlEQ0hTdEQtYWFWZGdQcmVkbmZna3lwOTU1eXpXSHJPeU83bXdoZ2RqLXhSc1cxdUNvT0dLMA?oc=5)
- [CHUDZIK KRZYSZTOF - Dziennik Polski](https://news.google.com/atom/articles/CBMi0gFBVV95cUxPZTMzaXk4QTFwUFpZV2xOclNDMEdkZDd0N29tY0FqR2VkSEZBMklxTFN0MExIY2J0VmVMV3F4OVhZVlFDajM2ZFRybGxIOWNXWFBHb2RVN1RpanRWaXBKSThxNDNQZldFWTIyUXQteWg4UE80RGN6T2dfNVlJNFhzdFJJdW5TMXBMbWZhckprQVdENjNkOEJ4MTZhZDlBZW5OM2JmbTNRaERPVGFlLUJ4Mk9qZUh2TFZoTzFuNm9fY2xJVU1iSVUzcFFzTGlFLUp6MGc?oc=5)
- [Przegląd AI: 3 października 2026](https://promptowy.com/przeglad-ai-2026-10-03/)
- [Zamknięcie dnia: Agenci wymknęli się spod kontroli - i mamy dowody](https://promptowy.com/zamkniecie-dnia-agenci-wymkneli-sie-spod-kontroli-i-mamy-dowody/)
<!--README_FEED:END-->
