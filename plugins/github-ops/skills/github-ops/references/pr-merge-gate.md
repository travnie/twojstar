# PR Merge Gate

Discipline for driving a PR to merge *safely* — what must be true before merging, and the mistakes that merge over unaddressed feedback. The main skill covers committing/PR mechanics; this covers the gate in front of the merge.

**Auth reality (read first).** The `/mcp/x/all` connector can verify pull-request review threads, while repository rulesets and check-run annotations still require capabilities the connector may not expose. Authed `gh` can run the full gate below. So:

- **Connector-only chat:** use `pull_request_read` with `method=get_review_comments`, paginate with `perPage` and `after`, and inspect each returned thread's resolution state before merging. Use the other pull-request read methods for PR state/checks. Do **not** claim rulesets or CI annotations are verified unless the live MCP tool schema actually exposes them.
- **Authed `gh` (sandbox with `GH_TOKEN`, or Claude Code):** the full gate below runs. Check `gh auth status` first. In Claude Code cloud sessions `gh` is authed via the GitHub proxy, which only allows a pinned set of GraphQL operations: if a `--json` field or `gh api graphql` query gets a 403 `This GraphQL query is not enabled for this session`, use the REST equivalents (`gh api repos/{owner}/{repo}/pulls/N`, `.../pulls/N/reviews`, `.../commits/SHA/check-runs`, `.../rules/branches/BASE`) and say which gate items you could not verify.
- Plain-git bits (ff-only merge, force-with-lease, rebase ordering) run anywhere with a checkout.

## The gate

Merge-ready requires **all** of:

- Every review thread resolved (not "I think I fixed them" — fetched from GitHub).
- `reviewDecision == APPROVED` (or no review required).
- `mergeStateStatus == CLEAN`, `mergeable == MERGEABLE`.
- Every required check `SUCCESS`.
- **No** CI annotations (warnings that pass their check but still need addressing).
- Rulesets satisfied (separate from classic branch protection — see below).
- Commits signed / DCO signed-off, if the repo requires it.

### One query, then read, then merge — never chain

`gh pr view` exits 0 whether it reports zero unresolved threads or three. So `gate && gh pr merge` merges on the **exit code**, before anyone reads the gate. And `mergeStateStatus: CLEAN` does **not** imply threads are resolved — GitHub only couples them when "require conversation resolution" is enabled, which most repos leave off.

```bash
# 1a) PR-level inputs supported by gh pr view
gh pr view NUMBER --json reviewDecision,mergeStateStatus,mergeable,statusCheckRollup

# 1b) Review threads are GraphQL-only in gh; fetch every page separately
REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
OWNER=${REPO%/*}
NAME=${REPO#*/}
gh api graphql --paginate \
  -F owner="$OWNER" -F name="$NAME" -F number=NUMBER \
  -f query='query($owner:String!,$name:String!,$number:Int!,$endCursor:String){repository(owner:$owner,name:$name){pullRequest(number:$number){reviewThreads(first:100,after:$endCursor){nodes{isResolved} pageInfo{hasNextPage endCursor}}}}}' \
  --jq '.data.repository.pullRequest.reviewThreads.nodes[]'

# READ both outputs: APPROVED? CLEAN? MERGEABLE? every required check SUCCESS?
# every thread isResolved == true?
# 2) Only then, as a SEPARATE command:
gh pr merge NUMBER --merge
```

Never `gh pr view ... && gh pr merge ...` and never both in one heredoc.

## Rulesets — the gate `gh pr view` doesn't show

`BLOCKED` with `reviewDecision: ""`, all checks green, all threads resolved → almost always a **repository ruleset**. Rulesets are evaluated for merge but invisible to both `gh pr view` and the classic `branches/{branch}/protection` API. Fetch the effective rules on the branch you merge *into*:

```bash
gh api repos/{owner}/{repo}/rules/branches/BASE \
  --jq 'group_by(.type)[] | {type: .[0].type, n: length}'
```

Common culprit: a `copilot_code_review` rule needing a review on the **latest** commit. A push does not reliably re-trigger Copilot, so if the bot's last review predates the head, re-request via REST (not `gh pr edit --add-reviewer`, which can't resolve the bot login):

```bash
gh api repos/{owner}/{repo}/pulls/NUMBER/requested_reviewers \
  -X POST -f 'reviewers[]=copilot-pull-request-reviewer[bot]'
```

Other rules to expect: `required_approving_review_count`, `required_review_thread_resolution`, `non_fast_forward`.

**Don't merge on a transient `CLEAN`.** A re-requested bot review can be in-flight while `mergeStateStatus` reads `CLEAN` for a few seconds; merging then strands fresh threads on a closed PR. A pending review request is the in-flight signal — treat the PR as not-ready until it clears and the bot's latest review `oid` matches `headRefOid`.

