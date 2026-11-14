"""Regression checks for OpenAI builder tools retained in Claudin."""
from __future__ import annotations

import json
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


if __name__ == "__main__":
    unittest.main()
