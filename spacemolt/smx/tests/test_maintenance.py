import hashlib
import io
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from smx.maintenance import (
    backend_status,
    ReleaseAsset,
    ReleaseInfo,
    compare_versions,
    doctor_report,
    download_release_asset,
    fetch_release,
    install_backend,
    parse_backend_version,
    platform_asset_name,
    previous_backend_path,
    rollback_backend,
)


class Response(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()


class MaintenanceTests(unittest.TestCase):
    def test_selects_platform_assets(self):
        self.assertEqual(
            platform_asset_name("Windows", "AMD64"),
            "spacemolt-client-v2-windows-x64.exe",
        )
        self.assertEqual(
            platform_asset_name("Linux", "aarch64"),
            "spacemolt-client-v2-linux-arm64",
        )
        self.assertEqual(
            platform_asset_name("Darwin", "arm64"),
            "spacemolt-client-v2-macos-arm64",
        )

    def test_compares_numeric_versions(self):
        self.assertLess(compare_versions("1.5.64", "1.5.65"), 0)
        self.assertEqual(compare_versions("v1.5.65", "1.5.65"), 0)
        self.assertGreater(compare_versions("1.6.0", "1.5.65"), 0)

    def test_parses_official_version_output(self):
        self.assertEqual(
            parse_backend_version("SpaceMolt CLI v1.5.65 (game API v2.0.0)"),
            "1.5.65",
        )

    def test_fetches_expected_release_asset(self):
        payload = {
            "tag_name": "v1.5.65",
            "assets": [
                {
                    "name": "spacemolt-client-v2-windows-x64.exe",
                    "browser_download_url": "https://github.com/SpaceMolt/client-v2/releases/download/v1.5.65/spacemolt-client-v2-windows-x64.exe",
                    "digest": "sha256:abc",
                    "size": 123,
                }
            ],
        }

        def opener(*args, **kwargs):
            return Response(json.dumps(payload).encode())

        release = fetch_release(
            asset_name="spacemolt-client-v2-windows-x64.exe",
            opener=opener,
        )
        self.assertEqual(release.version, "1.5.65")
        self.assertEqual(release.asset.digest, "sha256:abc")
        self.assertEqual(release.asset.size, 123)

    def test_download_verifies_sha256_and_size(self):
        data = b"official-client"
        digest = hashlib.sha256(data).hexdigest()
        release = ReleaseInfo(
            version="1.5.65",
            tag="v1.5.65",
            asset=ReleaseAsset(
                name="spacemolt-client-v2-windows-x64.exe",
                url="https://github.com/SpaceMolt/client-v2/releases/download/v1.5.65/spacemolt-client-v2-windows-x64.exe",
                digest=f"sha256:{digest}",
                size=len(data),
            ),
        )

        def opener(*args, **kwargs):
            return Response(data)

        with tempfile.TemporaryDirectory() as tmp:
            destination = Path(tmp) / "spacemolt.exe"
            downloaded = download_release_asset(release, destination, opener=opener)
            self.assertEqual(downloaded.read_bytes(), data)
            downloaded.unlink()

    def test_download_rejects_bad_digest_and_cleans_temp(self):
        data = b"tampered"
        release = ReleaseInfo(
            version="1.5.65",
            tag="v1.5.65",
            asset=ReleaseAsset(
                name="spacemolt-client-v2-linux-x64",
                url="https://github.com/SpaceMolt/client-v2/releases/download/v1.5.65/spacemolt-client-v2-linux-x64",
                digest="sha256:" + "0" * 64,
                size=len(data),
            ),
        )

        def opener(*args, **kwargs):
            return Response(data)

        with tempfile.TemporaryDirectory() as tmp:
            destination = Path(tmp) / "spacemolt"
            with self.assertRaises(RuntimeError):
                download_release_asset(release, destination, opener=opener)
            self.assertEqual(list(Path(tmp).iterdir()), [])


    def test_install_verifies_version_before_atomic_replace(self):
        data = b"verified-backend"
        digest = hashlib.sha256(data).hexdigest()
        release = ReleaseInfo(
            version="1.5.65",
            tag="v1.5.65",
            asset=ReleaseAsset(
                name="spacemolt-client-v2-windows-x64.exe",
                url="https://github.com/SpaceMolt/client-v2/releases/download/v1.5.65/spacemolt-client-v2-windows-x64.exe",
                digest=f"sha256:{digest}",
                size=len(data),
            ),
        )

        def opener(*args, **kwargs):
            return Response(data)

        def version_reader(path):
            return "1.5.65"

        with tempfile.TemporaryDirectory() as tmp:
            destination = Path(tmp) / "spacemolt.exe"
            result = install_backend(
                destination=destination,
                release=release,
                opener=opener,
                version_reader=version_reader,
            )
            self.assertTrue(result["updated"])
            self.assertEqual(destination.read_bytes(), data)
            self.assertEqual(result["current"], "1.5.65")

    def test_install_skips_when_managed_backend_is_current(self):
        release = ReleaseInfo(
            version="1.5.65",
            tag="v1.5.65",
            asset=ReleaseAsset(
                name="spacemolt-client-v2-linux-x64",
                url="https://github.com/SpaceMolt/client-v2/releases/download/v1.5.65/spacemolt-client-v2-linux-x64",
                digest="sha256:" + "1" * 64,
            ),
        )

        with tempfile.TemporaryDirectory() as tmp:
            destination = Path(tmp) / "spacemolt"
            destination.write_bytes(b"old-but-version-reader-says-current")

            def opener(*args, **kwargs):
                raise AssertionError("download should not run")

            result = install_backend(
                destination=destination,
                release=release,
                opener=opener,
                version_reader=lambda path: "1.5.65",
            )
            self.assertFalse(result["updated"])
            self.assertEqual(result["reason"], "already current")


    def test_status_reports_active_override_even_when_managed_backend_exists(self):
        with tempfile.TemporaryDirectory() as tmp:
            managed = Path(tmp) / "managed"
            override = Path(tmp) / "override"
            managed.write_bytes(b"managed")
            override.write_bytes(b"override")
            with patch("smx.maintenance.managed_backend_path", return_value=managed), \
                 patch("smx.maintenance.resolve_backend", return_value=str(override)), \
                 patch("smx.maintenance.backend_version", return_value="1.5.67") as reader:
                status = backend_status(online=False)
            reader.assert_called_once_with(override)
            self.assertEqual(status["resolved"], str(override))
            self.assertTrue(status["managed_exists"])

    def test_install_refuses_release_without_sha256(self):
        release = ReleaseInfo(
            version="1.5.65",
            tag="v1.5.65",
            asset=ReleaseAsset(
                name="spacemolt-client-v2-linux-x64",
                url="https://github.com/SpaceMolt/client-v2/releases/download/v1.5.65/spacemolt-client-v2-linux-x64",
                digest=None,
            ),
        )
        with tempfile.TemporaryDirectory() as tmp:
            destination = Path(tmp) / "spacemolt"
            with self.assertRaises(RuntimeError):
                install_backend(
                    destination=destination,
                    release=release,
                    opener=lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("download should not run")),
                )

    @staticmethod
    def _release(version, data):
        digest = hashlib.sha256(data).hexdigest()
        return ReleaseInfo(
            version=version,
            tag=f"v{version}",
            asset=ReleaseAsset(
                name="spacemolt-client-v2-linux-x64",
                url="https://github.com/SpaceMolt/client-v2/releases/download/x/spacemolt-client-v2-linux-x64",
                digest=f"sha256:{digest}",
                size=len(data),
            ),
        )

    def test_fetch_exact_version_uses_tag_endpoint(self):
        urls = []
        payload = {
            "tag_name": "v1.5.80",
            "assets": [{
                "name": "spacemolt-client-v2-linux-x64",
                "browser_download_url": "https://github.com/SpaceMolt/client-v2/releases/download/v1.5.80/spacemolt-client-v2-linux-x64",
            }],
        }

        def opener(request, **kwargs):
            urls.append(request.full_url)
            return Response(json.dumps(payload).encode())

        release = fetch_release("v1.5.80", asset_name="spacemolt-client-v2-linux-x64", opener=opener)
        self.assertEqual(release.version, "1.5.80")
        self.assertTrue(urls[0].endswith("/releases/tags/v1.5.80"))

    def test_fetch_rejects_non_numeric_version_before_network(self):
        def opener(*args, **kwargs):
            raise AssertionError("network must not run")

        with self.assertRaises(ValueError):
            fetch_release("1.5.80/../../x", opener=opener)

    def test_exact_version_downgrades_and_keeps_previous(self):
        with tempfile.TemporaryDirectory() as tmp:
            destination = Path(tmp) / "spacemolt"
            destination.write_bytes(b"new")
            versions = {destination.read_bytes(): "1.5.93", b"old": "1.5.80"}
            result = install_backend(
                "1.5.80",
                destination=destination,
                release=self._release("1.5.80", b"old"),
                opener=lambda *a, **k: Response(b"old"),
                version_reader=lambda path: versions[Path(path).read_bytes()],
            )
            self.assertTrue(result["updated"])
            self.assertEqual(destination.read_bytes(), b"old")
            self.assertEqual(previous_backend_path(destination).read_bytes(), b"new")

    def test_latest_never_downgrades(self):
        with tempfile.TemporaryDirectory() as tmp:
            destination = Path(tmp) / "spacemolt"
            destination.write_bytes(b"new")

            def opener(*args, **kwargs):
                raise AssertionError("download should not run")

            result = install_backend(
                destination=destination,
                release=self._release("1.5.80", b"old"),
                opener=opener,
                version_reader=lambda path: "1.5.93",
            )
            self.assertFalse(result["updated"])

    def test_unreadable_backend_does_not_replace_kept_previous(self):
        def reader(path):
            if Path(path).read_bytes() == b"broken":
                raise RuntimeError("broken")
            return "1.5.93"

        with tempfile.TemporaryDirectory() as tmp:
            destination = Path(tmp) / "spacemolt"
            destination.write_bytes(b"broken")
            previous_backend_path(destination).write_bytes(b"good")
            install_backend(
                destination=destination,
                release=self._release("1.5.93", b"fresh"),
                opener=lambda *a, **k: Response(b"fresh"),
                version_reader=reader,
            )
            self.assertEqual(destination.read_bytes(), b"fresh")
            self.assertEqual(previous_backend_path(destination).read_bytes(), b"good")

    def test_rollback_swaps_and_is_reversible(self):
        versions = {b"new": "1.5.93", b"old": "1.5.80"}

        def reader(path):
            return versions[Path(path).read_bytes()]

        with tempfile.TemporaryDirectory() as tmp:
            destination = Path(tmp) / "spacemolt"
            destination.write_bytes(b"new")
            previous_backend_path(destination).write_bytes(b"old")

            result = rollback_backend(destination=destination, version_reader=reader)
            self.assertEqual((result["previous"], result["current"]), ("1.5.93", "1.5.80"))
            self.assertEqual(destination.read_bytes(), b"old")

            rollback_backend(destination=destination, version_reader=reader)
            self.assertEqual(destination.read_bytes(), b"new")
            self.assertEqual(sorted(p.name for p in Path(tmp).iterdir()), ["spacemolt", "spacemolt.prev"])

    def test_failed_replace_keeps_old_rollback_copy(self):
        with tempfile.TemporaryDirectory() as tmp:
            destination = Path(tmp) / "spacemolt"
            destination.write_bytes(b"current")
            previous_backend_path(destination).write_bytes(b"older")
            with patch("smx.maintenance.os.replace", side_effect=OSError("busy")), \
                 self.assertRaises(OSError):
                install_backend(
                    destination=destination,
                    release=self._release("1.5.93", b"fresh"),
                    opener=lambda *a, **k: Response(b"fresh"),
                    version_reader=lambda path: "1.5.93" if Path(path).read_bytes() == b"fresh" else "1.5.80",
                )
            self.assertEqual(previous_backend_path(destination).read_bytes(), b"older")
            self.assertEqual(sorted(p.name for p in Path(tmp).iterdir()), ["spacemolt", "spacemolt.prev"])

    def test_interrupted_rollback_keeps_only_copy_of_current(self):
        real_replace = os.replace
        calls = []

        def replace(source, target):
            calls.append(source)
            if len(calls) == 2:
                raise OSError("busy")
            real_replace(source, target)

        versions = {b"new": "1.5.93", b"old": "1.5.80"}
        with tempfile.TemporaryDirectory() as tmp:
            destination = Path(tmp) / "spacemolt"
            destination.write_bytes(b"new")
            previous_backend_path(destination).write_bytes(b"old")
            with patch("smx.maintenance.os.replace", side_effect=replace), self.assertRaises(OSError):
                rollback_backend(
                    destination=destination,
                    version_reader=lambda path: versions[Path(path).read_bytes()],
                )
            self.assertEqual(destination.read_bytes(), b"old")
            self.assertEqual(Path(calls[1]).read_bytes(), b"new")

    def test_doctor_offers_rollback_only_when_copy_exists(self):
        def advice(kept):
            with tempfile.TemporaryDirectory() as tmp:
                managed = Path(tmp) / "spacemolt"
                if kept:
                    previous_backend_path(managed).write_bytes(b"old")
                status = {"managed": str(managed), "current": "999.0.0", "newer_than_tested": True}
                with patch("smx.maintenance.backend_status", return_value=status), \
                     patch("smx.maintenance.list_profiles", return_value=[]):
                    checks = doctor_report()["checks"]
            return {check["name"]: check["detail"] for check in checks}["backend version"]

        self.assertIn("backend rollback", advice(True))
        self.assertNotIn("backend rollback", advice(False))

    def test_rollback_without_previous_fails_clearly(self):
        with tempfile.TemporaryDirectory() as tmp, self.assertRaisesRegex(RuntimeError, "no previous backend"):
            rollback_backend(destination=Path(tmp) / "spacemolt")

    def test_previous_path_stays_executable_on_windows(self):
        self.assertEqual(previous_backend_path(Path("spacemolt.exe")).name, "spacemolt.prev.exe")

    def test_status_flags_backend_newer_than_tested(self):
        with tempfile.TemporaryDirectory() as tmp:
            backend = Path(tmp) / "spacemolt"
            backend.write_bytes(b"x")
            with patch("smx.maintenance.resolve_backend", return_value=str(backend)), \
                 patch("smx.maintenance.backend_version", return_value="999.0.0"):
                status = backend_status(online=False)
            self.assertTrue(status["newer_than_tested"])


if __name__ == "__main__":
    unittest.main()
