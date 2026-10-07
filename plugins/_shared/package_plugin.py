#!/usr/bin/env python3
"""Validate and reproducibly package a portable skill + MCP plugin."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import stat
import tempfile
import zipfile
from pathlib import Path
from urllib.parse import urlparse

import yaml

FIXED_TIME = (1980, 1, 1, 0, 0, 0)


class StrictSafeLoader(yaml.SafeLoader):
    """Safe YAML loader that rejects duplicate and non-string mapping keys."""

    def construct_mapping(self, node, deep=False):
        if isinstance(node, yaml.MappingNode):
            seen: set[str] = set()
            for key, _value in node.value:
                if not isinstance(key, yaml.ScalarNode) or key.tag != "tag:yaml.org,2002:str":
                    raise ValueError("YAML mapping keys must be strings")
                if key.value in seen:
                    raise ValueError(f"duplicate YAML key: {key.value}")
                seen.add(key.value)
        return super().construct_mapping(node, deep=deep)


def load_yaml(text: str):
    loader = StrictSafeLoader(text)
    try:
        return loader.get_single_data()
    finally:
        loader.dispose()


def safe_asset(root: Path, value: str) -> Path:
    if not isinstance(value, str) or not value.startswith("./") or "\\" in value or ".." in value.split("/"):
        raise ValueError(f"unsafe asset path: {value!r}")
    path = root / value[2:]
    path.resolve().relative_to(root.resolve())
    if not path.is_file() or path.is_symlink():
        raise ValueError(f"missing or unsafe asset: {value}")
    return path


def read_skill_frontmatter(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        raise ValueError(f"missing skill frontmatter: {path}")
    end = text.find("\n---\n", 4)
    if end < 0:
        raise ValueError(f"unterminated skill frontmatter: {path}")
    data = load_yaml(text[4:end])
    if not isinstance(data, dict):
        raise ValueError(f"skill frontmatter must be a mapping: {path}")
    return data


def validate(root: Path) -> tuple[dict, dict]:
    manifest = json.loads((root / "plugin.json").read_text(encoding="utf-8"))
    if manifest.get("$schema") != "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json":
        raise ValueError("expected Agent Plugins 1.0 manifest")
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", manifest.get("name", "")):
        raise ValueError("invalid plugin name")
    if not re.fullmatch(r"\d+\.\d+\.\d+", manifest.get("version", "")):
        raise ValueError("plugin version must be strict semver")

    interface = manifest.get("extensions", {}).get("com.openai", {}).get("interface")
    if not isinstance(interface, dict):
        raise ValueError("missing OpenAI interface metadata")
    for key in ("displayName", "shortDescription", "longDescription", "developerName", "category"):
        if not isinstance(interface.get(key), str) or not interface[key].strip():
            raise ValueError(f"missing interface field: {key}")
    if len(interface["shortDescription"]) > 30:
        raise ValueError("shortDescription exceeds 30 characters")
    for key in ("logo", "composerIcon"):
        value = interface.get(key)
        if not isinstance(value, str):
            raise ValueError(f"missing interface asset: {key}")
        safe_asset(root, value)

    mcp = json.loads((root / "mcp.json").read_text(encoding="utf-8"))
    if mcp.get("$schema") != "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json":
        raise ValueError("expected portable MCP schema")
    servers = mcp.get("mcpServers")
    if not isinstance(servers, dict) or not servers:
        raise ValueError("plugin must declare at least one MCP server")
    for name, server in servers.items():
        if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_-]*", name):
            raise ValueError(f"invalid MCP server name: {name}")
        if not isinstance(server, dict) or server.get("type") != "streamable-http":
            raise ValueError(f"{name}: expected streamable-http transport")
        url = server.get("url")
        parsed = urlparse(url) if isinstance(url, str) else None
        if not parsed or parsed.scheme != "https" or not parsed.netloc:
            raise ValueError(f"{name}: MCP URL must be HTTPS")

    skills = root / "skills"
    if not skills.is_dir():
        raise ValueError("missing skills directory")
    names: set[str] = set()
    for child in sorted(skills.iterdir()):
        if not child.is_dir() or child.is_symlink():
            raise ValueError(f"invalid skill directory: {child.name}")
        front = read_skill_frontmatter(child / "SKILL.md")
        name = front.get("name")
        if name != child.name or name in names:
            raise ValueError(f"invalid or duplicate skill: {child.name}")
        names.add(name)
        metadata_path = child / "agents/openai.yaml"
        if not metadata_path.is_file():
            raise ValueError(f"missing OpenAI skill metadata: {child.name}")
        metadata = load_yaml(metadata_path.read_text(encoding="utf-8"))
        if not isinstance(metadata, dict) or not isinstance(metadata.get("interface"), dict):
            raise ValueError(f"invalid OpenAI skill metadata: {child.name}")
        policy = metadata.get("policy")
        if not isinstance(policy, dict) or set(policy) - {"products", "allow_implicit_invocation"}:
            raise ValueError(f"invalid skill policy: {child.name}")
        products = policy.get("products")
        if not isinstance(products, list) or set(products) != {"CHAT", "CODEX"} or len(products) != 2:
            raise ValueError(f"skill must target CHAT and CODEX: {child.name}")
        if not isinstance(policy.get("allow_implicit_invocation"), bool):
            raise ValueError(f"skill must declare allow_implicit_invocation: {child.name}")

    if not any(root.glob("LICENSE*.txt")):
        raise ValueError("plugin package must include license text")
    return manifest, mcp


def stage(source: Path, target: Path) -> None:
    source = source.resolve()
    for path in sorted(source.rglob("*")):
        rel = path.relative_to(source)
        if path.is_symlink():
            raise ValueError(f"symlink is not packageable: {rel}")
        if path.is_dir() or "tests" in rel.parts or any(part in {"__pycache__", ".git", "node_modules"} for part in rel.parts):
            continue
        if not path.is_file():
            raise ValueError(f"unexpected package member: {rel}")
        if path.name.startswith(".env") or path.suffix.lower() in {".pyc", ".pem", ".key", ".p12", ".pfx"}:
            raise ValueError(f"secret/transient-shaped file: {rel}")
        dest = target / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(path.read_bytes())

    manifest, mcp = validate(target)
    overlay = {key: value for key, value in manifest.items() if key not in {"$schema", "extensions"}}
    overlay.update(manifest["extensions"]["com.openai"])
    overlay.update(skills="./skills/", mcpServers="./.mcp.json")
    (target / ".codex-plugin").mkdir(exist_ok=True)
    (target / ".codex-plugin/plugin.json").write_text(json.dumps(overlay, indent=2) + "\n", encoding="utf-8")
    legacy = {"mcpServers": {name: {"url": server["url"]} for name, server in mcp["mcpServers"].items()}}
    (target / ".mcp.json").write_text(json.dumps(legacy, indent=2) + "\n", encoding="utf-8")


def package(source: Path, output: Path) -> dict:
    source = source.resolve()
    output = output.resolve()
    if output == source or output.is_relative_to(source):
        raise ValueError("archive must be outside plugin source")
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as directory:
        staged = Path(directory) / source.name
        staged.mkdir()
        stage(source, staged)
        temp = output.with_suffix(output.suffix + ".tmp")
        try:
            with zipfile.ZipFile(temp, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
                for path in sorted(staged.rglob("*")):
                    if not path.is_file():
                        continue
                    name = f"{source.name}/" + path.relative_to(staged).as_posix()
                    info = zipfile.ZipInfo(name, FIXED_TIME)
                    info.create_system = 3
                    info.external_attr = (stat.S_IFREG | 0o644) << 16
                    archive.writestr(info, path.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
            temp.replace(output)
        finally:
            temp.unlink(missing_ok=True)
    return {
        "archive": str(output),
        "bytes": output.stat().st_size,
        "sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    print(json.dumps(package(args.source, args.output), indent=2))
