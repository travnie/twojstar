# SpaceMolt Gateway

Source of truth for the deployed `spacemolt-gateway` Cloudflare Worker.

The Worker exposes the authenticated SpaceMolt bridge used by Gremlin, keeps its short-lived game session in the `STATE` KV namespace, and runs the existing `37 19,20 * * *` UTC cron.

Daily gameplay planning uses the Worker's dedicated Workers AI binding first. `@cf/zai-org/glm-4.7-flash` gets the full 10,000-neuron daily free allocation, explicit thinking via `chat_template_kwargs`, and a 16,384-token output ceiling. The planner keeps a per-day ledger in `STATE`. It persists a conservative unique reservation before each inference, then writes a separate refund entry when reported usage is lower. Settlement failure leaves the conservative reservation intact and never discards a completed model response. `kanarek-review` remains a non-Workers-AI fallback through `KANAREK_PLANNER` if the direct binding is unavailable or the daily neuron budget is exhausted.

## Deployment

Cloudflare Workers Builds owns production builds from `main` with this directory as the repository root:

```sh
npm run check
npm run deploy
```

Runtime secrets stay in Cloudflare and are never committed:

- `BRIDGE_TOKEN`
- `SPACEMOLT_CLERK_API_KEY`

`SPACEMOLT_PLAYER_ID`, Workers AI budget settings, the KV namespace, service binding, compatibility settings and cron are maintained in `wrangler.jsonc`. The Workers AI model is intentionally pinned in code so neuron-rate accounting cannot drift from the selected model.
