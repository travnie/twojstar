# Cloud Run workflow

**Services:** HTTP/event endpoints. Verify ingress, auth, service identity, secrets, scaling, resources, and traffic strategy when relevant.

**Jobs:** finite batch/scheduled work. Check tasks, parallelism, retries, timeout, identity, and trigger. Starting execution is a mutation.

**Worker pools:** continuously running pull-based workers. Check image/source, scaling, connection behavior, and graceful shutdown.

On failure, retrieve the smallest relevant status/logs first. Common classes are startup/port errors, image access, IAM/service identity, quota/location, and build dependency failures. Ground remediation in current docs.
