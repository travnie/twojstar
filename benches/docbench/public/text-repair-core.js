"use strict";

(() => {
  // Conservative, exact-offset repairs for findings from the current scan.
  const MAX_CHANGES = 500;
  const groups = Object.freeze([
    { id: "bidi", label: "Remove directional controls", defaultOn: true },
    { id: "controls", label: "Remove non-printing controls", defaultOn: true },
    { id: "invisible", label: "Remove invisible separators", defaultOn: true },
    { id: "spaces", label: "Replace unusual spaces with ASCII spaces", defaultOn: false },
  ]);
  const groupIds = new Set(groups.map((group) => group.id));
  const bidi = new Set([0x061c, 0x200e, 0x200f]);
  for (let point = 0x202a; point <= 0x202e; point += 1) bidi.add(point);
  for (let point = 0x2066; point <= 0x206f; point += 1) bidi.add(point);
  const invisible = new Set([0x00ad, 0x034f, 0x200b, 0x2060, 0x2061, 0x2062, 0x2063, 0x2064, 0xfeff]);
  const spaces = new Set([0x00a0, 0x1680, 0x202f, 0x205f, 0x3000]);
  for (let point = 0x2000; point <= 0x200a; point += 1) spaces.add(point);

  function describePoint(point) {
    return "U+" + point.toString(16).toUpperCase().padStart(point > 0xffff ? 6 : 4, "0");
  }

  function proposal(text, finding) {
    if (!finding || !Number.isSafeInteger(finding.offset)
      || !Number.isSafeInteger(finding.length) || finding.offset < 0
      || finding.length < 1 || finding.length > 2
      || finding.offset + finding.length > text.length) return null;
    const original = text.slice(finding.offset, finding.offset + finding.length);
    const point = original.codePointAt(0);
    if (original.length !== (point > 0xffff ? 2 : 1)) return null;

    let group;
    let replacement = "";
    if (finding.kind === "invisible" && bidi.has(point)) group = "bidi";
    else if (finding.kind === "control" && point !== 0x09 && point !== 0x0a && point !== 0x0d) group = "controls";
    else if (finding.kind === "invisible" && invisible.has(point)) {
      if (point === 0xfeff && finding.offset === 0) return null;
      group = "invisible";
    } else if (finding.kind === "invisible" && spaces.has(point)) {
      group = "spaces";
      replacement = " ";
    } else return null;

    return Object.freeze({
      offset: finding.offset,
      length: finding.length,
      group,
      label: finding.label,
      codepoint: describePoint(point),
      replacement,
    });
  }

  function planRepairs(text, findings, chosen = ["bidi", "controls", "invisible"]) {
    if (typeof text !== "string" || !Array.isArray(findings) || !Array.isArray(chosen)
      || chosen.some((group) => !groupIds.has(group))) {
      throw new TypeError("Invalid repair input or group selection.");
    }
    const counts = Object.fromEntries(groups.map((group) => [group.id, 0]));
    if (findings.truncated || findings.length > MAX_CHANGES) {
      return Object.freeze({
        blocked: true, reason: "Inspection was truncated. Review a smaller document before repairs.",
        source: text, result: text, changes: [], counts,
      });
    }
    const selected = new Set(chosen);
    const all = [];
    const seen = new Set();
    for (const finding of findings) {
      const change = proposal(text, finding);
      if (!change) continue;
      const key = String(change.offset) + ":" + String(change.length);
      if (seen.has(key)) continue;
      seen.add(key);
      counts[change.group] += 1;
      if (selected.has(change.group)) all.push(change);
    }
    all.sort((a, b) => a.offset - b.offset);
    const changes = [];
    let cursor = 0;
    let result = "";
    for (const change of all) {
      if (change.offset < cursor) continue;
      result += text.slice(cursor, change.offset) + change.replacement;
      cursor = change.offset + change.length;
      changes.push(change);
    }
    result += text.slice(cursor);
    return Object.freeze({
      blocked: false, reason: "",
      source: text, result, changes: Object.freeze(changes), counts: Object.freeze(counts),
    });
  }

  globalThis.DocBenchTextRepair = Object.freeze({ groups, planRepairs });
})();
