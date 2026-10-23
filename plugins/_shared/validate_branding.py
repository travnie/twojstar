#!/usr/bin/env python3
"""Validate per-component icon inventory against portable plugin sources."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CATALOG = ROOT / ".agents/plugins/marketplace.json"


def read(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def icon_path(root: Path, value: str) -> None:
    if not isinstance(value, str) or not value.startswith("./") or "\\" in value or ".." in value.split("/"):
        raise ValueError(f"unsafe icon path: {value!r}")
    path = root / value[2:]
    path.resolve().relative_to(root.resolve())
    if not path.is_file() or path.is_symlink():
        raise ValueError(f"missing or unsafe icon asset: {path}")


def native_skill_icon(root: Path, skill: str, key: str) -> str | None:
    metadata = root / "skills" / skill / "agents/openai.yaml"
    if not metadata.is_file():
        return None
    interface_indent: int | None = None
    for line in metadata.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        indent = len(line) - len(line.lstrip())
        if stripped == "interface:":
            interface_indent = indent
            continue
        if interface_indent is None or not stripped or stripped.startswith("#"):
            continue
        if indent <= interface_indent:
            interface_indent = None
            continue
        field, separator, value = stripped.partition(":")
        if separator and field == key:
            icon = value.strip().strip("'\"")
            return "./" + (Path("skills") / skill / icon.removeprefix("./")).as_posix()
    return None


def check() -> None:
    seen = set()
    for item in read(CATALOG)["plugins"]:
        name = item["name"]
        if name in seen:
            raise ValueError(f"duplicate plugin: {name}")
        seen.add(name)
        source = item["source"]["path"]
        if not source.startswith("./") or ".." in source.split("/"):
            raise ValueError(f"unsafe plugin source: {source}")
        root = (ROOT / source).resolve()
        root.relative_to(ROOT.resolve())
        manifest = read(root / "plugin.json")
        if manifest["name"] != name:
            raise ValueError(f"plugin identity mismatch: {name}")
        brand = read(root / "branding.json")
        if set(brand) != {"plugin", "mcpServers", "skills"}:
            raise ValueError(f"unexpected branding sections: {name}")
        interface = manifest["extensions"]["com.openai"]["interface"]
        if brand["plugin"] != {
            "logo": interface["logo"], "composerIcon": interface["composerIcon"]
        }:
            raise ValueError(f"plugin logo mismatch: {name}")
        for path in brand["plugin"].values():
            icon_path(root, path)

        mcp = root / "mcp.json"
        servers = set(read(mcp)["mcpServers"]) if mcp.exists() else set()
        if set(brand["mcpServers"]) != servers:
            raise ValueError(f"MCP logo coverage mismatch: {name}")
        for server, data in brand["mcpServers"].items():
            if set(data) != {"logo"}:
                raise ValueError(f"invalid MCP branding: {name}/{server}")
            icon_path(root, data["logo"])

        skills = {p.name for p in (root / "skills").iterdir()
                  if p.is_dir() and (p / "SKILL.md").is_file()}
        if set(brand["skills"]) != skills:
            raise ValueError(f"skill icon coverage mismatch: {name}")
        for skill, data in brand["skills"].items():
            if set(data) != {"iconSmall", "iconLarge"}:
                raise ValueError(f"invalid skill branding: {name}/{skill}")
            for field, native_field in (
                ("iconSmall", "icon_small"), ("iconLarge", "icon_large")
            ):
                icon_path(root, data[field])
                native = native_skill_icon(root, skill, native_field)
                if native and data[field] != native:
                    raise ValueError(f"skill icon mismatch: {name}/{skill}/{field}")
        print(f"{name}: {len(skills)} skills, {len(servers)} MCP servers, icons OK")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", required=True)
    parser.parse_args()
    check()
