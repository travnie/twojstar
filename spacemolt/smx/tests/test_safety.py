import contextlib
import io
import json
import unittest

from smx.cli import BackendResult
from smx.safety import cmd_autodock, cmd_survive


def status(*, poi="base_poi", docked=None, transit=False, pending=False, fuel=35,
           hull=80, incapacitated=False, crew_id="captain"):
    return {"structuredContent": {
        "player": {"id": crew_id},
        "ship": {"hull": hull, "max_hull": 100, "shield": 60, "max_shield": 100,
                 "fuel": fuel, "max_fuel": 100, "incapacitated": incapacitated},
        "queue": {"has_pending": pending},
        "location": {"poi_id": poi, "docked_at": docked, "in_transit": transit,
                     "nearby_pirate_count": 0, "nearby_leviathans": []},
    }}


def chart(*, multi=False, battle=False):
    pois = [{"id": "base_poi", "name": "Home", "base_id": "base_1",
             "base_name": "Base One", "has_base": True}]
    if multi:
        pois.append({"id": "other_poi", "name": "Other", "base_id": "base_2",
                     "base_name": "Base Two", "has_base": True})
    doc = {"system": {"pois": pois}}
    if battle:
        doc["active_battle"] = {"participants": [{"player_id": "captain"}]}
    return {"structuredContent": doc}


def poi(*, public=True, battle=False, wrecked=False):
    data = {"poi": {"id": "base_poi"},
            "base": {"id": "base_1", "public_access": public, "wrecked": wrecked}}
    if battle:
        data["active_battle"] = {"battle_id": "attack"}
    return {"structuredContent": data}


class Backend:
    def __init__(self, replies):
        self.replies = {key: list(values) for key, values in replies.items()}
        self.calls = []

    def json(self, args, *, timeout=None):
        key = tuple(args)
        self.calls.append(("query", key, timeout))
        remaining = self.replies.get(key, [])
        if not remaining:
            raise AssertionError(f"unexpected query: {args}")
        return BackendResult(0, "", ""), remaining.pop(0)

    def run(self, args, *, json_output=False, timeout=None):
        key = tuple(args)
        self.calls.append(("action", key, timeout))
        remaining = self.replies.get(key, [])
        if not remaining:
            raise AssertionError(f"unexpected mutation: {args}")
        code, detail = remaining.pop(0)
        return BackendResult(code, detail if code == 0 else "", detail if code else "")


def run(method, backend, args):
    stdout, stderr = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
        code = method(backend, args)
    return code, stdout.getvalue(), stderr.getvalue()


class SurviveTests(unittest.TestCase):
    def test_healthy_read_only_and_json(self):
        backend = Backend({("get_status",): [status()], ("get_system",): [chart()]})
        rc, out, _ = run(cmd_survive, backend, ["--json", "--check"])
        self.assertEqual(rc, 0)
        data = json.loads(out)
        self.assertEqual(data["status"], "ok")
        self.assertEqual(data["combat"], "none")
        self.assertEqual(len(backend.calls), 2)
        self.assertTrue(all(call[0] == "query" for call in backend.calls))

    def test_low_hull_fuel_and_incapacitated(self):
        backend = Backend({("get_status",): [status(hull=25, fuel=0, incapacitated=True)],
                           ("get_system",): [chart()]})
        rc, out, _ = run(cmd_survive, backend, ["--json", "--check"])
        self.assertEqual(rc, 1)
        data = json.loads(out)
        self.assertEqual(data["status"], "danger")
        self.assertIn("smx distress_signal distress_type=fuel", data["suggestions"])

    def test_battle_tactical_escape_indicators(self):
        battle = {"is_participant": True,
                  "combat_state": {"can_escape": False, "warp_disrupted": True,
                                   "intercepted": False, "incapacitated": False}}
        backend = Backend({("get_status",): [status()],
                           ("get_system",): [chart(battle=True)],
                           ("spacemolt_battle/status",): [{"structuredContent": battle}]})
        rc, out, _ = run(cmd_survive, backend, ["--json", "--check"])
        self.assertEqual(rc, 1)
        result = json.loads(out)
        self.assertEqual(result["combat"], "active")
        self.assertTrue(result["escape"]["warp_disrupted"])
        self.assertIn("smx spacemolt_battle/stance id=brace", result["suggestions"])

    def test_flee_suggestion_is_not_executed(self):
        battle = {"is_participant": True, "combat_state": {"can_escape": True}}
        backend = Backend({("get_status",): [status()],
                           ("get_system",): [chart(battle=True)],
                           ("spacemolt_battle/status",): [{"structuredContent": battle}]})
        rc, out, _ = run(cmd_survive, backend, ["--json"])
        self.assertEqual(rc, 0)
        self.assertIn("smx spacemolt_battle/stance id=flee", json.loads(out)["suggestions"])
        self.assertTrue(all(call[0] == "query" for call in backend.calls))

    def test_battle_presence_unknown_fails_check(self):
        backend = Backend({("get_status",): [status()],
                           ("get_system",): [{"error": {"message": "chart offline"}}]})
        rc, out, _ = run(cmd_survive, backend, ["--json", "--check"])
        self.assertEqual(rc, 1)
        self.assertEqual(json.loads(out)["status"], "unknown")


