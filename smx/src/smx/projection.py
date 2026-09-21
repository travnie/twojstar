from __future__ import annotations

from typing import Any


def unwrap_payload(payload: Any) -> Any:
    if not isinstance(payload, dict):
        return payload
    for key in ("structuredContent", "structured_content"):
        value = payload.get(key)
        if isinstance(value, dict):
            return value
    result = payload.get("result")
    if isinstance(result, dict):
        nested = unwrap_payload(result)
        if isinstance(nested, dict):
            return nested
    return payload


def lookup_path(payload: Any, path: str) -> tuple[bool, Any]:
    current = payload
    for part in path.split("."):
        if isinstance(current, dict):
            if part not in current:
                return False, None
            current = current[part]
            continue
        if isinstance(current, list) and part.isdigit():
            index = int(part)
            if index < 0 or index >= len(current):
                return False, None
            current = current[index]
            continue
        return False, None
    return True, current


def parse_fields(values: list[str]) -> list[str]:
    fields: list[str] = []
    seen: set[str] = set()
    for value in values:
        for raw in value.split(","):
            field = raw.strip()
            if field and field not in seen:
                seen.add(field)
                fields.append(field)
    return fields


def project_fields(payload: Any, fields: list[str]) -> tuple[dict[str, Any], list[str]]:
    root = unwrap_payload(payload)
    projected: dict[str, Any] = {}
    missing: list[str] = []
    for field in fields:
        found, value = lookup_path(root, field)
        if found:
            projected[field] = value
        else:
            missing.append(field)
    return projected, missing
