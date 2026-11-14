"""Regression checks for OpenAI builder tools retained in Claudin."""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "skills/plugin-dev/scripts"


def invoke(name: str, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run([sys.executable, str(TOOLS / name), *map(str, args)],
                          capture_output=True, text=True, check=False)


class OpenAIBuildToolsTests(unittest.TestCase):
    def test_dotted_scaffold_and_validator(self):
        with tempfile.TemporaryDirectory() as temp:
            result = invoke("scaffold_plugin.py", temp, "--name", "build.tools",
                            "--description", "Sample app", "--skill", "build-tools",
                            "--bundled-mcp-name", "docs", "--mcp-url",
                            "https://developers.openai.com/mcp")
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            dest = Path(temp) / "build.tools"
            self.assertEqual(json.loads((dest / "plugin.json").read_text())["name"], "build.tools")
            check = invoke("validate_plugin.py", dest)
            self.assertEqual(check.returncode, 0, check.stdout + check.stderr)
            skill = dest / "skills/build-tools/SKILL.md"
            original = skill.read_text()
            skill.write_text(original.replace('name: "build-tools"', 'name: "wrong-skill"'))
            self.assertNotEqual(invoke("validate_plugin.py", dest).returncode, 0)

    def test_registered_app_binding(self):
        with tempfile.TemporaryDirectory() as temp:
            result = invoke("scaffold_plugin.py", temp, "--name", "docs-probe",
                            "--description", "Docs", "--skill", "docs-probe",
                            "--bundled-mcp-name", "docs", "--mcp-url",
                            "https://developers.openai.com/mcp",
                            "--registered-app-id", "plugin_asdk_app_" + "b" * 32)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            dest = Path(temp) / "docs-probe"
            app = json.loads((dest / ".app.json").read_text())
            self.assertEqual(app["apps"]["docs"]["id"], "asdk_app_" + "b" * 32)
            self.assertEqual(invoke("validate_plugin.py", dest).returncode, 0)

    def test_yaml_keyword_skill_names(self):
        with tempfile.TemporaryDirectory() as temp:
            result = invoke("scaffold_plugin.py", temp, "--name", "keywords-plugin",
                            "--description", "Useful", "--skill", "on", "--skill", "true")
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            dest = Path(temp) / "keywords-plugin"
            for name in ("on", "true"):
                text = (dest / "skills" / name / "SKILL.md").read_text()
                self.assertIn(f'name: "{name}"', text)
            self.assertEqual(invoke("validate_plugin.py", dest).returncode, 0)

    def test_invalid_scaffold_leaves_no_files(self):
        with tempfile.TemporaryDirectory() as temp:
            for extra in (["--mcp-url", "https://example.com"],
                          ["--command", "node"],
                          ["--registered-app-id", "asdk_app_" + "a" * 32],
                          ["--bundled-mcp-name", "docs", "--mcp-url", "https://"],
                          ["--bundled-mcp-name", "docs", "--mcp-url", "https://example.com",
                           "--registered-app-id", "invalid"]):
                with self.subTest(extra=extra):
                    result = invoke("scaffold_plugin.py", temp, "--name", "bad-plugin",
                                    "--description", "Example", "--skill", "demo", *extra)
                    self.assertNotEqual(result.returncode, 0)
                    self.assertFalse((Path(temp) / "bad-plugin").exists())

    def test_remote_and_local_compatibility_transport(self):
        with tempfile.TemporaryDirectory() as temp:
            for name, args, expected in (
                ("remote", ["--mcp-url", "https://example.com/mcp"],
                 {"type": "http", "url": "https://example.com/mcp"}),
                ("local", ["--command", "node", "--command-arg", "server.js", "--command-arg=--stdio"],
                 {"command": "node", "args": ["server.js", "--stdio"]}),
            ):
                result = invoke("scaffold_plugin.py", temp, "--name", name,
                                "--description", "Example", "--bundled-mcp-name", "demo", *args)
                self.assertEqual(result.returncode, 0, result.stderr)
                dest = Path(temp) / name
                self.assertEqual(json.loads((dest / ".mcp.json").read_text())["mcpServers"]["demo"], expected)
                self.assertEqual(invoke("validate_plugin.py", dest).returncode, 0)

    def test_invalid_manifest_reports_json(self):
        with tempfile.TemporaryDirectory() as temp:
            dest = Path(temp)
            manifest = dest / "plugin.json"
            for value in ("{}", "[]", "null", "[1]"):
                manifest.write_text(value)
                result = invoke("validate_plugin.py", dest)
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse(json.loads(result.stdout)["ok"])
            manifest.write_text(json.dumps({
                "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
                "name": "demo", "version": "0.1.0", "description": "Demo",
            }))
            overlay = dest / ".codex-plugin/plugin.json"
            overlay.parent.mkdir()
            overlay.write_text("{")
            result = invoke("validate_plugin.py", dest)
            self.assertFalse(json.loads(result.stdout)["ok"])
            self.assertNotEqual(result.returncode, 0)

    @unittest.skipUnless(shutil.which("node"), "Node.js not available")
    def test_node_invalid_arguments_and_help(self):
        with tempfile.TemporaryDirectory() as temp:
            dest = Path(temp) / "app"
            command = ["node", str(TOOLS / "scaffold_node_ext_apps.mjs")]
            help_result = subprocess.run([*command, "--help"], capture_output=True, text=True, check=False)
            self.assertIn("\nUsage:\n", help_result.stdout)
            for extra in (["--port", "65536"], ["--tool-name", "--force"],
                          ["--app-name"], ["--port", "0"]):
                result = subprocess.run([*command, str(dest), *extra], capture_output=True, text=True, check=False)
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse(dest.exists())

    @unittest.skipUnless(shutil.which("node"), "Node.js not available")
    def test_node_scaffold_and_overwrite_guard(self):
        with tempfile.TemporaryDirectory() as temp:
            dest = Path(temp) / "app"
            args = ["node", str(TOOLS / "scaffold_node_ext_apps.mjs"), str(dest),
                    "--app-name", "Demo App", "--tool-name", "Show Demo"]
            result = subprocess.run(args, capture_output=True, text=True, check=False)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertEqual(json.loads((dest / "package.json").read_text())["name"], "demo-app")
            for path in ("src/server.ts", "public/widget.html", "tsconfig.json"):
                self.assertTrue((dest / path).is_file(), path)
            self.assertIn("show_demo", (dest / "src/server.ts").read_text())
            deps = json.loads((dest / "package.json").read_text())["dependencies"]
            self.assertNotIn("@modelcontextprotocol/sdk", deps)
            self.assertEqual(deps["@modelcontextprotocol/server"], "^2.0.0")
            self.assertIn("NodeStreamableHTTPServerTransport", (dest / "src/server.ts").read_text())
            original = (dest / "package.json").read_text()
            result = subprocess.run(args, capture_output=True, text=True, check=False)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual((dest / "package.json").read_text(), original)


if __name__ == "__main__":
    unittest.main()
