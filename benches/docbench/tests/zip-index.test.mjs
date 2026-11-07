import assert from "node:assert/strict";
import { test } from "node:test";
import { zipSync, strToU8 } from "fflate";
import { readZipIndex, ZIP_INDEX_LIMITS } from "../public/zip-index.mjs";

function archive(files, options = {}) {
  return new Blob([zipSync(files, options)]);
}

test("ZIP index lists stored paths and compressed sizes without inflating", async () => {
  const file = archive({
    "notes.txt": strToU8("hello"),
    "sub/inside.json": strToU8('{"ok":true}'),
  });
  const result = await readZipIndex(file);
  assert.equal(result.count, 2);
  assert.equal(result.entries[0].name, "notes.txt");
  assert.equal(result.entries[1].name, "sub/inside.json");
  assert.equal(result.entries[1].safe, true);
  assert.equal(result.entries[0].originalSize, 5);
  assert.ok(result.indexedBytes < file.size * 2);
});

test("ZIP index marks path traversal as unsafe", async () => {
  const result = await readZipIndex(archive({
    "../private.txt": strToU8("no"),
    "C:\\temp\\drive.txt": strToU8("no"),
    "regular/ok.txt": strToU8("yes"),
  }));
  assert.deepEqual(result.entries.map((entry) => entry.safe), [false, false, true]);
});

test("ZIP rejects missing end record and malformed offsets", async () => {
  await assert.rejects(readZipIndex(new Blob([strToU8("not an archive")])), /ZIP index unavailable/u);
  const bytes = zipSync({ "a.txt": strToU8("a") });
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  view.setUint32(bytes.byteLength - 22 + 16, 0xfffffffe, true);
  await assert.rejects(readZipIndex(new Blob([bytes])), /invalid central directory offset/u);
});

test("ZIP64 marker produces explicit unsupported result", async () => {
  const bytes = zipSync({ "a.txt": strToU8("a") });
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  view.setUint16(bytes.byteLength - 22 + 10, 0xffff, true);
  await assert.rejects(readZipIndex(new Blob([bytes])), /ZIP64 index not yet supported/u);
});

test("ZIP tail reads stay bounded", async () => {
  const bytes = zipSync({ "a.txt": strToU8("a") });
  const lengths = [];
  const large = {
    size: 2 ** 33,
    slice(start, end) {
      lengths.push(end - start);
      return new Blob([bytes]);
    },
  };
  await assert.rejects(readZipIndex(large), /ZIP index unavailable/u);
  assert.ok(lengths[0] <= ZIP_INDEX_LIMITS.maxTailBytes);
  assert.ok(lengths[1] <= ZIP_INDEX_LIMITS.maxDirectoryBytes);
});

test("ZIP decodes legacy CP437 filenames", async () => {
  const bytes = zipSync({ "cafe.txt": strToU8("hello") });
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let central = -1;
  for (let index = 0; index + 46 <= bytes.length; index += 1) {
    if (view.getUint32(index, true) === 0x02014b50) {
      central = index;
      break;
    }
  }
  assert.ok(central >= 0);
  view.setUint16(central + 8, view.getUint16(central + 8, true) & ~0x800, true);
  bytes[central + 46 + 3] = 0x82;
  const result = await readZipIndex(new Blob([bytes]));
  assert.equal(result.entries[0].name, "café.txt");
});
