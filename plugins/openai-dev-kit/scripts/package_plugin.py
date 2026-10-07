#!/usr/bin/env python3
"""Package the canonical portable plugin with generated Codex compatibility files."""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import stat
import struct
import tempfile
import zipfile
from pathlib import Path
from xml.parsers import expat

import yaml

ROOT = Path(__file__).resolve().parents[1]
FIXED_TIME = (1980, 1, 1, 0, 0, 0)


class SkillMetadataLoader(yaml.SafeLoader):
    """Load skill metadata without duplicate keys or YAML merge overrides."""

    def construct_mapping(self, node, deep=False):
        if isinstance(node, yaml.MappingNode):
            keys = set()
            for key, _value in node.value:
                if not isinstance(key, yaml.ScalarNode) or key.tag != "tag:yaml.org,2002:str":
                    raise ValueError("skill metadata requires plain string mapping keys")
                if key.value in keys:
                    raise ValueError(f"duplicate skill metadata key: {key.value}")
                keys.add(key.value)
        return super().construct_mapping(node, deep=deep)


def asset(root: Path, value: str) -> Path:
    """Resolve a package-local regular asset without traversal or symlinks."""
    if not value.startswith("./") or "\\" in value or ".." in value.split("/"):
        raise ValueError(f"unsafe asset path: {value}")
    path = root / value[2:]
    path.resolve().relative_to(root.resolve())
    if not path.is_file() or path.is_symlink():
        raise ValueError(f"missing/unsafe asset: {value}")
    return path


def validate_svg(path: Path) -> None:
    """Parse static SVG with DTD/entity expansion and active content forbidden."""
    data = path.read_bytes()
    if len(data) > 64 * 1024:
        raise ValueError("SVG exceeds branding size limit")
    svg_parser = expat.ParserCreate(namespace_separator="}")
    root: list[dict[str, str]] = []

    def reject(*_args):
        raise ValueError("SVG declarations/entities are forbidden")

    def start(name, attrs):
        if not root:
            if name != "http://www.w3.org/2000/svg}svg":
                raise ValueError("invalid SVG root")
            root.append(attrs)
        if name.split("}")[-1] in {"script", "foreignObject", "image", "use"}:
            raise ValueError("active/referenced SVG content is forbidden")
        for key, value in attrs.items():
            local = key.split("}")[-1].lower()
            if local.startswith("on") or local in {"href", "style"} or "url(" in value.lower():
                raise ValueError("active/external SVG attributes are forbidden")

    svg_parser.StartDoctypeDeclHandler = reject
    svg_parser.EntityDeclHandler = reject
    svg_parser.ExternalEntityRefHandler = reject
    svg_parser.SetParamEntityParsing(expat.XML_PARAM_ENTITY_PARSING_NEVER)
    svg_parser.StartElementHandler = start
    svg_parser.Parse(data, True)
    if not root:
        raise ValueError("empty SVG")
    width, height = (float(root[0][key]) for key in ("width", "height"))
    if not math.isfinite(width) or width <= 0 or width != height:
        raise ValueError("branding must be finite, positive and square")


def validate(root: Path) -> tuple[dict, dict]:
    """Check canonical manifests, branding, one MCP and intended skill metadata."""
    manifest = json.loads((root / "plugin.json").read_text(encoding="utf-8"))
    if manifest.get("$schema") != "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json":
        raise ValueError("expected portable Agent Plugins 1.0 manifest")
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", manifest["name"]):
        raise ValueError("invalid package name")
    if not re.fullmatch(r"\d+\.\d+\.\d+", manifest["version"]):
        raise ValueError("expected strict release semver")
    ui = manifest["extensions"]["com.openai"]["interface"]
    if len(ui["shortDescription"]) > 30:
        raise ValueError("subtitle exceeds 30 characters")
    for key in ("logo", "composerIcon"):
        path = asset(root, ui[key])
        if path.suffix == ".svg":
            validate_svg(path)
        elif path.suffix == ".png":
            data = path.read_bytes()
            if len(data) > 5 * 1024 * 1024 or data[:16] != b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR":
                raise ValueError("invalid/oversized PNG branding")
            width, height = struct.unpack(">II", data[16:24])
            if width != height or not 48 <= width <= 4096:
                raise ValueError("PNG branding must be square and 48–4096 pixels")
        else:
            raise ValueError("expected SVG or PNG branding")
    validate_svg(asset(root, "./assets/icon.svg"))
    servers = json.loads((root / "mcp.json").read_text(encoding="utf-8"))
    if servers.get("$schema") != "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json":
        raise ValueError("expected portable MCP schema")
    expected = {"openaiDeveloperDocs": "https://developers.openai.com/mcp"}
    actual = servers["mcpServers"]
    if set(actual) != set(expected):
        raise ValueError("expected exactly the official OpenAI docs MCP")
    for name, url in expected.items():
        if actual[name] != {"type": "streamable-http", "url": url}:
            raise ValueError(f"unexpected server configuration: {name}")
    names = set()
    for child in sorted((root / "skills").iterdir()):
        if not child.is_dir() or child.is_symlink():
            raise ValueError(f"invalid skill directory: {child.name}")
        text = (child / "SKILL.md").read_text(encoding="utf-8")
        front = re.fullmatch(r"---\nname: ([a-z0-9-]+)\ndescription: ([^\n]+)\n---\n(.+)", text, re.S)
        if not front or front[1] != child.name or front[1] in names:
            raise ValueError(f"invalid/duplicate skill: {child.name}")
        names.add(front[1])
        metadata_text = (child / "agents/openai.yaml").read_text(encoding="utf-8")
        loader = SkillMetadataLoader(metadata_text)
        try:
            metadata = loader.get_single_data()
        except yaml.YAMLError as error:
            raise ValueError(f"invalid skill metadata: {child.name}") from error
        finally:
            loader.dispose()
        policy = metadata.get("policy") if isinstance(metadata, dict) else None
        if not isinstance(policy, dict) or policy.get("products") != ["CHAT", "CODEX"]:
            raise ValueError(f"bundled skill must target CHAT and CODEX: {child.name}")
    if names != {"openai-dev", "chatgpt-plugin-builder"}:
        raise ValueError("missing intended skills")
    return manifest, servers


