#!/usr/bin/env python3
"""Select changed plugin packages and publish their ZIP contents for ChatGPT.

This is the single configuration source for the plugin packaging workflow.
Each existing packager remains responsible for its plugin's manifest validation.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

# Package source, existing package command, and optional tests.
PLUGINS = {
    "claude-dev-kit": ("plugins/claude-dev-kit", "shared"),
    "cloudflare": ("plugins/cloudflare", "shared"),
    "desktop-commander": ("plugins/desktop-commander", "shared"),
    "github-ops": ("plugins/github-ops", "shared"),
    "google-dev-kit": ("plugins/google-dev-kit", "google"),
    "openai-dev-kit": ("plugins/openai-dev-kit", "openai"),
    "spacemolt": ("spacemolt/plugin", "spacemolt"),
}
SHARED_PACKAGES = {"claude-dev-kit", "cloudflare", "desktop-commander", "github-ops"}
COMMON_CHANGES = {
    ".github/workflows/plugin-packages.yml",
    ".agents/plugins/marketplace.json",
    "plugins/_shared/plugin_ci.py",
}


def changed_packages(paths: set[str]) -> list[str]:
    """Choose the smallest plugin subset affected by an actual diff."""
    if paths & COMMON_CHANGES:
        return sorted(PLUGINS)
    chosen: set[str] = set()
    for name, (source, _) in PLUGINS.items():
        if any(path.startswith(source + "/") for path in paths):
            chosen.add(name)
    if any(path.startswith("plugins/_shared/") for path in paths):
        chosen.update(SHARED_PACKAGES)
    if "plugins/openai-dev-kit/skills/chatgpt-plugin-builder/scripts/validate_plugin.py" in paths:
        chosen.update(SHARED_PACKAGES)
    if "spacemolt/scripts/package_plugin.py" in paths:
        chosen.add("spacemolt")
    return sorted(chosen)


def plan() -> None:
    selected = os.environ.get("SELECTED_PLUGIN", "").strip()
    event = os.environ.get("EVENT_NAME", "")
    if event == "workflow_dispatch":
        if selected and selected != "all" and selected not in PLUGINS:
            raise ValueError(f"unknown plugin: {selected}")
        packages = sorted(PLUGINS) if selected in {"", "all"} else [selected]
    else:
        base = os.environ.get("BASE_SHA", "").strip()
        if not base:
            raise ValueError("BASE_SHA is required for push/PR")
        if set(base) == {"0"}:
            packages = sorted(PLUGINS)  # first push of a new branch
        else:
            diff = subprocess.check_output(
                ["git", "diff", "--name-only", "--diff-filter=ACMRT", base, "HEAD"],
                cwd=ROOT,
                text=True,
            )
            packages = changed_packages(set(diff.splitlines()))
    value = json.dumps(packages, separators=(",", ":"))
    print(f"Selected plugin packages: {value}", file=sys.stderr)
    print("plugins=" + value)


def run(*args: str) -> None:
    subprocess.run(args, cwd=ROOT, check=True)


def unpack_importable(plugin: str, archive: Path, destination: Path) -> None:
    """Normalize old and new packagers into a single root-level ZIP layout.

    Actions/upload-artifact creates the outer ZIP from destination. It must
    contain the plugin's manifest directly, not another ZIP or a parent folder.
    """
    with zipfile.ZipFile(archive) as zf:
        members = [entry for entry in zf.infolist() if not entry.is_dir()]
        raw_names = {entry.filename for entry in members}
        prefix = "" if "plugin.json" in raw_names else plugin + "/"
        expected = {"plugin.json", ".codex-plugin/plugin.json", "mcp.json"}
        extracted: set[str] = set()
        for entry in members:
            name = entry.filename
            if (
                name.startswith("/")
                or "\\" in name
                or any(part in {"", ".", ".."} for part in name.split("/"))
                or not name.startswith(prefix)
            ):
                raise ValueError(f"unsafe/unexpected ZIP path: {name}")
            rel = name[len(prefix):]
            if not rel or rel in extracted:
                raise ValueError(f"duplicate or empty ZIP path: {name}")
            extracted.add(rel)
            target = destination / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(zf.read(entry))
    if not expected.issubset(extracted):
        raise ValueError(f"missing root manifests: {sorted(expected - extracted)}")
    if not any(
        name.startswith("skills/") and name.endswith("/SKILL.md") and name.count("/") == 2
        for name in extracted
    ):
        raise ValueError("no root-level skills/*/SKILL.md in plugin archive")
    manifest = json.loads((destination / "plugin.json").read_text(encoding="utf-8"))
    if manifest.get("name") != plugin:
        raise ValueError("plugin ZIP identity does not match the selected package")
    interface = manifest["extensions"]["com.openai"]["interface"]
    for prop in ("logo", "composerIcon"):
        asset = interface[prop]
        if not asset.startswith("./") or asset[2:] not in extracted:
            raise ValueError(f"missing packaged {prop}: {asset}")


def build(plugin: str, upload_root: Path) -> None:
    if plugin not in PLUGINS:
        raise ValueError(f"unknown plugin: {plugin}")
    source, kind = PLUGINS[plugin]
    requirements = {
        "shared": "plugins/_shared/requirements.txt",
        "google": "plugins/google-dev-kit/requirements.txt",
        "openai": "plugins/openai-dev-kit/requirements.txt",
    }.get(kind)
    if requirements:
        run(sys.executable, "-m", "pip", "install", "-r", requirements)
    if kind == "shared":
        run(sys.executable, "plugins/openai-dev-kit/skills/chatgpt-plugin-builder/scripts/validate_plugin.py", source)
    if kind == "google":
        run(sys.executable, "-m", "unittest", "discover", "-s", "plugins/google-dev-kit/tests", "-v")
    if kind == "openai":
        run(sys.executable, "plugins/openai-dev-kit/skills/chatgpt-plugin-builder/scripts/validate_plugin.py", source)
        run(sys.executable, "-m", "unittest", "discover", "-s", "plugins/openai-dev-kit/tests", "-v")

    with tempfile.TemporaryDirectory() as tmp:
        zip_path = Path(tmp) / (plugin + ".zip")
        if kind == "shared":
            run(sys.executable, "plugins/_shared/package_plugin.py", source, str(zip_path))
        elif kind == "spacemolt":
            run(sys.executable, "spacemolt/scripts/package_plugin.py", str(zip_path))
        else:
            run(sys.executable, f"plugins/{plugin}/scripts/package_plugin.py", str(zip_path))
        upload_dir = upload_root / plugin
        upload_dir.mkdir(parents=True, exist_ok=True)
        unpack_importable(plugin, zip_path, upload_dir)
    print(f"Built directly importable {plugin} artifact at {upload_dir}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("plan")
    builder = sub.add_parser("build")
    builder.add_argument("plugin", choices=sorted(PLUGINS))
    builder.add_argument("upload_root", type=Path)
    args = parser.parse_args()
    if args.command == "plan":
        plan()
    else:
        build(args.plugin, args.upload_root)
