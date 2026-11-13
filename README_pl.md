<div align="center">

# twojstar

**Wspólny warsztat małych narzędzi, eksperymentów i aplikacji, które łatwiej utrzymywać razem.**

**Polski** · [English](README.md) · [简体中文](README_zh.md)

[![Latest](https://img.shields.io/github/v/release/travnie/twojstar?display_name=tag&include_prereleases&style=for-the-badge&label=latest)](https://github.com/travnie/twojstar/releases/latest)
[![License](https://img.shields.io/github/license/travnie/twojstar?style=for-the-badge)](LICENSE)

</div>

## 🧭 Mapa warsztatu

| Projekt | Gdzie zajrzeć | Co robi |
| --- | --- | --- |
| 🔲 **Benches** | [`benches/`](benches/) · [pobierz](https://github.com/travnie/twojstar/releases/latest/download/benches-portable.zip) · [Codebench](https://codebench.trfny.com) · [Docbench](https://docbench.travny.workers.dev) · [Streambench](https://streambench.trfny.com) | Narzędzia przeglądarkowe do kodów QR/barcode, dokumentów/PDF i multimediów. |
| 🌦️ **Weather Feed** | [`weather-feed/`](weather-feed/) · [weather.trfny.com](https://weather.trfny.com) | Pogoda z wielu źródeł, jakość powietrza i alerty IMGW dla Kościelca/Chrzanowa; web, JSON i Atom. |
| 📰 **Feedboard** | [`feedboard/`](feedboard/) · [pobierz](https://github.com/travnie/twojstar/releases/latest/download/feedboard.zip) | Widżet i dostawca feedów RSS/Atom/JSON Feed dla Windows 11 z małą aplikacją ustawień. |
| 🛸 **SpaceMolt** | [`spacemolt/`](spacemolt/) · [`smx`](spacemolt/smx/) | Oficjalny towarzysz CLI v2 i narzędzia SpaceMolt. |
| 🌀 **Loopling** | [`pets/loopling/`](pets/loopling/) · [podglądy](pets/loopling/gallery/) | Proceduralnie generowany pet ChatGPT/Codex z instalatorami, atlasem animacji, podglądami i źródłami. |
| 👾 **GPTomek** | [`pets/gptomek/`](pets/gptomek/) · [podgląd](pets/gptomek/gallery/in-motion.gif) | Animowany turkusowy gremlin tokenów dla ChatGPT i Codex. |
| 📱 **Xiaomi ADB Tools** | [`xiaomi-adb-tools/`](xiaomi-adb-tools/) · [pobierz](https://github.com/travnie/twojstar/releases/latest/download/xiaomi-adb-tools.zip) | Utrzymywane narzędzie ADB/Fastboot z buildami JavaFX dla konkretnych platform. |
| 🎨 **Paint.NET plugins** | [`addons/paintdotnet/`](addons/paintdotnet/) · [`ICO`](addons/paintdotnet/ico/) · [`AI Restore`](addons/paintdotnet/ai/) | Import/eksport ICO oraz lokalne efekty AI Restore, DeJPEG i Denoise. |
| 🎚️ **Audacity plugins** | [`addons/audacity/`](addons/audacity/) · [`VST3`](addons/audacity/vst3/) · [Windows](https://github.com/travnie/twojstar/releases/latest/download/audacity-auto-declip-windows.zip) · [Linux](https://github.com/travnie/twojstar/releases/latest/download/audacity-auto-declip-linux.zip) | Lokalne efekty przywracania dźwięku i workflow, zaczynając od Auto Declip. |
| ⌨️ **Intent Keyboard** | [`intent-keyboard/`](intent-keyboard/) | Wieloplatformowy eksperyment z semantycznym wprowadzaniem: intencja → naturalny tekst, z tonem, tłumaczeniem i chronionymi faktami. |
| 💾 **Remotely Save GDrive patch** | [`addons/remotely-save-gdrive-patch/`](addons/remotely-save-gdrive-patch/) | Prywatna poprawka dedup/update Google Drive z harnessem weryfikacyjnym bez redystrybucji. |

## 📦 Jedno wydanie zbiorcze

GitHub **Latest** to repozytorium-szeroki rolling snapshot. Workflow produktów mogą trzymać szczegółowe artefakty wewnętrznie; centralny publikator wystawia tylko kompaktowe paczki:

- [`benches-portable.zip`](https://github.com/travnie/twojstar/releases/latest/download/benches-portable.zip) — przenośne buildy Codebench, Docbench i Streambench,
- [`feedboard.zip`](https://github.com/travnie/twojstar/releases/latest/download/feedboard.zip) — pakiet sideload Feedboard, certyfikat, zweryfikowany instalator i zależności,
- [`xiaomi-adb-tools.zip`](https://github.com/travnie/twojstar/releases/latest/download/xiaomi-adb-tools.zip) — wszystkie pięć platformowych JAR-ów Xiaomi ADB Tools,
- [`paintdotnet-ico.zip`](https://github.com/travnie/twojstar/releases/latest/download/paintdotnet-ico.zip) — pakiet pluginu Paint.NET ICO,
- [`paintdotnet-ai.zip`](https://github.com/travnie/twojstar/releases/latest/download/paintdotnet-ai.zip) — pakiet pluginów Paint.NET AI Restore, DeJPEG i Denoise,
- [`audacity-auto-declip-windows.zip`](https://github.com/travnie/twojstar/releases/latest/download/audacity-auto-declip-windows.zip) — Auto Declip VST3 dla Windows x64,
- [`audacity-auto-declip-linux.zip`](https://github.com/travnie/twojstar/releases/latest/download/audacity-auto-declip-linux.zip) — Auto Declip VST3 dla Linux x64,
- [`SHA256SUMS`](https://github.com/travnie/twojstar/releases/latest/download/SHA256SUMS) — sumy kontrolne siedmiu paczek produktowych.

Publikator najpierw kompletuje pełny draft, a dopiero potem przesuwa wskaźnik GitHub `Latest`.

➡️ **[Otwórz aktualne zjednoczone Latest](https://github.com/travnie/twojstar/releases/latest)**

## ⚙️ Utrzymanie

- CI projektów pozostaje filtrowane ścieżkami, więc niezwiązane zmiany nie przebudowują wszystkiego.

Szczegóły, cytaty i automatycznie aktualizowane feedy są utrzymywane w [angielskim README](README.md).

## 📜 [Licencja](LICENSE)

Kod na poziomie repozytorium pod [licencją ISC](https://spdx.org/licenses/ISC). Niektóre projekty mogą zachować własne pliki licencji tam, gdzie wymagane (np. oryginalna notka MIT Xiaomi ADB Tools).

<div align="center">

<sub>jeden warsztat · jedno rolling latest · mniej malutkich repo</sub>

</div>
