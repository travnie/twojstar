---
name: gemini-api
description: Builds with the current Gemini API and Google Gen AI SDK across supported languages. Use for Gemini generation, multimodal input, tools, structured output, embeddings, media, caching, batch, live/realtime, safety, or SDK migration.
---

# Gemini API

Use the current Google Gen AI SDK, not legacy Gemini or Vertex generative clients. Retrieve current model IDs, feature support, limits, and examples from `geminiApiDocs` instead of freezing them here.

1. Determine backend: Gemini Developer API/API-key flow or Google Cloud Agent Platform/enterprise flow.
2. Determine language and current Gen AI SDK package.
3. Query Gemini docs for the requested feature and current model availability.
4. Keep credentials outside source. Prefer environment/application-default mechanisms appropriate to the backend.
5. Return the smallest runnable example and call out preview or backend-specific behavior.

Read [sdk-routing.md](references/sdk-routing.md).
