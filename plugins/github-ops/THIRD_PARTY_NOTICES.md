# Third-party and source notices

The `github-ops` skill was supplied with this task and remains the operational source of truth. The repository normalizes its OpenAI host policy for CHAT and CODEX, adds portable plugin packaging, and carries narrow review-driven portability/safety fixes: safer `gh` installation guidance, GraphQL review-thread queries, host-neutral content-integrity instructions, and corrected CI-annotation fallback logic.

`skills/github-ops/references/pr-merge-gate.md` explicitly states that its gate patterns are adapted from `netresearch/git-workflow-skill` under CC-BY-SA-4.0 and that ShareAlike applies to the derived portions. The corresponding license notice is retained as `LICENSE.github-ops.txt`.

The surrounding plugin wrapper is ISC-licensed. This packaging does not relicense other user-supplied skill material beyond licenses already stated in that material.

The plugin references GitHub's hosted remote MCP endpoint; the remote service itself is not redistributed.
