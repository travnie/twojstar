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
| 🟠 **Claude Dev Kit** | [`plugins/claude-dev-kit/`](plugins/claude-dev-kit/) | Anthropic Claude API and MCP Builder skills paired with the live Claude Code Docs MCP. |
| 🖥️ **Desktop Commander** | [`plugins/desktop-commander/`](plugins/desktop-commander/) | Local-computer workflow skill paired with Desktop Commander Remote MCP. |
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
<i>❝In Windows 98, minimized windows are actually moved far away outside the average monitor’s resolution.❞</i>
<!--ENDS_HERE_QUOTE_README-->
<!-- markdownlint-enable MD033 -->

## 📰 Recently on the air

<!--README_FEED:START-->
- [Can Nuclear Fuel be Delivered in Time to Power Advanced Nuclear Reactors?](https://carnegieendowment.org/research/2026/10/can-nuclear-fuel-be-delivered-in-time-to-power-advanced-nuclear-reactors)
- [Policjantka z Chrzanowa najlepszym oskarżycielem publicznym - Przelom.pl - portal ziemi chrzanowskiej](https://news.google.com/atom/articles/CBMiqgFBVV95cUxNbGVjQnBfMzFfUmppWlZrWkpWUk9RbG1HM0wwdm9qak0wOVc0YUVCRm1tSF9mREYwNDVwZ1JKcU1NT1d6cUdwNkE0T18wLVVxWGJqbDRtSlRCSFgzeXJCeG9BNDM0R1JKSHNQRUhuV2E4T0x1VktwNHlrZkIwdFNKc0dkbnlaZUdkclZENGxWd080OW9CdTQyY2RqcS0zMF9kNUU1eDJ1NWdwQQ?oc=5)
- [Christa Pike 'angry and confused' about Tennessee's failed execution effort, lawyers say](https://www.reuters.com/legal/government/christa-pikes-lawyers-demand-see-syringes-drug-residue-botched-execution-2026-10-07/)
- [FBI arrests man for plotting mass shooting at Mall of America](https://www.reuters.com/legal/government/fbi-arrests-man-plotting-mass-shooting-mall-america-2026-10-07/)
- [Venezuela's Maduro to face new US charges over alleged torture of Americans, official says](https://www.reuters.com/world/americas/maduro-wife-expected-face-new-charges-over-alleged-torture-americans-cnn-says-2026-10-07/)
- [Spanish woman whose eviction ignited housing protests dies at 87](https://www.reuters.com/world/evicted-spanish-octogenarian-maricarmen-abascal-heart-spains-housing-protests-2026-10-07/)
<!--README_FEED:END-->
