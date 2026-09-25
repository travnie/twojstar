from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path
from typing import Mapping

APP_NAME = "smx"


def _expanded(value: str) -> Path:
    return Path(os.path.expandvars(os.path.expanduser(value))).resolve()


def state_dir(
    env: Mapping[str, str] | None = None,
    *,
    platform: str | None = None,
    home: Path | None = None,
) -> Path:
    env = os.environ if env is None else env
    override = env.get("SMX_STATE_DIR")
    if override:
        return _expanded(override)

    platform = sys.platform if platform is None else platform
    home = Path.home() if home is None else home

    if platform.startswith("win"):
        root = env.get("LOCALAPPDATA") or env.get("APPDATA")
        return Path(root) / APP_NAME if root else home / "AppData" / "Local" / APP_NAME
    if platform == "darwin":
        return home / "Library" / "Application Support" / APP_NAME

    xdg = env.get("XDG_STATE_HOME")
    return Path(xdg) / APP_NAME if xdg else home / ".local" / "state" / APP_NAME


def session_path(env: Mapping[str, str] | None = None, **kwargs: object) -> Path:
    env = os.environ if env is None else env
    override = env.get("SPACEMOLT_SESSION")
    if override:
        return _expanded(override)
    return state_dir(env, **kwargs) / "spacemolt-session.json"


def managed_bin_dir(env: Mapping[str, str] | None = None, **kwargs: object) -> Path:
    return state_dir(env, **kwargs) / "bin"


def managed_backend_path(env: Mapping[str, str] | None = None, **kwargs: object) -> Path:
    platform = kwargs.get("platform")
    current_platform = sys.platform if platform is None else str(platform)
    name = "spacemolt.exe" if current_platform.startswith("win") else "spacemolt"
    return managed_bin_dir(env, **kwargs) / name


def resolve_backend(
    binary: str | None = None,
    env: Mapping[str, str] | None = None,
    **kwargs: object,
) -> str:
    env = os.environ if env is None else env
    if binary:
        return binary
    if env.get("SMX_BACKEND"):
        return env["SMX_BACKEND"]

    managed = managed_backend_path(env, **kwargs)
    if managed.is_file():
        return str(managed)

    found = shutil.which("spacemolt")
    return found or "spacemolt"


def ensure_private_state_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True, mode=0o700)
    if os.name != "nt":
        try:
            path.chmod(0o700)
        except OSError:
            pass
