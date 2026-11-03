"""Official v2 surface smx reads. Checked against live OpenAPI by smx.yml.

Names only, not a second API model: one line per field smx depends on.
Exit codes: 0 clean, 1 drift, 2 spec unavailable (never treated as drift).
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.request
from typing import Any

from . import __version__

SPEC_URL = "https://game.spacemolt.com/api/v2/openapi.json"
API_PREFIX = "/api/v2/"
MAX_DEPTH = 8

CONTRACT: dict[str, dict[str, tuple[str, ...]]] = {
    "spacemolt/get_status": {
        "response": (
            "location.in_transit", "location.docked_at", "location.poi_id", "location.poi_name",
            "location.system_id", "location.system_name",
            "location.nearby_pirate_count", "location.nearby_leviathans[].aggressive",
            "queue.has_pending",
            "ship.incapacitated", "ship.hull", "ship.max_hull", "ship.shield", "ship.max_shield",
            "ship.fuel", "ship.max_fuel", "ship.cargo_used", "ship.cargo_capacity",
            "player.id", "player.username", "player.credits",
        ),
    },
    "spacemolt/get_cargo": {"response": ("cargo[].item_id", "cargo[].item_name", "cargo[].quantity")},
    "spacemolt/get_notifications": {
        "request": ("clear", "limit"),
        "response": (
            "notifications[].type", "notifications[].msg_type", "notifications[].data",
            "remaining", "retry_after", "throttled",
        ),
    },
    "spacemolt_market/view_market": {
        "response": (
            "base", "base_id", "items[].item_id", "items[].item_name", "items[].best_buy", "items[].best_sell",
        ),
    },
    "spacemolt_market/estimate_purchase": {
        "request": ("item_id", "quantity"),
        "response": ("available", "total_cost", "unfilled"),
    },
    "spacemolt/get_nearby": {
        "response": (
            "nearby[].username", "nearby[].player_id",
            "nearby[].in_combat", "nearby[].offline", "nearby[].ship_class",
            "pirates[].pirate_id", "pirates[].is_boss", "pirates[].tier",
            "empire_npcs[].name", "arena_npcs[].name", "creatures[].name", "prizes[].actor_id",
            "unknown_signature",
        ),
    },
    "spacemolt/get_missions": {},
    "spacemolt/get_active_missions": {},
    "spacemolt/get_guide": {"request": ("id",)},
    "spacemolt/find_route": {
        "request": ("id",),
        "response": (
            "found", "total_jumps", "fuel_available", "estimated_fuel", "fuel_per_jump",
            "route[].system_id", "route[].jumps", "route[].via_wormhole", "route[].entrance_poi",
            "fleet_fuel[].fuel_available", "fleet_fuel[].estimated_fuel",
            "fleet_fuel[].can_complete", "fleet_fuel[].username",
            "target_poi", "target_poi_name",
        ),
    },
    "spacemolt/get_system": {
        "response": (
            "system.id", "system.name", "system.pois[].id", "system.pois[].name",
            "system.pois[].has_base", "system.pois[].base_id", "system.pois[].base_name",
            "active_battle.participants[].player_id",
        ),
    },
    "spacemolt/get_poi": {
        "response": ("poi.id", "base.id", "base.public_access", "base.wrecked", "active_battle"),
    },
    "spacemolt/sell": {"request": ("id", "quantity"), "response": ("details.quantity_sold",)},
    "spacemolt/buy": {"request": ("id", "quantity")},
    "spacemolt/refuel": {},
    "spacemolt/jump": {},
    "spacemolt/attack": {},
    "spacemolt/jettison": {},
    "spacemolt/self_destruct": {},
    "spacemolt/undock": {},
    "spacemolt_ship/scrap_ship": {},
    "spacemolt/travel": {"request": ("id",)},
    "spacemolt/dock": {},
    "spacemolt/distress_signal": {"request": ("distress_type",)},
    "spacemolt_battle/status": {
        "response": (
            "is_participant", "combat_state.can_escape", "combat_state.warp_disrupted",
            "combat_state.intercepted", "combat_state.incapacitated",
            "combat_state.flee_counter", "combat_state.flee_required",
        ),
    },
    "spacemolt_battle/stance": {"request": ("id",)},
}


def _resolve(spec: dict[str, Any], node: Any, seen: frozenset[str]) -> tuple[Any, frozenset[str]]:
    while isinstance(node, dict) and "$ref" in node:
        ref = node["$ref"]
        if ref in seen:
            return {}, seen
        seen |= {ref}
        target: Any = spec
        for part in ref.removeprefix("#/").split("/"):
            target = target.get(part, {}) if isinstance(target, dict) else {}
        node = target
    return node, seen


def _walk(spec: dict[str, Any], node: Any, prefix: str, out: set[str],
          seen: frozenset[str] = frozenset(), depth: int = 0) -> None:
    if depth > MAX_DEPTH:
        return
    node, seen = _resolve(spec, node, seen)
    if not isinstance(node, dict):
        return
    for keyword in ("allOf", "oneOf", "anyOf"):
        for branch in node.get(keyword, []):
            _walk(spec, branch, prefix, out, seen, depth)
    if "items" in node:
        _walk(spec, node["items"], f"{prefix}[]", out, seen, depth + 1)
    properties = node.get("properties")
    if isinstance(properties, dict):
        for name, value in properties.items():
            path = f"{prefix}.{name}" if prefix else name
            out.add(path)
            _walk(spec, value, path, out, seen, depth + 1)


def _json_schema(spec: dict[str, Any], holder: Any) -> Any:
    holder, _ = _resolve(spec, holder, frozenset())
    if not isinstance(holder, dict):
        return {}
    return holder.get("content", {}).get("application/json", {}).get("schema", {})


def request_fields(spec: dict[str, Any], operation: dict[str, Any]) -> set[str]:
    fields: set[str] = set()
    _walk(spec, _json_schema(spec, operation.get("requestBody")), "", fields)
    return fields


def response_fields(spec: dict[str, Any], operation: dict[str, Any]) -> set[str]:
    """Fields of the payload smx unwraps: structuredContent of the 200 envelope."""
    fields: set[str] = set()
    _walk(spec, _json_schema(spec, operation.get("responses", {}).get("200")), "", fields)
    marker = "structuredContent."
    return {field.removeprefix(marker) for field in fields if field.startswith(marker)}


def find_drift(spec: dict[str, Any]) -> list[str]:
    drift: list[str] = []
    paths = spec["paths"]
    for command, needs in CONTRACT.items():
        item = paths.get(f"{API_PREFIX}{command}")
        operation = item.get("post") if isinstance(item, dict) else None
        if not isinstance(operation, dict):
            drift.append(f"{command}: endpoint removed")
            continue
        if needs.get("request"):
            have = request_fields(spec, operation)
            drift.extend(f"{command}: request field `{name}` removed"
                         for name in needs["request"] if name not in have)
        if needs.get("response"):
            have = response_fields(spec, operation)
            drift.extend(f"{command}: response field `{name}` removed"
                         for name in needs["response"] if name not in have)
    return drift


def fetch_spec() -> dict[str, Any]:
    request = urllib.request.Request(SPEC_URL, headers={"User-Agent": f"spacemolt-smx/{__version__}"})
    # Fixed https constant above; no caller-supplied scheme.
    with urllib.request.urlopen(request, timeout=60) as response:  # skipcq: BAN-B310
        return json.load(response)


def load_spec(path: str | None = None) -> dict[str, Any]:
    if path:
        with open(path, encoding="utf-8") as handle:
            spec = json.load(handle)
    else:
        spec = fetch_spec()
    if not isinstance(spec, dict) or not isinstance(spec.get("paths"), dict):
        raise ValueError("spec has no paths object")
    return spec


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m smx.contract", description=__doc__)
    parser.add_argument("--spec", help="local OpenAPI file instead of the live spec")
    ns = parser.parse_args(argv)
    try:
        spec = load_spec(ns.spec)
    except (OSError, ValueError) as exc:
        print(f"spec unavailable: {exc}", file=sys.stderr)
        return 2

    drift = find_drift(spec)
    if drift:
        print(f"Live SpaceMolt OpenAPI no longer matches smx ({len(drift)}):\n")
        print("\n".join(f"- {line}" for line in drift))
        return 1
    fields = sum(len(names) for needs in CONTRACT.values() for names in needs.values())
    print(f"contract clean: {len(CONTRACT)} commands, {fields} fields")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