def stage(source: Path, target: Path, apps: dict[str, str] | None = None) -> None:
    """Copy safe sources and generate synchronized legacy compatibility files."""
    names = set()
    for path in sorted(source.rglob("*")):
        rel = path.relative_to(source)
        if path.is_symlink():
            raise ValueError(f"symlink: {rel}")
        if path.is_dir() or "tests" in rel.parts:
            continue
        if not path.is_file() or any(part in {"__pycache__", ".git", "node_modules"} for part in rel.parts):
            raise ValueError(f"unexpected package member: {rel}")
        if path.name.startswith(".env") or path.suffix in {".pyc", ".pem", ".key"}:
            raise ValueError(f"secret/transient-shaped file: {rel}")
        key = str(rel).casefold()
        if key in names:
            raise ValueError(f"case-colliding path: {rel}")
        names.add(key)
        destination = target / rel
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(path.read_bytes())
    manifest, servers = validate(target)
    if apps is not None:
        if set(apps) != {"openaiDeveloperDocs"}:
            raise ValueError("private packages require the verified OpenAI docs app")
        if any(not re.fullmatch(r"(?:plugin_)?asdk_app_[0-9a-f]{32}", value) for value in apps.values()):
            raise ValueError("copy the actual App or connection page ID from ChatGPT registration")
        manifest["extensions"]["com.openai"]["apps"] = "./.app.json"
        (target / "plugin.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        bindings = {"apps": {name: {"id": value.removeprefix("plugin_")} for name, value in apps.items()}}
        (target / ".app.json").write_text(json.dumps(bindings, indent=2) + "\n", encoding="utf-8")
    overlay = {key: value for key, value in manifest.items() if key not in {"$schema", "extensions"}}
    overlay.update(manifest["extensions"]["com.openai"])
    overlay.update(skills="./skills/", mcpServers="./.mcp.json")
    (target / ".codex-plugin").mkdir()
    (target / ".codex-plugin/plugin.json").write_text(json.dumps(overlay, indent=2) + "\n", encoding="utf-8")
    legacy = {"mcpServers": {name: {"url": value["url"]} for name, value in servers["mcpServers"].items()}}
    (target / ".mcp.json").write_text(json.dumps(legacy, indent=2) + "\n", encoding="utf-8")


def package(output: Path, apps: dict[str, str] | None = None) -> dict:
    """Write an atomic reproducible archive and return its size and digest."""
    output = output.resolve()
    if output.is_relative_to(ROOT.resolve()):
        raise ValueError("archive must live outside plugin source")
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as directory:
        staged = Path(directory) / "openai-dev-kit"
        staged.mkdir()
        stage(ROOT, staged, apps)
        temporary = output.with_suffix(output.suffix + ".tmp")
        try:
            with zipfile.ZipFile(temporary, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
                for path in sorted(staged.rglob("*")):
                    if not path.is_file():
                        continue
                    name = "openai-dev-kit/" + path.relative_to(staged).as_posix()
                    info = zipfile.ZipInfo(name, FIXED_TIME)
                    info.create_system = 3
                    info.external_attr = (stat.S_IFREG | 0o644) << 16
                    archive.writestr(info, path.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
            temporary.replace(output)
        finally:
            temporary.unlink(missing_ok=True)
    return {"archive": str(output), "sha256": hashlib.sha256(output.read_bytes()).hexdigest(), "bytes": output.stat().st_size}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    parser.add_argument("--docs-app-id", help="Verified OpenAI docs App or connection page ID; private packages only")
    args = parser.parse_args()
    registered_apps = {"openaiDeveloperDocs": args.docs_app_id} if args.docs_app_id else None
    print(json.dumps(package(args.output, registered_apps), indent=2))
