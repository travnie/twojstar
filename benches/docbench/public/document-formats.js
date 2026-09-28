(() => {
  "use strict";

  const definitions = Object.freeze({
    txt: Object.freeze({ label: "Plain text", preferredExtension: "txt", mime: "text/plain;charset=utf-8", raw: true }),
    md: Object.freeze({ label: "Markdown", preferredExtension: "md", mime: "text/markdown;charset=utf-8", raw: false }),
    json: Object.freeze({ label: "JSON", preferredExtension: "json", mime: "application/json;charset=utf-8", raw: false }),
    jsonc: Object.freeze({ label: "JSONC", preferredExtension: "jsonc", mime: "application/json;charset=utf-8", raw: false }),
    json5: Object.freeze({ label: "JSON5", preferredExtension: "json5", mime: "application/json5;charset=utf-8", raw: false }),
    jsonl: Object.freeze({ label: "JSONL / NDJSON", preferredExtension: "jsonl", mime: "application/x-ndjson;charset=utf-8", raw: false }),
    yaml: Object.freeze({ label: "YAML", preferredExtension: "yaml", mime: "application/yaml;charset=utf-8", raw: false }),
    xml: Object.freeze({ label: "XML", preferredExtension: "xml", mime: "application/xml;charset=utf-8", raw: false }),
    ini: Object.freeze({ label: "INI / config", preferredExtension: "ini", mime: "text/plain;charset=utf-8", raw: true }),
    shell: Object.freeze({ label: "Shell script", preferredExtension: "sh", mime: "text/x-shellscript;charset=utf-8", raw: true }),
    powershell: Object.freeze({ label: "PowerShell", preferredExtension: "ps1", mime: "text/plain;charset=utf-8", raw: true }),
    batch: Object.freeze({ label: "Batch / CMD", preferredExtension: "cmd", mime: "text/plain;charset=utf-8", raw: true }),
    env: Object.freeze({ label: "Environment / .env", preferredExtension: "env", mime: "text/plain;charset=utf-8", raw: true }),
    playlist: Object.freeze({ label: "Playlist / M3U8", preferredExtension: "m3u8", mime: "application/vnd.apple.mpegurl;charset=utf-8", raw: true }),
    config: Object.freeze({ label: "Config / dotfile", preferredExtension: "conf", mime: "text/plain;charset=utf-8", raw: true }),
  });

  const extensionToFormat = Object.freeze({
    txt: "txt", text: "txt", log: "txt", out: "txt",
    md: "md", markdown: "md",
    json: "json", jsonc: "jsonc", json5: "json5", jsonl: "jsonl", ndjson: "jsonl",
    yml: "yaml", yaml: "yaml",
    xml: "xml", xspf: "xml", xmltv: "xml",
    ini: "ini", desktop: "ini",
    sh: "shell", bash: "shell", zsh: "shell", fish: "shell",
    ps1: "powershell", psm1: "powershell", psd1: "powershell",
    bat: "batch", cmd: "batch",
    env: "env",
    m3u: "playlist", m3u8: "playlist", pls: "playlist", cue: "playlist",
    conf: "config", cfg: "config", config: "config", toml: "config",
    properties: "config", prop: "config", repo: "config", list: "config", sources: "config",
    service: "config", socket: "config", target: "config", timer: "config",
    mount: "config", automount: "config", path: "config", slice: "config", scope: "config",
    gradle: "config", kts: "config", pro: "config", rules: "config",
  });

  const filenameToFormat = Object.freeze({
    ".bashrc": "shell",
    ".bash_profile": "shell",
    ".bash_aliases": "shell",
    ".profile": "shell",
    ".zshrc": "shell",
    ".zprofile": "shell",
    ".zshenv": "shell",
    ".env": "env",
    ".editorconfig": "ini",
    ".gitconfig": "ini",
    ".gitmodules": "ini",
    ".gitignore": "config",
    ".gitattributes": "config",
    ".dockerignore": "config",
    ".npmrc": "config",
    ".yarnrc": "config",
    ".wgetrc": "config",
    ".curlrc": "config",
    ".inputrc": "config",
    ".nanorc": "config",
    ".htaccess": "config",
    "dockerfile": "config",
    "containerfile": "config",
    "makefile": "config",
    "build.prop": "config",
    "gradle.properties": "config",
    "local.properties": "config",
  });

  const formatIds = Object.freeze(Object.keys(definitions));

  function basename(name) {
    return String(name || "").replaceAll("\\", "/").split("/").at(-1).toLowerCase();
  }

  function formatFromFilename(name) {
    const base = basename(name);
    if (!base) return "txt";
    if (filenameToFormat[base]) return filenameToFormat[base];
    if (base.startsWith(".env.")) return "env";
    const dot = base.lastIndexOf(".");
    if (dot < 0 || dot === base.length - 1) return "txt";
    return extensionToFormat[base.slice(dot + 1)] || "txt";
  }

  function preferredExtension(format) {
    return definitions[format]?.preferredExtension || definitions.txt.preferredExtension;
  }

  function labelFor(format) {
    return definitions[format]?.label || definitions.txt.label;
  }

  function isRaw(format) {
    return definitions[format]?.raw === true;
  }

  function mimeFor(name, format = formatFromFilename(name)) {
    const base = basename(name);
    if (base.endsWith(".m3u")) return "audio/x-mpegurl;charset=utf-8";
    if (base.endsWith(".m3u8")) return "application/vnd.apple.mpegurl;charset=utf-8";
    if (base.endsWith(".pls")) return "audio/x-scpls;charset=utf-8";
    if (base.endsWith(".xspf")) return "application/xspf+xml;charset=utf-8";
    return definitions[format]?.mime || definitions.txt.mime;
  }

  globalThis.DocBenchTextFormats = Object.freeze({
    definitions,
    formatIds,
    formatFromFilename,
    preferredExtension,
    labelFor,
    isRaw,
    mimeFor,
  });
})();