import io
import os
import subprocess
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from unittest.mock import patch

from smx.cli import Backend, cmd_backend, cmd_doctor


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
        with patch("smx.cli.install_backend", return_value=payload):
            with redirect_stdout(stdout):
                rc = cmd_backend(["update"])

        self.assertEqual(rc, 0)
        self.assertIn("1.5.64 -> 1.5.65", stdout.getvalue())
        self.assertIn("sha256:abc", stdout.getvalue())

    def test_backend_update_reports_failure_cleanly(self):
        stderr = io.StringIO()
        with patch("smx.cli.install_backend", side_effect=RuntimeError("bad digest")):
            with redirect_stderr(stderr):
                rc = cmd_backend(["update"])

        self.assertEqual(rc, 1)
        self.assertIn("bad digest", stderr.getvalue())

    def test_backend_update_passes_exact_version(self):
        payload = {"updated": False, "current": "1.5.80", "path": "/state/bin/spacemolt"}
        with patch("smx.cli.install_backend", return_value=payload) as install, redirect_stdout(io.StringIO()):
            rc = cmd_backend(["update", "--version", "1.5.80"])
        self.assertEqual(rc, 0)
        install.assert_called_once_with("1.5.80")

    def test_backend_rollback_prints_swap(self):
        payload = {"previous": "1.5.93", "current": "1.5.80", "path": "/state/bin/spacemolt"}
        stdout = io.StringIO()
        with patch("smx.cli.rollback_backend", return_value=payload), redirect_stdout(stdout):
            rc = cmd_backend(["rollback"])
        self.assertEqual(rc, 0)
        self.assertIn("1.5.93 -> 1.5.80", stdout.getvalue())

    def test_backend_rollback_reports_failure_cleanly(self):
        stderr = io.StringIO()
        with patch("smx.cli.rollback_backend", side_effect=RuntimeError("no previous backend")), redirect_stderr(stderr):
            rc = cmd_backend(["rollback"])
        self.assertEqual(rc, 1)
        self.assertIn("no previous backend", stderr.getvalue())


class FirstRunTests(unittest.TestCase):
    @staticmethod
    def _run(*, tty, answer="y\n", installed=True, interactive=True):
        missing = FileNotFoundError()
        done = subprocess.CompletedProcess([], 0, "ok\n", "")
        stdin = io.StringIO(answer)
        stdin.isatty = lambda: tty
        stderr = io.StringIO()
        stderr.isatty = lambda: tty
        env = {k: v for k, v in os.environ.items() if k != "SMX_BACKEND"}
        with tempfile.TemporaryDirectory() as tmp, \
             patch.dict(os.environ, {**env, "SMX_STATE_DIR": tmp}, clear=True), \
             patch("sys.stdin", stdin), patch("sys.stderr", stderr), \
             patch("smx.cli.subprocess.run", side_effect=[missing, done]) as run, \
             patch("smx.cli.install_backend", return_value={"current": "1.5.93"}) as install:
            if not installed:
                install.side_effect = RuntimeError("offline")
            result = Backend(interactive=interactive).run(["get_status"])
        return result, install, run, stderr.getvalue()

    def test_terminal_user_can_install_and_command_retries(self):
        result, install, run, _ = self._run(tty=True)
        self.assertEqual((result.returncode, result.stdout), (0, "ok\n"))
        install.assert_called_once_with()
        self.assertEqual(run.call_count, 2)

    def test_declining_keeps_clear_error(self):
        result, install, _, _ = self._run(tty=True, answer="n\n")
        self.assertEqual(result.returncode, 127)
        self.assertIn("smx backend update", result.stderr)
        install.assert_not_called()

    def test_agents_without_terminal_never_download(self):
        result, install, _, output = self._run(tty=False)
        self.assertEqual(result.returncode, 127)
        self.assertEqual(output, "")
        install.assert_not_called()

    def test_parallel_workers_never_prompt(self):
        result, install, _, _ = self._run(tty=True, interactive=False)
        self.assertEqual(result.returncode, 127)
        install.assert_not_called()

    def test_failed_install_keeps_clear_error(self):
        result, _, _, output = self._run(tty=True, installed=False)
        self.assertEqual(result.returncode, 127)
        self.assertIn("offline", output)


if __name__ == "__main__":
    unittest.main()
