#!/usr/bin/env python3
"""Validate icons and public listing metadata against portable plugin sources.

Listing rules mirror what Anthropic's directory and OpenAI's plugin directory
check at submission, so a regression fails here instead of in a portal.
"""
from __future__ import annotations

import argparse
import json
import re
import struct
from pathlib import Path
from urllib.parse import urlparse

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


LISTING_URLS = ("websiteURL", "supportURL", "privacyPolicyURL", "termsOfServiceURL")


def luminance(color: str) -> float:
    channels = [int(color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    linear = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in channels]
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]


def contrast(a: str, b: str) -> float:
    high, low = sorted((luminance(a), luminance(b)), reverse=True)
    return (high + 0.05) / (low + 0.05)


def listing_icon(root: Path, value: str, name: str) -> None:
    """Square PNG/SVG, at least 48 px, raster at most 4096 px, at most 5 MiB."""
    icon_path(root, value)
    path = root / value[2:]
    data = path.read_bytes()
    if len(data) > 5 * 1024 * 1024:
        raise ValueError(f"listing icon over 5 MiB: {name}")
    if path.suffix == ".png":
        if data[:16] != b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR":
            raise ValueError(f"invalid PNG listing icon: {name}")
        width, height = struct.unpack(">II", data[16:24])
        if width != height or not 48 <= width <= 4096:
            raise ValueError(f"listing icon must be square, 48-4096 px: {name}")
    elif path.suffix == ".svg":
        box = re.search(r'viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"', data.decode("utf-8"))
        if not box or float(box[1]) != float(box[2]) or not 48 <= float(box[1]) <= 4096:
            raise ValueError(f"SVG listing icon needs a square viewBox of at least 48: {name}")
    else:
        raise ValueError(f"listing icon must be PNG or SVG: {name}")


def check_listing(root: Path, manifest: dict, name: str) -> None:
    interface = manifest["extensions"]["com.openai"]["interface"]
    for field, limit in (("displayName", 30), ("shortDescription", 30), ("longDescription", 4000)):
        if not interface.get(field) or len(interface[field]) > limit:
            raise ValueError(f"{field} missing or over {limit} chars: {name}")
    for field in LISTING_URLS:
        url = urlparse(str(interface.get(field, "")))
        if url.scheme != "https" or not url.hostname or url.username or url.password:
            raise ValueError(f"listing {field} must be an https URL: {name}")
    prompts = interface.get("defaultPrompt", [])
    prompts = [prompts] if isinstance(prompts, str) else prompts
    if not isinstance(prompts, list) or any(not isinstance(p, str) for p in prompts) or len(prompts) > 3 or len(set(prompts)) != len(prompts) or any(len(p) > 128 for p in prompts):
        raise ValueError(f"defaultPrompt: at most 3 unique prompts of 128 chars: {name}")
    capabilities = interface.get("capabilities", [])
    if not isinstance(capabilities, list) or len(capabilities) > 20 or any(
        not isinstance(c, str) or len(c) > 120 for c in capabilities
    ):
        raise ValueError(f"capabilities over limits: {name}")
    for field, background in (("brandColor", "#FFFFFF"), ("brandColorDark", "#212121")):
        color = interface.get(field)
        if color is None:
            continue
        if not re.fullmatch(r"#[0-9A-Fa-f]{6}", color) or contrast(color, background) < 2:
            raise ValueError(f"{field} needs #RRGGBB with 2:1 contrast on {background}: {name}")
    for field in ("logo", "composerIcon", "logoDark", "composerIconDark"):
        if field in interface:
            listing_icon(root, interface[field], f"{name}/{field}")
    icon = manifest.get("icon")
    if not isinstance(icon, str) or not icon.endswith(".png"):
        raise ValueError(f"Claude directory icon must be a PNG: {name}")
    listing_icon(root, icon, f"{name}/icon")
    if struct.unpack(">I", (root / icon[2:]).read_bytes()[16:20])[0] < 256:
        raise ValueError(f"Claude directory icon must be at least 256 px: {name}")
    if not manifest.get("license") and not any(root.glob("LICENSE*")):
        raise ValueError(f"license field or LICENSE file required: {name}")
    readme = root / "README.md"
    words = re.sub(r"```.*?```", "", readme.read_text(encoding="utf-8"), flags=re.S).split() if readme.is_file() else []
    if len(words) < 40:
        raise ValueError(f"README needs at least 40 words outside code blocks: {name}")


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
        check_listing(root, manifest, name)
        print(f"{name}: {len(skills)} skills, {len(servers)} MCP servers, icons and listing OK")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", required=True)
    parser.parse_args()
    check()
