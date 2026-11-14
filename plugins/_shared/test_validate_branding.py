"""Check branding icon discovery across valid YAML indentation."""
from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from validate_branding import contrast, listing_icon, native_skill_icon


class SkillBrandingTests(unittest.TestCase):
    def test_interface_indentation(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            path = root / "skills" / "example" / "agents" / "openai.yaml"
            path.parent.mkdir(parents=True)
            for indent in (2, 4):
                with self.subTest(indent=indent):
                    padding = " " * indent
                    path.write_text(
                        "interface:\n"
                        f"{padding}display_name: Example\n"
                        f"{padding}icon_small: ./assets/icon.svg\n"
                        f"{padding}icon_large: assets/icon-large.png\n"
                        "policy:\n"
                        "  products: [CHAT, CODEX]\n",
                        encoding="utf-8",
                    )
                    self.assertEqual(
                        native_skill_icon(root, "example", "icon_small"),
                        "./skills/example/assets/icon.svg",
                    )
                    self.assertEqual(
                        native_skill_icon(root, "example", "icon_large"),
                        "./skills/example/assets/icon-large.png",
                    )

    def test_icon_outside_interface_is_ignored(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            path = root / "skills" / "example" / "agents" / "openai.yaml"
            path.parent.mkdir(parents=True)
            path.write_text(
                "interface:\n  display_name: Example\n"
                "policy:\n  icon_small: ./assets/wrong.svg\n",
                encoding="utf-8",
            )
            self.assertIsNone(native_skill_icon(root, "example", "icon_small"))


class ListingTests(unittest.TestCase):
    def test_svg_icon_needs_square_viewbox_of_48(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "assets").mkdir()
            for box, ok in (("0 0 24 24", False), ("0 0 512 256", False), ("0 0 512 512", True)):
                with self.subTest(box=box):
                    (root / "assets/icon.svg").write_text(f'<svg viewBox="{box}"/>', encoding="utf-8")
                    if ok:
                        listing_icon(root, "./assets/icon.svg", "x")
                    else:
                        with self.assertRaises(ValueError):
                            listing_icon(root, "./assets/icon.svg", "x")

    def test_brand_contrast(self):
        self.assertLess(contrast("#FFEE58", "#FFFFFF"), 2)
        self.assertGreater(contrast("#078AA8", "#FFFFFF"), 2)


if __name__ == "__main__":
    unittest.main()
