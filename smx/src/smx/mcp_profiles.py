from __future__ import annotations

import json

PROFILES = {
    "gameplay": {
        "endpoint": "https://game.spacemolt.com/mcp/v2?preset=full",
        "purpose": "Play SpaceMolt with the complete v2 MCP tool set.",
        "runtime": True,
    },
    "docs": {
        "endpoint": "https://game.spacemolt.com/mcp/docs",
        "purpose": "Build and maintain smx using exact live command contracts.",
        "runtime": False,
    },
}


def profiles_json(name: str | None = None) -> str:
    payload = PROFILES if name is None else {name: PROFILES[name]}
    return json.dumps(payload, indent=2, ensure_ascii=False)
