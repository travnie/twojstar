#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import stat
import tempfile
import zipfile
from pathlib import Path

import yaml
from defusedxml import ElementTree as DefusedElementTree

ROOT = Path(__file__).resolve().parents[1]
FIXED_TIME = (1980, 1, 1, 0, 0, 0)
EXPECTED_SERVERS = {
    "googleDeveloperKnowledge": "https://developerknowledge.googleapis.com/mcp",
    "googleCloudCli": "https://cloudcli.googleapis.com/mcp",
    "googleCloudStorage": "https://storage.googleapis.com/storage/mcp",
    "googleApplicationDesignCenter": "https://designcenter.googleapis.com/mcp",
    "googleAndroidManagement": "https://androidmanagement.googleapis.com/mcp",
    "googleCloudRun": "https://run.googleapis.com/mcp",
    "googleApiKeys": "https://apikeys.googleapis.com/mcp",
    "googleCloudAssist": "https://geminicloudassist.googleapis.com/mcp",
    "googleIam": "https://iam.googleapis.com/mcp",
    "geminiApiDocs": "https://gemini-api-docs-mcp.dev",
}
EXPECTED_SKILLS = {
    "google-dev",
    "gcloud",
    "google-cloud-storage",
    "cloud-run",
    "gemini-api",
    "gemini-agents-api",
    "application-design-center",
}
EXPECTED_AUTH_MODES = {
    "googleDeveloperKnowledge": "api_key_or_oauth",
    "googleCloudCli": "oauth",
    "googleCloudStorage": "oauth",
    "googleApplicationDesignCenter": "oauth",
    "googleAndroidManagement": "oauth",
    "googleCloudRun": "oauth",
    "googleApiKeys": "oauth",
    "googleCloudAssist": "oauth",
    "googleIam": "oauth",
    "geminiApiDocs": "none",
}
EXPECTED_AUTH_PROFILE_KEYS = {
    "googleDeveloperKnowledge": {"mode", "preferred", "apiKey", "oauth"},
    "googleCloudCli": {"mode", "oauth", "lifecycle"},
    "googleCloudStorage": {"mode", "oauth"},
    "googleApplicationDesignCenter": {"mode", "oauth", "lifecycle"},
    "googleAndroidManagement": {"mode", "oauth", "lifecycle"},
    "googleCloudRun": {"mode", "oauth"},
    "googleApiKeys": {"mode", "oauth", "sensitive"},
    "googleCloudAssist": {"mode", "oauth", "lifecycle"},
    "googleIam": {"mode", "oauth", "sensitive"},
    "geminiApiDocs": {"mode"},
}
GOOGLE_OAUTH_KEYS = {
    "clientRegistration",
    "dynamicClientRegistration",
    "clientIdMetadataDocuments",
    "credentialStorage",
}
OAUTH_POLICY_KEYS = {"scopes", "readOnlyScopes", "alternativeScopes"}


class StrictLoader(yaml.SafeLoader):
    def construct_mapping(self, node, deep=False):
        if isinstance(node, yaml.MappingNode):
            seen = set()
            for key, _ in node.value:
                if (
                    not isinstance(key, yaml.ScalarNode)
                    or key.tag != "tag:yaml.org,2002:str"
                ):
                    raise ValueError("metadata keys must be plain strings")
                if key.value in seen or key.value == "<<":
                    raise ValueError(f"duplicate/merged metadata key: {key.value}")
                seen.add(key.value)
        return super().construct_mapping(node, deep=deep)


def parse_yaml(text: str) -> dict:
    loader = StrictLoader(text)
    try:
        value = loader.get_single_data()
    finally:
        loader.dispose()
    if not isinstance(value, dict):
        raise ValueError("expected YAML mapping")
    return value


def load_yaml(path: Path) -> dict:
    try:
        return parse_yaml(path.read_text(encoding="utf-8"))
    except ValueError as exc:
        raise ValueError(f"invalid YAML mapping: {path}") from exc


def frontmatter(path: Path) -> dict:
    match = re.match(
        r"\A---\n(.*?)\n---\n",
        path.read_text(encoding="utf-8"),
        re.S,
    )
    if not match:
        raise ValueError(f"missing frontmatter: {path}")
    try:
        return parse_yaml(match.group(1))
    except ValueError as exc:
        raise ValueError(f"invalid frontmatter: {path}") from exc


