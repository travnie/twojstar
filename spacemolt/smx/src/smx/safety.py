from __future__ import annotations

import argparse
import json
import time
from typing import Any

from .projection import unwrap_payload


def _data(backend: Any, command: list[str], *, timeout: float = 20.0) -> tuple[int, dict[str, Any] | None, str]:
    result, payload = backend.json(command, timeout=timeout)
    data = unwrap_payload(payload)
    if result.returncode or not isinstance(data, dict) or "error" in data:
        error = data.get("error") if isinstance(data, dict) else None
        detail = error.get("message") if isinstance(error, dict) else None
        return result.returncode or 1, None, str(detail or result.stderr or result.stdout or "missing JSON state").strip()
    return 0, data, ""


def _state(backend: Any, *, timeout: float = 20.0) -> tuple[int, dict[str, Any] | None, str]:
    return _data(backend, ["get_status"], timeout=timeout)


def _safe_state(data: dict[str, Any], *, poi: str | None = None) -> str | None:
    location = data.get("location")
    ship = data.get("ship")
    queue = data.get("queue")
    if not isinstance(location, dict) or not isinstance(ship, dict) or not isinstance(queue, dict):
        return "incomplete state"
    transit = location.get("in_transit", False)
    if transit is True:
        return "ship is in transit"
    if transit is not False:
        return "transit state is invalid or unknown"
    if queue.get("has_pending") is not False:
        return "action queue is pending or unknown"
    if ship.get("incapacitated") is not False:
        return "crew incapacitated or condition unknown"
    if not isinstance(location.get("poi_id"), str):
        return "current POI unknown"
    if poi is not None and location["poi_id"] != poi:
        return "ship is not at the planned POI"
    if "docked_at" not in location:
        return "docking state unknown"
    return None


def _emit(report: dict[str, Any], json_output: bool) -> None:
    if json_output:
        print(json.dumps(report, indent=2, ensure_ascii=False))
    else:
        print(f"Pilot safety: {report['status']}")
        if "combat" in report:
            print(f"  combat: {report['combat']}")
        if "hull" in report:
            for field, max_field in (("hull", "max_hull"), ("shield", "max_shield"),
                                     ("fuel", "max_fuel")):
                print(f"  {field}: {report.get(field)}/{report.get(max_field)}")
        escape = report.get("escape")
        if isinstance(escape, dict):
            print("  escape: " + ", ".join(f"{key}={value}" for key, value in escape.items()))
        for entry in report.get("messages", []):
            print(f"  {entry}")
        for action in report.get("suggestions", []):
            print(f"  suggestion: {action}")
        if report.get("destination"):
            print(f"  station: {report['destination']}")
        if report.get("actions"):
            print(f"  actions: {', '.join(report['actions'])}")


LOW_FUEL = 0.3  # heuristic, not a game rule


def _mark_unknown(report: dict[str, Any]) -> None:
    if report["status"] != "danger":
        report["status"] = "unknown"


