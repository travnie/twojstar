import unittest

from smx.knowledge import GUIDES, list_guides, load_guide, search_guides


class KnowledgeTests(unittest.TestCase):
    def test_all_guides_load(self):
        for topic in GUIDES:
            text = load_guide(topic)
            self.assertTrue(text.startswith("# "))
            self.assertGreater(len(text), 100)

    def test_guide_list_is_compact(self):
        rows = list_guides()
        self.assertEqual({row["topic"] for row in rows}, set(GUIDES))
        self.assertTrue(all("content" not in row for row in rows))

    def test_search_returns_only_matching_lines(self):
        hits = search_guides("warp")
        self.assertTrue(hits)
        self.assertTrue(all("warp" in hit["text"].casefold() for hit in hits))

    def test_live_guide_mapping_is_optional(self):
        self.assertEqual(GUIDES["combat"]["live"], "pirate-hunter")
        self.assertIsNone(GUIDES["operations"]["live"])


if __name__ == "__main__":
    unittest.main()
