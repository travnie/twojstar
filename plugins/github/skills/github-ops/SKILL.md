---
name: "github-ops"
description: "Any GitHub work beyond a one-line read: git/gh (local or through a session proxy) vs GitHub MCP, commits and identity, PRs, Actions, releases, the pre-merge gate (threads, rulesets, BLOCKED merges) and Dependabot config and PRs."
---

# GitHub Ops

Two ways to act on a repo. Pick by **environment first**, then by task — they have different auth, different strengths, and different failure modes.

## CI first

If an Actions workflow already covers the job (build, lint, tests, generators, deploy), use it: push the branch, or `gh workflow run NAME --ref BRANCH` / MCP `actions_run_trigger` for dispatch-only jobs, then read the run. Don't download toolchains to rebuild locally what CI builds. Run locally only what no workflow covers, or can't be triggered from this branch (for example a `pull_request`-only workflow with no PR and no `workflow_dispatch`), or a quick probe while writing code. On failure, read the log (`gh run view ID --log-failed`, MCP `get_job_logs`) before trying to reproduce.

## Environment first (decide before anything else)

**Inside a git checkout** — Claude Code local or cloud (`CLAUDE_CODE_REMOTE=true`), or any shell where `git rev-parse --show-toplevel` succeeds for the target repo:

- **`git` for everything that changes the repo:** branch, commit, push, rebase. Commit what is on disk, run checks on it, then push. The project's `attribution` settings (Co-Authored-By trailer, PR footer) only apply to commits/PRs Claude Code makes this way.
- **`gh` for everything GitHub-side:** `gh pr create/view/checks/merge`, `gh run list/view/watch`, `gh workflow run`, `gh release`, `gh api`.
- **Never `push_files` / `create_or_update_file` into the repo you have checked out.** It bypasses git and the attribution settings, and the remote moves ahead of the working tree — the next `git push` gets rejected or clobbers it.
- MCP `github:*` tools stay fine for **other** repos you have not cloned (reading a file elsewhere, searching code across the org) and for things `gh` cannot do.
- **Local Claude Code (full `gh`, the user's own auth):** nothing is proxied; GraphQL, search, secrets and branch deletion all work. Reach for what the sandbox can't do:
  - Gate: `gh pr view --json reviewDecision,mergeStateStatus,statusCheckRollup`, `gh pr checks --watch`, `gh ruleset check BRANCH` / `gh ruleset view` (explains a `BLOCKED` merge), threads via `gh api graphql` (`references/pr-merge-gate.md`).
  - Merge: `gh pr merge --squash --delete-branch`, or `--auto` to merge once checks pass. Local branches: `git branch -d`.
  - CI: `gh run watch ID --exit-status`, `gh run rerun ID --failed`, `gh run download ID` for artifacts, `gh workflow run NAME --ref BRANCH`.
  - Other: `gh release create TAG --generate-notes`, `gh secret set NAME`, `gh search code`, `gh search prs`, `gh search issues`, `gh pr checkout N`.
  - Token scopes bite: pushing `.github/workflows/*` needs the `workflow` scope on the credential git actually uses. Stored classic `gh` auth used by git (`gh auth setup-git`): `gh auth refresh -s workflow` (doesn't apply while `GH_TOKEN`/`GITHUB_TOKEN` is set, which overrides it). Fine-grained PAT or GitHub App: grant `Workflows: write`. Anything else: update that credential.
- **Cloud sessions specifics:** git and `gh` go through Anthropic's GitHub proxy, which injects credentials — no `gh auth login`, `GH_TOKEN` reads `proxy-injected` (a script that reads the token directly gets the placeholder, not a usable token). `git push` works only for the session's working branch. The proxy only serves a pinned set of GraphQL operations for PR workflows; on a 403 `This GraphQL query is not enabled for this session`, use REST: `gh api repos/{owner}/{repo}/...`. API requests reach only repositories attached to the session.

**claude.ai chat sandbox** (`CLAUDE_CODE_REMOTE=true` with `CLAUDE_CODE_SESSION_ORIGIN=claude_ai_chat`): a cloud container whose preinstalled `git` and `gh` go through a GitHub proxy that injects the connected account's credentials. Verified behaviour:

- **Auth check:** `gh api user -q .login`. Ignore `gh auth status`; it can report an invalid token while every call works. Never read or print the injected credentials.
- **Repo scope:** only repositories attached to the session (an `add_repo`-style tool; request write/push access for API writes). Unattached → 403 `GitHub access to this repository is not enabled for this session`. Public repos still clone without attaching. Dot-named repos (`owner/.github`) may not attach; use the MCP connector for those.
- **Clone:** `git clone --depth 1 https://github.com/OWNER/REPO`, one at a time, with a long timeout. Concurrent git operations per repo are capped: on 429 wait and retry once. Before pushing from a shallow clone, fetch the default branch (`git fetch origin "$(gh api repos/OWNER/REPO --jq .default_branch)"`), or the push can fail with 413.
- **GraphQL is blocked**, so `gh pr view/create/edit/merge/list/checks`, `gh repo list` and `gh release list` fail with 403. Use REST: `gh api repos/OWNER/REPO/...`. Proxy-only REST routes replace the GraphQL-only parts: `GET .../pulls/N/ccr/review_threads`, `POST .../pulls/N/ccr/comments/ID/resolve` (`/unresolve`), `PUT|DELETE .../pulls/N/ccr/auto_merge`, `POST .../pulls/N/ccr/ready_for_review`, `POST .../pulls/N/ccr/convert_to_draft`.
- **Also blocked:** search endpoints (use MCP `search_*`), Actions secrets (the user sets them in the UI), branch deletion (ask the user; so don't push scratch branches).
- **Works here** (unlike the working-branch limit in Claude Code cloud sessions above): `git push` to any new branch, `gh run list`, `gh run view ID --log-failed`, REST reads of pulls, reviews, comments, check runs and `rules/branches/BASE`, `POST .../pulls` to open a PR, `PUT .../pulls/N/merge`.

**No checkout** — claude.ai chat, or a repo you are not going to clone: use the MCP tools as described below; reach for `gh` only if a token actually exists (auth check below).

- **MCP `github:*` tools** — authenticated through the connector, structured JSON in/out, no shell or token needed. Default **in chat** for reading files, committing, PRs, issues, search, releases.
- **`gh` CLI** — needs a token (`gh auth login`, or `GH_TOKEN`/`GITHUB_TOKEN`; CI and Claude Code cloud sessions provide one). In chat, with the `/x/all` connector toolset (~90 tools) MCP covers most Actions work too. Reach for `gh` there only for what MCP still can't do: **setting secrets (`gh secret set`), creating a release with notes, live `run watch` streaming, and shell piping / `-q` jq**.

Hard rule learned the hard way: **never hit `api.github.com` unauthenticated** (plain `curl`, or `gh` with no token). It's rate-limited to ~60/hr per IP and datacenter/CI IPs are usually already exhausted — you get a `{"message": "API rate limit exceeded…"}` dict, not data. Route through the connector (authed) or an authed `gh`.

## Which path

| Task | In a checkout (Claude Code) | No checkout (chat) |
|---|---|---|
| Read a file / list a dir / history | read the file, `git log` / `git show` | MCP `get_file_contents` / `list_commits` |
| Commit one or several files | `git add` + `git commit` | MCP `create_or_update_file` / `push_files` (atomic) |
| Push / branch | `git push -u origin BRANCH` | `push_files` with a new branch name |
| Open / update a PR | `gh pr create` / `gh pr edit` | MCP `create_pull_request` / `update_pull_request` |
| PR status, checks, reviews | `gh pr view --json …`, `gh pr checks` | MCP `pull_request_read` |
| Merge a PR (after the gate) | `gh pr merge` | MCP `merge_pull_request` |
| Search code / repos / issues across GitHub | `gh search …` or MCP `search_*` | MCP `search_*` |
| **Read Actions run logs** | `gh run view --log-failed` | MCP `get_job_logs` |
| List / watch workflow runs | `gh run list`, `gh run watch` | MCP `actions_list` / `actions_get` |
| **Trigger a workflow** | `gh workflow run` | MCP `actions_run_trigger` |
| **Set a secret** | `gh secret set NAME -R owner/repo` | same, needs a real token |
| **Cut a release with notes** | `gh release create` | `gh` with a token (MCP release tools are read-only) |

In connector-only chat, where no token is reachable, **prefer MCP for everything it covers** and only reach for `gh` when the task is genuinely in its column. Auth check: `gh auth status` locally and in CI; `gh api user -q .login` in proxied sandboxes, where `gh auth status` misreports.

## MCP path (chat only): commit semantics

The one rule that bites: **`create_or_update_file` requires the current blob SHA when updating an existing file.** Omit it and the write 409/422s. Get the SHA from `get_file_contents` (it returns one) or `git rev-parse <branch>:<path>`. Creating a *new* file needs no SHA.

**Prefer `push_files` whenever more than one file changes together** — it lands them in a single atomic commit and needs no SHA. This is the right tool for lockstep edits (two files that must agree, e.g. a config mirrored across a worker and a generator): one commit, no half-applied state, no SHA juggling.

Other MCP tools: `create_branch`, `delete_file`, `merge_pull_request`, `pull_request_review_write` (+ `add_comment_to_pending_review` for inline comments), `get_latest_release`/`list_releases`. `search_code` is repo-wide and fast; reach for it before cloning to grep.

## gh path: auth and install

- **Auth check first:** `gh auth status` (in proxied sandboxes `gh api user -q .login` instead). If unauthenticated, either `gh auth login` (interactive) or `export GH_TOKEN=…`. Never ask the user to paste a token into a chat transcript — point them at `gh auth login` or the CI `GITHUB_TOKEN`.
- **If `gh` is missing:** prefer the OS/package manager or GitHub's official installation instructions. Do not download and execute a release archive from an unpinned URL as part of an agent workflow. If a safe installation path is unavailable, stay on the authenticated MCP path instead.
- **Actions debugging.** MCP `get_job_logs` pulls job logs without a token — use it first. `gh` still wins for a *live* tail: `gh run watch <id>`, `gh run view <id> --log-failed`. List via MCP `actions_list` or `gh run list -R owner/repo`. Distinguish a *code* failure (a step errored) from a *GitHub-side* delay/skip (scheduled runs get throttled on low-activity repos — the run simply never started; the fix is `actions_run_trigger`/`gh workflow run`, not a code change).

## Commit & PR conventions

- **Commit identity: Claude** (`Claude <noreply@anthropic.com>`) as author and committer, everywhere, plus a co-author trailer when the project asks for one.
  - Cloud sessions and the chat sandbox already commit as Claude with a signing key (Verified): keep that, no `--author` or `user.name`/`user.email` override.
  - Locally git uses the user's own config, so set the identity per commit through the environment (it beats `user.*`, `author.*` and `committer.*` config) without touching their config, and skip their signing key (a user key on a Claude committer shows Unverified): `GIT_AUTHOR_NAME=Claude GIT_AUTHOR_EMAIL=noreply@anthropic.com GIT_COMMITTER_NAME=Claude GIT_COMMITTER_EMAIL=noreply@anthropic.com git -c commit.gpgsign=false commit …`, then check with `git log -1 --format='%an <%ae> / %cn <%ce>'`. Unsigned commits show no badge; say so if the repo requires signed commits.
- **Comments and review replies:** if the session has a dedicated bot MCP for comments, reactions, reviews and thread resolution, use it for those instead of posting as the account owner.
- **Bot reviews are advisory** (Codex, CodeRabbit, cubic…): verify each finding against the code, apply valid ones yourself, answer and resolve the rest with the reason. Don't ask a review bot to implement or push.
- **Match the repo's existing style.** Before composing a message, glance at recent history (`list_commits`) and mirror it: prefix style (`chore:`, `fix:`, `feat:`), tense, scope. Don't impose conventional-commits on a repo that doesn't use them, and do follow it on one that does.
- **Atomic commits.** One logical change per commit; files that must move together go in one commit (one `git commit` in a checkout, one `push_files` call in chat).
- **Direct-to-`main` vs PR.** Small fix on a solo/low-stakes repo → committing straight to `main` is fine. Larger, risky, or collaborative → `create_branch` + `create_pull_request`. If a push to a protected branch is rejected, fall back to branch + PR rather than forcing it.
- **Scan before you push.** In chat, run `run_secret_scanning` on file content you're about to commit; in a checkout, `git diff --cached` and look — catch a leaked key before it's in history, not after.

## Verify after writing

A write isn't done when the tool returns 200 — it's done when you've confirmed the effect:

1. **Commit landed** — `git log origin/BRANCH -1` after the push in a checkout; in chat use the returned commit SHA, or re-read with `get_file_contents`.
2. **Triggered workflows actually pass.** If the changed path matches a workflow trigger (e.g. a deploy on `worker/**`, an hourly build), watch it: `gh run watch` if `gh` is authed, else poll MCP `get_job_logs`/`actions_list` or check `list_commits` for the bot's follow-up commit. Don't assume a push that compiles locally also deployed.
3. **Report the SHA / PR URL / run conclusion**, not just "done."

### Content integrity (chat / MCP path) — `push_files`/`create_or_update_file` commit garbage silently

Both tools take the **whole file as a literal string** and commit whatever you hand them — a placeholder, a truncated tail, a from-memory reconstruction — with **no error**. This is the single most recurring push failure. It is caught *reactively* by md5 far too often; prevent it instead:

- **Never reconstruct file content from earlier in the conversation.** Re-read the canonical content immediately before the write. In a checkout, use `cat` or the editor/file tool available in that host; in connector-only chat, fetch the file again through the GitHub MCP.
- **Never pass shell substitution** (`$(cat f)`) as file content — a connector can commit it as the literal string `$(cat f)`.
- **Large files, lockfiles, and binaries:** in a checkout, commit them with git. In connector-only chat, use a write tool only when its live schema explicitly supports the exact bytes you need; otherwise switch to a checkout or ask the user to upload through a supported UI. Do not invent host-specific helpers that are not present.
- **Multi-file commits including existing repo files** (`feeds.yaml`, `README.md`): fetch each file's real content from the target ref first; a file left as a placeholder overwrites the real one. Pushing *only* the new/changed file is safe; including an existing file with a stub is destructive.
- **Verify every push against the returned commit SHA.** In connector-only chat, re-read the written paths through the GitHub MCP. In a checkout, compare the committed tree to the local files and run the relevant parser/compiler checks.
- **Hash-check uploads you can't diff:** download to a file first, then compare, so a failed download can't pass as an empty hash: `gh api 'repos/O/R/contents/<path>?ref=<COMMIT-SHA>' -H 'Accept: application/vnd.github.raw' > /tmp/remote && cmp /tmp/remote <local-file> && sha256sum /tmp/remote <local-file>`. For a public repo, `curl -fsSL https://raw.githubusercontent.com/O/R/<COMMIT-SHA>/<path> > /tmp/remote` also works. Use the commit SHA, not a branch name, which can serve a cached copy.
- **Binaries (`.skill`, PNG, ICO):** never through the connector's string-content tools; they corrupt. Use git, or hand the file to the user for a UI upload.
- **Watch encoding and escaping.** If a literal glyph or byte sequence matters, verify it from the committed object rather than trusting a reconstructed string.

## Merging a PR

Don't just call `gh pr merge`/`merge_pull_request`. Run the gate first: threads resolved, `reviewDecision APPROVED`, `mergeStateStatus CLEAN`, every check green, no CI annotations, rulesets satisfied, commits signed if required. The trap that bites: `gh pr view` exits 0 regardless of what it reports, and `CLEAN` does **not** imply threads are resolved — so query the gate, *read* it, then merge as a separate command; never `gate && merge`. A `BLOCKED` with empty `reviewDecision` and all checks green is usually a repository **ruleset** (invisible to `gh pr view` and classic branch protection). In the chat sandbox the gate is REST-only (`references/pr-merge-gate.md` → REST gate); say which items you couldn't verify. In connector-only chat using `/mcp/x/all`, paginate `pull_request_read(method=get_review_comments)` and inspect each thread's resolution state; still say when rulesets or check-run annotations cannot be verified from the live MCP schema. Full recipes, signed-rebase ff-only merge, and `--force-with-lease` "stale info" recovery: `references/pr-merge-gate.md`.

## Dependabot

One file, `.github/dependabot.yml`, on the **default branch** — multiple dependabot.yml files are not supported. Everything else is `updates:` entries inside it. Full option list: [GitHub's reference](https://docs.github.com/code-security/dependabot/working-with-dependabot/dependabot-options-reference) — go there rather than guessing.

The parts that are non-obvious or that bite:

- **`directory` (singular) does not accept globs.** Use `directories:` (plural) for `"/apps/*"`, `"**/*"`, etc. Silent no-match otherwise.
- **Ecosystem values don't match tool names.** pnpm and yarn are both `npm`; poetry/uv/pipenv are all `pip`; Gradle is `gradle`, Actions are `github-actions`.
- **Grouping is the whole point** — ungrouped deps get one PR each. First matching group wins; a dep never lands in two.
  ```yaml
  groups:
    dev-deps:
      dependency-type: "development"
      update-types: ["minor", "patch"]
    security-patches:
      applies-to: security-updates   # defaults to version-updates when absent
      patterns: ["*"]
  ```
  Use a `patterns:` group for libraries that must move in lockstep (e.g. Retrofit + okhttp, Compose BOM + compiler) so one PR carries both and CI tests the real combination — separate PRs merge in an order that breaks the build.
- **`open-pull-requests-limit: 0` disables version updates** while leaving security updates on. The security-only switch.
- **`cooldown:`** delays newly released versions (`semver-major-days`, `semver-minor-days`, …). Applies to version updates only, never security ones. Worth it on majors if you don't want to be the one finding the .0 bugs.
- **allow + ignore on the same dep → ignored wins.**
- **`target-branch:` doesn't move security updates** — those always target the default branch.

### Dependabot PRs

**Merge/close/reopen `@dependabot` comment commands were deprecated in January 2026.** Merge with `gh pr merge` / auto-merge / MCP `merge_pull_request` like any other PR. Still live: `@dependabot rebase`, `recreate`, `ignore this dependency`, `ignore this major|minor|patch version`, and in grouped PRs `@dependabot ignore|unignore DEPENDENCY_NAME`.

Dependabot may ignore commands posted by bot accounts; if one gets no response, ask the user to post it.

To vet a bump before merging, MCP `check_dependency_vulnerabilities` takes a dependency list and returns advisories with fixed versions — pair it with `list_commits`/the PR diff rather than trusting the changelog link.

## Gotchas

- **Unauth `api.github.com` is rate-limited** from cloud IPs → use the connector or authed `gh`. (Web/`raw.githubusercontent.com` fetches are fine; it's the *API* host that bites.)
- **`create_or_update_file` update without SHA fails** — fetch the SHA first, or use `push_files`.
- **`push_files` is last-write-wins** — re-read if a concurrent change may have landed since you fetched.
- **`gh` exists ≠ `gh` is authed.** Run the auth check (`gh auth status`; `gh api user -q .login` in proxied sandboxes) before relying on it; a fresh install reaches the request and stops at auth.
- **Don't paste tokens into the conversation.** Auth happens in the user's environment, not the transcript.
