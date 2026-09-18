from __future__ import annotations

import argparse
import difflib
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass
from typing import Any, Iterable

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
    def __init__(self, binary: str | None = None) -> None:
        self.binary = binary or os.environ.get("SMX_BACKEND", "spacemolt")

    def run(self, args: list[str], *, json_output: bool = False) -> BackendResult:
        command = [self.binary, *args]
        if json_output and "--json" not in args:
            command.append("--json")
        env = os.environ.copy()
        env.setdefault("NO_COLOR", "1")
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
    commands.update({"nearby", "near", "sell-all", "sellall", "missions"})
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


def print_help() -> None:
    print(
        """smx — ergonomic companion shell for the official SpaceMolt v2 CLI

Usage:
  smx <command> [args...]        pass through to `spacemolt`
  smx nearby [--json]           visible-threat summary from get_nearby
  smx missions [--json]         active + available missions
  smx sell-all [options]        sell current cargo through v2

Conveniences:
  status, ship, cargo, system, poi, map, skills, notifications
  kebab-case is accepted: get-map -> get_map
  failed typo commands get fuzzy suggestions, never auto-executed

sell-all options:
  --dry-run                     preview only
  --keep ITEM[,ITEM...]         exclude cargo IDs (repeatable)
  --json                        machine-readable aggregate output

Environment:
  SMX_BACKEND=/path/to/spacemolt  override the official client executable
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
    if not argv or argv[0] in {"-h", "--help", "help"} and len(argv) == 1:
        print_help()
        return 0

    backend = Backend()
    command = argv[0]
    rest = argv[1:]
    if command in {"nearby", "near"}:
        return cmd_nearby(backend, rest)
    if command in {"sell-all", "sellall"}:
        return cmd_sell_all(backend, rest)
    if command == "missions":
        return cmd_missions(backend, rest)
    return _passthrough(backend, argv)


if __name__ == "__main__":
    raise SystemExit(main())