def cmd_survive(backend: Any, argv: list[str]) -> int:
    parser = argparse.ArgumentParser(prog="smx survive", description="Read-only ship and combat triage")
    parser.add_argument("--check", action="store_true", help="nonzero on visible danger or incomplete state")
    parser.add_argument("--json", action="store_true")
    ns = parser.parse_args(argv)
    rc, data, error = _state(backend)
    report: dict[str, Any] = {
        "status": "unknown", "messages": [], "suggestions": [], "combat": "unknown",
    }
    if rc or data is None:
        report["messages"].append(f"state unavailable: {error}")
        _emit(report, ns.json)
        return rc or 1

    ship = data.get("ship")
    location = data.get("location")
    queue = data.get("queue")
    player = data.get("player")
    if not (isinstance(ship, dict) and isinstance(location, dict)
            and isinstance(queue, dict) and isinstance(player, dict)):
        report["messages"].append("incomplete canonical state")
        _emit(report, ns.json)
        return 1

    report["status"] = "ok"
    report["combat"] = "unknown"
    for stat in ("hull", "max_hull", "shield", "max_shield", "fuel", "max_fuel"):
        value = ship.get(stat)
        report[stat] = value if isinstance(value, int) and not isinstance(value, bool) else None
    for current, maximum, threshold in (("hull", "max_hull", 0.4), ("shield", "max_shield", 0.3)):
        a, b = report[current], report[maximum]
        if a is None or b is None or b <= 0:
            _mark_unknown(report)
            report["messages"].append(f"{current} condition unknown")
        elif a / b <= threshold:
            report["status"] = "danger"
            report["messages"].append(f"low {current}: {a}/{b} (heuristic)")
    if report["fuel"] is None or report["max_fuel"] is None:
        _mark_unknown(report)
        report["messages"].append("fuel condition unknown")
    elif report["fuel"] == 0:
        report["status"] = "danger"
        report["messages"].append("fuel empty")
        report["suggestions"].append("smx refuel" if location.get("docked_at")
                                     else "smx distress_signal distress_type=fuel")
    elif report["max_fuel"] > 0 and report["fuel"] / report["max_fuel"] <= LOW_FUEL:
        report["messages"].append(f"low fuel: {report['fuel']}/{report['max_fuel']} (heuristic)")
        if location.get("docked_at"):
            report["suggestions"].append("smx refuel")
        else:
            report["status"] = "danger"
            report["suggestions"].append("smx autodock")
    if ship.get("incapacitated") is True:
        report["status"] = "danger"
        report["messages"].append("crew incapacitated")
    elif ship.get("incapacitated") is not False:
        _mark_unknown(report)
        report["messages"].append("crew status unknown")
    if queue.get("has_pending") is True:
        report["messages"].append("an action is still pending")
    elif queue.get("has_pending") is not False:
        _mark_unknown(report)
        report["messages"].append("queue status unknown")
    if location.get("in_transit") is True:
        report["messages"].append("ship is in transit")
    pirates = location.get("nearby_pirate_count")
    if isinstance(pirates, int) and pirates > 0:
        report["messages"].append(f"{pirates} pirates at current POI (presence is not an attack)")
    leviathans = location.get("nearby_leviathans")
    if isinstance(leviathans, list):
        aggressive = len([creature for creature in leviathans
                          if isinstance(creature, dict) and creature.get("aggressive") is True])
        if aggressive:
            report["messages"].append(f"{aggressive} aggressive leviathans nearby")

    rc, system, error = _data(backend, ["get_system"])
    if rc or system is None:
        _mark_unknown(report)
        report["messages"].append(f"battle presence unknown: {error}")
    else:
        active = system.get("active_battle")
        player_id = player.get("id")
        members = active.get("participants") if isinstance(active, dict) else []
        if isinstance(active, dict) and (not isinstance(player_id, str) or not player_id):
            _mark_unknown(report)
            report["messages"].append("pilot identity unknown during active battle")
        elif isinstance(active, dict) and not isinstance(members, list):
            _mark_unknown(report)
            report["messages"].append("battle participants unknown")
        elif isinstance(player_id, str) and any(
                isinstance(row, dict) and row.get("player_id") == player_id for row in members):
            report["combat"] = "active"
            report["status"] = "danger"
            rc, battle, error = _data(backend, ["spacemolt_battle/status"])
            if rc or battle is None or battle.get("is_participant") is not True:
                report["messages"].append(f"battle tactics unavailable: {error or 'incomplete battle state'}")
            else:
                combat = battle.get("combat_state")
                if isinstance(combat, dict):
                    report["escape"] = {key: combat.get(key) for key in (
                        "can_escape", "warp_disrupted", "intercepted", "incapacitated",
                        "flee_counter", "flee_required"
                    )}
                    if combat.get("can_escape") is True:
                        report["suggestions"].append("smx spacemolt_battle/stance id=flee")
                        report["messages"].append("flee still requires combat ticks to escape")
                    else:
                        report["suggestions"].append("smx spacemolt_battle/stance id=brace")
                        report["messages"].append("escape blocked; check warp/intercept/crew flags")
                else:
                    report["messages"].append("combat blockers unknown")
        elif active is None:
            report["combat"] = "none"
        else:
            report["combat"] = "not_participating"

    _emit(report, ns.json)
    return int(ns.check and report["status"] != "ok")


def _stations(data: dict[str, Any]) -> list[dict[str, str]]:
    system = data.get("system")
    pois = system.get("pois") if isinstance(system, dict) else None
    if not isinstance(pois, list):
        return []
    found: list[dict[str, str]] = []
    for entry in pois:
        if (isinstance(entry, dict) and entry.get("has_base") is True
                and isinstance(entry.get("id"), str) and entry["id"]
                and isinstance(entry.get("base_id"), str) and entry["base_id"]):
            found.append({"poi": entry["id"], "base": entry["base_id"],
                          "name": str(entry.get("base_name") or entry.get("name") or entry["id"])})
    return found


def _valid_dock_poi(poi: dict[str, Any], target: str, expected_base: str) -> str | None:
    current = poi.get("poi")
    base = poi.get("base")
    if not isinstance(current, dict) or current.get("id") != target:
        return "station POI could not be verified"
    if not isinstance(base, dict) or not isinstance(base.get("id"), str):
        return "no station at current POI"
    if base["id"] != expected_base:
        return "station identity changed since chart lookup"
    if base.get("public_access") is not True:
        return "public station access not confirmed"
    if base.get("wrecked") is True:
        return "station is wrecked"
    if poi.get("active_battle") is not None:
        return "station POI is under attack"
    return None


def _backend_action(backend: Any, command: list[str], *, timeout: float) -> tuple[bool, str]:
    result = backend.run(command, json_output=True, timeout=timeout)
    return result.returncode == 0, (result.stderr or result.stdout or f"exit {result.returncode}").strip()


