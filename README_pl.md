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
| 🔳 **Benches** | [benches/](benches/) · [Codebench](https://codebench.trfny.com) · [Docbench](https://docbench.travny.workers.dev) · [Streambench](https://streambench.trfny.com) | Narzędzia przeglądarkowe do kodów QR, dokumentów/PDF i multimediów. |
| 🌦️ **Weather Feed** | [weather-feed/](weather-feed/) · [weather.trfny.com](https://weather.trfny.com) | Pogoda z wielu źródeł, jakość powietrza, alerty IMGW; web, JSON i Atom. |
| 📰 **Feedboard** | [feedboard/](feedboard/) · [pobierz](https://github.com/travnie/twojstar/releases/latest/download/feedboard.zip) | Widżet i dostawca feedów RSS/Atom/JSON Feed dla Windows 11. |
| 🛸 **SpaceMolt** | [spacemolt/](spacemolt/) · [smx](spacemolt/smx/) | Narzędzia SpaceMolt i klient CLI v2. |
| 🌀 **Loopling** | [pets/loopling/](pets/loopling/) | Animowany pet ChatGPT/Codex, generator grafik, instalatory i podglądy. |
| 📱 **Xiaomi ADB Tools** | [xiaomi-adb-tools/](xiaomi-adb-tools/) | Wieloplatformowe narzędzie ADB/Fastboot oparte na JavaFX. |
| 🎨 **Paint.NET plugins** | [addons/paintdotnet/](addons/paintdotnet/) | Obsługa ICO, lokalna naprawa obrazów i odszumianie AI. |
| 🎚️ **Audacity plugins** | [addons/audacity/](addons/audacity/) | Lokalne efekty audio, w tym Auto Declip VST3. |
| ⌨️ **Intent Keyboard** | [intent-keyboard/](intent-keyboard/) | Wieloplatformowy eksperyment z semantycznym wprowadzaniem tekstu. |
| 💾 **Remotely Save GDrive patch** | [addons/remotely-save-gdrive-patch/](addons/remotely-save-gdrive-patch/) | Prywatna poprawka synchronizacji Google Drive z testami zgodności. |

## 📦 Jedno wydanie zbiorcze

Tag **Latest** wskazuje aktualny wspólny zestaw narzędzi. Każdy projekt ma własny build i testy, a centralny workflow publikuje gotowe paczki:

- [benches-portable.zip](https://github.com/travnie/twojstar/releases/latest/download/benches-portable.zip) – Codebench, Docbench i Streambench.
- [feedboard.zip](https://github.com/travnie/twojstar/releases/latest/download/feedboard.zip) – Feedboard z instalatorem.
- [xiaomi-adb-tools.zip](https://github.com/travnie/twojstar/releases/latest/download/xiaomi-adb-tools.zip) – wieloplatformowe JAR-y.
- [paintdotnet-ico.zip](https://github.com/travnie/twojstar/releases/latest/download/paintdotnet-ico.zip) i [paintdotnet-ai.zip](https://github.com/travnie/twojstar/releases/latest/download/paintdotnet-ai.zip) – pluginy Paint.NET.
- [audacity-auto-declip-windows.zip](https://github.com/travnie/twojstar/releases/latest/download/audacity-auto-declip-windows.zip) i [audacity-auto-declip-linux.zip](https://github.com/travnie/twojstar/releases/latest/download/audacity-auto-declip-linux.zip) – pluginy VST3.
- [SHA256SUMS](https://github.com/travnie/twojstar/releases/latest/download/SHA256SUMS) – sumy kontrolne paczek.

Publikator najpierw kompletuje i sprawdza wydanie, a dopiero potem aktualizuje wskaźnik Latest. [Otwórz aktualne wydanie](https://github.com/travnie/twojstar/releases/latest).

## ⚙️ Utrzymanie i dokumentacja

CI pozostaje podzielone według projektów, więc niezwiązana zmiana nie przebudowuje wszystkich narzędzi. Szczegóły, bieżące wiadomości i automatycznie aktualizowane fragmenty są utrzymywane w [angielskim README](README.md).

## 📜 Licencja

Kod na poziomie repozytorium: [ISC](LICENSE). Niektóre komponenty zachowują własne licencje, np. Xiaomi ADB Tools (MIT). Poprawka Remotely Save dla Google Drive dotyczy kodu objętego [PolyForm Strict 1.0.0](https://polyformproject.org/licenses/strict/1.0.0/): wyłącznie użytek osobisty/niekomercyjny, bez redystrybucji zmodyfikowanego kodu. Zobacz [ograniczenia poprawki](addons/remotely-save-gdrive-patch/README.md#no-redistribution).
