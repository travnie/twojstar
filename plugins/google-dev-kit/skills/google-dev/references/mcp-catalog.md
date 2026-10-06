# Google MCP catalog

Use the narrowest server that owns the requested resource. Endpoint definitions
live in the plugin root `mcp.json`; authentication policy lives in
`mcp-auth.json`. A declared URL does not prove the current account can
authenticate, has the necessary IAM permissions, or has preview access.

| Alias | Primary use | Auth | Risk note |
| --- | --- | --- | --- |
| `googleDeveloperKnowledge` | Official Google developer docs | API key preferred; OAuth optional | Read-oriented |
| `googleCloudCli` | Validated gcloud execution | OAuth + IAM | Preview; can mutate cloud resources |
| `googleCloudStorage` | Buckets and objects | OAuth + IAM | Can write/delete data |
| `googleApplicationDesignCenter` | Application Design Center | OAuth + IAM | Preview; deployment mutates resources |
| `googleAndroidManagement` | Android Management | OAuth + IAM | Preview; policy changes mutate devices |
| `googleCloudRun` | Cloud Run resources | OAuth + IAM | Can deploy/modify services |
| `googleApiKeys` | API key lifecycle | OAuth + IAM | Sensitive secrets and destructive operations |
| `googleCloudAssist` | Gemini Cloud Assist | OAuth + IAM | Private preview |
| `googleIam` | IAM roles and deny policies | OAuth + IAM | Security-sensitive writes |
| `geminiApiDocs` | Gemini API docs/examples | None | Read-oriented |

For API Keys, IAM, Android Management, and other security-sensitive control-plane
changes, inspect first and require clear authorization before mutation. Use a
`readOnlyScopes` entry from `mcp-auth.json` when one is published. If a
server officially exposes only a broad OAuth scope, enforce read-only access
with IAM roles and MCP tool policies rather than inventing an unsupported scope.
