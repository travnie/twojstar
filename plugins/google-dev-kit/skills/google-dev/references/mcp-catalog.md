# Google MCP catalog

Use the narrowest server that owns the requested resource. A URL in `mcp.json` does not prove the current account can authenticate or has preview access.

| Alias | Primary use | Risk note |
| --- | --- | --- |
| `googleDeveloperKnowledge` | Official Google developer docs | Read-oriented |
| `googleCloudCli` | Validated gcloud execution | Can mutate cloud resources |
| `googleCloudStorage` | Buckets and objects | Can write/delete data |
| `googleApplicationDesignCenter` | Application Design Center | Preview; deployment mutates resources |
| `googleAndroidManagement` | Android Management | Preview; policy changes mutate devices |
| `googleCloudRun` | Cloud Run resources | Can deploy/modify services |
| `googleApiKeys` | API key lifecycle | Sensitive secrets and destructive operations |
| `googleCloudAssist` | Gemini Cloud Assist | Access may be private preview |
| `googleIam` | IAM roles and deny policies | Security-sensitive writes |
| `geminiApiDocs` | Gemini API docs/examples | Read-oriented |

For API Keys, IAM, Android Management, and other security-sensitive control-plane changes, inspect first and require clear authorization before mutation.
