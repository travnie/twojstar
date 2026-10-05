#!/usr/bin/env python3
"""Validate a ChatGPT/Codex plugin folder and manifest paths."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

NAME_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
VERSION_RE = re.compile(r"^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$")
PATH_FIELDS = {
    "skills": "directory",
    "mcpServers": "file",
    "apps": "file",
    "hooks": "path",
}


def inside(root: Path, target: Path) -> bool:
    try:
        target.resolve().relative_to(root.resolve())
        return True
    except ValueError:
        return False


def validate_relative_path(
    root: Path, field: str, value: Any, errors: list[str]
) -> None:
    values = value if isinstance(value, list) else [value]
    for item in values:
        if not isinstance(item, str):
            errors.append(f"{field} path must be a string or string array")
            continue
        if not item.startswith("./"):
            errors.append(f"{field} path must begin with './': {item}")
            continue
        target = root / item[2:]
        if not inside(root, target):
            errors.append(f"{field} path escapes plugin root: {item}")
            continue
        if not target.exists():
            errors.append(f"{field} points to missing path: {item}")
            continue
        expected = PATH_FIELDS[field]
        if expected == "file" and not target.is_file():
            errors.append(f"{field} must point to a file: {item}")
        if expected == "directory" and not target.is_dir():
            errors.append(f"{field} must point to a directory: {item}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("plugin_dir", type=Path)
    args = parser.parse_args()

    root = args.plugin_dir.resolve()
    errors: list[str] = []
    warnings: list[str] = []
    portable_path = root / "plugin.json"
    manifest_path = portable_path if portable_path.is_file() else root / ".codex-plugin" / "plugin.json"

    if not root.is_dir():
        errors.append("plugin path is not a directory")
    if not manifest_path.is_file():
        errors.append("missing plugin.json or .codex-plugin/plugin.json")

    manifest: dict[str, Any] = {}
    if manifest_path.is_file():
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        except Exception as exc:
            errors.append(f"invalid plugin.json: {exc}")

    if manifest:
        portable = manifest_path == portable_path
        if portable:
            if manifest.get("$schema") != "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json":
                errors.append("portable manifest must declare the Agent Plugins 1.0 schema")
            if any(field in manifest for field in (*PATH_FIELDS, "interface")):
                errors.append("portable manifest contains top-level compatibility fields")
            extensions = manifest.get("extensions", {})
            if not isinstance(extensions, dict):
                errors.append("extensions must be an object")
                extension = {}
            else:
                extension = extensions.get("com.openai")
            if extension is None:
                overlay = root / ".codex-plugin/plugin.json"
                extension = json.loads(overlay.read_text(encoding="utf-8")) if overlay.is_file() else {}
            if not isinstance(extension, dict):
                errors.append("OpenAI extension must be an object")
                extension = {}
            manifest = {**manifest, **extension}
            manifest["skills"] = "./skills/" if (root / "skills").is_dir() else None
            mcp_path = root / "mcp.json"
            if mcp_path.is_file():
                try:
                    config = json.loads(mcp_path.read_text(encoding="utf-8"))
                    if config.get("$schema") != "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json":
                        errors.append("portable MCP config must declare its schema")
                    servers = config.get("mcpServers")
                    if not isinstance(servers, dict) or not servers:
                        errors.append("mcpServers must be a nonempty object")
                    else:
                        for alias, server in servers.items():
                            if not isinstance(server, dict) or server.get("type") not in {"streamable-http", "stdio"}:
                                errors.append(f"missing or invalid MCP transport: {alias}")
                except (OSError, ValueError, AttributeError) as exc:
                    errors.append(f"invalid mcp.json: {exc}")
        name = manifest.get("name")
        version = manifest.get("version")
        description = manifest.get("description")

        if not isinstance(name, str) or not NAME_RE.fullmatch(name):
            errors.append("name must be lowercase kebab-case")
        elif root.name != name:
            warnings.append(f"root folder {root.name!r} differs from manifest name {name!r}")

        if not isinstance(version, str) or not VERSION_RE.fullmatch(version):
            errors.append("version must be semantic, for example 0.1.0")
        if not isinstance(description, str) or not description.strip():
            errors.append("description is required")

        for field in PATH_FIELDS:
            if field in manifest and manifest[field] is not None:
                validate_relative_path(root, field, manifest[field], errors)

        internal = [
            path for path in (root / ".codex-plugin").rglob("*")
            if path.is_file() and path.name != "plugin.json"
        ]
        if internal:
            errors.append(
                "only plugin.json belongs in .codex-plugin: "
                + ", ".join(str(path.relative_to(root)) for path in internal)
            )

        skills_value = manifest.get("skills")
        if isinstance(skills_value, str) and skills_value.startswith("./"):
            skills_dir = root / skills_value[2:]
            if skills_dir.is_dir():
                skill_files = list(skills_dir.glob("*/SKILL.md"))
                if not skill_files:
                    warnings.append("skills path exists but contains no */SKILL.md")
                for skill_file in skill_files:
                    text = skill_file.read_text(encoding="utf-8", errors="replace")
                    if not text.startswith("---\n"):
                        errors.append(f"{skill_file.relative_to(root)} lacks YAML frontmatter")

        interface = manifest.get("interface")
        if interface is not None and not isinstance(interface, dict):
            errors.append("interface must be an object")
        elif isinstance(interface, dict):
            subtitle = interface.get("shortDescription", "")
            if not isinstance(subtitle, str) or len(subtitle) > 30:
                errors.append("interface.shortDescription must be at most 30 characters")
            for field in ("composerIcon", "logo"):
                if field in interface:
                    value = interface[field]
                    if not isinstance(value, str) or not value.startswith("./"):
                        errors.append(f"interface.{field} must be a './'-relative path")
                    else:
                        target = root / value[2:]
                        if not inside(root, target) or not target.is_file():
                            errors.append(f"interface.{field} points to a missing or unsafe file")
            screenshots = interface.get("screenshots")
            if screenshots is not None:
                if not isinstance(screenshots, list):
                    errors.append("interface.screenshots must be an array")
                else:
                    for value in screenshots:
                        if not isinstance(value, str) or not value.startswith("./"):
                            errors.append("every screenshot must use a './'-relative path")
                            continue
                        target = root / value[2:]
                        if not inside(root, target) or not target.is_file():
                            errors.append(f"missing or unsafe screenshot: {value}")

    payload = {
        "ok": not errors,
        "plugin": str(root),
        "errors": errors,
        "warnings": warnings,
    }
    print(json.dumps(payload, indent=2))
    return 0 if payload["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
