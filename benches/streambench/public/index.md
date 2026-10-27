# Streambench

> Browser workshop for IPTV, internet radio, HLS, M3U/M3U8 playlists and XMLTV EPG.

Streambench is promoted at https://streambench.trfny.com/ and operates directly at https://streambench.travny.workers.dev/. User-provided playlist files, XMLTV data, edits, favorites and history remain in browser storage. Public provider catalogs are fetched through the constrained Streambench Worker APIs.

## What it does

- Open local M3U/M3U8 files or pasted playlist text.
- Play supported video and audio streams, including HLS.
- Browse public IPTV and internet-radio catalogs.
- Import XMLTV for now-and-next programme information.
- Search, edit, hide, favorite and export playlist entries locally.
- Inspect protocol, playback type and media diagnostics.

## Agent access

On WebMCP-capable browser hosts, Streambench exposes `read_stream_state`, `search_streams`, `start_stream_playback` and `stop_stream_playback`. The tools only operate on the loaded playlist and player state; they do not expose a general-purpose fetch or relay interface.

## Links

- [Application](https://streambench.travny.workers.dev/)
- [Concise LLM guide](https://streambench.travny.workers.dev/llms.txt)
- [Full LLM guide](https://streambench.travny.workers.dev/llms-full.txt)
- [Provider manifest](https://streambench.travny.workers.dev/api/providers)
- [Health](https://streambench.travny.workers.dev/health)
- [Source](https://github.com/travnie/twojstar/tree/main/benches/streambench)
