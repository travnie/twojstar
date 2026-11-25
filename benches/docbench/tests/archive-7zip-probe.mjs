import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { sevenzFixture, sevenzEdgeFixtures, rarFixtures } from "./archive-fixture.mjs";

// Candidate admission probe, not a production decoder. No host filesystem mount.
const { default: createSevenZip } = await import(pathToFileURL(process.argv[2]).href);
const samples = [
  { name: "7z", base64: sevenzFixture },
  ...Object.entries(sevenzEdgeFixtures).map(([name, base64]) => ({ name, base64 })),
  ...rarFixtures,
];
async function call(sample, args, password, captureBytes = false) {
  const output = [];
  const errors = [];
  const bytes = [];
  const module = await createSevenZip({
    print: line => output.push(line),
    printErr: line => errors.push(line),
    stdin: () => null,
    ...(captureBytes ? { stdout: byte => {
      if (byte !== null) {
        if (bytes.length >= 8192) throw new Error("Probe output limit");
        bytes.push(byte);
      }
    } } : {}),
  });
  const file = sample.name.startsWith("rar") ? "/input.rar" : "/input.7z";
  module.FS.writeFile(file, Buffer.from(sample.base64, "base64"));
  let status;
  try { status = module.callMain([...args, "-bsp0", ...(password ? ["-p" + password] : []), "--", file]); }
  catch (error) { status = error?.status ?? "throw"; errors.push(String(error)); }
  return { status, output: output.join("\n"), errors: errors.join("\n"), bytes: Uint8Array.from(bytes) };
}
for (const sample of samples) {
  const listed = await call(sample, ["l", "-slt", "-ba", "-sccUTF-8"], sample.password);
  console.log("LIST", sample.name, listed.status, listed.output, listed.errors);
  assert.equal(listed.status, 0, sample.name + " listing");
  const tested = await call(sample, ["t"], sample.password);
  console.log("TEST", sample.name, tested.status, tested.output, tested.errors);
  if (sample.name === "corrupt") assert.notEqual(tested.status, 0, "corruption must fail");
  else assert.equal(tested.status, 0, sample.name + " integrity");
  if (sample.password) assert.notEqual((await call(sample, ["t"], "wrong-password")).status, 0);
}
const stream = await call(samples[0], ["x", "-so", "-bso0", "-bse2", "-spd", "-i!folder/hello.txt"], "", true);
console.log("STREAM", stream.status, stream.bytes.length, JSON.stringify(new TextDecoder().decode(stream.bytes)), stream.errors);
assert.equal(stream.status, 0);
assert.equal(new TextDecoder().decode(stream.bytes), "hello Docbench\n");
console.log("7-Zip WASM candidate checks passed.");
