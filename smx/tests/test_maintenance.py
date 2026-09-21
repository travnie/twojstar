import hashlib
import io
import json
import tempfile
import unittest
from pathlib import Path

from smx.maintenance import (
    ReleaseAsset,
    ReleaseInfo,
    compare_versions,
    download_release_asset,
    install_latest_backend,
    fetch_latest_release,
    parse_backend_version,
    platform_asset_name,
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

        release = fetch_latest_release(
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
            result = install_latest_backend(
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

            result = install_latest_backend(
                destination=destination,
                release=release,
                opener=opener,
                version_reader=lambda path: "1.5.65",
            )
            self.assertFalse(result["updated"])
            self.assertEqual(result["reason"], "already current")


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
                install_latest_backend(
                    destination=destination,
                    release=release,
                    opener=lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("download should not run")),
                )


if __name__ == "__main__":
    unittest.main()
