#!/usr/bin/env python3
"""Generate Claude adapters from canonical portable plugin sources.

Codex marketplace entries define plugin paths. Portable plugin.json and mcp.json
define descriptions, versions, listing URLs and MCP endpoints. This script writes
.claude-plugin/marketplace.json and each plugin's .claude-plugin/plugin.json, the
manifest Anthropic's directory reads. Do not edit either by hand.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / ".agents/plugins/marketplace.json"
TARGET = ROOT / ".claude-plugin/marketplace.json"

# Claude Code disallows names beginning with "claude-". Preserve the display name.
CLAUDE_NAMES: dict[str, str] = {}
# Append-only history of Claude plugin ids, so existing installs migrate instead of breaking.
RENAMES = {"devkit-claude": "claudin"}


LISTING_URLS = {
    "supportUrl": "supportURL",
    "privacyPolicyUrl": "privacyPolicyURL",
    "termsOfServiceUrl": "termsOfServiceURL",
}


def claude_manifest(portable: dict, slug: str, servers: dict[str, dict[str, str]]) -> dict:
    """Claude-native manifest: listing fields for the directory, MCPs inline.

    Inline servers replace same-named entries of the Codex .mcp.json in packages.
    """
    interface = portable["extensions"]["com.openai"]["interface"]
    manifest = {"name": slug}
    for key in ("version", "description", "author", "homepage", "repository", "license", "keywords", "icon"):
        if key in portable:
            manifest[key] = portable[key]
    if "homepage" in portable:
        manifest["documentationUrl"] = portable["homepage"]
    for claude_key, openai_key in LISTING_URLS.items():
        manifest[claude_key] = interface[openai_key]
    if servers:
        manifest["mcpServers"] = servers
    return manifest


def catalog() -> tuple[dict, dict[Path, dict]]:
    codex = json.loads(SOURCE.read_text(encoding="utf-8"))
    result = {
        "name": codex["name"],
        "description": "Plugin and MCP workflows from travnie/twojstar for Claude Code.",
        "owner": {"name": "travnie", "url": "https://github.com/travnie/twojstar"},
        "plugins": [],
    }
    names: set[str] = set()
    manifests: dict[Path, dict] = {}
    for entry in codex["plugins"]:
        rel = entry["source"]["path"]
        if not rel.startswith("./") or ".." in Path(rel).parts:
            raise ValueError(f"unsafe plugin source: {rel}")
        root = (ROOT / rel).resolve()
        root.relative_to(ROOT.resolve())
        portable = json.loads((root / "plugin.json").read_text(encoding="utf-8"))
        if portable["name"] != entry["name"]:
            raise ValueError(f"plugin identity differs from marketplace: {rel}")
        slug = CLAUDE_NAMES.get(portable["name"], portable["name"])
        if slug in names:
            raise ValueError(f"duplicate Claude plugin: {slug}")
        names.add(slug)
        skills = root / "skills"
        if not skills.is_dir() or not list(skills.glob("*/SKILL.md")):
            raise ValueError(f"missing skills for: {slug}")
        if len(portable["description"]) > MAX_DESCRIPTION:
            # claude.ai rejects the upload above this length.
            raise ValueError(f"description over {MAX_DESCRIPTION} chars: {slug}")
        interface = portable["extensions"]["com.openai"]["interface"]
        item = {
            "name": slug,
            "source": rel,
            "description": portable["description"],
            "version": portable["version"],
            "displayName": interface["displayName"],
            "category": entry.get("category", "Productivity"),
        }
        servers: dict[str, dict[str, str]] = {}
        config_path = root / "mcp.json"
        if config_path.is_file():
            config = json.loads(config_path.read_text(encoding="utf-8"))
            for key, server in config["mcpServers"].items():
                if server.get("type") != "streamable-http":
                    raise ValueError(f"unsupported Claude MCP transport: {slug}/{key}")
                url = server["url"]
                parsed = urlparse(url)
                if parsed.scheme != "https" or not parsed.netloc:
                    raise ValueError(f"MCP endpoint must be HTTPS: {slug}/{key}")
                servers[key] = {"type": "http", "url": url}
        # With a plugin manifest present, Claude ignores marketplace-entry MCPs,
        # so the servers live in the generated manifest only.
        manifests[root / ".claude-plugin/plugin.json"] = claude_manifest(portable, slug, servers)
        result["plugins"].append(item)
    for old, new in RENAMES.items():
        if new is not None and new not in names:
            raise ValueError(f"rename target missing: {old} -> {new}")
    result["renames"] = RENAMES
    return result, manifests


MAX_DESCRIPTION = 500


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check", action="store_true")
    mode.add_argument("--write", action="store_true")
    args = parser.parse_args()
    marketplace, manifests = catalog()
    outputs = {TARGET: marketplace, **manifests}
    rendered = {path: json.dumps(data, indent=2, ensure_ascii=False) + "\n" for path, data in outputs.items()}
    if args.check:
        stale = [path for path, text in rendered.items()
                 if not path.is_file() or path.read_text(encoding="utf-8") != text]
        if stale:
            for path in stale:
                print(f"stale: {path.relative_to(ROOT)}")
            print("Run: python plugins/_shared/claude_marketplace.py --write")
            return 1
        print("Claude marketplace and plugin manifests match canonical portable sources")
        return 0
    for path, text in rendered.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
        print(f"Updated {path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
