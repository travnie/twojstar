import tempfile
import unittest
from pathlib import Path

from smx.paths import managed_backend_path, session_path, state_dir


class PathTests(unittest.TestCase):
    def test_windows_uses_local_appdata(self):
        env = {"LOCALAPPDATA": r"C:\\Users\\test\\AppData\\Local"}
        self.assertEqual(
            state_dir(env, platform="win32", home=Path(r"C:\\Users\\test")),
            Path(r"C:\\Users\\test\\AppData\\Local") / "smx",
        )

    def test_linux_uses_xdg_state(self):
        env = {"XDG_STATE_HOME": "/tmp/state"}
        self.assertEqual(
            state_dir(env, platform="linux", home=Path("/home/test")),
            Path("/tmp/state/smx"),
        )

    def test_session_override_wins(self):
        with tempfile.TemporaryDirectory() as tmp:
            wanted = Path(tmp) / "custom.json"
            self.assertEqual(
                session_path({"SPACEMOLT_SESSION": str(wanted)}, platform="linux", home=Path("/home/test")),
                wanted.resolve(),
            )

    def test_managed_windows_backend_is_inside_smx_state(self):
        env = {"LOCALAPPDATA": r"C:\\Users\\test\\AppData\\Local"}
        path = managed_backend_path(env, platform="win32", home=Path(r"C:\\Users\\test"))
        self.assertEqual(path.name, "spacemolt.exe")
        self.assertEqual(path.parent.name, "bin")
        self.assertEqual(path.parent.parent.name, "smx")


if __name__ == "__main__":
    unittest.main()
