# Cloudflare Durable Objects

Use Durable Objects for coordinated, strongly consistent state per entity: chat rooms, games, collaborative docs, inventory/booking, per-user or per-tenant storage, WebSockets, per-entity scheduled work (alarms). Not for stateless request handling (plain Workers), maximum global distribution, or high fan-out independent requests. Agents SDK agents and MCP servers on Workers are DOs underneath — start at [../agents-sdk/](../agents-sdk/) for those.

Free tier: SQLite-backed classes only. Check current [limits](https://developers.cloudflare.com/durable-objects/platform/limits/index.md) and [pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/index.md) before promising a fit.

Read the current docs for the task before implementing: [docs](https://developers.cloudflare.com/durable-objects/index.md), [API](https://developers.cloudflare.com/durable-objects/api/index.md), [best practices](https://developers.cloudflare.com/durable-objects/best-practices/index.md), [examples](https://developers.cloudflare.com/durable-objects/examples/index.md), [index](https://developers.cloudflare.com/durable-objects/llms.txt).

## Start here

- [rules.md](./rules.md): storage, concurrency, RPC, alarms, WebSocket hibernation, sharding.
- [workers.md](./workers.md): calling DOs from Workers — handlers, types, configuration, tracing, and local debugging.
- [testing.md](./testing.md): Vitest integration, migration choices, what to cover.

Search terms: `blockConcurrencyWhile`, `idFromName`, `getByName`, `setAlarm`, `sql.exec`, `new_sqlite_classes`.

## Critical rules

1. Model around coordination atoms — one DO per room/game/user, never one global DO.
2. `getByName()` for deterministic routing; `newUniqueId()` only with an external ID mapping.
3. SQLite storage: `new_sqlite_classes` in `migrations`. Inspect the backend of existing classes before choosing APIs.
4. `blockConcurrencyWhile()` in the constructor for schema setup only — never per request, never across `fetch()` or external I/O.
5. RPC methods over a `fetch()` handler.
6. Persist first, cache second; in-memory state must be reconstructible after eviction.
7. No `await` between related storage writes (breaks implicit atomicity).
8. One alarm per DO — `setAlarm()` replaces the existing one.