def cmd_autodock(backend: Any, argv: list[str]) -> int:
    parser = argparse.ArgumentParser(prog="smx autodock", description="Conservative same-system station docking")
    parser.add_argument("--target", help="charted station POI or base ID")
    parser.add_argument("--execute", action="store_true", help="allow travel/dock mutations")
    parser.add_argument("--max-wait", type=int, default=120, metavar="SECONDS",
                        help="maximum wait for an accepted travel action (0-300)")
    parser.add_argument("--json", action="store_true")
    ns = parser.parse_args(argv)
    if not 0 <= ns.max_wait <= 300:
        parser.error("--max-wait must be between 0 and 300")
    report: dict[str, Any] = {"status": "blocked", "destination": None, "actions": [],
                              "messages": [], "mode": "execute" if ns.execute else "preview"}

    def finish(status: str, message: str, code: int) -> int:
        report["status"] = status
        report["messages"].append(message)
        _emit(report, ns.json)
        return code

    rc, state, error = _state(backend)
    if rc or state is None:
        return finish("blocked", f"state unavailable: {error}", rc or 1)
    location = state.get("location")
    if not isinstance(location, dict):
        return finish("blocked", "location unavailable", 1)
    if isinstance(location.get("docked_at"), str) and location["docked_at"]:
        if ns.target and ns.target not in (location["docked_at"], location.get("poi_id")):
            return finish("blocked", "already docked at a different station", 1)
        return finish("docked", "already docked", 0)
    blocked = _safe_state(state)
    if blocked:
        return finish("blocked", blocked, 1)

    rc, chart, error = _data(backend, ["get_system"])
    if rc or chart is None:
        return finish("blocked", f"system chart unavailable: {error}", rc or 1)
    # Refuse movement when the system chart shows this pilot in a live battle.
    battle = chart.get("active_battle")
    player = state.get("player")
    if isinstance(battle, dict):
        participants = battle.get("participants")
        player_id = player.get("id") if isinstance(player, dict) else None
        if not isinstance(participants, list) or not isinstance(player_id, str):
            return finish("blocked", "cannot verify battle participation", 1)
        if any(isinstance(row, dict) and row.get("player_id") == player_id
               for row in participants):
            return finish("blocked", "pilot is in an active battle", 1)
    stations = _stations(chart)
    if not stations:
        return finish("blocked", "no charted station in this system", 1)
    if ns.target:
        matches = [s for s in stations if ns.target in (s["poi"], s["base"])]
    else:
        local = [s for s in stations if s["poi"] == location["poi_id"]]
        matches = local if local else stations
    if len(matches) != 1:
        report["messages"].append("Choose --target POI_ID when there are multiple stations")
        report["stations"] = stations
        return finish("blocked", "station selection ambiguous or not charted", 1)
    station = matches[0]
    target = station["poi"]
    report["destination"] = station
    moving = location["poi_id"] != target
    report["actions"] = ([f"travel id={target}"] if moving else []) + ["dock"]

    if not ns.execute:
        return finish("preview", "No mutations; add --execute to travel/dock", 0)

    if moving:
        rc, state, error = _state(backend)
        if rc or state is None or (blocked := _safe_state(state, poi=location["poi_id"])):
            return finish("blocked", f"pre-travel state changed: {blocked if state else error}", 1)
        ok, detail = _backend_action(backend, ["travel", f"id={target}"], timeout=90.0)
        if not ok:
            return finish("blocked", f"travel outcome uncertain or failed: {detail}; inspect state before retry", 1)
        deadline = time.monotonic() + ns.max_wait
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                return finish("in_transit", "Travel or queue may still be pending; rerun after it settles", 1)
            rc, state, error = _state(backend, timeout=min(20.0, remaining))
            if rc or state is None:
                return finish("blocked", f"post-travel state unavailable: {error}", 1)
            loc = state.get("location")
            que = state.get("queue")
            if not isinstance(loc, dict) or not isinstance(que, dict):
                return finish("blocked", "post-travel state incomplete", 1)
            transit = loc.get("in_transit", False)
            if transit is not True and transit is not False:
                return finish("blocked", "post-travel transit state invalid", 1)
            if transit is False and que.get("has_pending") is False:
                if loc.get("poi_id") != target:
                    return finish("blocked", "ship stopped at an unexpected POI", 1)
                break
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                return finish("in_transit", "Travel or queue still pending; rerun after it settles", 1)
            time.sleep(min(5.0, remaining))

    rc, poi, error = _data(backend, ["get_poi"])
    if rc or poi is None:
        return finish("blocked", f"station verification failed: {error}", 1)
    reason = _valid_dock_poi(poi, target, station["base"])
    if reason:
        return finish("blocked", reason, 1)
    rc, state, error = _state(backend)
    if rc or state is None or (blocked := _safe_state(state, poi=target)):
        return finish("blocked", f"pre-dock state changed: {blocked if state else error}", 1)
    ok, detail = _backend_action(backend, ["dock"], timeout=60.0)
    if not ok:
        return finish("blocked", f"dock outcome uncertain or failed: {detail}; inspect state before retry", 1)
    rc, state, error = _state(backend)
    loc = state.get("location") if isinstance(state, dict) else None
    if rc or not isinstance(loc, dict) or loc.get("docked_at") != station["base"]:
        return finish("unverified", "Dock request accepted, final dock state unverified", 1)
    return finish("docked", "Docked at charted station", 0)
