# Gemini SDK routing

Prefer the Google Gen AI SDK family: Python `google-genai`, JavaScript/TypeScript `@google/genai`, Go `google.golang.org/genai`, Java `com.google.genai:google-genai`, and .NET `Google.GenAI`.

Avoid new integrations with superseded Gemini/Vertex generative SDKs when Gen AI SDK supports the feature.

Gemini Developer API is typically API-key based. Google Cloud Agent Platform/enterprise uses project/location and Google authentication, normally Application Default Credentials.

Do not hardcode a favorite model list. Fetch current model names and feature matrices from `geminiApiDocs` or Developer Knowledge whenever the exact model matters.
