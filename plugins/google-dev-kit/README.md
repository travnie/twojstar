# Google Dev Kit

Personal Google Cloud and Gemini developer plugin for ChatGPT/Codex. Seven compact workflow skills sit on top of ten remote MCP endpoints. The source skills are adapted from Google's public `google/skills` repository and deduplicated so volatile commands, model names, and API details come from live documentation instead of bloating every skill.

## Included skills

- `google-dev` — official documentation retrieval, product routing, and MCP catalog.
- `gcloud` — leaf-command validation, scope, output reduction, and mutation guardrails.
- `google-cloud-storage` — merged GCS operations plus production bucket architecture.
- `cloud-run` — services, jobs, worker pools, deployment, and troubleshooting.
- `gemini-api` — current Google Gen AI SDK and Gemini feature routing.
- `gemini-agents-api` — managed Agent Platform control-plane resources.
- `application-design-center` — local-first Terraform design, assessment, import, deploy, and repair.

## MCP endpoints

`mcp.json` declares Developer Knowledge, Cloud CLI, Cloud Storage, Application Design Center, Android Management, Cloud Run, API Keys, Gemini Cloud Assist, IAM, and Gemini API Docs MCP servers.

Several endpoints require Google authentication, project permissions, API enablement, or preview access. Gemini Cloud Assist may require private-preview access. A server declaration is not proof that a ChatGPT account has a registered/authorized connection.

The plugin exposes write capability because several servers can mutate cloud resources. Skills keep reads/planning lightweight, require exact scope, and gate security-sensitive or destructive writes.

## Package

```sh
python -m pip install -r plugins/google-dev-kit/requirements.txt
python plugins/google-dev-kit/scripts/package_plugin.py /tmp/google-dev-kit-0.1.0.zip
```

Packaging validates Agent Plugins 1.0 manifests, MCP endpoints, skill metadata, assets, and `[CHAT, CODEX]` policy. It generates `.codex-plugin/plugin.json` and `.mcp.json` compatibility files.

Private ChatGPT installation can still require registering remote MCP endpoints in developer mode and binding resulting Apps. The source intentionally contains no account-specific App IDs.

## Provenance

Adapted from `google/skills` at commit `1d77046ad3670d62227f50a8f53286f6c6cde08b`. See `THIRD_PARTY_NOTICES.md`. Google-derived skill material remains Apache-2.0; repository packaging code is ISC. This is a personal toolkit maintained by travnie, not an official Google plugin.
