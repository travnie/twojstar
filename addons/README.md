# Native add-ons

Desktop application extensions live here; AI-agent plugins live separately in [`plugins/`](../plugins/).

| Product | What it ships | Validation |
| --- | --- | --- |
| [Audacity VST3](audacity/vst3/) | Released Auto Declip; **experimental** Smart Transition; DSP test suite | [![VST3 CI](https://github.com/travnie/twojstar/actions/workflows/audacity-vst3-ci.yml/badge.svg?branch=main)](https://github.com/travnie/twojstar/actions/workflows/audacity-vst3-ci.yml) |
| [Audacity Smart Edit](audacity/smart-edit/) | Smart cut/trim design and host-integration roadmap; VST3 experiment, **not shipped** | [VST3 implementation](audacity/vst3/) |
| [Paint.NET AI](paintdotnet/ai/) | Local image repair/deJPEG/denoise pack | [![Paint.NET CI](https://github.com/travnie/twojstar/actions/workflows/paintdotnet-ci.yml/badge.svg?branch=main)](https://github.com/travnie/twojstar/actions/workflows/paintdotnet-ci.yml) |
| [Paint.NET ICO](paintdotnet/ico/) | Multi-frame ICO import/export adapters | [Paint.NET CI](../.github/workflows/paintdotnet-ci.yml) |
| [Remotely Save GDrive patch](remotely-save-gdrive-patch/) | Local Obsidian plugin patch | [![Patch CI](https://github.com/travnie/twojstar/actions/workflows/remotely-save-gdrive-patch-ci.yml/badge.svg?branch=main)](https://github.com/travnie/twojstar/actions/workflows/remotely-save-gdrive-patch-ci.yml) |

Check the owning README before building. The patch is **personal-use only and must not be redistributed**; CI validates it without publishing an upstream derivative.
