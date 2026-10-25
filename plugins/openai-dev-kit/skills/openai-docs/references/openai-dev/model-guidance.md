# Documentation and model changes

For a specific API question, search the official docs for the named feature, fetch the most relevant page, then inspect the API reference/OpenAPI specification for required fields, enum values, and response shapes. Distinguish an API key from ChatGPT or connector authorization.

For broad Codex setup or behavior, consult the current Codex manual first; use narrower docs to resolve gaps. A statement from the current session's callable tools can establish what this environment supports even when a general docs page is behind.

For a model choice or migration:

1. Read https://developers.openai.com/api/docs/guides/latest-model.md and follow its current migration/prompting links. If the user specified a target model, keep it.
2. Locate active model configuration, provider routing, prompts, tests, and usage assumptions. Confirm the target model's actual capabilities and API parameters.
3. Change the intended active paths and related prompts; adjust code for incompatible API shapes when required by the task. Do not indiscriminately replace historical examples, eval baselines, comparison data, or intentional low-cost fallback models.
4. Run relevant tests or a small API-shape check when authorized and available. State which behavior remains unverified.

Do not package dated model recommendations or pricing as enduring reference text. Use current official pages at execution time; if unavailable, give bounded guidance and label it unverified.
