import contextlib
import io
import json
import unittest

from smx.cli import BackendResult, cmd_guide


class GuideCliTests(unittest.TestCase):
    def test_default_prefers_live_guide_with_alias(self):
        calls = []

        class Backend:
            @staticmethod
            def run(args, *, json_output=False, timeout=None):
                calls.append((args, json_output))
                return BackendResult(0, "OFFICIAL GUIDE\n", "")

        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            self.assertEqual(cmd_guide(Backend(), ["combat"]), 0)
        self.assertEqual(calls, [(["get_guide", "id=pirate-hunter"], False)])
        self.assertEqual(output.getvalue(), "OFFICIAL GUIDE\n")

    def test_failed_live_guide_falls_back_to_card(self):
        calls = []

        class Backend:
            @staticmethod
            def run(args, *, json_output=False, timeout=None):
                calls.append(args)
                return BackendResult(1, "", "not authenticated")

        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            self.assertEqual(cmd_guide(Backend(), ["combat"]), 0)
        self.assertEqual(calls, [["get_guide", "id=pirate-hunter"]])
        self.assertIn("Combat field card", out.getvalue())
        self.assertIn("may be stale", err.getvalue())

    def test_explicit_live_failure_never_uses_snapshot(self):
        class Backend:
            @staticmethod
            def run(args, *, json_output=False, timeout=None):
                return BackendResult(1, "", "no session")

        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            self.assertEqual(cmd_guide(Backend(), ["combat", "--live"]), 1)
        self.assertNotIn("Combat field card", out.getvalue())
        self.assertIn("no session", err.getvalue())

    def test_offline_never_contacts_backend(self):
        class Backend:
            @staticmethod
            def run(*args, **kwargs):
                raise AssertionError("unexpected network call")

        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            self.assertEqual(cmd_guide(Backend(), ["combat", "--offline"]), 0)
        self.assertIn("Combat field card", out.getvalue())

    def test_unknown_local_topic_passes_through_to_upstream(self):
        calls = []

        class Backend:
            @staticmethod
            def run(args, *, json_output=False, timeout=None):
                calls.append((args, json_output))
                return BackendResult(0, "NEW GUIDE\n", "")

        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            self.assertEqual(cmd_guide(Backend(), ["taxes", "--json"]), 0)
        self.assertEqual(calls, [(["get_guide", "id=taxes"], True)])
        self.assertEqual(out.getvalue(), "NEW GUIDE\n")

    def test_live_index_uses_server_without_local_catalog(self):
        calls = []

        class Backend:
            @staticmethod
            def run(args, *, json_output=False, timeout=None):
                calls.append(args)
                return BackendResult(0, "SERVER GUIDE INDEX\n", "")

        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            self.assertEqual(cmd_guide(Backend(), ["--live"]), 0)
        self.assertEqual(calls, [["get_guide"]])
        self.assertIn("SERVER GUIDE INDEX", out.getvalue())



    def test_json_fallback_marks_stale_source_and_preserves_error(self):
        class Backend:
            @staticmethod
            def run(args, *, json_output=False, timeout=None):
                return BackendResult(1, "", "session expired")

        out = io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(cmd_guide(Backend(), ["combat", "--json"]), 0)
        payload = json.loads(out.getvalue())
        self.assertEqual(payload["source"], "bundled")
        self.assertTrue(payload["fallback"])
        self.assertEqual(payload["fallback_reason"], "session expired")

    def test_offline_json_identifies_snapshot_without_fallback(self):
        class Backend:
            @staticmethod
            def run(*args, **kwargs):
                raise AssertionError("unexpected backend call")

        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            self.assertEqual(cmd_guide(Backend(), ["combat", "--offline", "--json"]), 0)
        payload = json.loads(out.getvalue())
        self.assertEqual(payload["source"], "bundled")
        self.assertFalse(payload["fallback"])

    def test_unmapped_operations_still_queries_live_server(self):
        calls = []

        class Backend:
            @staticmethod
            def run(args, *, json_output=False, timeout=None):
                calls.append(args)
                return BackendResult(0, "LIVE OPERATIONS", "")

        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            self.assertEqual(cmd_guide(Backend(), ["operations"]), 0)
        self.assertEqual(calls, [["get_guide", "id=operations"]])
        self.assertEqual(out.getvalue(), "LIVE OPERATIONS")

    def test_list_with_live_queries_upstream(self):
        calls = []

        class Backend:
            @staticmethod
            def run(args, *, json_output=False, timeout=None):
                calls.append(args)
                return BackendResult(0, "LIVE INDEX", "")

        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            self.assertEqual(cmd_guide(Backend(), ["--list", "--live"]), 0)
        self.assertEqual(calls, [["get_guide"]])
        self.assertEqual(out.getvalue(), "LIVE INDEX")

    def test_backend_startup_error_and_timeout_are_reported(self):
        import subprocess
        from unittest.mock import patch
        from smx.cli import Backend

        backend = Backend(binary="spacemolt")
        with patch("smx.cli.subprocess.run", side_effect=PermissionError("denied")):
            result = backend.run(["get_guide", "id=miner"], timeout=20.0)
            self.assertEqual(result.returncode, 127)
            self.assertIn("denied", result.stderr)
        with patch("smx.cli.subprocess.run", side_effect=subprocess.TimeoutExpired("smx", 20)):
            result = backend.run(["get_guide", "id=miner"], timeout=20.0)
            self.assertEqual(result.returncode, 124)
            self.assertIn("timed out", result.stderr)


if __name__ == "__main__":
    unittest.main()
