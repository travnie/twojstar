import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash, randomBytes } from "node:crypto";
import { createSha256, toHex, sha256File, findDuplicateGroups } from "../public/file-hash.mjs";

const reference = (buffer) => createHash("sha256").update(buffer).digest("hex");

test("sha256 matches reference digests across padding boundaries", () => {
  const sizes = [0, 1, 3, 55, 56, 57, 63, 64, 65, 119, 120, 127, 128, 129, 1000];
  for (const size of sizes) {
    const data = randomBytes(size);
    const hasher = createSha256();
    hasher.update(data);
    assert.equal(toHex(hasher.digest()), reference(data), `size ${size}`);
  }
  const abc = createSha256();
  abc.update(new TextEncoder().encode("abc"));
  assert.equal(toHex(abc.digest()), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("digest is finalized: repeated calls match and updates reject", () => {
  const data = randomBytes(1000);
  const hasher = createSha256();
  hasher.update(data);
  const first = hasher.digest();
  assert.equal(toHex(hasher.digest()), reference(data));
  assert.equal(toHex(hasher.digest()), toHex(first));
  assert.throws(() => hasher.update(new Uint8Array([1])), /already finalized/);
});

test("incremental updates equal one-shot hashing at random splits", () => {
  for (const size of [1, 63, 64, 65, 500, 4097, 100_000]) {
    const data = randomBytes(size);
    for (const chunk of [1, 7, 63, 64, 65, 1000]) {
      const hasher = createSha256();
      for (let offset = 0; offset < size; offset += chunk) {
        hasher.update(data.subarray(offset, Math.min(size, offset + chunk)));
      }
      if (size === 0) hasher.update(new Uint8Array(0));
      assert.equal(toHex(hasher.digest()), reference(data), `size ${size} chunk ${chunk}`);
    }
  }
});

test("sha256File reads a Blob in bounded chunks and reports progress", async () => {
  const data = randomBytes(10_000);
  const blob = new Blob([data]);
  const progress = [];
  const hash = await sha256File(blob, {
    chunkBytes: 1024,
    onProgress: (done, total) => progress.push([done, total]),
  });
  assert.equal(hash, reference(data));
  assert.deepEqual(progress, [
    ...Array.from({ length: 9 }, (_, index) => [(index + 1) * 1024, 10_000]),
    [10_000, 10_000],
  ]);
  const empty = await sha256File(new Blob([]), { chunkBytes: 4 });
  assert.equal(empty, reference(new Uint8Array(0)));
});

test("sha256File honors abort signals", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    sha256File(new Blob([randomBytes(100)]), { signal: controller.signal, chunkBytes: 10 }),
    (error) => error.name === "AbortError",
  );
  const midway = new AbortController();
  let calls = 0;
  await assert.rejects(
    sha256File(new Blob([randomBytes(100)]), {
      signal: midway.signal,
      chunkBytes: 10,
      onProgress: () => {
        calls += 1;
        if (calls === 3) midway.abort();
      },
    }),
    (error) => error.name === "AbortError",
  );
  assert.equal(calls, 3);
  await assert.rejects(sha256File(null), TypeError);
});

const entry = (id, name, path, content, size = content.length) => ({
  id, name, path, size,
  file: new Blob([content]),
});

test("findDuplicateGroups groups only byte-identical same-size files", async () => {
  const items = [
    entry("a", "one.txt", "a/one.txt", "same-bytes"),
    entry("b", "two.txt", "b/two.txt", "same-bytes"),
    entry("c", "three.txt", "three.txt", "same-byte!"), // same size, different bytes
    entry("d", "empty1", "empty1", ""),
    entry("e", "empty2", "dir/empty2", ""),
    entry("f", "unique.txt", "unique.txt", "only one"),
  ];
  const result = await findDuplicateGroups(items, { chunkBytes: 4 });
  assert.equal(result.scanned, 6);
  assert.equal(result.hashed, 5);
  assert.equal(result.groups.length, 2);
  const bySize = new Map(result.groups.map((group) => [group.size, group]));
  assert.deepEqual(bySize.get(10).members.map((member) => member.path).sort(), ["a/one.txt", "b/two.txt"]);
  assert.deepEqual(bySize.get(0).members.map((member) => member.path).sort(), ["dir/empty2", "empty1"]);
  for (const group of result.groups) {
    assert.equal(group.hash, reference(new TextEncoder().encode(group.size === 0 ? "" : "same-bytes")));
    assert.ok(group.members.every((member) => member.id && member.name && member.path));
  }
});

test("findDuplicateGroups reports no groups for unique content and aborts cleanly", async () => {
  const unique = await findDuplicateGroups([
    entry("a", "a.txt", "a.txt", "alpha"),
    entry("b", "b.txt", "b.txt", "a different length"),
  ]);
  assert.deepEqual(unique.groups, []);
  assert.equal(unique.hashed, 0);
  const sameSize = await findDuplicateGroups([
    entry("a", "a.txt", "a.txt", "alpha"),
    entry("b", "b.txt", "b.txt", "omega"),
  ]);
  assert.deepEqual(sameSize.groups, []);
  assert.equal(sameSize.hashed, 2);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    findDuplicateGroups([
      entry("a", "a.txt", "a.txt", "same"),
      entry("b", "b.txt", "b.txt", "same"),
    ], { signal: controller.signal }),
    (error) => error.name === "AbortError",
  );
  await assert.rejects(
    findDuplicateGroups([
      entry("a", "a.txt", "a.txt", "alpha"),
      entry("b", "b.txt", "b.txt", "different size"),
    ], { signal: controller.signal }),
    (error) => error.name === "AbortError",
  );
  await assert.rejects(findDuplicateGroups([{ id: "x" }]), TypeError);
  assert.deepEqual((await findDuplicateGroups([])).groups, []);
});
