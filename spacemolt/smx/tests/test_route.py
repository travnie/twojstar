import contextlib
import io
import json
import unittest

from smx.route import assess_route, cmd_route
from smx.cli import BackendResult


def route(**overrides):
    data = {
        "found": True,
        "target_system": "tau_ceti",
        "total_jumps": 2,
        "fuel_per_jump": 6,
        "estimated_fuel": 12,
        "fuel_available": 85,
        "cargo_used": 18,
        "route": [
            {"system_id": "sol", "name": "Sol", "jumps": 0},
            {"system_id": "alpha", "name": "Alpha", "jumps": 1},
            {"system_id": "tau_ceti", "name": "Tau Ceti", "jumps": 2},
        ],
    }
    data.update(overrides)
    return {"structuredContent": data}


class RouteTests(unittest.TestCase):
    def run_cli(self, payload, argv, *, code=0):
        calls = []

        class FakeBackend:
            @staticmethod
            def json(args, *, timeout=None):
                calls.append((args, timeout))
                return BackendResult(0, "", ""), payload

        stdout, stderr = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
            result = cmd_route(FakeBackend(), argv)
        self.assertEqual(result, code)
        self.assertEqual(calls, [(["find_route", f"id={argv[0]}"], 20.0)])
        return stdout.getvalue(), stderr.getvalue()

    def test_route_uses_official_ids_and_reports_fuel(self):
        out, _ = self.run_cli(route(), ["tau_ceti", "--reserve", "15", "--check", "--json"])
        result = json.loads(out)
        self.assertEqual(result["official"]["target_system"], "tau_ceti")
        self.assertEqual(result["assessment"]["fuel_on_arrival"], 73)
        self.assertEqual(result["assessment"]["status"], "ready")
        self.assertEqual(result["assessment"]["scope"], "pilot")

    def test_read_only_and_wormhole_poi(self):
        payload = route(route=[
            {"system_id": "sol", "name": "Sol", "jumps": 0},
            {"system_id": "alpha", "name": "Alpha", "jumps": 1,
             "via_wormhole": True, "entrance_poi": "hole_123"},
            {"system_id": "tau_ceti", "name": "Tau Ceti", "jumps": 2},
        ], target_poi="tau_station", target_poi_name="Tau Station")
        out, _ = self.run_cli(payload, ["tau_station"])
        self.assertIn("wormhole via hole_123", out)
        self.assertIn("Tau Station", out)
        self.assertIn("Read-only plan", out)

    def test_fuel_warning_default_still_reports_but_check_fails(self):
        payload = route(fuel_available=10)
        out, err = self.run_cli(payload, ["tau_ceti"])
        self.assertIn("needs_fuel", out)
        self.assertIn("Insufficient fuel", err)
        self.run_cli(payload, ["tau_ceti", "--check"], code=1)

    def test_reserve_is_checked_in_fleet_too(self):
        members = [
            {"username": "Gremlin", "fuel_available": 85,
             "estimated_fuel": 12, "can_complete": True},
            {"username": "Wingman", "fuel_available": 13,
             "estimated_fuel": 12, "can_complete": True},
        ]
        payload = route(fleet_fuel=members)
        out, _ = self.run_cli(payload, ["tau_ceti", "--reserve", "5", "--check", "--json"], code=1)
        report = json.loads(out)["assessment"]
        self.assertEqual(report["status"], "needs_fuel")
        self.assertEqual(report["scope"], "fleet")
        self.assertFalse(report["fleet"][1]["reserve_ok"])

    def test_server_fleet_failure_cannot_be_overridden_by_fuel_math(self):
        payload = route(fleet_fuel=[
            {"username": "Pilot", "fuel_available": 20, "estimated_fuel": 10, "can_complete": False}
        ])
        self.assertEqual(assess_route(payload["structuredContent"], 0)["status"], "needs_fuel")

    def test_unreachable_is_not_safety_approved(self):
        payload = route(found=False, route=None, fuel_available=0, estimated_fuel=0)
        out, _ = self.run_cli(payload, ["hidden_system", "--check", "--json"], code=1)
        self.assertEqual(json.loads(out)["assessment"]["status"], "unreachable")

    def test_unknown_or_incomplete_data_fails_closed(self):
        for payload in (None, {}, route(route=[]), route(fuel_per_jump=0),
                        route(fuel_available=True), route(fleet_fuel=[{}]),
                        route(route=[{"system_id": "sol", "name": "Sol", "jumps": 0},
                                     {"system_id": "alpha", "name": "Alpha", "jumps": 1,
                                      "via_wormhole": True},
                                     {"system_id": "tau_ceti", "name": "Tau Ceti", "jumps": 2}]),
                        route(route=[{"system_id": "sol", "name": "Sol", "jumps": 99},
                                     {"system_id": "alpha", "name": "Alpha", "jumps": 1},
                                     {"system_id": "tau_ceti", "name": "Tau Ceti", "jumps": 2}])):
            out, _ = self.run_cli(payload, ["tau_ceti", "--check", "--json"], code=1)
            self.assertEqual(json.loads(out)["assessment"]["status"], "unknown")

    def test_same_system_and_zero_jumps(self):
        payload = route(route=[{"system_id": "sol", "name": "Sol", "jumps": 0}],
                        total_jumps=0, estimated_fuel=0)
        self.run_cli(payload, ["sol", "--check"], code=0)

    def test_propagates_official_backend_error(self):
        class FakeBackend:
            @staticmethod
            def json(_args, *, timeout=None):
                return BackendResult(3, "", "not authenticated"), None

        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(cmd_route(FakeBackend(), ["tau_ceti", "--check"]), 3)

    def test_missing_json_keeps_backend_diagnostic(self):
        class FakeBackend:
            @staticmethod
            def json(_args, *, timeout=None):
                return BackendResult(0, "invalid output", "server returned broken JSON"), None

        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            self.assertEqual(cmd_route(FakeBackend(), ["sol", "--json", "--check"]), 1)
        self.assertIsNone(json.loads(out.getvalue())["official"])
        self.assertEqual(json.loads(out.getvalue())["assessment"]["status"], "unknown")
        self.assertIn("server returned broken JSON", err.getvalue())

    def test_missing_json_without_diagnostic(self):
        class FakeBackend:
            @staticmethod
            def json(_args, *, timeout=None):
                return BackendResult(0, "", ""), None

        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            self.assertEqual(cmd_route(FakeBackend(), ["sol", "--json"]), 1)
        self.assertEqual(json.loads(out.getvalue())["assessment"]["status"], "unknown")
        self.assertIn("no JSON payload", err.getvalue())

    def test_negative_reserve_rejected(self):
        class FakeBackend:
            @staticmethod
            def json(_args):
                raise AssertionError("should not query backend")

        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit) as raised:
            cmd_route(FakeBackend(), ["sol", "--reserve", "-1"])
        self.assertEqual(raised.exception.code, 2)


if __name__ == "__main__":
    unittest.main()
