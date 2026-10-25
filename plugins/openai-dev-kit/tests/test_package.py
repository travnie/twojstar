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
                skill = target / "skills/chatgpt-plugin-builder"
                self.assertTrue((skill / "SKILL.md").is_file())
                self.assertEqual(len([p for p in (skill / "references").rglob("*") if p.is_file()]), 10)
                self.assertEqual(len([p for p in (skill / "scripts").iterdir() if p.is_file()]), 3)
                root = json.loads((target / "plugin.json").read_text())
                self.assertEqual(root["version"], "1.1.0")
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
            metadata = target / "skills/chatgpt-plugin-builder/agents/openai.yaml"
            metadata.write_text(metadata.read_text().replace("[CHAT, CODEX]", "[chatgpt, codex, api, atlas]"))
            with self.assertRaisesRegex(ValueError, "must target CHAT and CODEX"):
                PACK["validate"](target)

    def test_product_policy_uses_effective_yaml_mapping(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory)
            PACK["stage"](ROOT, target)
            metadata = target / "skills/chatgpt-plugin-builder/agents/openai.yaml"
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

    def test_separate_docs_and_builder_skills_share_one_mcp(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory)
            PACK["stage"](ROOT, target)
            skills = sorted(path.parent.name for path in (target / "skills").glob("*/SKILL.md"))
            self.assertEqual(skills, ["chatgpt-plugin-builder", "openai-docs"])
            builder = target / "skills/chatgpt-plugin-builder"
            docs = target / "skills/openai-docs"
            self.assertIn("references/plugin-building.md", (builder / "SKILL.md").read_text())
            self.assertIn("references/openai-workflows.md", (docs / "SKILL.md").read_text())
            self.assertIn("## Migration from ChatGPT Apps SDK", (builder / "references/plugin-building.md").read_text())
            workflow = (docs / "references/openai-workflows.md").read_text()
            self.assertIn("## Route by task", workflow)
            self.assertIn("references/openai-dev/model-guidance.md", workflow)
            self.assertTrue((builder / "scripts/scaffold_node_ext_apps.mjs").is_file())
            self.assertEqual(len([p for p in (builder / "references").rglob("*") if p.is_file()]), 10)
            self.assertEqual(len([p for p in (docs / "references").rglob("*") if p.is_file()]), 6)
            self.assertEqual(len([p for p in (builder / "scripts").iterdir() if p.is_file()]), 3)
            self.assertFalse((target / "skills/openai-dev").exists())
            self.assertEqual(len(json.loads((target / "mcp.json").read_text())["mcpServers"]), 1)

    def test_standalone_docs_and_optional_integrations(self):
        skill = ROOT / "skills/chatgpt-plugin-builder"
        root = (skill / "SKILL.md").read_text()
        building = (skill / "references/plugin-building.md").read_text()
        legacy = (skill / "references/legacy-apps-sdk-migration.md").read_text()
        self.assertIn("General API, Codex", root)
        self.assertIn("kit's own scaffolding", building)
        self.assertNotIn("prefer the current built-in", building)
        self.assertIn("Root `plugin.json`", legacy)
        self.assertNotIn("required package entry point", legacy)

    def test_dotted_name_scaffold_and_frontmatter_validation(self):
        with tempfile.TemporaryDirectory() as directory:
            result = subprocess.run([
                sys.executable, str(BUILDER / "scaffold_plugin.py"), directory,
                "--name", "build.tools", "--description", "Integrations: API and MCP",
                "--skill", "build-tools", "--bundled-mcp-name", "docs",
                "--mcp-url", "https://developers.openai.com/mcp",
            ], capture_output=True, text=True, check=False)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            root = Path(directory) / "build.tools"
            manifest = json.loads((root / "plugin.json").read_text())
            self.assertEqual(manifest["name"], "build.tools")
            skill = root / "skills/build-tools/SKILL.md"
            original = skill.read_text()
            self.assertIn('name: "build-tools"', original)
            description = 'description: "TODO: describe when build-tools should activate."'
            self.assertIn(description, original)

            def validate() -> subprocess.CompletedProcess:
                return subprocess.run([
                    sys.executable, str(BUILDER / "validate_plugin.py"), str(root)
                ], capture_output=True, text=True, check=False)

            self.assertEqual(validate().returncode, 0)
            broken = (
                original.replace(description, "description: TODO: invalid YAML"),
                original.replace('name: "build-tools"', 'name: "wrong-skill"'),
                original.replace(description, 'description: ""'),
                original.replace('name: "build-tools"\n',
                                 'name: "build-tools"\nname: "build-tools"\n'),
            )
            for bad in broken:
                with self.subTest(bad=bad):
                    skill.write_text(bad)
                    check = validate()
                    self.assertNotEqual(check.returncode, 0, check.stdout)
            skill.write_text(original)
            self.assertEqual(validate().returncode, 0)

            # Legacy array of skill directories must receive the same checks.
            (root / "plugin.json").unlink()
            overlay_path = root / ".codex-plugin/plugin.json"
            overlay = json.loads(overlay_path.read_text())
            overlay["skills"] = ["./skills/build-tools"]
            overlay_path.write_text(json.dumps(overlay) + "\n")
            skill.write_text(original.replace(description, "description: TODO: invalid YAML"))
            self.assertNotEqual(validate().returncode, 0)
            skill.write_text(original)
            self.assertEqual(validate().returncode, 0)

    def test_yaml_keyword_skill_names_and_distinct_activation(self):
        with tempfile.TemporaryDirectory() as directory:
            result = subprocess.run([
                sys.executable, str(BUILDER / "scaffold_plugin.py"), directory,
                "--name", "keywords-plugin", "--description", "Useful plugin",
                "--skill", "on", "--skill", "true",
            ], capture_output=True, text=True, check=False)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            root = Path(directory) / "keywords-plugin"
            descriptions = []
            for name in ("on", "true"):
                text = (root / "skills" / name / "SKILL.md").read_text()
                self.assertIn(f'name: "{name}"', text)
                self.assertIn(f"TODO: describe when {name} should activate.", text)
                descriptions.append(text)
            self.assertNotEqual(descriptions[0], descriptions[1])
            check = subprocess.run([
                sys.executable, str(BUILDER / "validate_plugin.py"), str(root)
            ], capture_output=True, text=True, check=False)
            self.assertEqual(check.returncode, 0, check.stdout + check.stderr)

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
