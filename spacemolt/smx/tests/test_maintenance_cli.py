import io
import unittest
from contextlib import redirect_stderr, redirect_stdout
from unittest.mock import patch

from smx.cli import cmd_backend, cmd_doctor


class MaintenanceCliTests(unittest.TestCase):
    def test_doctor_returns_success_for_healthy_report(self):
        report = {
            "healthy": True,
            "checks": [{"name": "backend", "ok": True, "detail": "SpaceMolt CLI v1.5.65"}],
            "backend": {"current": "1.5.65"},
        }
        stdout = io.StringIO()
        with patch("smx.cli.doctor_report", return_value=report):
            with redirect_stdout(stdout):
                rc = cmd_doctor([])

        self.assertEqual(rc, 0)
        self.assertIn("backend", stdout.getvalue())

    def test_doctor_online_prints_update_hint(self):
        report = {
            "healthy": True,
            "checks": [{"name": "backend", "ok": True, "detail": "SpaceMolt CLI v1.5.64"}],
            "backend": {
                "current": "1.5.64",
                "latest": "1.5.65",
                "update_available": True,
            },
        }
        stdout = io.StringIO()
        with patch("smx.cli.doctor_report", return_value=report) as doctor:
            with redirect_stdout(stdout):
                rc = cmd_doctor(["--online"])

        self.assertEqual(rc, 0)
        doctor.assert_called_once_with(online=True)
        self.assertIn("update available", stdout.getvalue())

    def test_backend_check_uses_online_status(self):
        payload = {
            "resolved": "spacemolt",
            "managed": "/state/bin/spacemolt",
            "current": "1.5.64",
            "latest": "1.5.65",
            "update_available": True,
            "error": None,
        }
        stdout = io.StringIO()
        with patch("smx.cli.backend_status", return_value=payload) as status:
            with redirect_stdout(stdout):
                rc = cmd_backend(["check"])

        self.assertEqual(rc, 0)
        status.assert_called_once_with(online=True)
        self.assertIn("update    yes", stdout.getvalue())

    def test_backend_update_prints_verified_result(self):
        payload = {
            "updated": True,
            "previous": "1.5.64",
            "current": "1.5.65",
            "path": "/state/bin/spacemolt",
            "digest": "sha256:abc",
        }
        stdout = io.StringIO()
        with patch("smx.cli.install_latest_backend", return_value=payload):
            with redirect_stdout(stdout):
                rc = cmd_backend(["update"])

        self.assertEqual(rc, 0)
        self.assertIn("1.5.64 -> 1.5.65", stdout.getvalue())
        self.assertIn("sha256:abc", stdout.getvalue())

    def test_backend_update_reports_failure_cleanly(self):
        stderr = io.StringIO()
        with patch("smx.cli.install_latest_backend", side_effect=RuntimeError("bad digest")):
            with redirect_stderr(stderr):
                rc = cmd_backend(["update"])

        self.assertEqual(rc, 1)
        self.assertIn("bad digest", stderr.getvalue())


if __name__ == "__main__":
    unittest.main()
