import unittest

from smx.projection import parse_fields, project_fields, unwrap_payload


class ProjectionTests(unittest.TestCase):
    def test_unwraps_structured_content(self):
        payload = {"structuredContent": {"player": {"name": "Gremlin"}}}
        self.assertEqual(unwrap_payload(payload), {"player": {"name": "Gremlin"}})

    def test_projects_nested_fields(self):
        payload = {
            "structuredContent": {
                "player": {"name": "Gremlin"},
                "ship": {"fuel": 58, "cargo": {"used": 12}},
            }
        }
        projected, missing = project_fields(payload, ["player.name", "ship.fuel", "ship.cargo.used"])
        self.assertEqual(
            projected,
            {"player.name": "Gremlin", "ship.fuel": 58, "ship.cargo.used": 12},
        )
        self.assertEqual(missing, [])

    def test_missing_fields_are_reported(self):
        projected, missing = project_fields({"result": {"foo": 1}}, ["foo", "bar"])
        self.assertEqual(projected, {"foo": 1})
        self.assertEqual(missing, ["bar"])

    def test_parses_comma_and_repeat_values_without_duplicates(self):
        self.assertEqual(parse_fields(["player.name,ship.fuel", "ship.fuel", "ship.cargo"]), [
            "player.name",
            "ship.fuel",
            "ship.cargo",
        ])


if __name__ == "__main__":
    unittest.main()
