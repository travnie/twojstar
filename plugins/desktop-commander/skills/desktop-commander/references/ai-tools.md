# MCP and local AI tools

Inspect before installing. Identify the client, host OS, current connector state, config file, service status and first actionable error. Back up an existing config before edits, preserve unrelated servers, validate syntax, and verify the target client actually discovers and calls a tool. Redact tokens and private paths in responses. Never print a credential or insert it directly into chat-visible command output.

For Desktop Commander itself, read [the upstream repository](https://github.com/wonderwhy-er/DesktopCommanderMCP) for current setup and remote-device instructions. Its local stdio package and remote connection are different surfaces; a skill does not start or register either. Respect the user's configured `allowedDirectories` and blocked commands.

For other MCP clients, locate the client's real configuration rather than assuming Claude Desktop's `claude_desktop_config.json` applies. Check JSON nesting, launch executable/PATH, runtime dependency, server logs, authentication, and whether the client needs a reload. A local `npx` entry belongs to a client that accepts stdio servers; remote ChatGPT needs an appropriate remote MCP connection.

For [Hermes Agent](https://hermes-agent.nousresearch.com/docs/) or [OpenClaw](https://docs.openclaw.ai/), check live documentation before using installer, config or provider syntax. Disambiguate Hermes Agent from Hermes models in Ollama. Debug in order: provider key/credit and model/tool compatibility; daemon/process and port; connection; first useful log error. Make a minimal, bounded test request when authorized and practical. Don't replace working provider chains or memory to fix an unrelated startup issue.
