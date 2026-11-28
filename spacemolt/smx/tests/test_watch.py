import io
import unittest
from contextlib import redirect_stderr, redirect_stdout
from unittest.mock import patch

from smx.cli import (BackendResult, _passthrough, cmd_watch, extract_smx_globals,
                     is_tick_limited_read, watch_command_is_read_only)


class FakeBackend:
    def __init__(self):
        self.run_calls = []
        self.json_calls = []

    def run(self, args, *, json_output=False):
        self.run_calls.append(args)
        return BackendResult(0, "ok\n", "")

    def json(self, args):
        self.json_calls.append(args)
        return BackendResult(0, "", ""), {
            "structuredContent": {
                "player": {"name": "Gremlin-5"},
                "ship": {"fuel": 58, "cargo_used": 50},
            }
        }


class WatchAndFieldsTests(unittest.TestCase):
    def test_extracts_profile_and_fields_in_any_global_order(self):
        profile, fields, argv = extract_smx_globals([
            "--fields",
            "player.name,ship.fuel",
            "-p",
            "Gremlin",
            "status",
        ])
        self.assertEqual(profile, "gremlin")
        self.assertEqual(fields, ["player.name", "ship.fuel"])
        self.assertEqual(argv, ["status"])

    def test_passthrough_projects_selected_fields(self):
        backend = FakeBackend()
        stdout = io.StringIO()
        with redirect_stdout(stdout):
            rc = _passthrough(backend, ["status"], ["player.name", "ship.fuel"])

        self.assertEqual(rc, 0)
        self.assertEqual(backend.json_calls, [["get_status"]])
        self.assertIn('"player.name": "Gremlin-5"', stdout.getvalue())
        self.assertIn('"ship.fuel": 58', stdout.getvalue())

    def test_projection_fails_when_field_does_not_exist(self):
        backend = FakeBackend()
        stderr = io.StringIO()
        with redirect_stderr(stderr):
            rc = _passthrough(backend, ["status"], ["ship.nope"])

        self.assertEqual(rc, 2)
        self.assertIn("fields not found", stderr.getvalue())

    def test_watch_refuses_mutation(self):
        backend = FakeBackend()
        stderr = io.StringIO()
        with redirect_stderr(stderr):
            rc = cmd_watch(backend, ["mine", "--count", "1"])

        self.assertEqual(rc, 2)
        self.assertEqual(backend.run_calls, [])
        self.assertIn("potentially mutating", stderr.getvalue())

    def test_watch_runs_read_only_command_once(self):
        backend = FakeBackend()
        stdout = io.StringIO()
        with redirect_stdout(stdout):
            rc = cmd_watch(backend, ["status", "--count", "1"])

        self.assertEqual(rc, 0)
        self.assertEqual(backend.run_calls, [["get_status"]])
        self.assertEqual(stdout.getvalue(), "ok\n")

    def test_watch_can_project_fields(self):
        backend = FakeBackend()
        stdout = io.StringIO()
        with redirect_stdout(stdout):
            rc = cmd_watch(backend, ["status", "--count", "1", "--fields", "player.name"])

        self.assertEqual(rc, 0)
        self.assertEqual(backend.json_calls, [["get_status"]])
        self.assertIn("Gremlin-5", stdout.getvalue())

    def test_watch_read_only_detection(self):
        self.assertTrue(watch_command_is_read_only("status"))
        self.assertTrue(watch_command_is_read_only("get_cargo"))
        self.assertTrue(watch_command_is_read_only("market/view_market"))
        self.assertFalse(watch_command_is_read_only("sell"))
        self.assertFalse(watch_command_is_read_only("mine"))

    def test_watch_raises_interval_for_tick_limited_reads(self):
        for command in ("ship", "get_cargo", "spacemolt/get_state"):
            with self.subTest(command=command):
                backend = FakeBackend()
                stderr = io.StringIO()
                with patch("smx.cli.time.sleep") as sleep, redirect_stdout(io.StringIO()), \
                        redirect_stderr(stderr):
                    rc = cmd_watch(backend, [command, "-n", "2", "--count", "2"])
                self.assertEqual(rc, 0)
                sleep.assert_called_once_with(10.0)
                self.assertIn("one unchanged read per tick", stderr.getvalue())

    def test_watch_keeps_short_interval_for_unlimited_reads(self):
        backend = FakeBackend()
        stderr = io.StringIO()
        with patch("smx.cli.time.sleep") as sleep, redirect_stdout(io.StringIO()), \
                redirect_stderr(stderr):
            rc = cmd_watch(backend, ["status", "-n", "2", "--count", "2"])
        self.assertEqual(rc, 0)
        sleep.assert_called_once_with(2.0)
        self.assertEqual(stderr.getvalue(), "")

    def test_tick_limited_read_detection(self):
        for command in ("get_state", "ship", "cargo", "storage/view", "spacemolt_storage/view"):
            with self.subTest(command=command):
                self.assertTrue(is_tick_limited_read(command))
        for command in ("status", "get_system", "storage/deposit", "spacemolt_market/view_market"):
            with self.subTest(command=command):
                self.assertFalse(is_tick_limited_read(command))

    def test_upstream_freight_block_list_safety(self):
        self.assertTrue(watch_command_is_read_only("spacemolt_shipping/list_blocked"))
        self.assertFalse(watch_command_is_read_only("spacemolt_shipping/block_carrier"))
        self.assertFalse(watch_command_is_read_only("spacemolt_shipping/unblock_carrier"))

    def test_upstream_shipping_and_stance_safety(self):
        self.assertTrue(watch_command_is_read_only("spacemolt_shipping/list_all"))
        self.assertFalse(watch_command_is_read_only("spacemolt_shipping/reclaim"))
        self.assertFalse(watch_command_is_read_only("spacemolt_battle/default_stance"))

    def test_watch_refuses_list_prefixed_mutations(self):
        self.assertTrue(watch_command_is_read_only("spacemolt_ship/list_ships"))
        self.assertFalse(watch_command_is_read_only("spacemolt_facility/list_for_sale"))
        self.assertFalse(watch_command_is_read_only("spacemolt_ship/list_ship_for_sale"))

    def test_watch_notifications_only_without_clearing(self):
        self.assertFalse(watch_command_is_read_only("notifications"))
        self.assertFalse(watch_command_is_read_only("get_notifications", ["clear=true"]))
        self.assertTrue(watch_command_is_read_only("notifications", ["clear=false"]))
        self.assertFalse(watch_command_is_read_only("notifications", ["clear=false", "clear=true"]))
        self.assertTrue(watch_command_is_read_only("notifications", ["clear=true", "clear=false"]))

        backend = FakeBackend()
        with redirect_stderr(io.StringIO()):
            rc = cmd_watch(backend, ["notifications", "--count", "1"])
        self.assertEqual(rc, 2)
        self.assertEqual(backend.run_calls, [])


if __name__ == "__main__":
    unittest.main()
