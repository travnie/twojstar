"use strict";

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const vm = require("node:vm");

const context = {};
context.globalThis = context;
vm.runInNewContext(
  readFileSync(require.resolve("../public/document-formats.js"), "utf8"),
  context,
);

const formats = context.DocBenchTextFormats;
assert.ok(formats);

for (const [filename, expected] of [
  ["notes.txt", "txt"],
  ["server.log", "txt"],
  ["README.md", "md"],
  ["settings.ini", "ini"],
  [".editorconfig", "ini"],
  [".gitconfig", "ini"],
  ["script.sh", "shell"],
  [".bashrc", "shell"],
  [".zshrc", "shell"],
  ["setup.cmd", "batch"],
  ["legacy.BAT", "batch"],
  ["profile.ps1", "powershell"],
  ["module.psm1", "powershell"],
  [".env", "env"],
  [".env.local", "env"],
  ["build.prop", "config"],
  ["gradle.properties", "config"],
  ["service.service", "config"],
  ["rules.pro", "config"],
  ["stations.m3u", "playlist"],
  ["channels.m3u8", "playlist"],
  ["radio.pls", "playlist"],
  ["guide.xspf", "xml"],
  ["guide.xmltv", "xml"],
  ["something.weird", "txt"],
]) {
  assert.equal(formats.formatFromFilename(filename), expected, filename);
}

assert.equal(formats.preferredExtension("powershell"), "ps1");
assert.equal(formats.preferredExtension("playlist"), "m3u8");
assert.equal(formats.preferredExtension("missing"), "txt");
assert.equal(formats.labelFor("batch"), "Batch / CMD");
assert.equal(formats.isRaw("shell"), true);
assert.equal(formats.isRaw("json"), false);
assert.equal(formats.mimeFor("channels.m3u8"), "application/vnd.apple.mpegurl;charset=utf-8");
assert.equal(formats.mimeFor("stations.m3u"), "audio/x-mpegurl;charset=utf-8");
assert.equal(formats.mimeFor("playlist.xspf"), "application/xspf+xml;charset=utf-8");
assert.ok(formats.formatIds.includes("config"));
assert.ok(formats.formatIds.includes("playlist"));
for (const name of ["constructor", "toString", "hasOwnProperty", "notes.constructor"]) {
  assert.equal(formats.formatHintFromFilename(name), null, name);
}

for (const [filename, content, expected] of [
  ["payload.txt", "{\"ok\":true}", "json"],
  ["records.unknown", "{\"id\":1}\n{\"id\":2}", "jsonl"],
  ["script.txt", "#!/usr/bin/env bash\necho hi", "shell"],
  ["pwsh.txt", "#!/usr/bin/env pwsh\nWrite-Host hi", "powershell"],
  ["setup.txt", "@echo off\r\necho hi", "batch"],
  ["profile.txt", "#requires -Version 7.0\nWrite-Host hi", "powershell"],
  ["stations.txt", "#EXTM3U\n#EXTINF:-1,Radio\nhttps://example.test/stream", "playlist"],
  ["settings.txt", "[core]\neditor=nano", "ini"],
  ["secrets.txt", "API_KEY=abc\nDEBUG=true", "env"],
  ["config.txt", "---\nname: demo\nenabled: true", "yaml"],
  ["feed.txt", "<?xml version=\"1.0\"?><rss></rss>", "xml"],
  ["notes.txt", "# Title\n\n- one\n- two", "md"],
  ["plain.txt", "just some plain prose", "txt"],
  ["forced.json", "#EXTM3U\nhttps://example.test/live", "json"],
]) {
  assert.equal(formats.detectFormat(filename, content), expected, filename);
}

assert.equal(formats.formatFromContent("plain prose only"), null);
assert.equal(formats.formatFromContent("{foo: 'bar'}"), "json5");
assert.equal(formats.formatFromContent("{\n  // comment\n  \"ok\": true,\n}"), "jsonc");

assert.equal(formats.detectFormat("sheet.csv", "a,b\n1,2"), "csv");
assert.equal(formats.detectFormat("page.htm", "<script>alert(1)</script>"), "html");
assert.equal(formats.isRaw("html"), true);

const xml = '<?xml version="1.0"?><root attr="&quot;">&amp;<![CDATA[<script>]]><!-- <?keep?> --><?keep value?></root>';
assert.equal(formats.xmlPreviewSource(xml), xml);
const externalXml = '<!DOCTYPE tv SYSTEM\n "xmltv.dtd"><tv/>';
const safeXml = formats.xmlPreviewSource(externalXml);
assert.equal(safeXml.length, externalXml.length);
assert.deepEqual(safeXml.split("\n").map((line) => line.length), externalXml.split("\n").map((line) => line.length));
assert.match(safeXml, /^<!DOCTYPE tv\s+><tv\/>$/);
assert.equal(formats.xmlPreviewSource("<!DOCTYPE tv><tv/>"), "<!DOCTYPE tv><tv/>");
assert.equal(formats.xmlDoctypeMatchesRoot({ doctype: { name: "tv" }, documentElement: { nodeName: "rss" } }), false);
assert.equal(formats.xmlDoctypeMatchesRoot({ doctype: { name: "tv" }, documentElement: { nodeName: "tv" } }), true);
assert.equal(formats.xmlDoctypeMatchesRoot({ documentElement: { nodeName: "rss" } }), true);
assert.equal(formats.xmlPreviewSource('<!-- <!DOCTYPE root> --><root/>'), '<!-- <!DOCTYPE root> --><root/>');
assert.throws(() => formats.xmlPreviewSource('<!DOCTYPE root [<!ENTITY unsafe "data">]><root>&unsafe;</root>'), /DTD subsets/);

assert.throws(() => formats.xmlPreviewSource('<!DOCTYPE root><!-- x --><!DOCTYPE root [<!ENTITY unsafe "data">]><root/>'), /Duplicate XML DOCTYPE/);

assert.throws(() => formats.xmlPreviewSource('\ufeff<!DOCTYPE root [<!ENTITY unsafe "data">]><root/>'), /DTD subsets/);
assert.throws(() => formats.xmlPreviewSource("x".repeat(2 * 1024 * 1024 + 1)), /parsing limit/);

for (const invalid of ["\u0000", "\u0001", "\ud800", "\ufffe", "\uffff"]) {
  assert.throws(() => formats.xmlPreviewSource('<!DOCTYPE root SYSTEM "bad' + invalid + '.dtd"><root/>'), /Invalid XML character/);
}
console.log("Doc Bench document format tests passed.");
