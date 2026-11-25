import init, { Archive } from "./vendor/exav/pkg/exav_unpack_wasm.js";
import { WASM_ARCHIVE_LIMITS } from "./archive-engine.mjs";

self.onmessage = async ({ data: { file, operation, index, password } }) => {
  let archive;
  try {
    if (!(file instanceof Blob) || file.size > WASM_ARCHIVE_LIMITS.maxInputBytes) throw new Error("Archive input limit exceeded.");
    await init();
    archive = Archive.open(file, {
      maxBufferBytes: WASM_ARCHIVE_LIMITS.maxBufferBytes,
      maxExtractedBytes: WASM_ARCHIVE_LIMITS.maxExtractedBytes,
      maxScannedBytes: WASM_ARCHIVE_LIMITS.maxExtractedBytes,
      maxMembers: WASM_ARCHIVE_LIMITS.maxMembers,
      maxRecursion: 1,
      allowedFormats: ["SevenZip", "Rar"],
    });
    const passwords = password ? [password] : [];
    if (operation === "list") self.postMessage({ ok: true, value: archive.list(passwords) });
    else if (operation === "extract" && Number.isSafeInteger(index) && index >= 0) {
      const value = archive.extract(index, passwords);
      self.postMessage({ ok: true, value }, [value.data.buffer]);
    } else throw new Error("Unsupported archive operation.");
  } catch (error) {
    self.postMessage({ ok: false, error: "Archive unreadable. Check format, password and size limits." });
  } finally {
    archive?.free();
  }
};
