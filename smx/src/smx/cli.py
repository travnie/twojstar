from __future__ import annotations

import argparse
import difflib
import getpass
import json
import os
import re
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from typing import Any, Iterable

from .fleet import error_status, fleet_check_ok, render_fleet, status_from_payload
from .knowledge import GUIDES, guide_json, list_guides, load_guide, search_guides
from .mcp_profiles import PROFILES, profiles_json
from .paths import ensure_private_state_dir, managed_backend_path, resolve_backend, state_dir
from .profiles import (
    add_profile,
    canonical_profile,
    default_profile,
    list_profiles,
    migrate_legacy_session,
    remove_profile,
    selected_session_path,
    set_default_profile,
)

ANSI_RE = re.compile(r"\x1b\[[0-?]*[ -/]*[@-~]")
ALIASES = {
    "status": "get_status",
    "state": "get_status",
    "ship": "get_ship",
    "cargo": "get_cargo",
    "system": "get_system",
    "poi": "get_poi",
    "map": "get_map",
    "skills": "get_skills",
    "notifications": "get_notifications",
}


@dataclass
class BackendResult:
    returncode: int
    stdout: str
    stderr: str


class Backend:
    def __init__(self, binary: str | None = None, profile: str | None = None) -> None:
        self.binary = resolve_backend(binary)
        self.profile = canonical_profile(profile) if profile else None

    def run(self, args: list[str], *, json_output: bool = False) -> BackendResult:
        command = [self.binary, *args]
        if json_output and "--json" not in args:
            command.append("--json")
        env = os.environ.copy()
        env.setdefault("NO_COLOR", "1")
        if "SPACEMOLT_SESSION" not in env:
            session = selected_session_path(self.profile, env)
            ensure_private_state_dir(session.parent)
            env["SPACEMOLT_SESSION"] = str(session)
        try:
            proc = subprocess.run(command, capture_output=True, text=True, env=env, check=False)
        except FileNotFoundError:
            return BackendResult(
                127,
                "",
                f"smx: SpaceMolt v2 CLI not found: {self.binary!r}. Install SpaceMolt/client-v2 "
                "or set SMX_BACKEND to its executable path.\n",
            )
        return BackendResult(proc.returncode, proc.stdout, proc.stderr)

    def json(self, args: list[str]) -> tuple[BackendResult, Any | None]:
        result = self.run(args, json_output=True)
        if not result.stdout.strip():
            return result, None
        try:
            return result, json.loads(result.stdout)
        except json.JSONDecodeError:
            return result, None


def normalize_command(command: str) -> str:
    if command.startswith("-"):
        return command
    if "/" in command:
        group, action = command.split("/", 1)
        return f"{group.replace('-', '_')}/{action.replace('-', '_')}"
    return command.replace("-", "_")


def strip_ansi(text: str) -> str:
    return ANSI_RE.sub("", text)


def parse_help_commands(text: str) -> set[str]:
    commands: set[str] = set()
    for line in strip_ansi(text).splitlines():
        match = re.match(r"^\s*([\w-]+):\s+(.+)$", line)
        if not match:
            continue
        group, raw_commands = match.groups()
        if group.lower() in {"usage", "examples", "flags", "help", "account"}:
            continue
        for token in raw_commands.split(","):
            token = token.strip().split()[0]
            if not token:
                continue
            commands.add(token)
            if "/" not in token:
                commands.add(normalize_command(token))
    commands.update(ALIASES)
    commands.update({"nearby", "near", "sell-all", "sellall", "missions", "guide", "mcp", "paths", "profile", "profiles", "fleet"})
    return commands


def suggest(command: str, choices: Iterable[str]) -> list[str]:
    normalized = normalize_command(command)
    normalized_choices = sorted(set(choices))
    return difflib.get_close_matches(normalized, normalized_choices, n=3, cutoff=0.62)


def _first_list(node: Any, keys: tuple[str, ...]) -> list[Any] | None:
    if isinstance(node, dict):
        for key in keys:
            value = node.get(key)
            if isinstance(value, list):
                return value
            if isinstance(value, dict):
                nested = value.get("items")
                if isinstance(nested, list):
                    return nested
        for value in node.values():
            found = _first_list(value, keys)
            if found is not None:
                return found
    elif isinstance(node, list):
        for value in node:
            found = _first_list(value, keys)
            if found is not None:
                return found
    return None


