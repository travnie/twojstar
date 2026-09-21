from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any


@dataclass
class FleetStatus:
    profile: str
    ok: bool
    player: str = "-"
    ship: str = "-"
    location: str = "-"
    fuel: int | float | None = None
    max_fuel: int | float | None = None
    cargo_used: int | float | None = None
    cargo_capacity: int | float | None = None
    credits: int | float | None = None
    docked: bool = False
    state: str = "unknown"
    error: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def _canonical_status(node: Any) -> dict[str, Any] | None:
    if isinstance(node, dict):
        if any(key in node for key in ("player", "ship", "location")):
            player = node.get("player")
            ship = node.get("ship")
            location = node.get("location")
            if isinstance(player, dict) or isinstance(ship, dict) or isinstance(location, dict):
                return node

        for key in ("structuredContent", "structured_content", "result", "content", "data"):
            if key in node:
                found = _canonical_status(node[key])
                if found is not None:
                    return found
        for value in node.values():
            if isinstance(value, (dict, list)):
                found = _canonical_status(value)
                if found is not None:
                    return found
    elif isinstance(node, list):
        for value in node:
            found = _canonical_status(value)
            if found is not None:
                return found
    return None


def _text(node: dict[str, Any], *keys: str) -> str | None:
    for key in keys:
        value = node.get(key)
        if isinstance(value, str) and value:
            return value
    return None


def _number(node: dict[str, Any], *keys: str) -> int | float | None:
    for key in keys:
        value = node.get(key)
        if isinstance(value, bool):
            continue
        if isinstance(value, (int, float)):
            return value
    return None


def _is_docked(location: dict[str, Any], ship: dict[str, Any]) -> bool:
    docked = location.get("docked")
    if isinstance(docked, bool):
        return docked
    docked = ship.get("docked")
    if isinstance(docked, bool):
        return docked
    return bool(_text(location, "docked_at", "station_id", "base_id"))


def _state(location: dict[str, Any], ship: dict[str, Any], docked: bool) -> str:
    if docked:
        return "docked"
    for key, label in (
        ("jumping", "jumping"),
        ("in_jump", "jumping"),
        ("traveling", "traveling"),
        ("in_transit", "traveling"),
    ):
        if location.get(key) is True or ship.get(key) is True:
            return label
    status = _text(location, "state", "status") or _text(ship, "state", "status")
    return status or "space"


def status_from_payload(profile: str, payload: Any) -> FleetStatus:
    content = _canonical_status(payload)
    if content is None:
        return FleetStatus(profile=profile, ok=False, error="status payload has no canonical player/ship/location data")

    player = content.get("player") if isinstance(content.get("player"), dict) else {}
    ship = content.get("ship") if isinstance(content.get("ship"), dict) else {}
    location = content.get("location") if isinstance(content.get("location"), dict) else {}

    system = _text(location, "system_name", "system_id")
    poi = _text(location, "poi_name", "poi_id")
    where = "/".join(part for part in (system, poi) if part) or "-"

    docked = _is_docked(location, ship)
    return FleetStatus(
        profile=profile,
        ok=True,
        player=_text(player, "username", "name", "id", "player_id") or "-",
        ship=_text(ship, "name", "class_id", "id", "ship_id") or "-",
        location=where,
        fuel=_number(ship, "fuel"),
        max_fuel=_number(ship, "max_fuel", "fuel_capacity"),
        cargo_used=_number(ship, "cargo_used", "cargo"),
        cargo_capacity=_number(ship, "cargo_capacity", "max_cargo"),
        credits=_number(player, "credits"),
        docked=docked,
        state=_state(location, ship, docked),
    )


def error_status(profile: str, message: str) -> FleetStatus:
    return FleetStatus(profile=profile, ok=False, state="error", error=message.strip() or "unknown backend error")


def fleet_check_ok(rows: list[FleetStatus]) -> bool:
    return bool(rows) and all(row.ok and row.docked for row in rows)


def _ratio(value: int | float | None, maximum: int | float | None) -> str:
    if value is None and maximum is None:
        return "-"
    if maximum is None:
        return str(value)
    return f"{value if value is not None else '-'}/{maximum}"


def render_fleet(rows: list[FleetStatus]) -> str:
    headers = ("PROFILE", "PLAYER", "SHIP", "LOCATION", "FUEL", "CARGO", "CR", "STATE")
    body: list[tuple[str, ...]] = []
    for row in rows:
        body.append(
            (
                row.profile,
                row.player,
                row.ship,
                row.location,
                _ratio(row.fuel, row.max_fuel),
                _ratio(row.cargo_used, row.cargo_capacity),
                str(row.credits) if row.credits is not None else "-",
                row.state if row.ok else f"error: {row.error}",
            )
        )

    widths = [len(header) for header in headers]
    for record in body:
        for index, value in enumerate(record):
            widths[index] = max(widths[index], len(value))

    def line(record: tuple[str, ...]) -> str:
        return "  ".join(value.ljust(widths[index]) for index, value in enumerate(record)).rstrip()

    lines = [line(headers)]
    lines.extend(line(record) for record in body)
    return "\n".join(lines)
