---
name: google-cloud-storage
description: Designs and operates Google Cloud Storage buckets and objects. Use for bucket architecture or creation, uploads/downloads, access, lifecycle, retention, signed URLs, storage classes, transfers, or other GCS tasks.
---

# Google Cloud Storage

Prefer Cloud Storage MCP when structured tools are connected. Fall back to validated gcloud/API/SDK/Terraform only when needed.

Choose a mode:
- **Bucket architecture** for new production buckets: inspect workload, security, durability, location, class, lifecycle, and recovery before creation.
- **Storage operations** for existing buckets/objects: perform the narrow requested read/write/transfer/configuration task.

For new production buckets, present the intended configuration before creation. For access-control, retention-lock, destructive, or public-access changes, require clear authorization and explain irreversible or exposure impact.

Read [workflows.md](references/workflows.md) and [safety.md](references/safety.md).
