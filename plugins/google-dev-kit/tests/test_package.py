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
