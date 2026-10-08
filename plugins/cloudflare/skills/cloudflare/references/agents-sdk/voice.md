# Voice (Beta)

Fetch https://developers.cloudflare.com/agents/communication-channels/voice/ for complete documentation.

`@cloudflare/voice` provides real-time speech-to-text and text-to-speech for Agents. Audio streams over WebSocket.

```bash
npm install @cloudflare/voice
```

## Server

```typescript
import { Agent } from "agents";
import {
  withVoice,
  WorkersAIFluxSTT,
  WorkersAITTS,
  type VoiceTurnContext,
} from "@cloudflare/voice";
import { streamText } from "ai";
import { createWorkersAI } from "workers-ai-provider";

const VoiceAgentBase = withVoice(Agent);

export class VoiceAgent extends VoiceAgentBase<Env> {
  transcriber = new WorkersAIFluxSTT(this.env.AI);
  tts = new WorkersAITTS(this.env.AI);

  async onTurn(transcript: string, context: VoiceTurnContext) {
    const workersAI = createWorkersAI({ binding: this.env.AI });
    const result = streamText({
      model: workersAI("@cf/moonshotai/kimi-k2.6"),
      system: "You are a concise voice assistant.",
      messages: [
        ...context.messages.map((message) => ({
          role: message.role as "user" | "assistant",
          content: message.content,
        })),
        { role: "user" as const, content: transcript },
      ],
      abortSignal: context.signal,
    });

    return result.textStream;
  }
}
```

## Lifecycle hooks

| Hook | Purpose |
|---|---|
| `onTurn(transcript, context)` | Handle the completed transcript and return text or a text stream |
| `onCallStart(connection)` | Call connected |
| `onCallEnd(connection)` | Call disconnected |

## Client (React)

```tsx
import { useVoiceAgent } from "@cloudflare/voice/react";

function VoiceUI() {
  const { status, startCall, endCall } = useVoiceAgent({ agent: "VoiceAgent" });

  return (
    <button onClick={status === "idle" ? startCall : endCall}>
      {status === "idle" ? "Start Call" : "End Call"}
    </button>
  );
}
```

## STT/TTS providers

For full `withVoice` agents, the built-in Workers AI defaults are `WorkersAIFluxSTT(this.env.AI)` and `WorkersAITTS(this.env.AI)`. `WorkersAINova3STT` is documented for the STT-only `withVoiceInput` path. Third-party provider packages are also available; follow the live Voice docs for their current constructor options.
