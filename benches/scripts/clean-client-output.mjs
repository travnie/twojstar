import { readdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Drops stale tsc output before compile: renamed/deleted client/*.ts must not linger in
// public/ (ignored by git, but bundled into portable.html and deployed).
// Keep list = tracked hand-written/synced files; mirrors the .gitignore exceptions.
const benchesDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const products = new Set(["codebench", "streambench"]);
const keep = new Set(["i18n.js", "i18n-runtime.js", "webmcp-lifecycle.js"]);
const product = process.argv[2];

if (!products.has(product)) {
  throw new Error(`Expected codebench or streambench, got: ${product || "<empty>"}`);
}

const publicDir = join(benchesDir, product, "public");
for (const entry of await readdir(publicDir, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith(".js") && !keep.has(entry.name)) {
    await rm(join(publicDir, entry.name));
  }
}
