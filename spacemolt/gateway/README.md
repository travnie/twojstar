# SpaceMolt Gateway

Source of truth for the deployed `spacemolt-gateway` Cloudflare Worker.

The Worker exposes the authenticated SpaceMolt bridge used by Gremlin, keeps its short-lived game session in the `STATE` KV namespace, uses `kanarek-review` through the `KANAREK_PLANNER` service binding, and runs the existing `37 19,20 * * *` UTC cron.

## Deployment

Cloudflare Workers Builds owns production builds from `main` with this directory as the repository root:

```sh
npm run check
npm run deploy
```

Runtime secrets stay in Cloudflare and are never committed:

- `BRIDGE_TOKEN`
- `SPACEMOLT_CLERK_API_KEY`

`SPACEMOLT_PLAYER_ID`, the KV namespace, service binding, compatibility settings and cron are maintained in `wrangler.jsonc`.