def _item_id(item: dict[str, Any]) -> str | None:
    for key in ("item_id", "type_id", "id", "item"):
        value = item.get(key)
        if isinstance(value, str) and value:
            return value
    return None


def _quantity(item: dict[str, Any]) -> int:
    for key in ("quantity", "qty", "count", "amount"):
        value = item.get(key)
        if isinstance(value, bool):
            continue
        if isinstance(value, (int, float)):
            return int(value)
        if isinstance(value, str) and value.isdigit():
            return int(value)
    return 0


def extract_cargo_items(payload: Any) -> list[tuple[str, int]]:
    rows = _first_list(payload, ("cargo", "items")) or []
    found: dict[str, int] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        item_id = _item_id(row)
        quantity = _quantity(row)
        if not item_id or quantity <= 0:
            continue
        if row.get("tradable") is False or row.get("sellable") is False or row.get("quest_item") is True:
            continue
        found[item_id] = max(found.get(item_id, 0), quantity)
    return sorted(found.items())


def _entity_rows(payload: Any) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    seen: set[str] = set()

    def visit(node: Any) -> None:
        if isinstance(node, dict):
            for key in ("players", "npcs", "creatures", "prizes", "entities", "nearby"):
                value = node.get(key)
                if isinstance(value, list):
                    for entry in value:
                        if not isinstance(entry, dict):
                            continue
                        entity_id = str(entry.get("id") or entry.get("player_id") or entry.get("actor_id") or id(entry))
                        if entity_id not in seen:
                            seen.add(entity_id)
                            result.append(entry)
            for value in node.values():
                if isinstance(value, (dict, list)):
                    visit(value)
        elif isinstance(node, list):
            for value in node:
                visit(value)

    visit(payload)
    return result


def _weapon_count(entity: dict[str, Any]) -> int:
    for key in ("weapon_count", "weapons_count", "guns"):
        value = entity.get(key)
        if isinstance(value, int):
            return max(0, value)
    weapons = entity.get("weapons")
    if isinstance(weapons, list):
        return len(weapons)
    return 0


