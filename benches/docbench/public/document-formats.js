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

  function formatHintFromFilename(name) {
    const base = basename(name);
    if (!base) return null;
    if (filenameToFormat[base]) return filenameToFormat[base];
    if (base.startsWith(".env.")) return "env";
    const dot = base.lastIndexOf(".");
    if (dot < 0 || dot === base.length - 1) return null;
    return extensionToFormat[base.slice(dot + 1)] || null;
  }

  function formatFromFilename(name) {
    return formatHintFromFilename(name) || "txt";
  }

  const MAX_SNIFF_CHARS = 256 * 1024;

  function detectPlaylistContent(source, trimmed) {
    if (/^#EXTM3U(?:\s|$)/iu.test(trimmed)) return "playlist";
    if (/^\[playlist\]\s*$/imu.test(source) && /^File\d+\s*=/imu.test(source)) return "playlist";
    return null;
  }

  function detectScriptContent(source, trimmed) {
    if (/^#![^\r\n]*(?:\b(?:ba|da|k|z)?sh\b|\bfish\b)/iu.test(trimmed)) return "shell";
    if (/^#![^\r\n]*(?:\bpwsh\b|\bpowershell\b)/iu.test(trimmed)) return "powershell";
    if (/^@echo\s+off\b/imu.test(source) || /%~dp0/iu.test(source)) return "batch";
    if (/^#requires\s+-/imu.test(source)
      || (/^\s*param\s*\(/imu.test(source) && /\$(?:PSScriptRoot|env:)/iu.test(source))) {
      return "powershell";
    }
    return null;
  }

  function detectXmlContent(trimmed) {
    return /^<\?xml\b/iu.test(trimmed) || /^<(?:rss|feed|tv|playlist)\b/iu.test(trimmed)
      ? "xml"
      : null;
  }

  function detectJsonLines(nonEmptyLines) {
    if (nonEmptyLines.length < 2 || nonEmptyLines.length > 100) return null;
    const valid = nonEmptyLines.every((line) => {
      if (!/^[{[]/u.test(line)) return false;
      try {
        JSON.parse(line);
        return true;
      } catch {
        return false;
      }
    });
    return valid ? "jsonl" : null;
  }

  function detectJsonFamily(source, trimmed) {
    if (!/^[{[]/u.test(trimmed)) return null;
    if (source.length < MAX_SNIFF_CHARS) {
      try {
        JSON.parse(source);
        return "json";
      } catch {
        // Try conservative JSON-family signatures below.
      }
    }
    if (/(?:^|[{,]\s*)[A-Za-z_$][\w$]*\s*:/mu.test(source)
      || /'(?:[^'\\]|\\.)*'/u.test(source)) {
      return "json5";
    }
    if (/(^|[^:])\/\/[^\r\n]*$|\/\*[\s\S]*?\*\/|,\s*[}\]]/mu.test(source)) {
      return "jsonc";
    }
    return null;
  }

  function detectYamlContent(source, trimmed) {
    if (/^%YAML(?:\s|$)/iu.test(trimmed)) return "yaml";
    return /^---\s*(?:\r?\n|$)/u.test(trimmed) && /^\s*[\w.-]+\s*:/mu.test(source)
      ? "yaml"
      : null;
  }

  function detectIniContent(source) {
    if (/^\[playlist\]\s*$/imu.test(source)) return "playlist";
    return /^\s*\[[^\]\r\n]+\]\s*$/mu.test(source)
      && /^\s*[^#;\s][^=\r\n]*\s*=.+$/mu.test(source)
      ? "ini"
      : null;
  }

  function detectEnvContent(nonEmptyLines) {
    const envLines = nonEmptyLines.filter((line) => !line.startsWith("#"));
    if (envLines.length < 2) return null;
    return envLines.every((line) => /^(?:export\s+)?[A-Z_][A-Z0-9_]*\s*=/u.test(line))
      ? "env"
      : null;
  }

  function detectMarkdownContent(source) {
    const signals = [
      /^#{1,6}\s+\S/mu.test(source),
      /^(?:\x60\x60\x60|~~~)/mu.test(source),
      /\[[^\]\r\n]+\]\([^\r\n)]+\)/u.test(source),
      /^\s*[-*+]\s+\S/mu.test(source),
    ].filter(Boolean).length;
    return signals >= 2 ? "md" : null;
  }

  function formatFromContent(text) {
    const source = String(text || "").slice(0, MAX_SNIFF_CHARS);
    const trimmed = source.trimStart();
    if (!trimmed) return null;

    const nonEmptyLines = source
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean);

    for (const detector of [
      () => detectPlaylistContent(source, trimmed),
      () => detectScriptContent(source, trimmed),
      () => detectXmlContent(trimmed),
      () => detectJsonLines(nonEmptyLines),
      () => detectJsonFamily(source, trimmed),
      () => detectYamlContent(source, trimmed),
      () => detectIniContent(source),
      () => detectEnvContent(nonEmptyLines),
      () => detectMarkdownContent(source),
    ]) {
      const detected = detector();
      if (detected) return detected;
    }
    return null;
  }

  function detectFormat(name, text) {
    const filenameFormat = formatHintFromFilename(name);
    if (filenameFormat && filenameFormat !== "txt") return filenameFormat;
    return formatFromContent(text) || filenameFormat || "txt";
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
    formatFromContent,
    detectFormat,
    preferredExtension,
    labelFor,
    isRaw,
    mimeFor,
  });
})();