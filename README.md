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
<i>❝To the people that have said I'm too small, I'm not fast enough, I don't have what it takes, I'm not strong enough. THANK YOU. — Muhammad Ali❞</i>
<!--ENDS_HERE_QUOTE_README-->
<!-- markdownlint-enable MD033 -->

## 📰 Recently on the air

<!--README_FEED:START-->
- [List do redakcji w sprawie masztu przy Wilczej: Mieszkańcy pytają o bezpieczeństwo i ład przestrzenny - jaw.pl](https://news.google.com/atom/articles/CBMiakFVX3lxTE9xSnExYml4LU9INmxrQnNOZ0QwNS1YLTdJMGFtRkp0dVBIMFlLVDI2anhfQXR6cmNXVlYzUHNMT253MHE0SG81eXhVRzVVZGdETm5RRW5MeDhpMkNJNFVEMWNqRTR3TFVzZ3c?oc=5)
- [Russia’s Shadow Fleet Turns to Nets and Rubber Tires for Makeshift Drone Armor](https://www.wsj.com/world/russias-shadow-fleet-turns-to-nets-and-rubber-tires-for-makeshift-drone-armor-95e817a1)
- [The Slate vs Ford Fathom debate might be settled by this one key tech feature](https://www.engadget.com/2300238/slate-vs-ford-fathom-android-auto-carplay-support/)
- [What the Cameras Saw | Post Mortem](https://www.cbsnews.com/video/103126-48-hours-post-mortem-episode-2/)
- [U.S. plans to deport Afghans back to their home country through Pakistan, documents show](https://abcnews.com/US/wireStory/us-plans-deport-afghans-back-home-country-pakistan-137741097)
- [Judge ends Trump's attempts to sue Wall Street Journal over Epstein reporting](https://www.reuters.com/world/us-judge-dismisses-trumps-lawsuit-against-wall-street-journal-with-prejudice-2026-10-31/)
<!--README_FEED:END-->