def safe_asset_path(
    root: Path,
    value: object,
    *,
    require_dot_prefix: bool = False,
) -> Path:
    if not isinstance(value, str):
        raise ValueError(f"unsafe asset path: {value}")
    if require_dot_prefix and not value.startswith("./"):
        raise ValueError(f"unsafe asset path: {value}")
    if value.startswith(("/", "\\")) or "\\" in value or ".." in value.split("/"):
        raise ValueError(f"unsafe asset path: {value}")
    relative = value[2:] if value.startswith("./") else value
    path = root / relative
    if not path.is_file() or path.is_symlink():
        raise ValueError(f"missing asset: {path}")
    return path


def validate_svg(path: Path) -> None:
    root = DefusedElementTree.fromstring(path.read_text(encoding="utf-8"))
    if root.tag.split("}")[-1] != "svg":
        raise ValueError(f"invalid SVG: {path}")
    width = float(root.attrib["width"])
    height = float(root.attrib["height"])
    if not math.isfinite(width) or width <= 0 or width != height:
        raise ValueError(f"SVG must be square: {path}")
    for element in root.iter():
        if element.tag.split("}")[-1] in {"script", "foreignObject", "image", "use"}:
            raise ValueError(f"active SVG element: {path}")
        for key, value in element.attrib.items():
            leaf = key.split("}")[-1].lower()
            if (
                leaf.startswith("on")
                or leaf == "href"
                or "url(" in value.lower()
            ):
                raise ValueError(f"external SVG reference: {path}")


def validate(root: Path):
    manifest = json.loads((root / "plugin.json").read_text(encoding="utf-8"))
    if (
        manifest.get("$schema")
        != "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json"
    ):
        raise ValueError("expected Agent Plugins 1.0")
    if manifest.get("name") != "google-dev-kit" or not re.fullmatch(
        r"\d+\.\d+\.\d+",
        manifest.get("version", ""),
    ):
        raise ValueError("invalid plugin identity/version")

    ui = manifest["extensions"]["com.openai"]["interface"]
    if len(ui["shortDescription"]) > 30:
        raise ValueError("shortDescription too long")
    for key in ("logo", "composerIcon"):
        validate_svg(
            safe_asset_path(
                root,
                ui[key],
                require_dot_prefix=True,
            )
        )

    config = json.loads((root / "mcp.json").read_text(encoding="utf-8"))
    actual = config.get("mcpServers", {})
    if set(actual) != set(EXPECTED_SERVERS):
        raise ValueError("unexpected MCP server set")
    for name, url in EXPECTED_SERVERS.items():
        if actual[name] != {"type": "streamable-http", "url": url}:
            raise ValueError(f"unexpected MCP config: {name}")

    auth = json.loads((root / "mcp-auth.json").read_text(encoding="utf-8"))
    if set(auth) != {"version", "googleOAuth", "servers"}:
        raise ValueError("unexpected MCP auth top-level fields")
    if auth.get("version") != 1:
        raise ValueError("unsupported MCP auth metadata version")
    google_oauth = auth.get("googleOAuth", {})
    if set(google_oauth) != GOOGLE_OAUTH_KEYS:
        raise ValueError("unexpected Google OAuth metadata fields")
    if (
        google_oauth.get("clientRegistration") != "pre-registered"
        or google_oauth.get("dynamicClientRegistration") is not False
        or google_oauth.get("clientIdMetadataDocuments") is not False
        or google_oauth.get("credentialStorage") != "host-managed"
    ):
        raise ValueError("unexpected Google OAuth client-registration policy")

    auth_servers = auth.get("servers", {})
    if set(auth_servers) != set(EXPECTED_SERVERS):
        raise ValueError("unexpected MCP auth server set")
    for name, expected_mode in EXPECTED_AUTH_MODES.items():
        profile = auth_servers[name]
        if set(profile) != EXPECTED_AUTH_PROFILE_KEYS[name]:
            raise ValueError(f"unexpected MCP auth profile fields: {name}")
        if profile.get("mode") != expected_mode:
            raise ValueError(f"unexpected MCP auth mode: {name}")
        if expected_mode == "none":
            continue

        oauth = profile.get("oauth")
        if not isinstance(oauth, dict) or not set(oauth) <= OAUTH_POLICY_KEYS:
            raise ValueError(f"unexpected OAuth policy fields: {name}")
        for scope_key in OAUTH_POLICY_KEYS & set(oauth):
            scopes = oauth[scope_key]
            if (
                not isinstance(scopes, list)
                or not scopes
                or not all(isinstance(scope, str) and scope for scope in scopes)
            ):
                raise ValueError(
                    f"invalid OAuth scope list: {name}/{scope_key}"
                )

    developer_key = auth_servers["googleDeveloperKnowledge"].get("apiKey")
    if developer_key != {
        "header": "X-Goog-Api-Key",
        "env": "GOOGLE_DEVELOPER_KNOWLEDGE_API_KEY",
    }:
        raise ValueError("unexpected Developer Knowledge API-key policy")

    names = set()
    for child in sorted((root / "skills").iterdir()):
        if not child.is_dir() or child.is_symlink():
            raise ValueError(f"invalid skill directory: {child}")
        meta = frontmatter(child / "SKILL.md")
        skill_name = meta.get("name")
        if skill_name != child.name or skill_name in names:
            raise ValueError(f"invalid/duplicate skill: {child.name}")
        names.add(skill_name)

        openai = load_yaml(child / "agents/openai.yaml")
        if openai.get("policy", {}).get("products") != ["CHAT", "CODEX"]:
            raise ValueError(f"skill must target CHAT and CODEX: {skill_name}")
        validate_svg(safe_asset_path(child, openai["interface"]["icon_small"]))

        for tool in openai.get("dependencies", {}).get("tools", []):
            alias_value = tool.get("value")
            if not isinstance(alias_value, str):
                raise ValueError(
                    f"dependency alias must be a string: {skill_name}"
                )
            alias = alias_value
            if alias not in EXPECTED_SERVERS:
                raise ValueError(f"unknown dependency: {alias}")
            if (
                tool.get("transport") != "streamable_http"
                or tool.get("url") != EXPECTED_SERVERS[alias]
            ):
                raise ValueError(
                    f"dependency mismatch: {skill_name}/{alias}"
                )

    if names != EXPECTED_SKILLS:
        raise ValueError("missing intended skills")
    return manifest, config, auth


