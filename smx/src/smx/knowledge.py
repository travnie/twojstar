from __future__ import annotations

import json
from importlib.resources import files
from typing import Any

GUIDES: dict[str, dict[str, str | None]] = {
    "combat": {
        "summary": "Range, damage types, tackle, escape and battle checks.",
        "live": "pirate-hunter",
    },
    "boarding": {
        "summary": "Capture flow, marines, prizes and recovery logistics.",
        "live": "boarding",
    },
    "trade": {
        "summary": "Market checks, arbitrage, cargo discipline and freight.",
        "live": "trader",
    },
    "exploration": {
        "summary": "Routing, fuel, police levels, surveying and field notes.",
        "live": "explorer",
    },
    "industry": {
        "summary": "Mining, refining, crafting and facility discipline.",
        "live": "miner",
    },
    "operations": {
        "summary": "Session continuity, insurance, notifications and survival.",
        "live": None,
    },
}


def list_guides() -> list[dict[str, str | None]]:
    return [
        {"topic": topic, "summary": str(meta["summary"]), "live": meta["live"]}
        for topic, meta in GUIDES.items()
    ]


def load_guide(topic: str) -> str:
    if topic not in GUIDES:
        raise KeyError(topic)
    return files("smx").joinpath("cards", f"{topic}.md").read_text(encoding="utf-8").strip()


def search_guides(query: str, *, max_hits: int = 12) -> list[dict[str, Any]]:
    needle = query.casefold().strip()
    if not needle:
        return []

    hits: list[dict[str, Any]] = []
    for topic in GUIDES:
        text = load_guide(topic)
        for line_no, line in enumerate(text.splitlines(), start=1):
            if needle in line.casefold():
                hits.append({"topic": topic, "line": line_no, "text": line.strip()})
                if len(hits) >= max_hits:
                    return hits
    return hits


def guide_json(topic: str) -> str:
    meta = GUIDES[topic]
    return json.dumps(
        {
            "topic": topic,
            "summary": meta["summary"],
            "live_guide": meta["live"],
            "content": load_guide(topic),
        },
        indent=2,
        ensure_ascii=False,
    )
