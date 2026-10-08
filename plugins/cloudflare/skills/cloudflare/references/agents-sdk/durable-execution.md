# Durable Execution

Fetch https://developers.cloudflare.com/agents/runtime/execution/durable-execution/index.md for complete documentation.

Fibers let agent work survive Durable Object eviction. Progress is checkpointed to SQLite; on recovery, you decide what to do.

## Accept background work and return quickly

Use `startFiber()` when an HTTP caller needs a durable acknowledgement without waiting for the work to finish:

```typescript
export class MyAgent extends Agent<Env, State> {
  async onRequest(request: Request) {
    const receipt = await this.startFiber("process-data", async (ctx) => {
      const step1 = await fetchData();
      ctx.stash({ step: 1, data: step1 });

      const step2 = await transform(step1);
      ctx.stash({ step: 2, result: step2 });

      this.setState({ result: step2 });
    });

    return Response.json(
      { fiberId: receipt.fiberId, status: receipt.status },
      { status: 202 }
    );
  }
}
```

`startFiber()` returns after the work is durably accepted by default. Add an idempotency key when the external request can be retried and must not start duplicate work.

## Checkpoint and recover an unmanaged fiber

```typescript
export class ResearchAgent extends Agent<Env, State> {
  startResearch() {
    void this.runFiber("research", async (ctx) => {
      const step1 = await fetchData();
      ctx.stash({ step: 1, data: step1 });

      const step2 = await transform(step1);
      ctx.stash({ step: 2, result: step2 });

      this.setState({ result: step2 });
    });
  }

  async onFiberRecovered(ctx) {
    if (ctx.name !== "research") return;

    const checkpoint = ctx.snapshot as
      | { step: 1; data: unknown }
      | { step: 2; result: unknown }
      | null;

    if (checkpoint?.step === 1) {
      const step2 = await transform(checkpoint.data);
      this.setState({ result: step2 });
    }
  }
}
```

## Key APIs

| API | Purpose |
|-----|---------|
| `this.runFiber(name, fn)` | Run a durable fiber and optionally await its result |
| `this.startFiber(name, fn, options?)` | Durably accept retained background work and return a receipt |
| `ctx.stash(data)` / `this.stash(data)` | Write the complete JSON-serializable checkpoint |
| `ctx.snapshot` | Read the latest checkpoint inside `onFiberRecovered` |
| `onFiberRecovered(ctx)` | Handle an interrupted fiber after restart or eviction |
| `keepAlive()` | Prevent hibernation while fiber work is active |
| `keepAliveWhile(fn)` | Keep alive for the duration of an async function |

## Important

- Each `stash()` call replaces the entire checkpoint; it is not a merge.
- The original lambda is not serialized. Recovery gets the fiber name and `ctx.snapshot`, so recovery logic belongs in `onFiberRecovered`.
- `runFiber()` has no automatic retry on throw.
- Managed `startFiber()` records can use idempotency keys, inspection and cancellation.
- For multi-step pipelines that need workflow semantics and automatic retries, use Workflows.
- Filter concurrent fibers by `ctx.name` in `onFiberRecovered`.