def stage(source: Path, target: Path) -> None:
    for path in sorted(source.rglob("*")):
        rel = path.relative_to(source)
        if path.is_symlink():
            raise ValueError(f"symlink: {rel}")
        if (
            path.is_dir()
            or "tests" in rel.parts
            or any(
                part in {"__pycache__", ".git", "node_modules"}
                for part in rel.parts
            )
        ):
            continue
        if path.name.startswith(".env") or path.suffix in {".pyc", ".pem", ".key"}:
            raise ValueError(f"unsafe package member: {rel}")
        dest = target / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(path.read_bytes())

    manifest, config, _ = validate(target)
    overlay = {
        key: value
        for key, value in manifest.items()
        if key not in {"$schema", "extensions"}
    }
    overlay.update(manifest["extensions"]["com.openai"])
    overlay.update(skills="./skills/", mcpServers="./.mcp.json")
    (target / ".codex-plugin").mkdir()
    (target / ".codex-plugin/plugin.json").write_text(
        json.dumps(overlay, indent=2) + "\n",
        encoding="utf-8",
    )
    legacy = {
        "mcpServers": {
            name: {"url": item["url"]}
            for name, item in config["mcpServers"].items()
        }
    }
    (target / ".mcp.json").write_text(
        json.dumps(legacy, indent=2) + "\n",
        encoding="utf-8",
    )


def package(output: Path) -> dict:
    output = output.resolve()
    if output.is_relative_to(ROOT.resolve()):
        raise ValueError("archive must live outside plugin source")
    output.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as directory:
        staged = Path(directory) / "google-dev-kit"
        staged.mkdir()
        stage(ROOT, staged)

        with zipfile.ZipFile(
            output,
            "w",
            zipfile.ZIP_DEFLATED,
            compresslevel=9,
        ) as archive:
            for path in sorted(staged.rglob("*")):
                if not path.is_file():
                    continue
                name = (
                    "google-dev-kit/"
                    + path.relative_to(staged).as_posix()
                )
                info = zipfile.ZipInfo(name, FIXED_TIME)
                info.create_system = 3
                info.external_attr = (stat.S_IFREG | 0o644) << 16
                archive.writestr(
                    info,
                    path.read_bytes(),
                    compress_type=zipfile.ZIP_DEFLATED,
                    compresslevel=9,
                )

    return {
        "sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
        "bytes": output.stat().st_size,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    print(json.dumps(package(args.output), indent=2))
