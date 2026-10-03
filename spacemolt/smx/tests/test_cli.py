import contextlib
import io
import json
import unittest

from smx.cli import BackendResult, assess_threat, cmd_missions, cmd_nearby, cmd_sell_all, extract_cargo_items, extract_global_profile, normalize_command, parse_help_commands, suggest


class CliTests(unittest.TestCase):

    def test_extracts_global_profile_before_command(self):
        profile, argv = extract_global_profile(["-p", "Gremlin", "status"])
        self.assertEqual(profile, "gremlin")
        self.assertEqual(argv, ["status"])

    def test_normalizes_kebab_case(self):
        self.assertEqual(normalize_command("get-map"), "get_map")
        self.assertEqual(normalize_command("market/view-market"), "market/view_market")

    def test_parses_official_help_groups(self):
        commands = parse_help_commands("core: get_status, get_ship, get_map\nmarket: view_market, create_sell_order\n")
        self.assertIn("get_status", commands)
        self.assertIn("view_market", commands)
        self.assertIn("sell-all", commands)

    def test_fuzzy_suggestion(self):
        matches = suggest("get-stauts", {"get_status", "get_ship", "get_map"})
        self.assertEqual(matches[0], "get_status")

    def test_extracts_cargo_without_duplicates(self):
        payload = {
            "result": {
                "cargo": [
                    {"item_id": "ore_iron", "quantity": 12},
                    {"item_id": "fuel_cell", "quantity": 3},
                    {"item_id": "quest", "quantity": 1, "quest_item": True},
                ]
            }
        }
        self.assertEqual(extract_cargo_items(payload), [("fuel_cell", 3), ("ore_iron", 12)])

    def test_nearby_includes_current_v2_pirates_and_empire_npcs(self):
        calls = []

        class Backend:
            def json(self, args):
                calls.append(args)
                return BackendResult(0, "", ""), {
                    "structuredContent": {
                        "nearby": [{"player_id": "p1", "username": "Scout"}],
                        "pirates": [{"pirate_id": "pir1", "name": "Raider", "tier": 2}],
                        "empire_npcs": [{"npc_id": "npc1", "name": "Patrol", "role": "guard"}],
                    }
                }

        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            self.assertEqual(cmd_nearby(Backend(), ["--json"]), 0)
        self.assertEqual(calls, [["get_nearby"]])
        rows = json.loads(output.getvalue())["assessment"]
        self.assertEqual({row["kind"]: row["name"] for row in rows}, {
            "player": "Scout", "pirate": "Raider", "empire NPC": "Patrol",
        })
        self.assertGreater(next(row["score"] for row in rows if row["kind"] == "pirate"), 0)

    def test_threat_scores_boss_pirates_and_ignores_offline_players(self):
        boss, _, reasons = assess_threat({"kind": "pirate", "is_boss": True})
        regular, _, _ = assess_threat({"kind": "pirate"})
        self.assertGreater(boss, regular)
        self.assertIn("boss", reasons)
        self.assertEqual(assess_threat({"kind": "player", "offline": True, "in_combat": True})[0], 0)

    def test_nearby_reports_unknown_signature(self):
        class Backend:
            @staticmethod
            def json(_args):
                return BackendResult(0, "", ""), {"structuredContent": {"nearby": [], "unknown_signature": True}}

        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            self.assertEqual(cmd_nearby(Backend(), []), 0)
        self.assertIn("Unknown signature", output.getvalue())

    def test_missions_keeps_active_when_board_unavailable(self):
        class Backend:
            @staticmethod
            def json(args):
                if args == ["get_active_missions"]:
                    return BackendResult(0, "", ""), {"structuredContent": {"missions": [{"id": "m1"}]}}
                error = {"error": {"code": "no_mission_service", "message": "no board"}}
                return BackendResult(1, json.dumps(error), ""), error

        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            self.assertEqual(cmd_missions(Backend(), ["--json"]), 0)
        combined = json.loads(output.getvalue())
        self.assertEqual(combined["active"]["structuredContent"]["missions"], [{"id": "m1"}])
        self.assertEqual(combined["available"]["error"]["code"], "no_mission_service")

    def test_missions_fails_on_other_board_errors(self):
        class Backend:
            @staticmethod
            def json(args):
                if args == ["get_active_missions"]:
                    return BackendResult(0, "", ""), {"structuredContent": {"missions": []}}
                error = {"error": {"code": "rate_limited", "message": "slow down"}}
                return BackendResult(1, json.dumps(error), ""), error

        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(cmd_missions(Backend(), ["--json"]), 1)

    def test_sell_all_reports_actual_fill_and_unsold_items(self):
        calls = []

        class Backend:
            def json(self, args):
                calls.append(args)
                if args == ["get_cargo"]:
                    return BackendResult(0, "", ""), {"structuredContent": {
                        "cargo": [{"item_id": "iron_ore", "quantity": 12}]
                    }}
                return BackendResult(0, "", ""), {"structuredContent": {
                    "details": {"quantity_sold": 4, "unsold": 8}
                }}

        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            self.assertEqual(cmd_sell_all(Backend(), ["--json"]), 0)
        self.assertEqual(calls, [["get_cargo"], ["sell", "id=iron_ore", "quantity=12"]])
        result = json.loads(output.getvalue())
        self.assertEqual(result["sold"][0]["quantity"], 4)
        self.assertEqual(result["unfilled"], [{"item_id": "iron_ore", "quantity": 8}])

    def test_threat_marks_pirate_combat_ship(self):
        score, marker, reasons = assess_threat(
            {"kind": "pirate", "ship_class": "Raider Gunship", "weapons": [{}, {}], "in_combat": True}
        )
        self.assertGreaterEqual(score, 7)
        self.assertEqual(marker, "☠️")
        self.assertIn("pirate", reasons)

    def test_civilian_defaults_low(self):
        score, marker, reasons = assess_threat({"kind": "player", "ship_class": "Cargo Hauler"})
        self.assertEqual(score, 0)
        self.assertEqual(marker, "⬜")
        self.assertEqual(reasons, [])


if __name__ == "__main__":
    unittest.main()
