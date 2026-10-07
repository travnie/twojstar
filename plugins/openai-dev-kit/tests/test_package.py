"""Package safety and scaffolding regression checks."""
from __future__ import annotations

import json
import runpy
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACK = runpy.run_path(str(ROOT / "scripts/package_plugin.py"))
BUILDER = ROOT / "skills/chatgpt-plugin-builder/scripts"


class PackageTests(unittest.TestCase):
    def test_portable_and_private_bindings(self):
        with tempfile.TemporaryDirectory() as directory:
            for app_id in (None, "plugin_asdk_app_" + "a" * 32, "asdk_app_" + "a" * 32):
                target = Path(directory) / str(app_id)
                target.mkdir()
                apps = {"openaiDeveloperDocs": app_id} if app_id else None
                PACK["stage"](ROOT, target, apps)
                root = json.loads((target / "plugin.json").read_text())
                overlay = json.loads((target / ".codex-plugin/plugin.json").read_text())
                if app_id:
                    self.assertEqual(root["extensions"]["com.openai"]["apps"], "./.app.json")
                    self.assertEqual(overlay["apps"], "./.app.json")
                    actual = json.loads((target / ".app.json").read_text())
                    self.assertEqual(actual["apps"]["openaiDeveloperDocs"]["id"], "asdk_app_" + "a" * 32)
                else:
                    self.assertNotIn("apps", root["extensions"]["com.openai"])
                    self.assertNotIn("apps", overlay)
                    self.assertFalse((target / ".app.json").exists())
                validation = subprocess.run([sys.executable, str(BUILDER / "validate_plugin.py"), str(target)], capture_output=True, text=True, check=False)
                self.assertEqual(validation.returncode, 0, validation.stdout + validation.stderr)

    def test_invalid_bindings_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            for number, apps in enumerate(({"other": "asdk_app_" + "a" * 32}, {"openaiDeveloperDocs": "invented"})):
                target = Path(directory) / str(number)
                target.mkdir()
                with self.assertRaises(ValueError):
                    PACK["stage"](ROOT, target, apps)

    def test_lowercase_product_policy_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory)
            PACK["stage"](ROOT, target)
            metadata = target / "skills/openai-dev/agents/openai.yaml"
            metadata.write_text(metadata.read_text().replace("[CHAT, CODEX]", "[chatgpt, codex, api, atlas]"))
            with self.assertRaisesRegex(ValueError, "must target CHAT and CODEX"):
                PACK["validate"](target)

    def test_product_policy_uses_effective_yaml_mapping(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory)
            PACK["stage"](ROOT, target)
            metadata = target / "skills/openai-dev/agents/openai.yaml"
            original = metadata.read_text()
            invalid = original.replace("[CHAT, CODEX]", "[chatgpt, codex, api, atlas]")
            cases = (
                invalid + "notes: |\n  products: [CHAT, CODEX]\n",
                original.replace("  products: [CHAT, CODEX]", "  products: [CHAT, CODEX]\n  products: [chatgpt]"),
                original + "policy:\n  products: [chatgpt]\n",
                "defaults: &defaults\n  products: [CHAT, CODEX]\npolicy:\n  <<: *defaults\n",
                "policy: [\n",
                "policy: !!python/object:builtins.object {}\n",
            )
            for content in cases:
                with self.subTest(content=content):
                    metadata.write_text(content)
                    with self.assertRaises(ValueError):
                        PACK["validate"](target)
            metadata.write_text(original.replace("  products: [CHAT, CODEX]", "  products:\n    - CHAT\n    - CODEX"))
            PACK["validate"](target)

    def test_reproducible_archive(self):
        with tempfile.TemporaryDirectory() as directory:
            first = PACK["package"](Path(directory) / "first.zip")
            second = PACK["package"](Path(directory) / "second.zip")
            self.assertEqual(first["sha256"], second["sha256"])
            with self.assertRaises(ValueError):
                PACK["package"](ROOT / "inside.zip")

    def test_active_svg_and_escaping_assets_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            svg = root / "icon.svg"
            svg.write_text('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><script/></svg>')
            with self.assertRaises(ValueError):
                PACK["validate_svg"](svg)
            with self.assertRaises(ValueError):
                PACK["asset"](root, "./../icon.svg")

    def test_scaffold_portable_http_and_registered_id(self):
        with tempfile.TemporaryDirectory() as directory:
            result = subprocess.run([
                sys.executable, str(BUILDER / "scaffold_plugin.py"), directory,
                "--name", "docs-probe", "--description", "Search documentation",
                "--skill", "docs-probe", "--bundled-mcp-name", "docs",
                "--mcp-url", "https://developers.openai.com/mcp",
                "--registered-app-id", "plugin_asdk_app_" + "b" * 32,
            ], capture_output=True, text=True, check=False)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            target = Path(directory) / "docs-probe"
            root = json.loads((target / "plugin.json").read_text())
            self.assertNotIn("skills", root)
            self.assertNotIn("interface", root)
            server = json.loads((target / "mcp.json").read_text())["mcpServers"]["docs"]
            self.assertEqual(server["type"], "streamable-http")
            actual = json.loads((target / ".app.json").read_text())
            self.assertEqual(actual["apps"]["docs"]["id"], "asdk_app_" + "b" * 32)
            result = subprocess.run([sys.executable, str(BUILDER / "validate_plugin.py"), str(target)], capture_output=True, text=True, check=False)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
