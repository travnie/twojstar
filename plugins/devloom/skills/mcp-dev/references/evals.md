# Evaluating an MCP server

Quality = how well a model with **only** these tools answers real, hard questions — not how many endpoints exist. Method from Anthropic's `mcp-builder` (Apache-2.0); harness in `scripts/eval/` (twojstar patches: content serialization, multiple tool calls per turn, repeatable `-e`/`-H`).

## Write 10 questions

- Read-only, independent, idempotent — no question needs another's answer or a write.
- Multi-hop: several to dozens of tool calls; realistic for the target user.
- One verifiable, **stable** answer each (IDs, counts over a closed time range, names) — never "latest", never things that change.
- Before keeping a question, solve it yourself with the tools and record the answer.
- Mix tools: cover search, pagination, filters, joins across resources; avoid questions answerable by one call.

```xml
<evaluation>
  <qa_pair><question>…</question><answer>…</answer></qa_pair>
</evaluation>
```

## Run (Claude Code or any shell with an Anthropic API key)

```bash
pip install -r scripts/eval/requirements.txt        # anthropic, mcp
export ANTHROPIC_API_KEY=…                           # user's own key, never committed
python scripts/eval/evaluation.py evals.xml -m <current-model-id> -t http -u https://host/mcp [-H "Authorization: Bearer $T"] -o report.md
python scripts/eval/evaluation.py evals.xml -m <id> -t stdio -c node -a dist/index.js [-e KEY=VALUE]
```

Report: per-question correctness, duration, tool-call counts, and the model's feedback on tools. Low accuracy → read the transcripts: unclear descriptions, missing filters, oversized results, unhelpful errors (`references/tools.md`). Re-run after each fix; keep `evals.xml` in the repo.

Chat sandbox: write the questions and verify answers with `mcp_probe.py --call`; the harness needs an API key the sandbox shouldn't hold.
