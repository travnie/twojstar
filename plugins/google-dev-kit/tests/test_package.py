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

    def test_auth_metadata_rejects_credentials(self):
        mutations = [
            ("oauth-client-secret", ("oauth", "clientSecret"), "nope"),
            ("protected-api-key", ("apiKey",), {"value": "nope"}),
        ]
        for label, keys, value in mutations:
            with self.subTest(label=label), tempfile.TemporaryDirectory() as directory:
                target = Path(directory) / "google-dev-kit"
                target.mkdir()
                PACK.stage(ROOT, target)
                path = target / "mcp-auth.json"
                auth = json.loads(path.read_text())
                profile = auth["servers"]["googleCloudRun"]
                if len(keys) == 2:
                    profile[keys[0]][keys[1]] = value
                else:
                    profile[keys[0]] = value
                path.write_text(json.dumps(auth))
                with self.assertRaisesRegex(
                    ValueError,
                    "unexpected (MCP auth profile|OAuth policy) fields",
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
