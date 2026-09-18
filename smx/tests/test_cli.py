import unittest

from smx.cli import assess_threat, extract_cargo_items, normalize_command, parse_help_commands, suggest


class CliTests(unittest.TestCase):
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
