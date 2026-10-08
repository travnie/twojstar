# Webhooks & Push Notifications

## Webhooks

Fetch https://developers.cloudflare.com/agents/communication-channels/webhooks/index.md for complete documentation.

Verify the webhook before choosing the agent instance. Derive the routing key from authenticated payload data, not from an unrelated URL segment:

```typescript
import { getAgentByName, routeAgentRequest } from "agents";

export default {
  async fetch(req: Request, env: Env) {
    const url = new URL(req.url);
    if (req.method === "POST" && url.pathname === "/webhooks/github") {
      const rawBody = await req.clone().text();
      const signature = req.headers.get("X-Hub-Signature-256");
      if (!(await verifyGitHubWebhook(rawBody, signature, env.WEBHOOK_SECRET))) {
        return new Response("Unauthorized", { status: 401 });
      }

      let payload: { repository?: { full_name?: string } };
      try {
        payload = JSON.parse(rawBody);
      } catch {
        return new Response("Invalid payload", { status: 400 });
      }

      const repository = payload.repository?.full_name;
      if (!repository) {
        return new Response("Missing repository", { status: 400 });
      }

      const agentName = repository.toLowerCase().replace(/\\//g, "-");
      const agent = await getAgentByName(env.MyAgent, agentName);
      return agent.fetch(req);
    }

    return (
      (await routeAgentRequest(req, env)) ??
      new Response("Not found", { status: 404 })
    );
  }
};
```

In the agent, parse and queue the already verified request. If the agent route is exposed directly, verify the signature again there as well:

```typescript
export class MyAgent extends Agent<Env, State> {
  async onRequest(request: Request) {
    const body = await request.text();
    const payload = JSON.parse(body);
    this.queue("processWebhook", payload);
    return new Response("OK", { status: 202 });
  }
}
```

**Tips:** Respond quickly (200/202), verify signatures, deduplicate with stored event IDs, use `queue()` for async processing.

## Push Notifications

Fetch https://developers.cloudflare.com/agents/communication-channels/webhooks/push-notifications/index.md for complete documentation.

Web Push via VAPID from agents. Store subscriptions in agent state, send via `web-push`.

```bash
npm install web-push
```

```typescript
import webpush from "web-push";

export class NotifyAgent extends Agent<Env, State> {
  @callable()
  async subscribe(subscription: PushSubscription) {
    this.setState({
      ...this.state,
      subscriptions: [...this.state.subscriptions, subscription]
    });
  }

  async sendReminder(payload: { message: string }, schedule: Schedule) {
    for (const sub of this.state.subscriptions) {
      try {
        await webpush.sendNotification(sub, JSON.stringify({
          title: "Reminder",
          body: payload.message
        }), {
          vapidDetails: {
            subject: "mailto:you@example.com",
            publicKey: this.env.VAPID_PUBLIC_KEY,
            privateKey: this.env.VAPID_PRIVATE_KEY
          }
        });
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          // Remove expired subscription
        }
      }
    }
  }
}
```

VAPID keys: generate with `npx web-push generate-vapid-keys`, store as secrets.
