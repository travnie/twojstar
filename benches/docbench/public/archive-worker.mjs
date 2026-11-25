import createSevenZip from "./vendor/sevenzip/sevenzip-wasm.mjs";
import { WASM_ARCHIVE_LIMITS } from "./archive-engine.mjs";
import { runSevenZipOperation } from "./archive-7zip-core.mjs";

self.onmessage = async (event) => {
  if (event.origin !== "" && event.origin !== self.location.origin) return;
  const { file, operation, index, password, wasmBinary } = event.data ?? {};
  try {
    if (!(file instanceof Blob) || file.size > WASM_ARCHIVE_LIMITS.maxInputBytes
      || typeof password !== "string" || password.length > 1024) throw new Error("Archive input limit exceeded.");
    const value = await runSevenZipOperation(createSevenZip, new Uint8Array(await file.arrayBuffer()), operation, {
      index, password, wasmBinary,
      wasmUrl: wasmBinary ? undefined : new URL("./vendor/sevenzip/sevenzip-wasm.wasm", import.meta.url).href,
    });
    const transfer = operation === "extract" ? [value.data.buffer]
      : operation === "extractAll" ? value.map(entry => entry.data.buffer) : [];
    self.postMessage({ ok: true, value }, transfer);
  } catch {
    self.postMessage({ ok: false, error: "Archive unreadable. Check password, integrity and size limits." });
  }
};
