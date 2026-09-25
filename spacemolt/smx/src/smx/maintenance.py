from __future__ import annotations

import hashlib
import json
import os
import platform
import re
import shutil
import stat
import subprocess
import urllib.request
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Callable

from .paths import ensure_private_state_dir, managed_backend_path, resolve_backend, state_dir
from .profiles import default_profile, list_profiles

RELEASE_API = "https://api.github.com/repos/SpaceMolt/client-v2/releases/latest"
VERSION_RE = re.compile(r"SpaceMolt CLI v?([0-9]+(?:\.[0-9]+)+)", re.IGNORECASE)
USER_AGENT = "spacemolt-smx/0.1"


@dataclass(frozen=True)
class ReleaseAsset:
    name: str
    url: str
    digest: str | None = None
    size: int | None = None


@dataclass(frozen=True)
class ReleaseInfo:
    version: str
    tag: str
    asset: ReleaseAsset

    def as_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["asset"] = asdict(self.asset)
        return payload


def normalize_version(value: str) -> str:
    return value.strip().removeprefix("v")


def version_tuple(value: str) -> tuple[int, ...]:
    normalized = normalize_version(value)
    if not normalized or any(not part.isdigit() for part in normalized.split(".")):
        raise ValueError(f"invalid numeric version: {value!r}")
    return tuple(int(part) for part in normalized.split("."))


def compare_versions(current: str, latest: str) -> int:
    a = version_tuple(current)
    b = version_tuple(latest)
    width = max(len(a), len(b))
    aa = a + (0,) * (width - len(a))
    bb = b + (0,) * (width - len(b))
    return (aa > bb) - (aa < bb)


def platform_asset_name(system: str | None = None, machine: str | None = None) -> str:
    system = (system or platform.system()).casefold()
    machine = (machine or platform.machine()).casefold()

    x64 = machine in {"amd64", "x86_64", "x64"}
    arm64 = machine in {"arm64", "aarch64"}

    if system == "windows" and x64:
        return "spacemolt-client-v2-windows-x64.exe"
    if system == "linux" and x64:
        return "spacemolt-client-v2-linux-x64"
    if system == "linux" and arm64:
        return "spacemolt-client-v2-linux-arm64"
    if system in {"darwin", "macos"} and x64:
        return "spacemolt-client-v2-macos-x64"
    if system in {"darwin", "macos"} and arm64:
        return "spacemolt-client-v2-macos-arm64"
    raise ValueError(f"unsupported platform for managed backend: {system}/{machine}")


def _open_json(url: str, opener: Callable[..., Any] = urllib.request.urlopen) -> dict[str, Any]:
    request = urllib.request.Request(
        url,
        headers={"Accept": "application/vnd.github+json", "User-Agent": USER_AGENT},
    )
    with opener(request, timeout=10) as response:
        payload = json.load(response)
    if not isinstance(payload, dict):
        raise ValueError("release API returned a non-object payload")
    return payload


def fetch_latest_release(
    *,
    asset_name: str | None = None,
    opener: Callable[..., Any] = urllib.request.urlopen,
    system: str | None = None,
    machine: str | None = None,
) -> ReleaseInfo:
    payload = _open_json(RELEASE_API, opener)
    tag = payload.get("tag_name")
    if not isinstance(tag, str) or not tag:
        raise ValueError("latest release has no tag_name")
    wanted = asset_name or platform_asset_name(system, machine)

    assets = payload.get("assets")
    if not isinstance(assets, list):
        raise ValueError("latest release has no assets")
    for row in assets:
        if not isinstance(row, dict) or row.get("name") != wanted:
            continue
        url = row.get("browser_download_url")
        if not isinstance(url, str) or not url.startswith("https://github.com/SpaceMolt/client-v2/"):
            raise ValueError(f"release asset has an unexpected download URL: {url!r}")
        digest = row.get("digest") if isinstance(row.get("digest"), str) else None
        size = row.get("size") if isinstance(row.get("size"), int) else None
        return ReleaseInfo(
            version=normalize_version(tag),
            tag=tag,
            asset=ReleaseAsset(name=wanted, url=url, digest=digest, size=size),
        )
    raise ValueError(f"release {tag} does not contain {wanted}")


def parse_backend_version(output: str) -> str | None:
    match = VERSION_RE.search(output)
    return match.group(1) if match else None


def backend_version(binary: str | Path) -> str:
    proc = subprocess.run(
        [str(binary), "--version"],
        capture_output=True,
        text=True,
        check=False,
        timeout=15,
    )
    combined = f"{proc.stdout}\n{proc.stderr}"
    version = parse_backend_version(combined)
    if proc.returncode != 0 or not version:
        raise RuntimeError(f"could not verify SpaceMolt backend version: {combined.strip() or proc.returncode}")
    return version


def _download_path(destination: Path) -> Path:
    if destination.suffix.casefold() == ".exe":
        return destination.with_name(f".{destination.stem}.{os.getpid()}.download.exe")
    return destination.with_name(f".{destination.name}.{os.getpid()}.download")


