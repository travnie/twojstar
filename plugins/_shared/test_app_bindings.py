"""Ensure all shared ChatGPT plugin packages can bind to registered MCP apps without duplication."""
from __future__ import annotations

import json
import runpy
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PACK = runpy.run_path(str(ROOT / "plugins/_shared/package_plugin.py"))
SOURCES = ("claude-dev-kit", "cloudflare", "desktop-commander", "github-ops")


class AppBindingTests(unittest.TestCase):
    def test_private_and_portable_for_every_shared_plugin(self):
        for name in SOURCES:
            source = ROOT / "plugins" / name
            for ident in (None, "plugin_asdk_app_" + "a" * 32, "asdk_app_" + "a" * 32):
                with self.subTest(name=name, ident=ident), tempfile.TemporaryDirectory() as tmp:
                    dest = Path(tmp) / "staged"
                    dest.mkdir()
                    PACK["stage"](source, dest, ident)
                    manifest = json.loads((dest / "plugin.json").read_text())
                    overlay = json.loads((dest / ".codex-plugin/plugin.json").read_text())
                    server_alias = next(iter(json.loads((dest / "mcp.json").read_text())["mcpServers"]))
                    self.assertTrue((dest / "skills").is_dir())
                    if ident:
                        self.assertEqual(manifest["extensions"]["com.openai"]["apps"], "./.app.json")
                        self.assertEqual(overlay["apps"], "./.app.json")
                        binding = json.loads((dest / ".app.json").read_text())
                        self.assertEqual(binding["apps"], {server_alias: {"id": "asdk_app_" + "a" * 32}})
                    else:
                        self.assertFalse((dest / ".app.json").exists())
                        self.assertNotIn("apps", overlay)
                        self.assertNotIn("apps", manifest["extensions"]["com.openai"])
                    self.assertEqual(overlay["mcpServers"], "./.mcp.json")

    def test_invalid_ids_fail_closed(self):
        source = ROOT / "plugins/claude-dev-kit"
        for ident in ("", "bogus", "plugin_asdk_app_unsafe", "plugin_asdk_app_" + "A" * 32):
            with self.subTest(ident=ident), tempfile.TemporaryDirectory() as tmp:
                dest = Path(tmp) / "staged"
                dest.mkdir()
                with self.assertRaises(ValueError):
                    PACK["stage"](source, dest, ident)


if __name__ == "__main__":
    unittest.main()
