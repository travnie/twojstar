"""Local conveniences over official commands: ID cache, inbox and dry-run previews.

The cache holds only what the official client already returned. It never
overrides live data and never rewrites a command.
"""
from __future__ import annotations

import argparse
import difflib
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Any, Callable

from .paths import ensure_private_state_dir, state_dir
from .profiles import default_profile, profile_dir
from .projection import unwrap_payload

CACHE_NAME = "ids.json"
MAX_IDS_PER_KIND = 500
MAX_MARKETS = 100
KINDS = ("system", "poi", "base", "item", "player")
REFRESH_COMMANDS = ("get_system", "get_cargo", "get_nearby", "spacemolt_market/view_market")

ALWAYS_SHOWN_TYPES = {"chat", "combat", "trade"}
HIGH_SIGNAL = re.compile(r"(?:^|[^a-z])(complete|completed|failed|failure|error|cancel|cancelled|refund)(?:[^a-z]|$)", re.I)

RISK_NOTES = {
    "attack": ["Starts a fight. Check police_level and escape options first."],
    "buy": ["auto_list=true may create a buy order and charge a listing fee for the unfilled part."],
    "jettison": ["Dumps cargo into space. Mid-flight cargo is lost."],
    "jump": ["Spends fuel and time. Run `smx route` first."],
    "scrap_ship": ["Permanently destroys a stored ship."],
    "self_destruct": ["Destroys the active ship and leaves a wreck."],
    "sell": ["auto_list=true may create a sell order and charge a listing fee for the unsold part."],
    "undock": ["Leaves station protection. Run `smx survive` and check fuel first."],
}


def cache_path(profile: str | None = None) -> Path:
    name = profile or default_profile()
    return (profile_dir(name) if name else state_dir()) / CACHE_NAME


