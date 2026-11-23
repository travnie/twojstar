#!/usr/bin/env python3
"""Scope PR CodeQL jobs to changed code. Scan all languages on main/schedule."""

import json
import os
from pathlib import Path
import subprocess

LANGUAGES = (
    ("actions", "none", "ubuntu-latest"),
    ("c-cpp", "none", "ubuntu-latest"),
    ("csharp", "none", "ubuntu-latest"),
    ("javascript-typescript", "none", "ubuntu-latest"),
    ("python", "none", "ubuntu-latest"),
    ("java-kotlin", "manual", "ubuntu-latest"),
    ("swift", "manual", "macos-26"),
)

SUFFIX_LANGUAGES = {
    ".c": "c-cpp", ".cc": "c-cpp", ".cpp": "c-cpp", ".cxx": "c-cpp",
    ".h": "c-cpp", ".hh": "c-cpp", ".hpp": "c-cpp", ".hxx": "c-cpp",
    ".cs": "csharp", ".csproj": "csharp", ".sln": "csharp",
    ".js": "javascript-typescript", ".jsx": "javascript-typescript",
    ".ts": "javascript-typescript", ".tsx": "javascript-typescript",
    ".mjs": "javascript-typescript", ".cjs": "javascript-typescript",
    ".mts": "javascript-typescript", ".cts": "javascript-typescript",
    ".py": "python", ".pyi": "python",
    ".java": "java-kotlin", ".kt": "java-kotlin", ".kts": "java-kotlin",
    ".swift": "swift",
}


def matrix(languages):
    selected = set(languages)
    return [
        {"language": language, "build-mode": mode, "runner": runner}
        for language, mode, runner in LANGUAGES
        if language in selected
    ]


def choose(paths):
    """Return relevant rows in stable order."""
    selected = set()
    for raw_path in paths:
        path = raw_path.lower().replace("\\", "/")
        if path.startswith(".github/codeql/"):
            return matrix(lang for lang, _, _ in LANGUAGES)
        if path.startswith(".github/workflows/"):
            selected.add("actions")
        if path.startswith("intent-keyboard/"):
            # Shared KMP sources feed Android, desktop and iOS framework.
            selected.update(("java-kotlin", "swift"))
        if path.startswith("xiaomi-adb-tools/"):
            selected.add("java-kotlin")
        lang = SUFFIX_LANGUAGES.get(Path(path).suffix)
        if lang:
            selected.add(lang)
    return matrix(selected)


def plan(event, base_sha):
    if event != "pull_request" or not base_sha:
        return matrix(lang for lang, _, _ in LANGUAGES)
    try:
        changed = subprocess.run(
            ["git", "diff", "--name-only", "--diff-filter=ACMRT", base_sha, "HEAD"],
            check=True, text=True, capture_output=True,
        )
        return choose(changed.stdout.splitlines())
    except subprocess.CalledProcessError:
        # No silent security scan skips on missing history.
        return matrix(lang for lang, _, _ in LANGUAGES)


if __name__ == "__main__":
    selected = plan(os.environ.get("EVENT_NAME", ""), os.environ.get("BASE_SHA", ""))
    print(f"include={json.dumps(selected, separators=(',', ':'))}")
