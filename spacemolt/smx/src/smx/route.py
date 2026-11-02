from __future__ import annotations

import argparse
import json
import sys
from typing import Any, cast

from .projection import unwrap_payload


def _fuel_number(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and value >= 0


def _valid_steps(steps: Any) -> bool:
    if not isinstance(steps, list) or not steps:
        return False
    for index, step in enumerate(steps):
        if (not isinstance(step, dict)
                or not isinstance(step.get("system_id"), str)
                or not step["system_id"]
                or step.get("jumps") != index
                or not _fuel_number(step.get("jumps"))):
            return False
        if step.get("via_wormhole") is True and (
                not isinstance(step.get("entrance_poi"), str)
                or not step["entrance_poi"]):
            return False
    return True


def assess_route(data: Any, reserve: int) -> dict[str, Any]:
    """Conservative read-only assessment of the official find_route response."""
    report: dict[str, Any] = {
        "status": "unknown",
        "reserve": reserve,
        "scope": "pilot",
        "fuel_on_arrival": None,
        "fleet": [],
    }
    if not isinstance(data, dict) or not isinstance(data.get("found"), bool):
        return report
    if not data["found"]:
        report["status"] = "unreachable"
        return report

    hops = data.get("total_jumps")
    available = data.get("fuel_available")
    estimated = data.get("estimated_fuel")
    per_jump = data.get("fuel_per_jump")
    steps = data.get("route")
    if (not all(_fuel_number(v) for v in (hops, available, estimated, per_jump))
            or not _valid_steps(steps)
            or hops != len(cast(list[Any], steps)) - 1
            or (hops > 0 and per_jump == 0)):
        return report

    remaining = cast(int, available) - cast(int, estimated)
    report["fuel_on_arrival"] = remaining
    fleet = data.get("fleet_fuel", [])
    if not isinstance(fleet, list):
        return report
    if fleet:
        report["scope"] = "fleet"

    fleet_ok = True
    for member in fleet:
        if not isinstance(member, dict):
            return report
        member_available = member.get("fuel_available")
        member_estimated = member.get("estimated_fuel")
        can_complete = member.get("can_complete")
        if (not _fuel_number(member_available) or not _fuel_number(member_estimated)
                or not isinstance(can_complete, bool)):
            return report
        member_remaining = cast(int, member_available) - cast(int, member_estimated)
        enough = can_complete and member_remaining >= reserve
        fleet_ok = fleet_ok and enough
        report["fleet"].append({
            "username": member.get("username", "unknown"),
            "fuel_on_arrival": member_remaining,
            "can_complete": can_complete,
            "reserve_ok": enough,
        })

    report["status"] = "ready" if remaining >= reserve and fleet_ok else "needs_fuel"
    return report


def cmd_route(backend: Any, argv: list[str]) -> int:
    parser = argparse.ArgumentParser(prog="smx route", description="Read-only route and fuel preflight")
    parser.add_argument("destination", help="system, POI or base ID (not display name)")
    parser.add_argument("--reserve", type=int, default=0, metavar="FUEL",
                        help="minimum fuel remaining on arrival, for you and fleet members")
    parser.add_argument("--check", action="store_true",
                        help="exit nonzero unless the route and fuel reserve are verified")
    parser.add_argument("--json", action="store_true", help="official route plus derived assessment")
    ns = parser.parse_args(argv)
    if ns.reserve < 0:
        parser.error("--reserve must be nonnegative")

    result, payload = backend.json(["find_route", f"id={ns.destination}"], timeout=20.0)
    if result.returncode != 0:
        sys.stderr.write(result.stderr or result.stdout or "smx: find_route failed\n")
        return result.returncode
    if payload is None:
        sys.stderr.write(result.stderr or result.stdout or "smx: find_route returned no JSON payload\n")
    data = unwrap_payload(payload)
    report = assess_route(data, ns.reserve)
    if ns.json:
        print(json.dumps({"destination": ns.destination, "official": data, "assessment": report},
                         indent=2, ensure_ascii=False))
    else:
        print(f"Route to {ns.destination}: {report['status']} ({report['scope']} fuel check)")
        if isinstance(data, dict) and data.get("found") is True:
            steps = data.get("route")
            if isinstance(steps, list):
                for index, step in enumerate(steps):
                    if not isinstance(step, dict):
                        continue
                    name = step.get("name") or step.get("system_id") or "unknown"
                    marker = "start" if index == 0 else "jump"
                    if step.get("via_wormhole") is True:
                        marker = f"wormhole via {step.get('entrance_poi') or 'unknown entrance'}"
                    print(f"  {index}. {name} ({marker})")
            if data.get("target_poi"):
                print(f"  final POI: {data.get('target_poi_name') or data['target_poi']} [{data['target_poi']}]")
            print(f"  jumps: {data.get('total_jumps', '?')}")
            print(f"  fuel: {data.get('estimated_fuel', '?')} needed / {data.get('fuel_available', '?')} available"
                  f" / {report['fuel_on_arrival'] if report['fuel_on_arrival'] is not None else '?'} on arrival"
                  f" (reserve {ns.reserve})")
            for member in report["fleet"]:
                flag = "OK" if member["reserve_ok"] else "LOW"
                print(f"  fleet {member['username']}: {member['fuel_on_arrival']} on arrival [{flag}]")
        if report["status"] == "unknown":
            print("  Route response incomplete; fuel safety cannot be verified.", file=sys.stderr)
        elif report["status"] == "needs_fuel":
            print("  Insufficient fuel for the requested reserve (possibly a fleet member).", file=sys.stderr)
        elif report["status"] == "unreachable":
            print("  No known route to that destination.", file=sys.stderr)
        print("Read-only plan. Recheck live conditions before jumping.")
    if ns.check or report["status"] in {"unknown", "unreachable"}:
        return 0 if report["status"] == "ready" else 1
    return 0
