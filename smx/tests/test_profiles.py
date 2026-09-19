import json
import tempfile
import unittest
from pathlib import Path

from smx.profiles import (
    add_profile,
    canonical_profile,
    default_profile,
    list_profiles,
    migrate_legacy_session,
    profile_session_path,
    selected_session_path,
    set_default_profile,
)


class ProfileTests(unittest.TestCase):
    def test_profile_names_are_canonical_and_safe(self):
        self.assertEqual(canonical_profile("Gremlin-5"), "gremlin-5")
        with self.assertRaises(ValueError):
            canonical_profile("../escape")

    def test_profiles_get_separate_session_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            env = {"SMX_STATE_DIR": tmp}
            a = selected_session_path("gremlin", env, platform="linux", home=Path("/home/test"))
            b = selected_session_path("claude", env, platform="linux", home=Path("/home/test"))
            self.assertNotEqual(a, b)
            self.assertEqual(a.name, "session.json")
            self.assertEqual(a.parent.name, "gremlin")

    def test_explicit_session_override_beats_profile(self):
        with tempfile.TemporaryDirectory() as tmp:
            wanted = Path(tmp) / "explicit.json"
            env = {"SMX_STATE_DIR": tmp, "SPACEMOLT_SESSION": str(wanted), "SMX_PROFILE": "claude"}
            self.assertEqual(
                selected_session_path("gremlin", env, platform="linux", home=Path("/home/test")),
                wanted.resolve(),
            )

    def test_environment_profile_beats_saved_default(self):
        with tempfile.TemporaryDirectory() as tmp:
            env = {"SMX_STATE_DIR": tmp}
            add_profile("gremlin", env, platform="linux", home=Path("/home/test"))
            set_default_profile("gremlin", env, platform="linux", home=Path("/home/test"))
            env["SMX_PROFILE"] = "claude"
            self.assertEqual(
                selected_session_path(None, env, platform="linux", home=Path("/home/test")).parent.name,
                "claude",
            )

    def test_migrates_legacy_session_and_sets_default(self):
        with tempfile.TemporaryDirectory() as tmp:
            env = {"SMX_STATE_DIR": tmp}
            legacy = Path(tmp) / "spacemolt-session.json"
            legacy.write_text(json.dumps({"version": 2}), encoding="utf-8")
            dest = migrate_legacy_session("Gremlin", env, platform="linux", home=Path("/home/test"))
            self.assertFalse(legacy.exists())
            self.assertTrue(dest.is_file())
            self.assertEqual(default_profile(env, platform="linux", home=Path("/home/test")), "gremlin")
            rows = list_profiles(env, platform="linux", home=Path("/home/test"))
            self.assertEqual(rows, [{"name": "gremlin", "default": True, "session": True}])


if __name__ == "__main__":
    unittest.main()
