# Markdown knowledge bases and Obsidian vaults

For an ordinary agent-readable Markdown knowledge base, keep one canonical `INDEX.md` with one-line note descriptions and paths. Organize atomic notes by topic, give each a stable ID, summary, created/updated dates, and useful related links. Read the index, then only relevant notes. When adding/editing a note, update the index and topic map in the same change; keep backlinks and tags consistent. Merge duplicates into the canonical note and retain unique details.

Example layout:

```text
knowledge-base/
  INDEX.md
  topics/<topic>/_topic.md
  topics/<topic>/<slug>.md
  assets/
```

For Obsidian, first identify the vault root and current conventions. Use `[[wikilinks]]`, a Home/Index map of content, consistent Properties, and controlled tags. Use Bases for editable property tables when available, or Dataview only if installed; check current Obsidian syntax for exact dashboard queries. Find unlinked notes by checking inbound links; a true orphan has neither inbound nor outbound links. Resolve broken links to actual files, not merely text matches.

Renames and moves should preserve links: prefer Obsidian's own rename/move where it updates references; if that is unavailable and the user has authorized restructuring, search inbound links and update/verify them as part of the move. Avoid a blanket rule that all filesystem moves are forbidden. Do not impose Obsidian metadata or link conventions on a generic Markdown folder.
