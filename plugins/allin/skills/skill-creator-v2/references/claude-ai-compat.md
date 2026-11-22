
# Skill Compatibility Audit (claude.ai / Skills API)

A skill that's fine in Claude Code can fail silently on claude.ai: it's **rejected on upload** (illegal frontmatter), **never triggers** (weak description), or **loads but misfires** (it assumes subagents, slash commands, or a filesystem that chat doesn't have). This audit catches all three. Use it on one skill or a whole directory.

## 1. Frontmatter — the upload allowlist (hard rule)

The validator accepts **exactly** these keys and rejects any others:

```
name          (required)   kebab-case ^[a-z0-9-]+$, ≤64 chars, no leading/trailing/double hyphen
description   (required)   ≤1024 chars, NO angle brackets (< or >)
license       (optional)
allowed-tools (optional)
metadata      (optional)   nested keys under it are fine
compatibility (optional)   string, ≤500 chars
```

Strip every other key. The common offenders when porting from Claude Code (or other harnesses) are `context` (e.g. `context: fork`), `agent`, `disable-model-invocation`, `model`, `color`, and tool-permission blocks under non-allowlisted names. They make the upload fail outright. Also:
- **One `SKILL.md` per skill**, at `<folder>/SKILL.md`. Nested `SKILL.md` files are rejected on upload (only Claude Code's filesystem loads them). Supporting docs must be renamed (`references/<topic>.md`).
- Angle brackets in `description` fail — rewrite `<thing>` as "thing" or "the X".

## 2. Description — does it actually trigger?

claude.ai only consults a skill based on its `description`, and Claude tends to **under-trigger**. A correct-but-shy description is a real defect. Make it do two jobs: what the skill does **and** when to use it (concrete trigger phrases, file types, contexts), phrased a little pushy. Move all "when to use this" out of the body and into the description. (If you want to optimize triggering quantitatively, that's the `skill-creator` description-optimizer — but its `run_loop.py` needs `claude -p`, which is Claude Code only.)

## 3. Body — rewrite Claude Code assumptions for chat

Bartek's claude.ai chat (verified Oct 2026) runs a **Claude Code harness in a cloud container** (`CLAUDE_CODE_SESSION_ORIGIN=claude_ai_chat`): `Bash`/`Read`/`Write`, `Skill`, `Agent` (subagents — only when the user asks), `SendUserFile`, `AskUserQuestion`, proxied `git`/`gh`. Still absent: persistent checkout, `settings.json`/hooks, `claude -p`. Other surfaces (mobile, older chats, Codex) may lack the harness — write skills that degrade, don't hard-require it:
- **Subagent fan-out** → default inline; fan out only on explicit request.
- **`/slash-command` references** → describe the action; skills are model-invoked by description (a user typing `/name` is just a request to load it).
- **`gh ...`** → fine in the chat sandbox via the proxy, REST only (`gh api`; `gh pr …` uses GraphQL and fails), repo must be attached via `add_repo`. Point to `github-ops` instead of restating rules; MCP connector as fallback. Never paste a token.
- **Builds/tests/deploys** → the repo's Actions workflows, not local runs (user rule: a workflow beats grinding locally).
- **`claude -p` / eval-runner loops / browser eval-viewer** → not available; rely on inline review.
- **Filesystem persistence between sessions** → none; don't assume prior outputs survive.
- **Tool names:** use current ones (`WebSearch`, `WebFetch`, `SendUserFile`, `AskUserQuestion`, `mcp__visualize__show_widget`) and say "or the host's equivalent" — names drift per surface.

State the environment once at the top (a short blockquote like the `cmd-*` skills use) so the model picks the right path.

## 4. Validate and package

Run from this skill's base directory (printed when it loads). Copy any **read-only installed skill to a writable location first** (`/tmp/<name>/`), edit there, and **preserve the original `name`** and folder so the output is `<name>.skill`, not `<name>-v2`.

```bash
cd <skill-creator-v2 base dir>
python -m scripts.quick_validate /tmp/<skill-folder>     # fix until it prints "Skill is valid!"
python -m scripts.package_skill  /tmp/<skill-folder>     # produces the .skill for upload at claude.ai/skills
```

`quick_validate` enforces everything in §1 — treat a failure as the spec, not a suggestion.

## 5. Batch audit a folder

For a directory of skills, go one at a time so a single failure doesn't hide the rest:

```bash
for d in <skills-dir>/*/; do
  echo "== $d"; python -m scripts.quick_validate "$d"
done
```

Group the output: which pass, which have illegal frontmatter (list the offending keys), which trigger weakly, which carry Claude-Code-only assumptions. Fix in that priority order (upload-blockers first), re-validate, then repackage each. Report a short table of skill → issues → fix, and hand back the validated `.skill` files.

## Guardrails

- The allowlist is the contract — if `quick_validate` rejects a key, remove it; don't argue with it.
- Don't rename a skill you're fixing (breaks the user's installed reference); preserve `name` and folder.
- Don't strip body content that's still useful in chat — translate it. Deleting the subagent section wholesale can remove the actual method; replace it with the inline equivalent.
- A skill that uploads but never fires is still broken — always sanity-check the description's triggers, not just legality.
