import importlib.util
import json
import tempfile
import unittest
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "pack",
    ROOT / "scripts/package_plugin.py",
)
PACK = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PACK)


class PackageTests(unittest.TestCase):
    def test_source(self):
        manifest, config, auth = PACK.validate(ROOT)
        self.assertEqual(manifest["name"], "google-dev-kit")
        self.assertEqual(manifest["version"], "0.1.1")
        self.assertEqual(len(config["mcpServers"]), 10)
        self.assertEqual(
            config["mcpServers"]["googleApplicationDesignCenter"]["url"],
            "https://designcenter.googleapis.com/mcp",
        )
        self.assertEqual(auth["servers"]["geminiApiDocs"]["mode"], "none")
        self.assertEqual(
            auth["servers"]["googleDeveloperKnowledge"]["apiKey"]["header"],
            "X-Goog-Api-Key",
        )
        self.assertEqual(
            auth["servers"]["googleApiKeys"]["oauth"]["readOnlyScopes"],
            ["https://www.googleapis.com/auth/cloud-platform.read-only"],
        )

    def test_stage(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "google-dev-kit"
            target.mkdir()
            PACK.stage(ROOT, target)
            overlay = json.loads(
                (target / ".codex-plugin/plugin.json").read_text(),
            )
            self.assertEqual(overlay["skills"], "./skills/")
            self.assertEqual(overlay["mcpServers"], "./.mcp.json")

    def test_private_bindings_preserve_all_sources(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "private"
            target.mkdir()
            apps = {
                "googleDeveloperKnowledge": "plugin_asdk_app_" + "a" * 32,
                "geminiApiDocs": "asdk_app_" + "b" * 32,
            }
            PACK.stage(ROOT, target, apps)
            root = json.loads((target / "plugin.json").read_text())
            overlay = json.loads((target / ".codex-plugin/plugin.json").read_text())
            self.assertEqual(root["extensions"]["com.openai"]["apps"], "./.app.json")
            self.assertEqual(overlay["apps"], "./.app.json")
            bindings = json.loads((target / ".app.json").read_text())["apps"]
            self.assertEqual(bindings, {
                "googleDeveloperKnowledge": {"id": "asdk_app_" + "a" * 32},
                "geminiApiDocs": {"id": "asdk_app_" + "b" * 32},
            })
            self.assertEqual(len(json.loads((target / "mcp.json").read_text())["mcpServers"]), 10)
            self.assertEqual(len(list((target / "skills").glob("*/SKILL.md"))), 7)
            PACK.validate(target)

    def test_registered_connector_and_templated_app_id_formats(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "private"
            target.mkdir()
            apps = {
                "googleDeveloperKnowledge": "plugin_connector_abcd-01",
                "geminiApiDocs": "templated_apps_0123-test",
            }
            PACK.stage(ROOT, target, apps)
            bindings = json.loads((target / ".app.json").read_text())["apps"]
            self.assertEqual(bindings["googleDeveloperKnowledge"]["id"], "connector_abcd-01")
            self.assertEqual(bindings["geminiApiDocs"]["id"], "templated_apps_0123-test")

    def test_private_bindings_reject_unknown_duplicate_or_invalid_ids(self):
        with tempfile.TemporaryDirectory() as directory:
            cases = (
                {"notGoogle": "asdk_app_" + "a" * 32},
                {"googleDeveloperKnowledge": "not-an-id"},
                {"googleDeveloperKnowledge": "asdk_app_" + "a" * 32,
                 "geminiApiDocs": "plugin_asdk_app_" + "a" * 32},
                {},
            )
            for index, apps in enumerate(cases):
                with self.subTest(apps=apps):
                    target = Path(directory) / str(index)
                    target.mkdir()
                    with self.assertRaises(ValueError):
                        PACK.stage(ROOT, target, apps)

    def test_archive_contains_compatibility_manifests(self):
        with tempfile.TemporaryDirectory() as directory:
            archive_path = Path(directory) / "plugin.zip"
            PACK.package(archive_path)
            with zipfile.ZipFile(archive_path) as archive:
                names = set(archive.namelist())
            self.assertIn("google-dev-kit/.mcp.json", names)
            self.assertIn("google-dev-kit/mcp-auth.json", names)
            self.assertIn("google-dev-kit/AUTHENTICATION.md", names)
            self.assertIn(
                "google-dev-kit/.codex-plugin/plugin.json",
                names,
            )

    def test_reproducible(self):
        with tempfile.TemporaryDirectory() as directory:
            first = Path(directory) / "a.zip"
            second = Path(directory) / "b.zip"
            self.assertEqual(
                PACK.package(first)["sha256"],
                PACK.package(second)["sha256"],
            )
            self.assertEqual(first.read_bytes(), second.read_bytes())

    def test_auth_metadata_rejects_oauth_credentials(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "google-dev-kit"
            target.mkdir()
            PACK.stage(ROOT, target)
            path = target / "mcp-auth.json"
            auth = json.loads(path.read_text())
            auth["servers"]["googleCloudRun"]["oauth"]["clientSecret"] = "nope"
            path.write_text(json.dumps(auth))
            with self.assertRaisesRegex(
                ValueError,
                "unexpected OAuth policy fields",
            ):
                PACK.validate(target)

    def test_auth_metadata_rejects_developer_api_key_value(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "google-dev-kit"
            target.mkdir()
            PACK.stage(ROOT, target)
            path = target / "mcp-auth.json"
            auth = json.loads(path.read_text())
            auth["servers"]["googleDeveloperKnowledge"]["apiKey"]["value"] = "nope"
            path.write_text(json.dumps(auth))
            with self.assertRaisesRegex(
                ValueError,
                "unexpected Developer Knowledge API-key policy",
            ):
                PACK.validate(target)

    def test_auth_metadata_requires_primary_scopes(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "google-dev-kit"
            target.mkdir()
            PACK.stage(ROOT, target)
            path = target / "mcp-auth.json"
            auth = json.loads(path.read_text())
            del auth["servers"]["googleCloudRun"]["oauth"]["scopes"]
            path.write_text(json.dumps(auth))
            with self.assertRaisesRegex(
                ValueError,
                "missing OAuth scopes",
            ):
                PACK.validate(target)

    def test_auth_metadata_rejects_invalid_optional_scopes(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "google-dev-kit"
            target.mkdir()
            PACK.stage(ROOT, target)
            path = target / "mcp-auth.json"
            auth = json.loads(path.read_text())
            auth["servers"]["googleCloudRun"]["oauth"]["readOnlyScopes"] = None
            path.write_text(json.dumps(auth))
            with self.assertRaisesRegex(
                ValueError,
                "invalid OAuth scope list",
            ):
                PACK.validate(target)

    def test_auth_metadata_rejects_top_level_credentials(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "google-dev-kit"
            target.mkdir()
            PACK.stage(ROOT, target)
            path = target / "mcp-auth.json"
            auth = json.loads(path.read_text())
            auth["clientSecret"] = "nope"
            path.write_text(json.dumps(auth))
            with self.assertRaisesRegex(
                ValueError,
                "unexpected MCP auth top-level fields",
            ):
                PACK.validate(target)

    def test_bad_product_policy(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "google-dev-kit"
            target.mkdir()
            PACK.stage(ROOT, target)
            path = target / "skills/google-dev/agents/openai.yaml"
            path.write_text(
                path.read_text().replace(
                    "[CHAT, CODEX]",
                    "[chatgpt, codex]",
                ),
            )
            with self.assertRaisesRegex(ValueError, "CHAT and CODEX"):
                PACK.validate(target)


if __name__ == "__main__":
    unittest.main()
