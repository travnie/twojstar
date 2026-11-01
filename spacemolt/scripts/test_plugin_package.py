"""Regression checks for safe, complete SpaceMolt plugin archives."""
from __future__ import annotations

import json
import runpy
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / "plugins/spacemolt"
PACK = runpy.run_path(str(Path(__file__).resolve().with_name("package_plugin.py")))


class SpaceMoltPackageTests(unittest.TestCase):
    def test_only_intended_sources_are_allowed(self):
        for file in ("plugin.json", "mcp.json", "assets/icon.svg", "skills/spacemolt/SKILL.md",
                     "skills/spacemolt/references/gameplay.md",
                     "skills/spacemolt/references/guides/explorer.md"):
            self.assertTrue(PACK["allowed_plugin_member"](Path(file)), file)
        for file in (".mcp.json", ".env", "credentials.json", "secrets/password.txt", "assets/auth.json",
                     "skills/spacemolt/credentials.json", "skills/spacemolt/agents/session.json",
                     "skills/spacemolt/references/guides/private.env",
                     "skills/spacemolt/references/guides/credentials.md",
                     "skills/spacemolt/references/private-session.md",
                     "scripts/secret.py", "other.md"):
            self.assertFalse(PACK["allowed_plugin_member"](Path(file)), file)

    def test_private_and_portable_preserve_references(self):
        with tempfile.TemporaryDirectory() as tmp:
            for i, apps in enumerate((
                None,
                {"game": "plugin_asdk_app_" + "a" * 32, "docs": "plugin_asdk_app_" + "b" * 32},
                {"game": "asdk_app_" + "a" * 32, "docs": "asdk_app_" + "b" * 32},
            )):
                dest = Path(tmp) / str(i)
                dest.mkdir()
                PACK["stage"](ROOT, dest, apps)
                self.assertEqual(
                    {p.name for p in (dest / "skills/spacemolt/references/guides").glob("*.md")},
                    set(PACK["GUIDE_NAMES"]),
                )
                overlay = json.loads((dest / ".codex-plugin/plugin.json").read_text())
                legacy = json.loads((dest / ".mcp.json").read_text())
                self.assertEqual(legacy["mcpServers"]["game"]["url"], "https://game.spacemolt.com/mcp/v2?preset=full")
                self.assertEqual(legacy["mcpServers"]["docs"]["url"], "https://game.spacemolt.com/mcp/docs")
                if apps:
                    actual = json.loads((dest / ".app.json").read_text())["apps"]
                    self.assertEqual(actual, {
                        "game": {"id": "asdk_app_" + "a" * 32},
                        "docs": {"id": "asdk_app_" + "b" * 32},
                    })
                    self.assertEqual(overlay["apps"], "./.app.json")
                else:
                    self.assertNotIn("apps", overlay)
                    self.assertFalse((dest / ".app.json").exists())

    def test_invalid_and_alias_collisions_rejected(self):
        bad = (
            {"game": "invented", "docs": "asdk_app_" + "b" * 32},
            {"game": "asdk_app_" + "a" * 32, "docs": "plugin_asdk_app_" + "a" * 32},
            {"game": "asdk_app_" + "a" * 32},
        )
        for i, apps in enumerate(bad):
            with self.subTest(i=i), tempfile.TemporaryDirectory() as tmp:
                dest = Path(tmp) / "stage"
                dest.mkdir()
                with self.assertRaises(ValueError):
                    PACK["stage"](ROOT, dest, apps)


if __name__ == "__main__":
    unittest.main()