def assess_threat(entity: dict[str, Any]) -> tuple[int, str, list[str]]:
    score = 0
    reasons: list[str] = []
    kind = str(entity.get("kind") or entity.get("type") or "").lower()
    text = " ".join(str(entity.get(k, "")) for k in ("name", "ship", "ship_class", "class", "role")).lower()

    if "pirate" in kind or "pirate" in text:
        score += 3
        reasons.append("pirate")
    if entity.get("in_combat") is True:
        score += 2
        reasons.append("in combat")
    weapons = _weapon_count(entity)
    if weapons:
        score += min(3, weapons)
        reasons.append(f"{weapons} weapon{'s' if weapons != 1 else ''}")
    if any(word in text for word in ("combat", "fighter", "gunship", "bomber", "warship", "raider")):
        score += 2
        reasons.append("combat hull")

    danger = entity.get("danger") or entity.get("danger_level")
    if isinstance(danger, (int, float)):
        score += min(4, max(0, int(danger) // 2))
        reasons.append(f"danger {danger}")

    if score >= 7:
        marker = "☠️"
    elif score >= 4:
        marker = "🟥"
    elif score >= 2:
        marker = "🟧"
    elif score == 1:
        marker = "🟨"
    else:
        marker = "⬜"
    return score, marker, reasons


def _entity_name(entity: dict[str, Any]) -> str:
    return str(entity.get("name") or entity.get("username") or entity.get("id") or entity.get("player_id") or "unknown")


def cmd_nearby(backend: Backend, argv: list[str]) -> int:
    parser = argparse.ArgumentParser(prog="smx nearby", add_help=True)
    parser.add_argument("--json", action="store_true")
    ns = parser.parse_args(argv)

    result, payload = backend.json(["get_nearby"])
    if result.returncode != 0 or payload is None:
        sys.stderr.write(result.stderr or result.stdout)
        return result.returncode or 1

    assessments = []
    for entity in _entity_rows(payload):
        score, marker, reasons = assess_threat(entity)
        assessments.append({"name": _entity_name(entity), "score": score, "marker": marker, "reasons": reasons, "entity": entity})
    assessments.sort(key=lambda row: row["score"], reverse=True)

    if ns.json:
        print(json.dumps({"assessment": assessments, "source": payload}, indent=2, ensure_ascii=False))
        return 0

    if not assessments:
        print("No visible nearby actors.")
        return 0
    for row in assessments:
        entity = row["entity"]
        kind = entity.get("kind") or entity.get("type") or "actor"
        ship = entity.get("ship_class") or entity.get("ship") or entity.get("class")
        details = ", ".join(row["reasons"]) or "no visible threat signals"
        suffix = f" · {ship}" if ship else ""
        print(f"{row['marker']} {row['name']} [{kind}]{suffix} · {details}")
    print("\nHeuristic only; SpaceMolt live data remains authoritative. Use `smx scan <id>` for more detail.")
    return 0


def cmd_missions(backend: Backend, argv: list[str]) -> int:
    parser = argparse.ArgumentParser(prog="smx missions", add_help=True)
    parser.add_argument("--json", action="store_true")
    ns = parser.parse_args(argv)

    active_result, active = backend.json(["get_active_missions"])
    available_result, available = backend.json(["get_missions"])
    if active_result.returncode != 0:
        sys.stderr.write(active_result.stderr or active_result.stdout)
        return active_result.returncode
    if available_result.returncode != 0:
        sys.stderr.write(available_result.stderr or available_result.stdout)
        return available_result.returncode

    combined = {"active": active, "available": available}
    if ns.json:
        print(json.dumps(combined, indent=2, ensure_ascii=False))
    else:
        print("ACTIVE MISSIONS")
        print(json.dumps(active, indent=2, ensure_ascii=False))
        print("\nAVAILABLE MISSIONS")
        print(json.dumps(available, indent=2, ensure_ascii=False))
    return 0


def cmd_sell_all(backend: Backend, argv: list[str]) -> int:
    parser = argparse.ArgumentParser(prog="smx sell-all", add_help=True)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--keep", action="append", default=[], metavar="ITEM[,ITEM...]")
    parser.add_argument("--json", action="store_true")
    ns = parser.parse_args(argv)

    keep = {part.strip() for value in ns.keep for part in value.split(",") if part.strip()}
    cargo_result, cargo = backend.json(["get_cargo"])
    if cargo_result.returncode != 0 or cargo is None:
        sys.stderr.write(cargo_result.stderr or cargo_result.stdout)
        return cargo_result.returncode or 1

    items = [(item_id, qty) for item_id, qty in extract_cargo_items(cargo) if item_id not in keep]
    if not items:
        if ns.json:
            print(json.dumps({"sold": [], "skipped": sorted(keep), "message": "No sellable cargo found."}))
        else:
            print("No sellable cargo found.")
        return 0

    if ns.dry_run:
        if ns.json:
            print(json.dumps({"dry_run": True, "would_sell": [{"item_id": i, "quantity": q} for i, q in items]}, indent=2))
        else:
            for item_id, qty in items:
                print(f"would sell {item_id} × {qty}")
        return 0

    sold: list[dict[str, Any]] = []
    failed: list[dict[str, Any]] = []
    for item_id, qty in items:
        result, payload = backend.json(["sell", f"id={item_id}", f"quantity={qty}"])
        row = {"item_id": item_id, "quantity": qty, "response": payload}
        if result.returncode == 0:
            sold.append(row)
            if not ns.json:
                print(f"✓ sold {item_id} × {qty}")
        else:
            row["error"] = (result.stderr or result.stdout).strip()
            failed.append(row)
            if not ns.json:
                print(f"✗ {item_id} × {qty}: {row['error']}", file=sys.stderr)

    if ns.json:
        print(json.dumps({"sold": sold, "failed": failed, "kept": sorted(keep)}, indent=2, ensure_ascii=False))
    return 1 if failed else 0



def cmd_guide(backend: Backend, argv: list[str]) -> int:
    parser = argparse.ArgumentParser(prog="smx guide", add_help=True)
    parser.add_argument("topic", nargs="?")
    parser.add_argument("--list", action="store_true")
    parser.add_argument("--search", metavar="TEXT")
    parser.add_argument("--live", action="store_true")
    parser.add_argument("--json", action="store_true")
    ns = parser.parse_args(argv)

    if ns.list or (not ns.topic and not ns.search):
        guides = list_guides()
        if ns.json:
            print(json.dumps(guides, indent=2, ensure_ascii=False))
        else:
            for row in guides:
                live = f" · live: {row['live']}" if row["live"] else ""
                print(f"{row['topic']:<12} {row['summary']}{live}")
        return 0

    if ns.search:
        hits = search_guides(ns.search)
        if ns.json:
            print(json.dumps({"query": ns.search, "hits": hits}, indent=2, ensure_ascii=False))
        else:
            if not hits:
                print(f'No local guide hits for "{ns.search}".')
            for hit in hits:
                print(f"{hit['topic']}:{hit['line']}: {hit['text']}")
        return 0

    topic = str(ns.topic).casefold()
    if topic not in GUIDES:
        matches = difflib.get_close_matches(topic, sorted(GUIDES), n=3, cutoff=0.55)
        suffix = f" Did you mean: {', '.join(matches)}?" if matches else ""
        print(f'smx: unknown guide "{topic}".{suffix}', file=sys.stderr)
        return 2

    if ns.live:
        live_guide = GUIDES[topic]["live"]
        if not live_guide:
            print(f'smx: "{topic}" has no direct server guide; use the local card or live help.', file=sys.stderr)
            return 2
        result = backend.run(["get_guide", f"id={live_guide}"], json_output=ns.json)
        if result.stdout:
            sys.stdout.write(result.stdout)
        if result.stderr:
            sys.stderr.write(result.stderr)
        return result.returncode

    if ns.json:
        print(guide_json(topic))
    else:
        print(load_guide(topic))
    return 0




def _fleet_profile_status(profile: str):
    backend = Backend(profile=profile)
    result, payload = backend.json(["get_status"])
    if result.returncode != 0:
        return error_status(profile, result.stderr or result.stdout or f"backend exited {result.returncode}")
    if payload is None:
        return error_status(profile, "backend returned no JSON status payload")
    return status_from_payload(profile, payload)


def cmd_fleet(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(prog="smx fleet", add_help=True)
    parser.add_argument("action", nargs="?", choices=("status", "check"), default="status")
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--only-undocked", action="store_true")
    ns = parser.parse_args(argv)

    if os.environ.get("SPACEMOLT_SESSION"):
        print(
            "smx: fleet needs isolated profile sessions; unset SPACEMOLT_SESSION and use smx profiles.",
            file=sys.stderr,
        )
        return 2

    profile_rows = list_profiles()
    if not profile_rows:
        payload = {"ok": False, "profiles": [], "error": "no smx profiles configured"}
        if ns.json:
            print(json.dumps(payload, indent=2, ensure_ascii=False))
        else:
            print("No smx profiles configured.")
        return 1 if ns.action == "check" else 0

    rows_by_name = {}
    runnable = []
    for profile in profile_rows:
        name = str(profile["name"])
        if not profile.get("session"):
            rows_by_name[name] = error_status(name, "profile has no session")
        else:
            runnable.append(name)

    if runnable:
        workers = min(8, len(runnable))
        with ThreadPoolExecutor(max_workers=workers, thread_name_prefix="smx-fleet") as pool:
            futures = {pool.submit(_fleet_profile_status, name): name for name in runnable}
            for future in as_completed(futures):
                name = futures[future]
                try:
                    rows_by_name[name] = future.result()
                except Exception as exc:
                    rows_by_name[name] = error_status(name, f"status collection failed: {exc}")

    rows = [rows_by_name[str(profile["name"])] for profile in profile_rows]
    ok = fleet_check_ok(rows)
    shown = [row for row in rows if not row.docked or not row.ok] if ns.only_undocked else rows

    if ns.json:
        print(
            json.dumps(
                {"ok": ok, "profiles": [row.as_dict() for row in shown]},
                indent=2,
                ensure_ascii=False,
            )
        )
    else:
        if shown:
            print(render_fleet(shown))
        elif ns.only_undocked:
            print("All profiles are docked.")
        if ns.action == "check":
            docked = sum(1 for row in rows if row.ok and row.docked)
            print(f"\nfleet check: {docked}/{len(rows)} docked" + (" ✓" if ok else " ✗"))

    if ns.action == "check" and not ok:
        return 1
    return 0



def cmd_mcp(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(prog="smx mcp", add_help=True)
    parser.add_argument("profile", nargs="?", choices=sorted(PROFILES))
    parser.add_argument("--json", action="store_true")
    ns = parser.parse_args(argv)

    if ns.json:
        print(profiles_json(ns.profile))
        return 0

    if ns.profile:
        profile = PROFILES[ns.profile]
        role = "gameplay" if profile["runtime"] else "development only"
        print(f"{ns.profile}: {profile['endpoint']}")
        print(f"{profile['purpose']} ({role})")
        return 0

    print("gameplay  " + PROFILES["gameplay"]["endpoint"])
    print("          complete v2 MCP tool set for playing")
    print("docs      " + PROFILES["docs"]["endpoint"])
    print("          read-only contract docs for developing smx; not a gameplay dependency")
    return 0




def extract_global_profile(argv: list[str]) -> tuple[str | None, list[str]]:
    if not argv:
        return None, argv
    token = argv[0]
    if token in {"-p", "--profile"}:
        if len(argv) < 2:
            raise ValueError(f"{token} requires a profile name")
        return canonical_profile(argv[1]), argv[2:]
    if token.startswith("--profile="):
        return canonical_profile(token.split("=", 1)[1]), argv[1:]
    return None, argv


def cmd_profiles(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(prog="smx profiles", add_help=True)
    parser.add_argument("--json", action="store_true")
    ns = parser.parse_args(argv)
    rows = list_profiles()
    if ns.json:
        print(json.dumps(rows, indent=2, ensure_ascii=False))
        return 0
    if not rows:
        print("No smx profiles yet.")
        return 0
    for row in rows:
        marker = "*" if row["default"] else " "
        session = "session" if row["session"] else "empty"
        print(f"{marker} {row['name']:<16} {session}")
    return 0


def cmd_profile(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(prog="smx profile", add_help=True)
    sub = parser.add_subparsers(dest="action", required=True)

    add = sub.add_parser("add", help="create an isolated profile")
    add.add_argument("name")
    add.add_argument("--use", action="store_true", help="make it the default profile")

    use = sub.add_parser("use", help="set the default profile")
    use.add_argument("name")

    login = sub.add_parser("login", help="login into one isolated profile")
    login.add_argument("name")
    login.add_argument("username")
    login.add_argument("--use", action="store_true", help="make it the default profile")
    login.add_argument("--password-stdin", action="store_true")

    migrate = sub.add_parser("migrate", help="move the old flat session into a profile")
    migrate.add_argument("name")

    remove = sub.add_parser("remove", help="delete a profile and its session")
    remove.add_argument("name")
    remove.add_argument("--yes", action="store_true", help="confirm credential/session deletion")

    ns = parser.parse_args(argv)
    try:
        name = canonical_profile(ns.name)
    except ValueError as exc:
        print(f"smx: {exc}", file=sys.stderr)
        return 2

    if ns.action == "add":
        path = add_profile(name)
        if ns.use:
            set_default_profile(name)
        print(f"{name}: {path}")
        return 0

    if ns.action == "use":
        known = {row["name"] for row in list_profiles()}
        if name not in known:
            print(f'smx: profile "{name}" does not exist; run `smx profile add {name}` first.', file=sys.stderr)
            return 2
        set_default_profile(name)
        print(f"default profile: {name}")
        return 0

    if ns.action == "login":
        add_profile(name)
        if ns.password_stdin:
            password = sys.stdin.readline().rstrip("\r\n")
        else:
            password = getpass.getpass(f"SpaceMolt password for {ns.username}: ")
        if not password:
            print("smx: empty password refused.", file=sys.stderr)
            return 2
        backend = Backend(profile=name)
        result = backend.run(["login", ns.username, password])
        if result.stdout:
            sys.stdout.write(result.stdout)
        if result.stderr:
            sys.stderr.write(result.stderr)
        if result.returncode == 0 and ns.use:
            set_default_profile(name)
        return result.returncode

    if ns.action == "migrate":
        try:
            destination = migrate_legacy_session(name)
        except (ValueError, FileNotFoundError, FileExistsError) as exc:
            print(f"smx: {exc}", file=sys.stderr)
            return 2
        print(f"migrated legacy session -> {destination}")
        print(f"default profile: {name}")
        return 0

    if ns.action == "remove":
        if not ns.yes:
            print("smx: refusing to delete profile credentials without --yes.", file=sys.stderr)
            return 2
        try:
            remove_profile(name)
        except FileNotFoundError as exc:
            print(f"smx: {exc}", file=sys.stderr)
            return 2
        print(f"removed profile: {name}")
        return 0

    return 2


def cmd_paths(argv: list[str], profile: str | None = None) -> int:
    parser = argparse.ArgumentParser(prog="smx paths", add_help=True)
    parser.add_argument("--json", action="store_true")
    ns = parser.parse_args(argv)

    selected = profile or default_profile()
    payload = {
        "profile": selected,
        "state_dir": str(state_dir()),
        "session_file": str(selected_session_path(profile)),
        "managed_backend": str(managed_backend_path()),
        "resolved_backend": resolve_backend(),
    }
    if ns.json:
        print(json.dumps(payload, indent=2, ensure_ascii=False))
    else:
        print(f"profile   {payload['profile'] or '(legacy/default)'}")
        print(f"state     {payload['state_dir']}")
        print(f"session   {payload['session_file']}")
        print(f"backend   {payload['resolved_backend']}")
        print(f"managed   {payload['managed_backend']}")
    return 0


def print_help() -> None:
    print(
        """smx — ergonomic companion shell for the official SpaceMolt v2 CLI

Usage:
  smx [-p PROFILE] <command> [args...]  run with an isolated gameplay profile
  smx <command> [args...]               pass through to `spacemolt`
  smx nearby [--json]           visible-threat summary from get_nearby
  smx missions [--json]         active + available missions
  smx sell-all [options]        sell current cargo through v2
  smx guide [topic]             load a small local tactical card on demand
  smx mcp [gameplay|docs]       print canonical MCP endpoints and roles
  smx paths                      show backend, profile and state locations
  smx profiles                   list isolated gameplay profiles
  smx fleet [check]               show/check every gameplay profile
  smx profile <action>           add/use/login/migrate/remove profiles

Conveniences:
  status, ship, cargo, system, poi, map, skills, notifications
  kebab-case is accepted: get-map -> get_map
  failed typo commands get fuzzy suggestions, never auto-executed
  guide --search TEXT finds narrow advice without dumping every card

sell-all options:
  --dry-run                     preview only
  --keep ITEM[,ITEM...]         exclude cargo IDs (repeatable)
  --json                        machine-readable aggregate output

Environment:
  SMX_PROFILE=name                  choose the gameplay profile by default
  SMX_BACKEND=/path/to/spacemolt  override the official client executable
  SMX_STATE_DIR=/path/to/state      override smx private state directory
  SPACEMOLT_SESSION=/path/file.json override the official session file
"""
    )


def _passthrough(backend: Backend, argv: list[str]) -> int:
    command = normalize_command(argv[0])
    command = ALIASES.get(command, command)
    result = backend.run([command, *argv[1:]])
    if result.stdout:
        sys.stdout.write(result.stdout)
    if result.stderr:
        sys.stderr.write(result.stderr)
    if result.returncode == 0:
        return 0

    combined = f"{result.stdout}\n{result.stderr}".lower()
    if "unknown command" in combined or "unknown help topic" in combined:
        help_result = backend.run(["help"])
        candidates = parse_help_commands(help_result.stdout)
        matches = suggest(command, candidates)
        if matches:
            print(f"smx: did you mean {', '.join(matches)}?", file=sys.stderr)
    return result.returncode


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    try:
        profile, argv = extract_global_profile(argv)
    except ValueError as exc:
        print(f"smx: {exc}", file=sys.stderr)
        return 2
    if not argv or argv[0] in {"-h", "--help", "help"} and len(argv) == 1:
        print_help()
        return 0

    backend = Backend(profile=profile)
    command = argv[0]
    rest = argv[1:]
    if command in {"nearby", "near"}:
        return cmd_nearby(backend, rest)
    if command in {"sell-all", "sellall"}:
        return cmd_sell_all(backend, rest)
    if command == "missions":
        return cmd_missions(backend, rest)
    if command == "guide":
        return cmd_guide(backend, rest)
    if command == "mcp":
        return cmd_mcp(rest)
    if command == "fleet":
        return cmd_fleet(rest)
    if command == "paths":
        return cmd_paths(rest, profile)
    if command == "profiles":
        return cmd_profiles(rest)
    if command == "profile":
        return cmd_profile(rest)
    return _passthrough(backend, argv)


if __name__ == "__main__":
    raise SystemExit(main())
