from __future__ import annotations

import json
import os
import re
import shutil
from pathlib import Path
from typing import Mapping

from .paths import ensure_private_state_dir, session_path, state_dir

PROFILE_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")


def canonical_profile(name: str) -> str:
    value = name.strip()
    if not PROFILE_RE.fullmatch(value):
        raise ValueError("profile names must use 1-64 letters, numbers, '.', '_' or '-'")
    return value.casefold()


def profiles_dir(env: Mapping[str, str] | None = None, **kwargs: object) -> Path:
    return state_dir(env, **kwargs) / "profiles"


def profile_dir(name: str, env: Mapping[str, str] | None = None, **kwargs: object) -> Path:
    return profiles_dir(env, **kwargs) / canonical_profile(name)


def profile_session_path(name: str, env: Mapping[str, str] | None = None, **kwargs: object) -> Path:
    return profile_dir(name, env, **kwargs) / "session.json"


def config_path(env: Mapping[str, str] | None = None, **kwargs: object) -> Path:
    return state_dir(env, **kwargs) / "profiles.json"


def _read_config(env: Mapping[str, str] | None = None, **kwargs: object) -> dict[str, str]:
    path = config_path(env, **kwargs)
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return {}
    return payload if isinstance(payload, dict) else {}


def default_profile(env: Mapping[str, str] | None = None, **kwargs: object) -> str | None:
    env = os.environ if env is None else env
    override = env.get("SMX_PROFILE")
    if override:
        return canonical_profile(override)
    value = _read_config(env, **kwargs).get("default")
    return canonical_profile(value) if value else None


def selected_session_path(
    profile: str | None = None,
    env: Mapping[str, str] | None = None,
    **kwargs: object,
) -> Path:
    env = os.environ if env is None else env
    if env.get("SPACEMOLT_SESSION"):
        return session_path(env, **kwargs)
    selected = canonical_profile(profile) if profile else default_profile(env, **kwargs)
    return profile_session_path(selected, env, **kwargs) if selected else session_path(env, **kwargs)


def list_profiles(env: Mapping[str, str] | None = None, **kwargs: object) -> list[dict[str, object]]:
    root = profiles_dir(env, **kwargs)
    default = default_profile(env, **kwargs)
    if not root.is_dir():
        return []
    rows: list[dict[str, object]] = []
    for path in sorted((p for p in root.iterdir() if p.is_dir()), key=lambda p: p.name):
        rows.append({
            "name": path.name,
            "default": path.name == default,
            "session": (path / "session.json").is_file(),
        })
    return rows


def add_profile(name: str, env: Mapping[str, str] | None = None, **kwargs: object) -> Path:
    path = profile_dir(name, env, **kwargs)
    ensure_private_state_dir(path)
    return path


def set_default_profile(name: str | None, env: Mapping[str, str] | None = None, **kwargs: object) -> None:
    env = os.environ if env is None else env
    state = state_dir(env, **kwargs)
    ensure_private_state_dir(state)
    path = config_path(env, **kwargs)
    payload = {} if name is None else {"default": canonical_profile(name)}
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    if os.name != "nt":
        try:
            tmp.chmod(0o600)
        except OSError:
            pass
    tmp.replace(path)


def migrate_legacy_session(
    name: str,
    env: Mapping[str, str] | None = None,
    **kwargs: object,
) -> Path:
    env = os.environ if env is None else env
    if env.get("SPACEMOLT_SESSION"):
        raise ValueError("cannot migrate while SPACEMOLT_SESSION is explicitly set")
    source = session_path(env, **kwargs)
    destination = profile_session_path(name, env, **kwargs)
    if not source.is_file():
        raise FileNotFoundError(f"legacy session not found: {source}")
    if destination.exists():
        raise FileExistsError(f"profile already has a session: {destination}")
    ensure_private_state_dir(destination.parent)
    source.replace(destination)
    set_default_profile(name, env, **kwargs)
    return destination


def remove_profile(
    name: str,
    env: Mapping[str, str] | None = None,
    **kwargs: object,
) -> None:
    env = os.environ if env is None else env
    canonical = canonical_profile(name)
    path = profile_dir(canonical, env, **kwargs)
    if not path.is_dir():
        raise FileNotFoundError(f"profile not found: {canonical}")
    shutil.rmtree(path)
    if default_profile(env, **kwargs) == canonical and not env.get("SMX_PROFILE"):
        set_default_profile(None, env, **kwargs)