class AutodockTests(unittest.TestCase):
    def test_preview_never_mutates(self):
        backend = Backend({("get_status",): [status()], ("get_system",): [chart()]})
        rc, out, _ = run(cmd_autodock, backend, ["--json"])
        self.assertEqual(rc, 0)
        doc = json.loads(out)
        self.assertEqual(doc["status"], "preview")
        self.assertEqual(doc["actions"], ["dock"])
        self.assertTrue(all(c[0] == "query" for c in backend.calls))

    def test_local_dock_execute_and_verify(self):
        backend = Backend({
            ("get_status",): [status(), status(), status(docked="base_1")],
            ("get_system",): [chart()],
            ("get_poi",): [poi()],
            ("dock",): [(0, "ok")],
        })
        rc, out, _ = run(cmd_autodock, backend, ["--execute", "--json"])
        self.assertEqual(rc, 0)
        self.assertEqual(json.loads(out)["status"], "docked")
        self.assertEqual([c[1] for c in backend.calls if c[0] == "action"], [("dock",)])

    def test_remote_station_execute_travels_then_docks(self):
        backend = Backend({
            ("get_status",): [
                status(poi="belt"), status(poi="belt"), status(poi="base_poi"),
                status(poi="base_poi"), status(poi="base_poi", docked="base_1"),
            ],
            ("get_system",): [chart()],
            ("get_poi",): [poi()],
            ("travel", "id=base_poi"): [(0, "ok")],
            ("dock",): [(0, "ok")],
        })
        rc, out, _ = run(cmd_autodock, backend, ["--execute", "--json", "--max-wait", "1"])
        self.assertEqual(rc, 0)
        self.assertEqual(json.loads(out)["status"], "docked")
        self.assertEqual([c[1] for c in backend.calls if c[0] == "action"],
                         [("travel", "id=base_poi"), ("dock",)])

    def test_travel_pending_no_reissue_or_dock(self):
        backend = Backend({
            ("get_status",): [status(poi="belt"), status(poi="belt"),
                              status(poi="belt", transit=True, pending=True)],
            ("get_system",): [chart()],
            ("travel", "id=base_poi"): [(0, "accepted")],
        })
        rc, out, _ = run(cmd_autodock, backend, ["--execute", "--json", "--max-wait", "0"])
        self.assertEqual(rc, 1)
        self.assertEqual(json.loads(out)["status"], "in_transit")
        self.assertEqual(len([c for c in backend.calls if c[0] == "action"]), 1)

    def test_local_station_wins_over_other_charted_stations(self):
        backend = Backend({("get_status",): [status()],
                           ("get_system",): [chart(multi=True)]})
        rc, out, _ = run(cmd_autodock, backend, ["--json"])
        self.assertEqual(rc, 0)
        self.assertEqual(json.loads(out)["actions"], ["dock"])

    def test_ambiguous_station_needs_target(self):
        backend = Backend({("get_status",): [status(poi="belt")],
                           ("get_system",): [chart(multi=True)]})
        rc, out, _ = run(cmd_autodock, backend, ["--execute", "--json"])
        self.assertEqual(rc, 1)
        self.assertEqual(json.loads(out)["status"], "blocked")
        self.assertEqual(len(json.loads(out)["stations"]), 2)
        self.assertTrue(all(c[0] == "query" for c in backend.calls))

    def test_blocks_pending_queue_and_transit(self):
        for payload in (status(pending=True), status(transit=True),
                        status(incapacitated=True)):
            backend = Backend({("get_status",): [payload]})
            rc, _, _ = run(cmd_autodock, backend, ["--execute"])
            self.assertEqual(rc, 1)
            self.assertEqual(len(backend.calls), 1)

    def test_blocks_hostile_or_inaccessible_station(self):
        for station in (poi(public=False), poi(battle=True), poi(wrecked=True)):
            backend = Backend({("get_status",): [status()],
                               ("get_system",): [chart()],
                               ("get_poi",): [station]})
            rc, _, _ = run(cmd_autodock, backend, ["--execute"])
            self.assertEqual(rc, 1)
            self.assertTrue(all(c[0] == "query" for c in backend.calls))

    def test_malformed_transit_state_blocks_mutation(self):
        payload = status()
        payload["structuredContent"]["location"]["in_transit"] = "unknown"
        backend = Backend({("get_status",): [payload]})
        rc, out, _ = run(cmd_autodock, backend, ["--execute", "--json"])
        self.assertEqual(rc, 1)
        self.assertEqual(json.loads(out)["status"], "blocked")

    def test_missing_pilot_id_during_battle_is_unknown(self):
        backend = Backend({("get_status",): [status(crew_id=None)],
                           ("get_system",): [chart(battle=True)]})
        rc, out, _ = run(cmd_survive, backend, ["--check", "--json"])
        self.assertEqual(rc, 1)
        self.assertEqual(json.loads(out)["combat"], "unknown")

    def test_zero_fuel_while_docked_suggests_refuel(self):
        backend = Backend({("get_status",): [status(fuel=0, docked="base_1")],
                           ("get_system",): [chart()]})
        rc, out, _ = run(cmd_survive, backend, ["--json", "--check"])
        data = json.loads(out)
        self.assertEqual((rc, data["status"]), (1, "danger"))
        self.assertEqual(data["suggestions"], ["smx refuel"])

    def test_low_fuel_in_space_is_danger(self):
        backend = Backend({("get_status",): [status(fuel=30)], ("get_system",): [chart()]})
        rc, out, _ = run(cmd_survive, backend, ["--json", "--check"])
        data = json.loads(out)
        self.assertEqual((rc, data["status"]), (1, "danger"))
        self.assertEqual(data["suggestions"], ["smx autodock"])

    def test_low_fuel_skips_autodock_when_it_would_refuse(self):
        for state in (status(fuel=30, transit=True), status(fuel=30, pending=True)):
            backend = Backend({("get_status",): [state], ("get_system",): [chart()]})
            _, out, _ = run(cmd_survive, backend, ["--json"])
            self.assertEqual(json.loads(out)["suggestions"], [])

    def test_low_fuel_skips_autodock_in_battle(self):
        backend = Backend({("get_status",): [status(fuel=30)], ("get_system",): [chart(battle=True)],
                           ("spacemolt_battle/status",): [{"structuredContent": {"is_participant": False}}]})
        _, out, _ = run(cmd_survive, backend, ["--json"])
        data = json.loads(out)
        self.assertEqual(data["combat"], "active")
        self.assertNotIn("smx autodock", data["suggestions"])

    def test_low_fuel_while_docked_is_only_advice(self):
        backend = Backend({("get_status",): [status(fuel=30, docked="base_1")], ("get_system",): [chart()]})
        rc, out, _ = run(cmd_survive, backend, ["--json", "--check"])
        data = json.loads(out)
        self.assertEqual((rc, data["status"]), (0, "ok"))
        self.assertEqual(data["suggestions"], ["smx refuel"])

    def test_known_danger_survives_unknown_fuel(self):
        payload = status(hull=20)
        payload["structuredContent"]["ship"]["fuel"] = None
        backend = Backend({("get_status",): [payload], ("get_system",): [chart()]})
        rc, out, _ = run(cmd_survive, backend, ["--check", "--json"])
        self.assertEqual(rc, 1)
        self.assertEqual(json.loads(out)["status"], "danger")

    def test_in_battle_blocks_travel(self):
        backend = Backend({("get_status",): [status(poi="belt")],
                           ("get_system",): [chart(battle=True)]})
        rc, out, _ = run(cmd_autodock, backend, ["--execute", "--json"])
        self.assertEqual(rc, 1)
        self.assertEqual(json.loads(out)["status"], "blocked")
        self.assertTrue(all(c[0] == "query" for c in backend.calls))

    def test_explicit_charted_target_selection(self):
        backend = Backend({("get_status",): [status(poi="belt")],
                           ("get_system",): [chart(multi=True)]})
        rc, out, _ = run(cmd_autodock, backend, ["--json", "--target", "base_2"])
        self.assertEqual(rc, 0)
        doc = json.loads(out)
        self.assertEqual(doc["status"], "preview")
        self.assertEqual(doc["destination"]["poi"], "other_poi")
        self.assertEqual(doc["actions"], ["travel id=other_poi", "dock"])

    def test_invalid_target_refused(self):
        backend = Backend({("get_status",): [status(poi="belt")],
                           ("get_system",): [chart()]})
        rc, out, _ = run(cmd_autodock, backend, ["--target", "unknown", "--json", "--execute"])
        self.assertEqual(rc, 1)
        self.assertEqual(json.loads(out)["status"], "blocked")
        self.assertTrue(all(c[0] == "query" for c in backend.calls))

    def test_station_identity_change_refused(self):
        changed = poi()
        changed["structuredContent"]["base"]["id"] = "different_base"
        backend = Backend({
            ("get_status",): [status()],
            ("get_system",): [chart()],
            ("get_poi",): [changed],
        })
        rc, out, _ = run(cmd_autodock, backend, ["--execute", "--json"])
        self.assertEqual(rc, 1)
        self.assertEqual(json.loads(out)["status"], "blocked")
        self.assertTrue(all(c[0] == "query" for c in backend.calls))

    def test_dock_failure_never_retries(self):
        backend = Backend({("get_status",): [status(), status()],
                           ("get_system",): [chart()],
                           ("get_poi",): [poi()],
                           ("dock",): [(124, "official CLI timed out")]})
        rc, out, _ = run(cmd_autodock, backend, ["--execute", "--json"])
        self.assertEqual(rc, 1)
        self.assertEqual(json.loads(out)["status"], "blocked")
        self.assertEqual(len([c for c in backend.calls if c[0] == "action"]), 1)

    def test_already_docked_different_target_is_not_success(self):
        backend = Backend({("get_status",): [status(docked="base_1")]})
        rc, out, _ = run(cmd_autodock, backend, ["--execute", "--target", "base_2", "--json"])
        self.assertEqual(rc, 1)
        self.assertEqual(json.loads(out)["status"], "blocked")
        self.assertEqual(len(backend.calls), 1)

    def test_already_docked_matching_poi_is_idempotent(self):
        backend = Backend({("get_status",): [status(docked="base_1")]})
        rc, out, _ = run(cmd_autodock, backend, ["--execute", "--target", "base_poi", "--json"])
        self.assertEqual(rc, 0)
        self.assertEqual(json.loads(out)["status"], "docked")

    def test_survival_default_text_has_numbers(self):
        backend = Backend({("get_status",): [status()], ("get_system",): [chart()]})
        rc, out, _ = run(cmd_survive, backend, [])
        self.assertEqual(rc, 0)
        self.assertIn("hull: 80/100", out)
        self.assertIn("shield: 60/100", out)
        self.assertIn("fuel: 35/100", out)
        self.assertIn("combat: none", out)

    def test_already_docked_is_idempotent(self):
        backend = Backend({("get_status",): [status(docked="base_1")]})
        rc, out, _ = run(cmd_autodock, backend, ["--execute", "--json"])
        self.assertEqual(rc, 0)
        self.assertEqual(json.loads(out)["status"], "docked")
        self.assertEqual(len(backend.calls), 1)


if __name__ == "__main__":
    unittest.main()