## CI annotations — invisible in the PR summary

Checks can pass while emitting warning annotations (reviewdog/actionlint/shellcheck, CodeQL deprecations). They're hidden in the PR summary view and only show under each job's "Annotations" panel. Annotations are a **commit-level** property, so they need their own call:

```bash
gh api "repos/{owner}/{repo}/commits/SHA/check-runs" --paginate \
  --jq '.check_runs[] | select((.output.annotations_count // 0) > 0) | {name, annotations: .output.annotations_count}'
```

### Annotations-first on *failure*, too

When a run **fails** — especially `startup_failure`, "no jobs ran", "config invalid", a red X with no detail — read the annotation text **before** speculating about infra, blaming upstream, diffing YAML, or re-running. The literal validator error is usually one line, sitting in the annotations:

```bash
SHA=$(git rev-parse HEAD)
annotation_jobs=$(gh api "repos/{owner}/{repo}/commits/$SHA/check-runs" --paginate \
  --jq '.check_runs[] | select((.output?.annotations_count? // 0) > 0) | "\(.id)\t\(.name)"')

if [ -n "$annotation_jobs" ]; then
  while IFS=$'\t' read -r id name; do
    echo "=== $name ==="
    gh api "repos/{owner}/{repo}/check-runs/$id/annotations" --paginate \
      --jq '.[] | "[\(.annotation_level)] \(.path):\(.start_line) \(.message)"'
  done <<< "$annotation_jobs"
else
  gh run view RUN_ID --log-failed
fi
```

The fallback now depends on whether any annotations were actually found. (Same endpoint family as the main skill's Actions-debugging section — read the text on failure, count it on success.)

## Signed commits + rebase → local fast-forward merge

If a repo requires signed commits **and** rebase-only merges, GitHub can't sign the rebased commits — `gh pr merge --rebase` errors out. Since your local commits are already signed, merge locally and push:

```bash
git checkout main && git pull origin main
git log --oneline main..feature-branch          # should be a clean fast-forward
git merge feature-branch --ff-only              # keeps original signatures, makes no new commit
git push origin main                            # GitHub recognizes the commits, auto-closes the PR
```

| Repo requires | Path |
|---|---|
| signed + squash allowed | `gh pr merge --squash` (GitHub signs) — when the user or repo convention prefers squash |
| signed + merge commit allowed | `gh pr merge --merge` (GitHub signs the merge commit) |
| signed + rebase only | local `--ff-only` (above) |

To backfill missing sign-offs/signatures across a branch in one pass:

```bash
git rebase origin/main --exec 'git commit --amend --no-edit --signoff -S'
git push --force-with-lease
```

If signatures still read `unknown_key`, the SSH key is registered for *auth* but not as a *signing key* — add the same public key again under GitHub → Settings → SSH and GPG keys → New **signing** key. Verify: `gh api /repos/{owner}/{repo}/commits/HEAD --jq '.commit.verification'`.

## `--force-with-lease` rejected with "stale info"

On PRs that bots touch (auto-approve, Renovate/Dependabot, a CI step that pushes), `--force-with-lease` can be rejected even when your work is correct: a bot moved the remote since your last fetch, so the lease's expected ref no longer matches. **This is the safety check working — never escalate to plain `--force`.** Fetch, inspect, push:

```bash
BR=feature/my-feature
git fetch origin "$BR"
git log HEAD..origin/"$BR"                       # what the bot pushed — safe to discard?
git push --force-with-lease origin "$BR"         # lease now matches the fetched ref
```

If a bot keeps pushing inside the fetch→push window, pin the lease to the SHA you just inspected (this pins the check, doesn't skip it — only after the `git log` confirms those commits are disposable):

```bash
git push --force-with-lease="$BR:$(git rev-parse origin/"$BR")" origin "$BR"
```

## Commit before rebase

The "fetch+rebase before push" rule means before *pushing*, not before *committing*. `git rebase` aborts on a dirty tree, leaving you behind the remote and the later push rejected as non-fast-forward.

```bash
git add <files> && git commit -m "msg"   # commit FIRST
git fetch origin && git rebase origin/<branch>
git push
```

---

The upstream skill also ships a long-running merge-gate **watcher** (a `for i in seq 1 100; sleep 30` poll loop that drives a PR to merge across bot-review rounds). That's a Claude-Code / authed-sandbox artifact, not a chat move — chat doesn't sit and poll for 50 minutes. If you want it, run it there; it's not reproduced here.

> Gate patterns adapted from netresearch/git-workflow-skill (CC-BY-SA-4.0), rewritten for the connector/`gh` split. Sharing-alike applies to this file's derived portions.
