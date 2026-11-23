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
    ".props": "csharp", ".targets": "csharp", ".slnx": "csharp",
    ".js": "javascript-typescript", ".jsx": "javascript-typescript",
    ".ts": "javascript-typescript", ".tsx": "javascript-typescript",
    ".mjs": "javascript-typescript", ".cjs": "javascript-typescript",
    ".mts": "javascript-typescript", ".cts": "javascript-typescript",
    ".html": "javascript-typescript", ".htm": "javascript-typescript",
    ".vue": "javascript-typescript", ".svelte": "javascript-typescript",
    ".astro": "javascript-typescript",
    ".py": "python", ".pyi": "python",
    ".java": "java-kotlin", ".kt": "java-kotlin", ".kts": "java-kotlin",
    ".swift": "swift",
}


JS_MANIFESTS = {
    "package.json", "package-lock.json", "npm-shrinkwrap.json",
    "pnpm-lock.yaml", "yarn.lock", "bun.lock", "bun.lockb",
}
PY_MANIFESTS = {"pyproject.toml", "uv.lock", "poetry.lock", "pipfile", "pipfile.lock"}


def matrix(languages, keyboard=True, xiaomi=True):
    selected = set(languages)
    rows = []
    for language, mode, runner in LANGUAGES:
        if language not in selected:
            continue
        row = {"language": language, "build-mode": mode, "runner": runner}
        if language == "java-kotlin":
            row.update(keyboard=keyboard, xiaomi=xiaomi)
        rows.append(row)
    return rows

def choose(paths):
    """Return relevant rows in stable order."""
    selected = set()
    keyboard = xiaomi = False
    for raw_path in paths:
        path = raw_path.lower().replace("\\", "/")
        if path.startswith(".github/codeql/"):
            return matrix(lang for lang, _, _ in LANGUAGES)
        if path.startswith((".github/workflows/", ".github/actions/")):
            selected.add("actions")
        source = Path(path)
        is_doc = source.suffix in {".md", ".mdx"}
        if path.startswith("intent-keyboard/") and not is_doc:
            # Shared KMP sources feed Android, desktop and iOS framework.
            selected.update(("java-kotlin", "swift"))
            keyboard = True
        if path.startswith("xiaomi-adb-tools/") and not is_doc:
            selected.add("java-kotlin")
            xiaomi = True
        lang = SUFFIX_LANGUAGES.get(source.suffix)
        if lang:
            selected.add(lang)
            if lang == "java-kotlin" and not path.startswith(("intent-keyboard/", "xiaomi-adb-tools/")):
                keyboard = xiaomi = True
        if source.name in JS_MANIFESTS or (source.suffix == ".json" and source.name.startswith(("tsconfig", "jsconfig"))):
            selected.add("javascript-typescript")
        if source.name in PY_MANIFESTS or (source.name.startswith("requirements") and source.suffix == ".txt"):
            selected.add("python")
    return matrix(selected, keyboard=keyboard, xiaomi=xiaomi)

def plan(event, base_sha):
    if event != "pull_request":
        return matrix(lang for lang, _, _ in LANGUAGES)
    # Synthetic PR merge: first parent is the current base, unlike stale event SHA.
    for base in ("HEAD^1", base_sha):
        if not base:
            continue
        try:
            changed = subprocess.run(
                ["git", "diff", "--name-only", "--no-renames", "-z", base, "HEAD"],
                check=True, capture_output=True,
            )
            return choose(os.fsdecode(p) for p in changed.stdout.split(b"\\0") if p)
        except subprocess.CalledProcessError:
            continue
    # Never lose coverage if both Git references are unavailable.
    return matrix(lang for lang, _, _ in LANGUAGES)


if __name__ == "__main__":
    selected = plan(os.environ.get("EVENT_NAME", ""), os.environ.get("BASE_SHA", ""))
    print(f"include={json.dumps(selected, separators=(',', ':'))}")
