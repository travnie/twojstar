# Storage safety

Treat deletion, retention or Bucket Lock changes, public access, IAM/ACL changes, encryption key changes, lifecycle deletion rules, and unsafe overwrites as sensitive mutations.

Inspect current state, describe the intended delta, and obtain authorization unless the user explicitly requested that exact mutation. Prefer uniform bucket-level access for new designs unless requirements say otherwise.

The upstream Google skills include telemetry attribution conventions. This condensed derivative does not invent or persist telemetry configuration; fetch the current upstream skill or official docs when exact Google tooling attribution is required.
