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
| 🔳 **Benches** | [benches/](benches/) · [Codebench](https://codebench.trfny.com) · [Docbench](https://docbench.travny.workers.dev) · [Streambench](https://streambench.trfny.com) | 浏览器端二维码、文档/PDF 与媒体处理工具。 |
| 🌦️ **Weather Feed** | [weather-feed/](weather-feed/) · [weather.trfny.com](https://weather.trfny.com) | 多来源天气、空气质量和 IMGW 预警；提供网页、JSON、Atom。 |
| 📰 **Feedboard** | [feedboard/](feedboard/) · [下载](https://github.com/travnie/twojstar/releases/latest/download/feedboard.zip) | Windows 11 RSS/Atom/JSON Feed 小组件及设置程序。 |
| 🛸 **SpaceMolt** | [spacemolt/](spacemolt/) · [smx](spacemolt/smx/) | SpaceMolt 工具与 v2 CLI 客户端。 |
| 🌀 **Loopling** | [pets/loopling/](pets/loopling/) | ChatGPT/Codex 动画桌面宠物，包含生成器、安装脚本和预览。 |
| 📱 **Xiaomi ADB Tools** | [xiaomi-adb-tools/](xiaomi-adb-tools/) | 基于 JavaFX 的跨平台 ADB/Fastboot 工具。 |
| 🎨 **Paint.NET plugins** | [addons/paintdotnet/](addons/paintdotnet/) | ICO 导入导出、本地 AI 图像修复与降噪。 |
| 🎚️ **Audacity plugins** | [addons/audacity/](addons/audacity/) | 本地音频修复效果，包括 Auto Declip VST3。 |
| ⌨️ **Intent Keyboard** | [intent-keyboard/](intent-keyboard/) | 多平台语义输入与自然文本生成实验。 |
| 💾 **Remotely Save GDrive patch** | [addons/remotely-save-gdrive-patch/](addons/remotely-save-gdrive-patch/) | 个人使用的 Google Drive 去重与更新补丁。 |

## 📦 统一滚动发布

**Latest** 指向当前所有产品的统一发布快照。各项目保留独立的构建和测试，而中央工作流负责打包发布：

- [benches-portable.zip](https://github.com/travnie/twojstar/releases/latest/download/benches-portable.zip)：Codebench、Docbench、Streambench。
- [feedboard.zip](https://github.com/travnie/twojstar/releases/latest/download/feedboard.zip)：Feedboard 安装包。
- [xiaomi-adb-tools.zip](https://github.com/travnie/twojstar/releases/latest/download/xiaomi-adb-tools.zip)：多平台 JAR。
- [paintdotnet-ico.zip](https://github.com/travnie/twojstar/releases/latest/download/paintdotnet-ico.zip) 和 [paintdotnet-ai.zip](https://github.com/travnie/twojstar/releases/latest/download/paintdotnet-ai.zip)：Paint.NET 插件。
- [audacity-auto-declip-windows.zip](https://github.com/travnie/twojstar/releases/latest/download/audacity-auto-declip-windows.zip) 和 [audacity-auto-declip-linux.zip](https://github.com/travnie/twojstar/releases/latest/download/audacity-auto-declip-linux.zip)：VST3 插件。
- [SHA256SUMS](https://github.com/travnie/twojstar/releases/latest/download/SHA256SUMS)：文件校验和。

发布器先准备并验证完整快照，再移动 Latest 指针。[查看当前发布](https://github.com/travnie/twojstar/releases/latest)。

## ⚙️ 维护与文档

CI 按项目路径过滤，避免无关修改触发全部重建。最新资讯和自动更新的内容集中维护在[英文 README](README.md)，不在翻译文件中复制。

## 📜 许可证

仓库级代码使用 [ISC 许可证](LICENSE)。部分组件保留独立许可证，例如 Xiaomi ADB Tools 的 MIT 许可证。Remotely Save Google Drive 补丁涉及受 [PolyForm Strict 1.0.0](https://polyformproject.org/licenses/strict/1.0.0/) 约束的上游代码：仅允许个人及非商业使用，不得重新分发修改后的代码。参见[补丁分发限制](addons/remotely-save-gdrive-patch/README.md#no-redistribution)。
