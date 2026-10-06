---
name: cloud-run
description: Deploys and manages Cloud Run services, jobs, and worker pools. Use for HTTP services, scheduled or batch jobs, pull-based workers, runtime configuration, deployment, troubleshooting, or Cloud Run architecture.
---

# Cloud Run

Classify the workload as a service, job, or worker pool. Prefer Cloud Run MCP for resource inspection/operations and Developer Knowledge for current limits/configuration.

Before deployment:
1. Confirm project and region.
2. Confirm source/image and runtime contract. HTTP containers must listen on the injected port and externally reachable interface.
3. Inspect current state before changing an existing resource.
4. Validate any gcloud fallback through `$gcloud`.
5. Treat IAM changes, unauthenticated exposure, secret wiring, traffic migration, and deletion as security-sensitive mutations.

Read [workflow.md](references/workflow.md).
