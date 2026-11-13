<div align="center">

# twojstar

**集中维护小工具、实验项目与实用程序的共享工作台。**

[Polski](README_pl.md) · [English](README.md) · **简体中文**

[![Latest](https://img.shields.io/github/v/release/travnie/twojstar?display_name=tag&include_prereleases&style=for-the-badge&label=latest)](https://github.com/travnie/twojstar/releases/latest)
[![License](https://img.shields.io/github/license/travnie/twojstar?style=for-the-badge)](LICENSE)

</div>

## 🧭 项目导航

| 项目 | 入口 | 用途 |
| --- | --- | --- |
| 🔲 **Benches** | [`benches/`](benches/) · [下载](https://github.com/travnie/twojstar/releases/latest/download/benches-portable.zip) · [Codebench](https://codebench.trfny.com) · [Docbench](https://docbench.travny.workers.dev) · [Streambench](https://streambench.trfny.com) | 浏览器端二维码/条形码、文档/PDF 与媒体处理工具。 |
| 🌦️ **Weather Feed** | [`weather-feed/`](weather-feed/) · [weather.trfny.com](https://weather.trfny.com) | 多来源天气、空气质量与 IMGW 预警（Kościelec/Chrzanów）；提供网页、JSON、Atom。 |
| 📰 **Feedboard** | [`feedboard/`](feedboard/) · [下载](https://github.com/travnie/twojstar/releases/latest/download/feedboard.zip) | Windows 11 RSS/Atom/JSON Feed 小组件/提供器及小型设置应用。 |
| 🛸 **SpaceMolt** | [`spacemolt/`](spacemolt/) · [`smx`](spacemolt/smx/) | 官方 v2 CLI 伴随与 SpaceMolt 工具。 |
| 🌀 **Loopling** | [`pets/loopling/`](pets/loopling/) · [预览](pets/loopling/gallery/) | 程序生成的 ChatGPT/Codex 桌面宠物，含安装器、动画图集、预览与源素材。 |
| 👾 **GPTomek** | [`pets/gptomek/`](pets/gptomek/) · [预览](pets/gptomek/gallery/in-motion.gif) | ChatGPT 与 Codex 用动画青色令牌小精灵。 |
| 📱 **Xiaomi ADB Tools** | [`xiaomi-adb-tools/`](xiaomi-adb-tools/) · [下载](https://github.com/travnie/twojstar/releases/latest/download/xiaomi-adb-tools.zip) | 维护中的桌面 ADB/Fastboot 工具，含平台特定 JavaFX 构建。 |
| 🎨 **Paint.NET plugins** | [`addons/paintdotnet/`](addons/paintdotnet/) · [`ICO`](addons/paintdotnet/ico/) · [`AI Restore`](addons/paintdotnet/ai/) | ICO 导入/导出，以及本地 AI Restore、DeJPEG 与 Denoise 效果。 |
| 🎚️ **Audacity plugins** | [`addons/audacity/`](addons/audacity/) · [`VST3`](addons/audacity/vst3/) · [Windows](https://github.com/travnie/twojstar/releases/latest/download/audacity-auto-declip-windows.zip) · [Linux](https://github.com/travnie/twojstar/releases/latest/download/audacity-auto-declip-linux.zip) | 本地音频修复与工作流效果，从 Auto Declip 开始。 |
| ⌨️ **Intent Keyboard** | [`intent-keyboard/`](intent-keyboard/) | 多平台语义输入实验：粗略意图进入，自然文本输出，含语气、翻译与保护事实。 |
| 💾 **Remotely Save GDrive patch** | [`addons/remotely-save-gdrive-patch/`](addons/remotely-save-gdrive-patch/) | 个人使用的 Google Drive 去重/更新补丁，含非再分发验证套件。 |

## 📦 统一滚动发布

GitHub **Latest** 是仓库范围的滚动快照。产品工作流可在内部保留详细构建产物；中央发布器仅暴露紧凑产品包：

- [`benches-portable.zip`](https://github.com/travnie/twojstar/releases/latest/download/benches-portable.zip) — Codebench、Docbench 与 Streambench 便携构建，
- [`feedboard.zip`](https://github.com/travnie/twojstar/releases/latest/download/feedboard.zip) — Feedboard 侧载包、证书、验证安装器与依赖，
- [`xiaomi-adb-tools.zip`](https://github.com/travnie/twojstar/releases/latest/download/xiaomi-adb-tools.zip) — 全部五个平台特定 Xiaomi ADB Tools JAR，
- [`paintdotnet-ico.zip`](https://github.com/travnie/twojstar/releases/latest/download/paintdotnet-ico.zip) — Paint.NET ICO 插件包，
- [`paintdotnet-ai.zip`](https://github.com/travnie/twojstar/releases/latest/download/paintdotnet-ai.zip) — Paint.NET AI Restore、DeJPEG 与 Denoise 插件包，
- [`audacity-auto-declip-windows.zip`](https://github.com/travnie/twojstar/releases/latest/download/audacity-auto-declip-windows.zip) — Windows x64 Auto Declip VST3，
- [`audacity-auto-declip-linux.zip`](https://github.com/travnie/twojstar/releases/latest/download/audacity-auto-declip-linux.zip) — Linux x64 Auto Declip VST3，
- [`SHA256SUMS`](https://github.com/travnie/twojstar/releases/latest/download/SHA256SUMS) — 七个产品包的校验和。

发布器先组装完整草稿，仅在所有必需包上传后才移动 GitHub `Latest` 指针。

➡️ **[打开当前统一 Latest](https://github.com/travnie/twojstar/releases/latest)**

## ⚙️ 维护

- 项目 CI 保持路径过滤，无关修改不会重建所有内容。

详情、引语与自动更新的信息流集中维护在[英文 README](README.md)。

## 📜 [许可证](LICENSE)

仓库级代码使用 [ISC 许可证](https://spdx.org/licenses/ISC)。部分项目可能保留自己的许可证文件（例如 Xiaomi ADB Tools 的原始 MIT 声明）。

<div align="center">

<sub>一个工作台 · 一个滚动 latest · 更少的小仓库</sub>

</div>