def load_cache(profile: str | None = None) -> dict[str, Any]:
    try:
        payload = json.loads(cache_path(profile).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        payload = None
    if not isinstance(payload, dict):
        payload = {}
    ids = payload.get("ids")
    markets = payload.get("markets")
    return {"ids": ids if isinstance(ids, dict) else {}, "markets": markets if isinstance(markets, dict) else {}}


def save_cache(cache: dict[str, Any], profile: str | None = None) -> None:
    path = cache_path(profile)
    ensure_private_state_dir(path.parent)
    temporary = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    try:
        temporary.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
        os.replace(temporary, path)
    except OSError:
        temporary.unlink(missing_ok=True)
        raise


def _newest(rows: dict[str, Any], limit: int) -> dict[str, Any]:
    ordered = sorted(rows.items(), key=lambda row: row[1].get("seen", 0) if isinstance(row[1], dict) else 0, reverse=True)
    return dict(ordered[:limit])


def _remember(cache: dict[str, Any], kind: str, entity_id: Any, name: Any, now: int) -> None:
    if isinstance(entity_id, str) and entity_id:
        cache["ids"].setdefault(kind, {})[entity_id] = {"name": name if isinstance(name, str) else entity_id, "seen": now}


def _rows(node: Any) -> list[dict[str, Any]]:
    return [row for row in node if isinstance(row, dict)] if isinstance(node, list) else []


def learn(cache: dict[str, Any], command: str, payload: Any, now: int) -> None:
    data = unwrap_payload(payload)
    if not isinstance(data, dict):
        return
    action = command.rsplit("/", 1)[-1]
    if action == "get_system":
        system = data.get("system")
        if isinstance(system, dict):
            _remember(cache, "system", system.get("id"), system.get("name"), now)
            for poi in _rows(system.get("pois")):
                _remember(cache, "poi", poi.get("id"), poi.get("name"), now)
                _remember(cache, "base", poi.get("base_id"), poi.get("base_name"), now)
    elif action == "get_cargo":
        for row in _rows(data.get("cargo")):
            _remember(cache, "item", row.get("item_id"), row.get("item_name"), now)
    elif action == "get_nearby":
        for row in _rows(data.get("nearby")):
            _remember(cache, "player", row.get("player_id"), row.get("username"), now)
    elif action == "view_market":
        items: dict[str, Any] = {}
        for row in _rows(data.get("items")):
            item_id = row.get("item_id")
            _remember(cache, "item", item_id, row.get("item_name"), now)
            if isinstance(item_id, str):
                items[item_id] = {key: row.get(key) for key in ("best_buy", "best_sell")}
        base_id = data.get("base_id")
        if isinstance(base_id, str) and base_id and items:
            cache["markets"][base_id] = {"name": data.get("base"), "seen": now, "items": items}


def refresh(backend: Any, cache: dict[str, Any], now: int) -> int:
    learned = 0
    for command in REFRESH_COMMANDS:
        result, payload = backend.json([command], timeout=20.0)
        if result.returncode == 0 and payload is not None:
            learn(cache, command, payload, now)
            learned += 1
    cache["ids"] = {kind: _newest(rows, MAX_IDS_PER_KIND) for kind, rows in cache["ids"].items()}
    cache["markets"] = _newest(cache["markets"], MAX_MARKETS)
    return learned


def _age(seen: Any, now: int) -> str:
    if not isinstance(seen, (int, float)):
        return "unknown age"
    minutes = max(0, int(now - seen)) // 60
    if minutes < 60:
        return f"{minutes}m ago"
    return f"{minutes // 60}h ago" if minutes < 2880 else f"{minutes // 1440}d ago"


def cmd_ids(backend: Any, argv: list[str]) -> int:
    parser = argparse.ArgumentParser(prog="smx ids", description="IDs seen in official responses")
    parser.add_argument("kind", nargs="?", choices=KINDS)
    parser.add_argument("--refresh", action="store_true", help="query the current system, cargo, nearby and market")
    parser.add_argument("--search", metavar="TEXT", help="filter by ID or name")
    parser.add_argument("--json", action="store_true")
    ns = parser.parse_args(argv)

    profile = getattr(backend, "profile", None)
    cache = load_cache(profile)
    now = int(time.time())
    if ns.refresh:
        if not refresh(backend, cache, now):
            print("smx: no official query succeeded; cache unchanged.", file=sys.stderr)
            return 1
        save_cache(cache, profile)

    needle = (ns.search or "").casefold()
    rows = [
        {"kind": kind, "id": entity_id, "name": entry.get("name"), "seen": entry.get("seen")}
        for kind, entries in cache["ids"].items() if kind == (ns.kind or kind)
        for entity_id, entry in entries.items()
        if isinstance(entry, dict) and needle in f"{entity_id} {entry.get('name')}".casefold()
    ]
    rows.sort(key=lambda row: (row["kind"], row["id"]))
    if ns.json:
        print(json.dumps(rows, indent=2, ensure_ascii=False))
    elif not rows:
        print("No cached IDs. Run `smx ids --refresh`.")
    else:
        for row in rows:
            print(f"{row['kind']:<7} {row['id']}  {row['name']}  ({_age(row['seen'], now)})")
    return 0


def id_suggestions(profile: str | None, args: list[str]) -> list[str]:
    """Hints after a failed command. Printed only, never executed."""
    ids = load_cache(profile)["ids"]
    by_id = {
        entity_id: entry.get("name")
        for entries in ids.values() if isinstance(entries, dict)
        for entity_id, entry in entries.items() if isinstance(entry, dict)
    }
    by_name = {str(name).casefold(): entity_id for entity_id, name in by_id.items() if name}
    hints: list[str] = []
    for arg in args:
        value = arg.split("=", 1)[-1]
        if not value or value.startswith("-") or value.isdigit() or value in by_id:
            continue
        exact = by_name.get(value.casefold())
        matches = [exact] if exact else difflib.get_close_matches(value, list(by_id), n=3, cutoff=0.6)
        if matches:
            hints.append(f'smx: cached IDs close to "{value}": {", ".join(matches)} (not executed)')
    return hints


def cmd_where_can_i(backend: Any, argv: list[str]) -> int:
    parser = argparse.ArgumentParser(prog="smx where-can-i", description="Markets where you last saw an item")
    parser.add_argument("item", nargs="+", help="item ID or part of its name")
    parser.add_argument("--json", action="store_true")
    ns = parser.parse_args(argv)

    cache = load_cache(getattr(backend, "profile", None))
    needle = " ".join(ns.item).casefold()
    names = cache["ids"].get("item", {})
    wanted = {
        item_id for item_id, entry in names.items()
        if needle in item_id.casefold() or (isinstance(entry, dict) and needle in str(entry.get("name")).casefold())
    }
    now = int(time.time())
    rows: list[dict[str, Any]] = []
    for base_id, market in cache["markets"].items():
        if not isinstance(market, dict) or not isinstance(market.get("items"), dict):
            continue
        for item_id, prices in market["items"].items():
            if (item_id in wanted or needle in item_id.casefold()) and isinstance(prices, dict):
                rows.append({"item_id": item_id, "base_id": base_id, "base": market.get("name"),
                             "seen": market.get("seen"), **prices})
    rows.sort(key=lambda row: row["seen"] if isinstance(row["seen"], (int, float)) else 0, reverse=True)
    if ns.json:
        print(json.dumps(rows, indent=2, ensure_ascii=False))
    elif not rows:
        print("Not seen in a cached market. `smx ids --refresh` records the market while docked.")
    else:
        for row in rows:
            print(f"{row['item_id']} @ {row['base'] or row['base_id']} [{row['base_id']}]  "
                  f"best_buy={row['best_buy']} best_sell={row['best_sell']}  ({_age(row['seen'], now)})")
        print("Local observations only. Prices may be stale; recheck at the station.")
    return 0


def _notification_text(row: dict[str, Any]) -> str:
    data = row.get("data")
    if isinstance(data, dict):
        for key in ("message", "content", "text", "summary"):
            if isinstance(data.get(key), str) and data[key]:
                return data[key]
        return json.dumps(data, ensure_ascii=False)[:160]
    return str(data or row.get("msg_type") or "")


def cmd_inbox(backend: Any, argv: list[str]) -> int:
    parser = argparse.ArgumentParser(prog="smx inbox", description="Notifications with routine events collapsed")
    parser.add_argument("--peek", action="store_true", help="leave notifications in the queue")
    parser.add_argument("--all", action="store_true", help="print routine events too")
    parser.add_argument("--limit", type=int, metavar="N", help="1-100, official default 50")
    parser.add_argument("--json", action="store_true")
    ns = parser.parse_args(argv)
    if ns.limit is not None and not 1 <= ns.limit <= 100:
        parser.error("--limit must be between 1 and 100")

    command = ["get_notifications"]
    if ns.peek:
        command.append("clear=false")
    if ns.limit is not None:
        command.append(f"limit={ns.limit}")
    result, payload = backend.json(command, timeout=20.0)
    if result.returncode != 0 or payload is None:
        sys.stderr.write(result.stderr or result.stdout or "smx: get_notifications failed\n")
        return result.returncode or 1

    data = unwrap_payload(payload)
    data = data if isinstance(data, dict) else {}
    if data.get("throttled") is True:
        print(f"Throttled; retry after {data.get('retry_after', '?')}s.")
        return 0
    shown: list[dict[str, Any]] = []
    collapsed: dict[str, int] = {}
    for row in _rows(data.get("notifications")):
        kind = str(row.get("type") or "unknown")
        if ns.all or kind in ALWAYS_SHOWN_TYPES or HIGH_SIGNAL.search(_notification_text(row)):
            shown.append(row)
        else:
            collapsed[kind] = collapsed.get(kind, 0) + 1
    if ns.json:
        print(json.dumps({"shown": shown, "collapsed": collapsed, "remaining": data.get("remaining")},
                         indent=2, ensure_ascii=False))
        return 0
    for row in shown:
        print(f"[{row.get('type') or 'unknown'}] {_notification_text(row)}")
    if collapsed:
        print("collapsed: " + ", ".join(f"{count} {kind}" for kind, count in sorted(collapsed.items())))
    if not shown and not collapsed:
        print("No notifications.")
    if isinstance(data.get("remaining"), int) and data["remaining"] > 0:
        print(f"{data['remaining']} more queued.")
    return 0


def _named(args: list[str], *keys: str) -> str | None:
    for arg in args:
        key, separator, value = arg.partition("=")
        if separator and key in keys and value:
            return value
    return None


def _purchase_args(args: list[str]) -> tuple[str | None, str | None]:
    positional = [arg for arg in args if "=" not in arg]
    item = _named(args, "id", "item_id") or (positional[0] if positional else None)
    quantity = _named(args, "quantity") or (positional[1] if len(positional) > 1 else None)
    return item, quantity


def cmd_dry_run(backend: Any, command: str, args: list[str], read_only: Callable[[str, list[str]], bool]) -> int:
    """Print what would be sent. Only official read-only queries may run."""
    as_json = "--json" in args
    args = [arg for arg in args if arg != "--json"]
    action = command.rsplit("/", 1)[-1]
    is_read_only = read_only(command, args)
    report: dict[str, Any] = {
        "dry_run": True,
        "command": [command, *args],
        "read_only": is_read_only,
        "notes": list(RISK_NOTES.get(action, [])),
    }
    if action == "buy":
        item, quantity = _purchase_args(args)
        if item and quantity:
            result, payload = backend.json(
                ["spacemolt_market/estimate_purchase", f"item_id={item}", f"quantity={quantity}"], timeout=20.0)
            data = unwrap_payload(payload)
            if result.returncode == 0 and isinstance(data, dict):
                report["estimate"] = {key: data.get(key) for key in ("available", "total_cost", "unfilled")}
    if as_json:
        print(json.dumps(report, indent=2, ensure_ascii=False))
        return 0
    print("dry run, nothing sent: spacemolt " + " ".join(report["command"]))
    print("read-only query" if is_read_only else "may change game state")
    for note in report["notes"]:
        print(f"note: {note}")
    estimate = report.get("estimate")
    if estimate:
        print(f"estimate: total_cost={estimate['total_cost']} available={estimate['available']} "
              f"unfilled={estimate['unfilled']}")
    return 0
