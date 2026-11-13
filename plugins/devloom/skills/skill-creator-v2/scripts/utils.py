"""Shared utilities for skill-creator scripts."""

from pathlib import Path

import yaml


def parse_skill_md(skill_path: Path) -> tuple[str, str, str]:
    """Parse a SKILL.md file, returning (name, description, full_content).

    Frontmatter is parsed as YAML (same as quick_validate), so folded,
    literal and plain multi-line scalars all keep their full text.
    """
    content = (skill_path / "SKILL.md").read_text()
    lines = content.split("\n")

    if lines[0].strip() != "---":
        raise ValueError("SKILL.md missing frontmatter (no opening ---)")

    end_idx = None
    for i, line in enumerate(lines[1:], start=1):
        if line.strip() == "---":
            end_idx = i
            break

    if end_idx is None:
        raise ValueError("SKILL.md missing frontmatter (no closing ---)")

    try:
        front = yaml.safe_load("\n".join(lines[1:end_idx])) or {}
    except yaml.YAMLError as e:
        raise ValueError(f"SKILL.md frontmatter is not valid YAML: {e}") from e
    if not isinstance(front, dict):
        raise ValueError("SKILL.md frontmatter must be a mapping")

    name = str(front.get("name") or "").strip()
    description = str(front.get("description") or "").strip()
    return name, description, content
