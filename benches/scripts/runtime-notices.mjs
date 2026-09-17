import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { dependencyFile, workspaceDirectory } from "./dependency-file.mjs";

const benchesRoot = workspaceDirectory(import.meta.url);
const workspaces = ["codebench", "docbench", "streambench"];
const output = resolve(process.cwd(), process.argv[2] ?? "THIRD-PARTY-NOTICES.txt");
const packages = new Map();

function sourceUrl(pkg) {
  const repository = typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url;
  const source = repository || pkg.homepage || "";
  return source
    .replace(/^git\+/, "")
    .replace(/^git:\/\/github\.com\//, "https://github.com/")
    .replace(/\.git$/, "");
}

function licenseLabel(pkg) {
  if (typeof pkg.license === "string") return pkg.license;
  if (pkg.license) return JSON.stringify(pkg.license);
  if (Array.isArray(pkg.licenses)) return pkg.licenses.map((item) => item.type ?? item).join(", ");
  return "not declared";
}

async function licenseFiles(packageDirectory) {
  const names = await readdir(packageDirectory);
  const matches = names
    .filter((name) => /^(licen[cs]e|copying|notice)(?:\.|$)/i.test(name))
    .sort((a, b) => a.localeCompare(b));

  return Promise.all(matches.map(async (name) => ({
    name,
    text: await readFile(resolve(packageDirectory, name), "utf8"),
  })));
}

for (const workspace of workspaces) {
  const manifest = JSON.parse(await readFile(resolve(benchesRoot, workspace, "package.json"), "utf8"));
  for (const dependency of Object.keys(manifest.dependencies ?? {})) {
    const manifestPath = dependencyFile(import.meta.url, `${dependency}/package.json`);
    const pkg = JSON.parse(await readFile(manifestPath, "utf8"));
    const key = `${pkg.name}@${pkg.version}`;
    const existing = packages.get(key);
    if (existing) {
      existing.usedBy.add(workspace);
      continue;
    }

    packages.set(key, {
      name: pkg.name,
      version: pkg.version,
      license: licenseLabel(pkg),
      source: sourceUrl(pkg),
      usedBy: new Set([workspace]),
      licenseFiles: await licenseFiles(dirname(manifestPath)),
    });
  }
}

const records = [...packages.values()].sort((a, b) => a.name.localeCompare(b.name));
const lines = [
  "Benches portable builds - third-party notices",
  "===============================================",
  "",
  "Generated from the exact runtime packages installed by npm ci.",
  "Build-only tooling is intentionally excluded.",
  "",
  "Runtime dependencies",
  "--------------------",
];

for (const record of records) {
  lines.push(
    `${record.name} ${record.version}`,
    `  Used by: ${[...record.usedBy].sort().join(", ")}`,
    `  License: ${record.license}`,
  );
  if (record.source) lines.push(`  Source: ${record.source}`);
  lines.push("");
}

lines.push("License and notice texts", "------------------------", "");
for (const record of records) {
  lines.push(`${record.name} ${record.version}`, "~".repeat(`${record.name} ${record.version}`.length), "");
  if (record.licenseFiles.length === 0) {
    lines.push(`No LICENSE/COPYING/NOTICE file was present in the installed package. Declared license: ${record.license}`, "");
    continue;
  }

  for (const file of record.licenseFiles) {
    lines.push(`[${file.name}]`, file.text.trim(), "");
  }
}

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${lines.join("\n").trimEnd()}\n`);
console.log(`Wrote ${records.length} runtime dependency notices to ${output}`);
