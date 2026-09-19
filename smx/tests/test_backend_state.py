import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from smx.cli import Backend


class BackendStateTests(unittest.TestCase):
    def test_backend_injects_private_session_path(self):
        with tempfile.TemporaryDirectory() as tmp:
            state = Path(tmp) / "state"
            captured = {}

            class Proc:
                returncode = 0
                stdout = ""
                stderr = ""

            def fake_run(command, **kwargs):
                captured["command"] = command
                captured["env"] = kwargs["env"]
                return Proc()

            with patch.dict(os.environ, {"SMX_STATE_DIR": str(state)}, clear=True):
                with patch("smx.cli.subprocess.run", side_effect=fake_run):
                    Backend(binary="spacemolt").run(["get_status"])

            self.assertEqual(
                captured["env"]["SPACEMOLT_SESSION"],
                str((state / "spacemolt-session.json").resolve()),
            )
            self.assertTrue(state.is_dir())


    def test_profile_gets_its_own_session_path(self):
        with tempfile.TemporaryDirectory() as tmp:
            state = Path(tmp) / "state"
            captured = {}

            class Proc:
                returncode = 0
                stdout = ""
                stderr = ""

            def fake_run(command, **kwargs):
                captured["env"] = kwargs["env"]
                return Proc()

            with patch.dict(os.environ, {"SMX_STATE_DIR": str(state)}, clear=True):
                with patch("smx.cli.subprocess.run", side_effect=fake_run):
                    Backend(binary="spacemolt", profile="Claude").run(["get_status"])

            self.assertEqual(
                captured["env"]["SPACEMOLT_SESSION"],
                str((state / "profiles" / "claude" / "session.json").resolve()),
            )

    def test_explicit_session_path_is_preserved(self):
        with tempfile.TemporaryDirectory() as tmp:
            wanted = str(Path(tmp) / "mine.json")
            captured = {}

            class Proc:
                returncode = 0
                stdout = ""
                stderr = ""

            def fake_run(command, **kwargs):
                captured["env"] = kwargs["env"]
                return Proc()

            with patch.dict(os.environ, {"SPACEMOLT_SESSION": wanted}, clear=True):
                with patch("smx.cli.subprocess.run", side_effect=fake_run):
                    Backend(binary="spacemolt").run(["get_status"])

            self.assertEqual(captured["env"]["SPACEMOLT_SESSION"], wanted)


if __name__ == "__main__":
    unittest.main()
