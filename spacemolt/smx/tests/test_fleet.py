import unittest

from smx.fleet import FleetStatus, fleet_check_ok, render_fleet, status_from_payload


class FleetTests(unittest.TestCase):
    def test_parses_official_get_status_shape(self):
        payload = {
            "structuredContent": {
                "player": {"username": "Gremlin-5", "empire": "nebula", "credits": 7909},
                "ship": {
                    "name": "Prospect",
                    "class_id": "prospect",
                    "fuel": 58,
                    "max_fuel": 130,
                    "cargo_used": 50,
                    "cargo_capacity": 100,
                },
                "location": {
                    "system_name": "Arneb",
                    "poi_name": "The Obsidian Well",
                    "docked_at": "cca9",
                },
            }
        }
        row = status_from_payload("gremlin", payload)
        self.assertTrue(row.ok)
        self.assertEqual(row.player, "Gremlin-5")
        self.assertEqual(row.ship, "Prospect")
        self.assertEqual(row.location, "Arneb/The Obsidian Well")
        self.assertEqual((row.fuel, row.max_fuel), (58, 130))
        self.assertEqual((row.cargo_used, row.cargo_capacity), (50, 100))
        self.assertEqual(row.credits, 7909)
        self.assertTrue(row.docked)
        self.assertEqual(row.state, "docked")

    def test_undocked_profile_fails_fleet_check(self):
        rows = [
            FleetStatus(profile="a", ok=True, docked=True, state="docked"),
            FleetStatus(profile="b", ok=True, docked=False, state="space"),
        ]
        self.assertFalse(fleet_check_ok(rows))

    def test_all_docked_profiles_pass_fleet_check(self):
        rows = [
            FleetStatus(profile="a", ok=True, docked=True, state="docked"),
            FleetStatus(profile="b", ok=True, docked=True, state="docked"),
        ]
        self.assertTrue(fleet_check_ok(rows))

    def test_renderer_contains_compact_status(self):
        row = FleetStatus(
            profile="gremlin",
            ok=True,
            player="Gremlin-5",
            ship="Prospect",
            location="Arneb/Well",
            fuel=58,
            max_fuel=130,
            cargo_used=50,
            cargo_capacity=100,
            credits=7909,
            docked=True,
            state="docked",
        )
        output = render_fleet([row])
        self.assertIn("PROFILE", output)
        self.assertIn("Gremlin-5", output)
        self.assertIn("58/130", output)
        self.assertIn("50/100", output)


if __name__ == "__main__":
    unittest.main()
