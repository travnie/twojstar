#!/usr/bin/env python3
"""Generate the Claude Code marketplace from canonical portable plugin sources.

Codex marketplace entries define plugin paths. Portable plugin.json and mcp.json
define descriptions, versions and MCP endpoints. Do not edit the generated
.claude-plugin/marketplace.json manually.
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
CLAUDE_NAMES = {"claude-dev-kit": "devkit-claude"}


def catalog() -> dict:
    codex = json.loads(SOURCE.read_text(encoding="utf-8"))
    result = {
        "name": codex["name"],
        "description": "Plugin and MCP workflows from travnie/twojstar for Claude Code.",
        "owner": {"name": "travnie", "url": "https://github.com/travnie/twojstar"},
        "plugins": [],
    }
    names: set[str] = set()
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
        interface = portable["extensions"]["com.openai"]["interface"]
        item = {
            "name": slug,
            "source": rel,
            "description": portable["description"],
            "version": portable["version"],
            "displayName": interface["displayName"],
            "category": entry.get("category", "Productivity"),
        }
        config_path = root / "mcp.json"
        if config_path.is_file():
            config = json.loads(config_path.read_text(encoding="utf-8"))
            servers: dict[str, dict[str, str]] = {}
            for key, server in config["mcpServers"].items():
                if server.get("type") != "streamable-http":
                    raise ValueError(f"unsupported Claude MCP transport: {slug}/{key}")
                url = server["url"]
                parsed = urlparse(url)
                if parsed.scheme != "https" or not parsed.netloc:
                    raise ValueError(f"MCP endpoint must be HTTPS: {slug}/{key}")
                servers[key] = {"type": "http", "url": url}
            if servers:
                # Claude Code marketplace entry supplies MCPs as plugin components.
                # The same portable mcp.json is the only edited URL source.
                item["mcpServers"] = servers
        result["plugins"].append(item)
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check", action="store_true")
    mode.add_argument("--write", action="store_true")
    args = parser.parse_args()
    output = json.dumps(catalog(), indent=2, ensure_ascii=False) + "\n"
    if args.check:
        if not TARGET.is_file() or TARGET.read_text(encoding="utf-8") != output:
            print("Claude marketplace is stale. Run: python plugins/_shared/claude_marketplace.py --write")
            return 1
        print("Claude marketplace matches canonical portable plugin sources")
        return 0
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text(output, encoding="utf-8")
    print(f"Updated {TARGET.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
