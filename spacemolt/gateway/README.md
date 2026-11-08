# SpaceMolt Gateway

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-F38020?logo=cloudflareworkers&logoColor=white&style=flat-square)](https://developers.cloudflare.com/workers/) [![Workers AI](https://img.shields.io/badge/Workers_AI-F38020?logo=cloudflareworkers&logoColor=white&style=flat-square)](https://developers.cloudflare.com/workers-ai/)

> **Agent entry:** Cloudflare Worker entry and `wrangler.jsonc` own the authenticated Gremlin bridge and scheduled autopilot.
> **Validate:** `cd spacemolt/gateway && npm ci && npm test && npm run check`; deploy only through the configured Workers Builds path.
> **Boundary:** KV state and **shared bearer-token authentication** are production-owned (not per-request signatures); gameplay guards forbid self-destruct. Market buys **without** `allow_irreversible=true` enforce a quantity cap and a best-effort preflight credit estimate; the override bypasses those caps. Follow [parent agent rules](../AGENTS.md) and official v2 contract.

Source of truth for the deployed `spacemolt-gateway` Cloudflare Worker.

The Worker exposes the authenticated SpaceMolt bridge used by Gremlin, keeps its short-lived game session in the `STATE` KV namespace, and runs the existing `37 19,20 * * *` UTC cron.

Daily gameplay planning uses the Worker's dedicated Workers AI binding first. `@cf/zai-org/glm-4.7-flash` gets the full 10,000-neuron daily free allocation and a 2,048-token output ceiling. Thinking (`chat_template_kwargs.enable_thinking`) is off unless `WORKERS_AI_THINKING=true`: with it and a 16k ceiling, calls hit `3046` timeouts after ~4 min. A failed inference with a timeout or capacity error is retried once without thinking, but only before two thirds of the loop budget are spent. The planner keeps a per-day ledger in `STATE`. It persists a conservative unique reservation before each inference, then writes a separate refund entry when reported usage is lower. Settlement failure leaves the conservative reservation intact and never discards a completed model response. `kanarek-review` remains a non-Workers-AI fallback through `KANAREK_PLANNER` if the direct binding is unavailable or the daily neuron budget is exhausted.

The daily run is Gremlin's autopilot. It follows his newest captain's log entry; when that entry is under 24 h old (or unknown) it holds: no undock, jump, travel, mining or new missions, only replies, refuel/repair and his missions. In autonomous mode it skips the LLM and flies a fixed scout routine: refuel, one fuel-safe jump to the nearest unscouted neighbour (`routine:visited` in `STATE`), survey, up to five mining cycles at the quietest belt when the system has a station (stationless systems: survey only), then dock there or back home; the return trip's subrequests are reserved before undocking. The LLM planner runs in hold mode or when the routine cannot start. In every mode a ship left undocked is taken to a station in its system. Drones are off-limits. The gateway keeps one `[autopilot]` log entry, replacing its own earlier one after a re-read match (outside hold mode only, since the game deletes by index) and never touching Gremlin's. When an own report stays or the log is full, the new report goes only to `STATE` (`daily:autopilot-report`).

## Command policy

`spacemolt_command` and `/v1/command` run reads, routine gameplay and in-battle self-defence directly; anything else needs `allow_irreversible=true`, and `self_destruct` is always refused. `spacemolt/buy` runs without the override only as a capped market buy: no `auto_list`, quantity up to `BUY_SAFE_MAX_QUANTITY` (default 100) and an `estimate_purchase` total up to `BUY_SAFE_MAX_CREDITS` (default 2000). The credit check is best-effort: the game has no max-price buy, so the price can move between estimate and fill; the quantity cap bounds that, and a fill above the credit cap returns `gateway_warning.code = "buy_filled_over_cap"`. Set either var in `wrangler.jsonc` to change the caps. Fuel goes through `refuel`, which is not capped.

## Deployment

Cloudflare Workers Builds owns production builds from `main` with this directory as the repository root:

```sh
npm run check
npm run deploy
```

Runtime secrets stay in Cloudflare and are never committed:

- `BRIDGE_TOKEN`
- `SPACEMOLT_CLERK_API_KEY`

`SPACEMOLT_PLAYER_ID`, Workers AI budget settings, daily run limits (`DAILY_MAX_STEPS` ≤ 24, `DAILY_LOOP_BUDGET_SECONDS` ≤ 540; Free plan: 50 external subrequests and 15 min wall per cron run, so the loop also stops once worst-case login, docking and cleanup would no longer fit), the KV namespace, service binding, compatibility settings and cron are maintained in `wrangler.jsonc`. The Workers AI model is intentionally pinned in code so neuron-rate accounting cannot drift from the selected model.
