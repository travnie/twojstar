# Operations essentials

- Start: verify correct profile, status, current objective, queue, fuel, hull, cargo and log.
- Game mutations: normally one per 10-second tick; queries are free. Respect `retry_after`. A timeout does not cancel accepted travel.
- Notifications may clear on read. Peek non-destructively only when supported.
- `smx survive` is read-only; `smx autodock` previews; `smx autodock --execute` attempts guarded same-system docking.
- Finish safely docked when possible, and verify the state. If blocked, log exact location, danger and next step.
- Live [help/docs](https://game.spacemolt.com/mcp/docs) outrank this card.
