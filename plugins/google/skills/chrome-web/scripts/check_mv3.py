#!/usr/bin/env python3
"""Static MV3 sanity check for an unpacked Chrome extension directory.

Usage: python3 check_mv3.py <extension-dir> [--json]
Exit 1 on errors. Catches what loads fine but breaks at runtime or in review;
it does not prove the extension works (load it in Chromium for that).
"""

import json
import re
import struct
import sys
from pathlib import Path

MV2_KEYS = {
    "browser_action",
    "page_action",
    "background.scripts",
    "background.page",
    "background.persistent",
}
MV2_CALLS = [
    r"chrome\.browserAction",
    r"chrome\.pageAction",
    r"chrome\.tabs\.executeScript",
    r"chrome\.tabs\.insertCSS",
    r"chrome\.extension\.getURL",
    r"chrome\.runtime\.getBackgroundPage",
]
RISKY = {"<all_urls>", "*://*/*", "http://*/*", "https://*/*"}
HEAVY_PERMS = {
    "tabs",
    "history",
    "webRequest",
    "cookies",
    "debugger",
    "management",
    "scripting",
    "downloads",
}


def png_size(p: Path):
    with p.open("rb") as f:
        head = f.read(24)
    if head[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    return struct.unpack(">II", head[16:24])


def refs(m: dict):
    out = []

    def add(v):
        if isinstance(v, str):
            out.append(v)

    for v in (m.get("icons") or {}).values():
        add(v)
    act = m.get("action") or {}
    add(act.get("default_popup"))
    di = act.get("default_icon")
    if isinstance(di, dict):
        for v in di.values():
            add(v)
    else:
        add(di)
    bg = m.get("background") or {}
    add(bg.get("service_worker"))
    add((m.get("side_panel") or {}).get("default_path"))
    add(m.get("options_page"))
    add((m.get("options_ui") or {}).get("page"))
    add(m.get("devtools_page"))
    for v in (m.get("chrome_url_overrides") or {}).values():
        add(v)
    for cs in m.get("content_scripts") or []:
        for f in cs.get("js", []) + cs.get("css", []):
            add(f)
    for p in (m.get("sandbox") or {}).get("pages", []):
        add(p)
    for r in m.get("declarative_net_request", {}).get("rule_resources", []):
        add(r.get("path"))
    return [r.lstrip("/") for r in out if r]


def check(root: Path):
    errors, warnings = [], []
    mf = root / "manifest.json"
    if not mf.is_file():
        return {"errors": ["manifest.json not found at directory root"], "warnings": []}
    try:
        m = json.loads(mf.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        return {"errors": [f"manifest.json invalid JSON: {e}"], "warnings": []}

    if m.get("manifest_version") != 3:
        errors.append("manifest_version must be 3")
    for k in ("name", "version"):
        if not m.get(k):
            errors.append(f"missing '{k}'")
    if len(m.get("description", "")) > 132:
        errors.append("description > 132 chars")
    if not re.fullmatch(r"\d+(\.\d+){0,3}", str(m.get("version", ""))):
        errors.append("version must be 1-4 dot-separated integers")
    for k in MV2_KEYS:
        a, _, b = k.partition(".")
        if (b and isinstance(m.get(a), dict) and b in m[a]) or (not b and a in m):
            errors.append(f"MV2 key present: {k}")

    for r in refs(m):
        if not (root / r).is_file():
            errors.append(f"referenced file missing: {r}")
    for size, path in (m.get("icons") or {}).items():
        p = root / str(path).lstrip("/")
        if p.is_file() and p.suffix.lower() == ".png":
            dim = png_size(p)
            if dim and dim != (int(size), int(size)):
                warnings.append(f"icon {size} is {dim[0]}x{dim[1]}: {path}")
    if "128" not in (m.get("icons") or {}):
        warnings.append("no 128px icon (store listing needs one)")

    perms = set(m.get("permissions", []))
    hosts = set(m.get("host_permissions", []))
    if hosts & RISKY or perms & RISKY:
        warnings.append(
            "broad host access; justify or narrow / use activeTab or optional_host_permissions"
        )
    if any(p in perms for p in RISKY) or any("://" in p for p in perms):
        errors.append("host patterns belong in host_permissions, not permissions")
    for p in sorted(perms & HEAVY_PERMS):
        warnings.append(f"permission '{p}' needs a specific store justification")
    uses_action_api = False
    sandbox_pages = {p.lstrip("/") for p in (m.get("sandbox") or {}).get("pages", [])}
    # Default sandbox CSP allows inline scripts; a custom one must keep 'unsafe-inline'.
    csp = m.get("content_security_policy") or {}
    sandbox_csp = csp.get("sandbox") if isinstance(csp, dict) else None
    sandbox_inline_ok = sandbox_csp is None or "'unsafe-inline'" in sandbox_csp

    for f in root.rglob("*"):
        if any(part in {"node_modules", ".git"} for part in f.parts) or not f.is_file():
            continue
        rel = f.relative_to(root).as_posix()
        if f.suffix in {".js", ".mjs"}:
            src = f.read_text(encoding="utf-8", errors="ignore")
            for pat in MV2_CALLS:
                if re.search(pat, src):
                    errors.append(f"MV2 API {pat.replace(chr(92), '')} in {rel}")
            if re.search(r"(chrome|browser)\.action\.", src):
                uses_action_api = True
            if re.search(r"openPanelOnActionIconClick", src):
                errors.append(f"typo openPanelOnActionIconClick in {rel}")
            if re.search(r"(chrome|browser)\.windows\.query\(", src):
                errors.append(f"windows.query() does not exist ({rel})")
            if re.search(r"https?://[^'\"\s]+\.js['\"]", src) and re.search(
                r"(importScripts|import\(|createElement\(['\"]script)", src
            ):
                warnings.append(f"possible remote script load in {rel}")
            if re.search(r"\beval\(|new Function\(", src) and rel not in sandbox_pages:
                warnings.append(
                    f"eval/new Function in {rel} (blocked by extension CSP outside sandbox pages)"
                )
        elif f.suffix in {".html", ".htm"}:
            html = f.read_text(encoding="utf-8", errors="ignore")
            if rel in sandbox_pages and sandbox_inline_ok:
                continue  # sandbox pages may use inline script and handlers
            if re.search(r"<script(?![^>]*\bsrc=)[^>]*>\s*\S", html, re.I):
                errors.append(f"inline <script> in {rel}")
            if re.search(r"\son[a-z]+\s*=\s*['\"]", html, re.I):
                errors.append(f"inline event handler in {rel}")
        elif f.name in {".env"} or f.suffix in {".pem", ".key"}:
            warnings.append(f"sensitive file in package: {rel}")
        elif f.suffix == ".map":
            warnings.append(f"source map in package: {rel}")
    if uses_action_api and "action" not in m:
        errors.append('chrome.action used but manifest has no "action" key')
    if "side_panel" in m and "sidePanel" not in perms:
        errors.append("side_panel declared without 'sidePanel' permission")
    return {"errors": errors, "warnings": warnings}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    res = check(Path(sys.argv[1]))
    if "--json" in sys.argv:
        print(json.dumps(res, indent=2))
    else:
        for e in res["errors"]:
            print("ERROR", e)
        for w in res["warnings"]:
            print("WARN ", w)
        print(f"{len(res['errors'])} error(s), {len(res['warnings'])} warning(s)")
    sys.exit(1 if res["errors"] else 0)
