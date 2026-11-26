"""Ensure all shared ChatGPT plugin packages can bind to registered MCP apps without duplication."""
from __future__ import annotations

import json
import runpy
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PACK = runpy.run_path(str(ROOT / "plugins/_shared/package_plugin.py"))
SOURCES = ("cloudflare", "desktop-commander", "github")
MULTI_SERVER = ("google",)
SKILLS_ONLY = ("claudesign",)


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

    def test_multi_server_plugins_bind_per_alias(self):
        for name in MULTI_SERVER:
            source = ROOT / "plugins" / name
            aliases = list(json.loads((source / "mcp.json").read_text())["mcpServers"])
            bindings = {alias: f"plugin_asdk_app_{index:032x}" for index, alias in enumerate(aliases)}
            with tempfile.TemporaryDirectory() as tmp:
                public, private = Path(tmp) / "public", Path(tmp) / "private"
                public.mkdir()
                private.mkdir()
                PACK["stage"](source, public)
                self.assertFalse((public / ".app.json").exists())
                PACK["stage"](source, private, app_bindings=bindings)
                apps = json.loads((private / ".app.json").read_text())["apps"]
                self.assertEqual(apps, {a: {"id": i.removeprefix("plugin_")} for a, i in bindings.items()})
                overlay = json.loads((private / ".codex-plugin/plugin.json").read_text())
                self.assertEqual(overlay["apps"], "./.app.json")
            one = "asdk_app_" + "a" * 32
            for kwargs in (
                {"app_id": one},
                {"app_bindings": {"nope": one}},
                {"app_bindings": {aliases[0]: "bogus"}},
                {"app_bindings": {aliases[0]: one, aliases[1]: "plugin_" + one}},
            ):
                with self.subTest(name=name, kwargs=kwargs), tempfile.TemporaryDirectory() as tmp:
                    with self.assertRaises(ValueError):
                        PACK["stage"](source, Path(tmp), **kwargs)

    def test_other_documented_id_prefixes(self):
        for ident in ("connector_abc123", "templated_apps_A-b_1"):
            with self.subTest(ident=ident), tempfile.TemporaryDirectory() as tmp:
                PACK["stage"](ROOT / "plugins/google", Path(tmp), app_bindings={"google-compute": ident})
                apps = json.loads((Path(tmp) / ".app.json").read_text())["apps"]
                self.assertEqual(apps, {"google-compute": {"id": ident}})

    def test_invalid_ids_fail_closed(self):
        source = ROOT / "plugins/cloudflare"
        for ident in ("", "bogus", "plugin_asdk_app_unsafe", "plugin_asdk_app_" + "A" * 32, "connector_", "templated_apps_a b"):
            with self.subTest(ident=ident), tempfile.TemporaryDirectory() as tmp:
                dest = Path(tmp) / "staged"
                dest.mkdir()
                with self.assertRaises(ValueError):
                    PACK["stage"](source, dest, ident)

    def test_extra_mcp_only_in_private_build(self):
        with tempfile.TemporaryDirectory() as tmp:
            dest = Path(tmp) / "github"
            dest.mkdir()
            PACK["stage"](ROOT / "plugins/github", dest, None, {"claudiusz": "https://example.com/mcp"})
            for rel in (".mcp.json", ".claude-plugin/plugin.json", "mcp.json"):
                servers = json.loads((dest / rel).read_text())["mcpServers"]
                self.assertEqual(set(servers), {"github", "claudiusz"}, rel)
                transport = "streamable-http" if rel == "mcp.json" else "http"
                self.assertEqual(servers["claudiusz"], {"type": transport, "url": "https://example.com/mcp"}, rel)
            public = Path(tmp) / "public"
            public.mkdir()
            PACK["stage"](ROOT / "plugins/github", public)
            for rel in (".mcp.json", ".claude-plugin/plugin.json", "mcp.json"):
                self.assertEqual(set(json.loads((public / rel).read_text())["mcpServers"]), {"github"}, rel)
            for bad in ({"github": "https://example.com/mcp"}, {"x": "http://example.com"}, {"9x": "https://example.com"}, {"x": "https://"}):
                with self.subTest(bad=bad), self.assertRaises(ValueError):
                    again = Path(tmp) / "again"
                    again.mkdir(exist_ok=True)
                    PACK["stage"](ROOT / "plugins/github", again, None, bad)

    def test_skills_only_plugin_has_no_mcp_overlay(self):
        for name in SKILLS_ONLY:
            with self.subTest(name=name), tempfile.TemporaryDirectory() as tmp:
                dest = Path(tmp) / "staged"
                dest.mkdir()
                PACK["stage"](ROOT / "plugins" / name, dest, None)
                overlay = json.loads((dest / ".codex-plugin/plugin.json").read_text())
                self.assertNotIn("mcpServers", overlay)
                self.assertFalse((dest / ".mcp.json").exists())
                with self.assertRaises(ValueError):
                    PACK["stage"](ROOT / "plugins" / name, Path(tmp) / "again", "asdk_app_" + "a" * 32)


if __name__ == "__main__":
    unittest.main()
