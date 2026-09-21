import io
import os
import unittest
from contextlib import redirect_stderr, redirect_stdout
from unittest.mock import patch

from smx.cli import BackendResult, cmd_fleet


def status_payload(name, ship, docked):
    return {
        "structuredContent": {
            "player": {"username": name, "credits": 100},
            "ship": {
                "name": ship,
                "fuel": 10,
                "max_fuel": 20,
                "cargo_used": 1,
                "cargo_capacity": 10,
            },
            "location": {
                "system_name": "Sol",
                "poi_name": "Central",
                "docked_at": "station" if docked else "",
            },
        }
    }


class FleetCliTests(unittest.TestCase):
    def test_fleet_check_collects_profiles_and_fails_when_one_is_undocked(self):
        profiles = [
            {"name": "gremlin", "default": True, "session": True},
            {"name": "claudiusz", "default": False, "session": True},
        ]

        def fake_json(backend, args):
            self.assertEqual(args, ["get_status"])
            payload = status_payload(
                "Gremlin-5" if backend.profile == "gremlin" else "Claudiusz",
                "Prospect" if backend.profile == "gremlin" else "Theoria",
                backend.profile == "gremlin",
            )
            return BackendResult(0, "", ""), payload

        stdout = io.StringIO()
        with patch.dict(os.environ, {"SPACEMOLT_SESSION": ""}, clear=False):
            with patch("smx.cli.list_profiles", return_value=profiles):
                with patch("smx.cli.Backend.json", new=fake_json):
                    with redirect_stdout(stdout):
                        rc = cmd_fleet(["check"])

        self.assertEqual(rc, 1)
        output = stdout.getvalue()
        self.assertIn("gremlin", output)
        self.assertIn("claudiusz", output)
        self.assertIn("1/2 docked", output)

    def test_only_undocked_hides_safe_profiles(self):
        profiles = [
            {"name": "gremlin", "default": True, "session": True},
            {"name": "claudiusz", "default": False, "session": True},
        ]

        def fake_json(backend, args):
            return BackendResult(0, "", ""), status_payload(
                backend.profile,
                "ship",
                backend.profile == "gremlin",
            )

        stdout = io.StringIO()
        with patch.dict(os.environ, {"SPACEMOLT_SESSION": ""}, clear=False):
            with patch("smx.cli.list_profiles", return_value=profiles):
                with patch("smx.cli.Backend.json", new=fake_json):
                    with redirect_stdout(stdout):
                        rc = cmd_fleet(["--only-undocked"])

        self.assertEqual(rc, 0)
        output = stdout.getvalue()
        self.assertNotIn("gremlin", output)
        self.assertIn("claudiusz", output)

    def test_explicit_session_override_is_refused(self):
        stderr = io.StringIO()
        with patch.dict(os.environ, {"SPACEMOLT_SESSION": "one.json"}, clear=True):
            with redirect_stderr(stderr):
                rc = cmd_fleet([])

        self.assertEqual(rc, 2)
        self.assertIn("isolated profile sessions", stderr.getvalue())


if __name__ == "__main__":
    unittest.main()
