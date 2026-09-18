import json
import unittest

from smx.mcp_profiles import PROFILES, profiles_json


class McpProfileTests(unittest.TestCase):
    def test_gameplay_uses_full_v2_preset(self):
        self.assertEqual(
            PROFILES["gameplay"]["endpoint"],
            "https://game.spacemolt.com/mcp/v2?preset=full",
        )
        self.assertTrue(PROFILES["gameplay"]["runtime"])

    def test_docs_is_development_only(self):
        self.assertEqual(
            PROFILES["docs"]["endpoint"],
            "https://game.spacemolt.com/mcp/docs",
        )
        self.assertFalse(PROFILES["docs"]["runtime"])

    def test_json_can_return_one_profile(self):
        data = json.loads(profiles_json("docs"))
        self.assertEqual(list(data), ["docs"])


if __name__ == "__main__":
    unittest.main()
