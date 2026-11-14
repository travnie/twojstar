#!/usr/bin/env python3
"""Scaffold a minimal ChatGPT/Codex plugin folder."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from urllib.parse import urlsplit

NAME_RE = re.compile(r"^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]{0,62}[a-z0-9])?$")
SKILL_NAME_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
VERSION_RE = re.compile(r"^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$")


def require_name(value: str) -> str:
    if not NAME_RE.fullmatch(value):
        raise argparse.ArgumentTypeError("expected a lowercase plugin name (dots and hyphens allowed)")
    return value


def require_skill_name(value: str) -> str:
    if not SKILL_NAME_RE.fullmatch(value):
        raise argparse.ArgumentTypeError("expected lowercase kebab-case")
    return value


def require_version(value: str) -> str:
    if not VERSION_RE.fullmatch(value):
        raise argparse.ArgumentTypeError("expected a semantic version such as 0.1.0")
    return value


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output_dir", type=Path)
    parser.add_argument("--name", required=True, type=require_name)
    parser.add_argument("--description", required=True)
    parser.add_argument("--version", default="0.1.0", type=require_version)
    parser.add_argument("--skill", action="append", type=require_skill_name)
    parser.add_argument("--registered-app-id")
    parser.add_argument("--bundled-mcp-name", type=require_skill_name)
    parser.add_argument("--mcp-url")
    parser.add_argument("--command", help="Bare executable name or path, not a shell command")
    parser.add_argument("--command-arg", action="append", default=[], help="Repeat for each argument; use --command-arg=value for flags")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    if not args.description.strip():
        parser.error("--description must not be blank")
    if not args.bundled_mcp_name and (args.command is not None or args.mcp_url is not None or args.registered_app_id is not None):
        parser.error("MCP and App binding flags require --bundled-mcp-name")
    if args.command_arg and not args.command:
        parser.error("--command-arg requires --command")
    if args.bundled_mcp_name:
        if bool(args.command) == bool(args.mcp_url):
            parser.error("provide exactly one of --command or --mcp-url with --bundled-mcp-name")
        if args.mcp_url:
            try:
                parsed = urlsplit(args.mcp_url)
                valid_url = (parsed.scheme == "https" and bool(parsed.hostname)
                             and not parsed.username and not parsed.password
                             and not any(c.isspace() for c in args.mcp_url))
            except ValueError:
                valid_url = False
            if not valid_url:
                parser.error("--mcp-url must be an HTTPS URL with a hostname and no credentials")
        if args.command is not None and not args.command.strip():
            parser.error("--command must not be blank")
    app_id = None
    if args.registered_app_id is not None:
        if not args.mcp_url:
            parser.error("--registered-app-id requires a remote MCP endpoint")
        app_id = args.registered_app_id.removeprefix("plugin_")
        if not re.fullmatch(r"(?:asdk_app_|connector_|templated_apps_)[A-Za-z0-9][A-Za-z0-9_-]*", app_id):
            parser.error("--registered-app-id should come from the supported ChatGPT registration flow")

    root = (args.output_dir / args.name).resolve()
    if root.exists() and (not root.is_dir() or (any(root.iterdir()) and not args.force)):
        parser.error(f"refusing to overwrite non-empty directory: {root}")
    root.mkdir(parents=True, exist_ok=True)

    skills = args.skill or []
    manifest: dict = {
        "name": args.name,
        "version": args.version,
        "description": args.description.strip(),
        "interface": {
            "displayName": args.name.replace("-", " ").title(),
            "shortDescription": args.description.strip()[:30],
        },
    }

    if skills:
        manifest["skills"] = "./skills/"
        for skill_name in skills:
            write(
                root / "skills" / skill_name / "SKILL.md",
                (
                    "---\n"
                    f"name: {json.dumps(skill_name)}\n"
                    f"description: {json.dumps(f'TODO: describe when {skill_name} should activate.', ensure_ascii=False)}\n"
                    "---\n\n"
                    f"# {skill_name.replace('-', ' ').title()}\n\n"
                    "Define expected input, workflow, output, boundaries, and stop rules.\n"
                ),
            )

    if app_id:
        manifest["apps"] = "./.app.json"
        write(
            root / ".app.json",
            json.dumps(
                {"apps": {args.bundled_mcp_name or args.name: {"id": app_id}}},
                indent=2,
            ) + "\n",
        )

    if args.bundled_mcp_name:
        portable_server = (
            {"type": "streamable-http", "url": args.mcp_url}
            if args.mcp_url else {"type": "stdio", "command": args.command, "args": args.command_arg}
        )
        manifest["mcpServers"] = "./.mcp.json"
        write(
            root / ".mcp.json",
            json.dumps(
                {
                    "mcpServers": {args.bundled_mcp_name: (
                        {"type": "http", "url": args.mcp_url}
                        if args.mcp_url else {"command": args.command, "args": args.command_arg}
                    )}
                },
                indent=2,
            ) + "\n",
        )
        write(root / "mcp.json", json.dumps({
            "$schema": "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
            "mcpServers": {args.bundled_mcp_name: portable_server},
        }, indent=2) + "\n")

    portable = {key: value for key, value in manifest.items()
                if key not in {"interface", "skills", "apps", "mcpServers"}}
    extension = {"interface": manifest["interface"]}
    if "apps" in manifest:
        extension["apps"] = manifest["apps"]
    portable.update({
        "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
        "extensions": {"com.openai": extension},
    })
    write(root / "plugin.json", json.dumps(portable, indent=2) + "\n")

    write(
        root / ".codex-plugin" / "plugin.json",
        json.dumps(manifest, indent=2) + "\n",
    )
    write(
        root / "README.md",
        (
            f"# {manifest['interface']['displayName']}\n\n"
            "Generated plugin scaffold.\n"
        ),
    )
    print(root)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