def download_release_asset(
    release: ReleaseInfo,
    destination: Path,
    *,
    opener: Callable[..., Any] = urllib.request.urlopen,
) -> Path:
    ensure_private_state_dir(destination.parent)
    temporary = _download_path(destination)
    request = urllib.request.Request(release.asset.url, headers={"User-Agent": USER_AGENT})
    hasher = hashlib.sha256()
    written = 0

    try:
        with opener(request, timeout=60) as response, temporary.open("wb") as handle:
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                handle.write(chunk)
                hasher.update(chunk)
                written += len(chunk)

        if release.asset.size is not None and written != release.asset.size:
            raise RuntimeError(
                f"download size mismatch for {release.asset.name}: expected {release.asset.size}, got {written}"
            )

        digest = release.asset.digest
        if digest and digest.casefold().startswith("sha256:"):
            expected = digest.split(":", 1)[1].casefold()
            actual = hasher.hexdigest().casefold()
            if actual != expected:
                raise RuntimeError(f"SHA-256 mismatch for {release.asset.name}")

        if os.name != "nt":
            mode = temporary.stat().st_mode
            temporary.chmod(mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
        return temporary
    except Exception:
        temporary.unlink(missing_ok=True)
        raise


def install_latest_backend(
    *,
    destination: Path | None = None,
    release: ReleaseInfo | None = None,
    opener: Callable[..., Any] = urllib.request.urlopen,
    version_reader: Callable[[str | Path], str] = backend_version,
) -> dict[str, Any]:
    destination = destination or managed_backend_path()
    release = release or fetch_latest_release(opener=opener)
    if not release.asset.digest or not release.asset.digest.casefold().startswith("sha256:"):
        raise RuntimeError(f"release asset {release.asset.name} has no SHA-256 digest; refusing update")

    current: str | None = None
    if destination.is_file():
        try:
            current = version_reader(destination)
        except (OSError, RuntimeError, subprocess.SubprocessError):
            current = None

    if current is not None and compare_versions(current, release.version) >= 0:
        return {
            "updated": False,
            "current": current,
            "latest": release.version,
            "path": str(destination),
            "reason": "already current",
        }

    temporary = download_release_asset(release, destination, opener=opener)
    try:
        downloaded = version_reader(temporary)
        if compare_versions(downloaded, release.version) != 0:
            raise RuntimeError(
                f"downloaded backend version {downloaded} does not match release {release.version}"
            )
        os.replace(temporary, destination)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise

    return {
        "updated": True,
        "previous": current,
        "current": release.version,
        "latest": release.version,
        "path": str(destination),
        "asset": release.asset.name,
        "digest": release.asset.digest,
    }


def backend_status(*, online: bool = True) -> dict[str, Any]:
    managed = managed_backend_path()
    resolved = resolve_backend()
    current: str | None = None
    error: str | None = None

    candidate = managed if managed.is_file() else Path(resolved)
    try:
        if candidate.is_file() or shutil.which(str(candidate)):
            current = backend_version(candidate)
        else:
            error = f"backend not found: {resolved}"
    except (OSError, RuntimeError, subprocess.SubprocessError) as exc:
        error = str(exc)

    payload: dict[str, Any] = {
        "resolved": resolved,
        "managed": str(managed),
        "managed_exists": managed.is_file(),
        "current": current,
        "error": error,
    }
    if online:
        latest = fetch_latest_release()
        payload["latest"] = latest.version
        payload["asset"] = latest.asset.name
        payload["update_available"] = current is None or compare_versions(current, latest.version) < 0
    return payload


def doctor_report(*, online: bool = False) -> dict[str, Any]:
    state = state_dir()
    profiles = list_profiles()
    backend = backend_status(online=online)
    session_errors = [str(row["name"]) for row in profiles if not row.get("session")]

    checks = [
        {
            "name": "backend",
            "ok": backend.get("error") is None,
            "detail": backend.get("error") or f"SpaceMolt CLI v{backend.get('current')}",
        },
        {
            "name": "state",
            "ok": state.is_dir(),
            "detail": str(state),
        },
        {
            "name": "profiles",
            "ok": not session_errors,
            "detail": (
                f"{len(profiles)} profile(s)"
                if not session_errors
                else f"profiles without session: {', '.join(session_errors)}"
            ),
            "warning": not profiles,
        },
    ]

    if os.environ.get("SPACEMOLT_SESSION"):
        checks.append(
            {
                "name": "session override",
                "ok": True,
                "warning": True,
                "detail": "SPACEMOLT_SESSION is set; profile isolation is bypassed for ordinary commands",
            }
        )
    if os.environ.get("SMX_BACKEND"):
        checks.append(
            {
                "name": "backend override",
                "ok": True,
                "warning": True,
                "detail": "SMX_BACKEND is set; managed backend updates will not change the active backend",
            }
        )

    healthy = all(check.get("ok", False) for check in checks if not check.get("warning"))
    return {
        "healthy": healthy,
        "state_dir": str(state),
        "default_profile": default_profile(),
        "profiles": profiles,
        "backend": backend,
        "checks": checks,
    }
