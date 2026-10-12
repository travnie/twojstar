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
| 🟧 **Cloudflare** | [`plugins/cloudflare/`](plugins/cloudflare/) | Cloudflare platform skill paired with the token-efficient Cloudflare API MCP. |
| 🐙 **GitHub Ops** | [`plugins/github-ops/`](plugins/github-ops/) | GitHub workflow and merge-gate skill paired with the full GitHub Copilot MCP toolset. |
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
<i>❝A programmer developed an operating system called TempleOS in Hospitalized for mental health problems, he believes that TempleOS is literally the Third Temple as biblically prophesied. Per God’s “instructions,” the OS uses a 640×480, 16 color display, and uses the language HolyC.❞</i>
<!--ENDS_HERE_QUOTE_README-->
<!-- markdownlint-enable MD033 -->

## 📰 Recently on the air

<!--README_FEED:START-->
- [Operetka wróci do Młoszowej - Przelom.pl](https://news.google.com/atom/articles/CBMif0FVX3lxTE1zeVl6VHlCYlBqSlNRYU5TVGoxV19VSTU0a3FCckpiYjdUT0tMOEptNTRkLV92MzRXdUlINXIxajBRVWVvOVQzSkw3RVdCM3IxUFd5aVZETHNtOG1LN053dHRHUmEtaUZDeW5qTXJjUXl6WC1XdGFYYVZpRXJIUkU?oc=5)
- [Seniorzy z UTW ruszyli po wiedzę, zdrowie i przygodę - Przelom.pl](https://news.google.com/atom/articles/CBMirgFBVV95cUxPcGRwc1ludjBJSWFaZ0dWZ0JUUkxwczBoSWQ2cGVRUkgxb3NNWWo0ZnJqNW5Id1dyWkFCa1pZQVJRU3VmdXVkajlnZ0xsWHJFaDJrYUtMUmNFeVFta0otcFFSUS1UMlhrTXNhcHF4SExiTnJQZXY5YUtyY2xuSnFYV0ctcEhZcDR5bUFyUDZTdkpHbktDY2lIMFZSdVUyLWpSTkdfWGx4Rl93c1g2SVE?oc=5)
- [Amazon in talks to buy AI startup Decart for around $7 billion, WSJ reports](https://www.reuters.com/business/retail-consumer/amazon-talks-buy-ai-startup-decart-around-7-billion-wsj-reports-2026-10-11/)
- [W mijającym tygodniu odeszli od nas \[5 - 10 październik\] - Przelom.pl](https://news.google.com/atom/articles/CBMiogFBVV95cUxQRTFFRDRGbkVMMXI0Ym8yd2g1a3IwaXczZm1VaUpmbWRwaVdwd3Z0TWRlSWZOcW1IVUdPcGluV2VicHo2blVOREt5djFERnowR3dsSkFwN0FraV9HYUt1UEE5T3VXM1RqZG14bHNOVFhLMWUxenBFa2E5ZWpyaHROWERHUXVOZUVldnBfNWhnZnY1X0tnMjIydGQzeG9tQmF3NHc?oc=5)
- [Wiązanki i kwiaty na cmentarz Wszystkich Świętych 2026. Najpiękniejsze stroiki na cmentarz z żywych kwiatów 12.10.2026 - Dziennik Łódzki](https://news.google.com/atom/articles/CBMi8wFBVV95cUxObjFvTnNmTEh2c2ZWZGttUWJRX25MLU5sRHJJSWVlVWhQdjFvMjVjaFE3amdLd015THpMY2hjb3V3azJOY0xFQ1dRU3lQcjRRaTNZTzJBUEJYWGxOYS1TX3Y2M1N5V2dwQ2xLV0FSblkwaTVCZGFkU2xNdmNSRTY3WmRTal9COW95T1BfaE0zT2pBaENXTk9OU3JKaEwxRnpiZkcwOFBnX3h0ZnNDbTBmUTJEYm4wMVNQQ1pBckQzTE5GdHJwckl0b3hJbzBDaVJhX2ItZTZoMlJRTW5TUEJFOGtRT21udE5DSzBWeEE1LTJsdzg?oc=5)
- [At least 72 Sudanese artisanal miners killed in strike, rights monitor says](https://www.reuters.com/world/africa/least-72-sudanese-artisanal-miners-killed-strike-saturday-rights-monitor-says-2026-10-11/)
<!--README_FEED:END-->
