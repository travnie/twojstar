# gcloud safety

Leaf help is authoritative for command names, positional arguments, flags, and flag values. Parent-group help is discovery only.

Before mutation: validate leaf syntax, verify project/location scope, check for dry-run or validate-only support, and present security/data-sensitive changes when the user has not already authorized that exact action.

Never run an unconstrained list when a small limit, focused filter, or projection can answer the question. Require explicit authorization for IAM changes, API enablement, deletes, billing, organization-level changes, KMS changes, and destructive infrastructure application.
