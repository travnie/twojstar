# Stateful MCP Apps UI

For widgets with repeated actions, keep a stable model-visible snapshot in `structuredContent` and a monotonic event/revision token to distinguish repeated identical actions. Separate data tools from render tools when attaching a UI resource to every call would remount the widget. Make retries idempotent or document and guard irreversible operations. Persist only the state needed to restore the user experience.

Use MCP Apps `ui/initialize`, `ui/notifications/tool-result`, `tools/call`, and `ui/message` as the baseline; optional ChatGPT-specific `window.openai` support can provide host signals, file access, modal flows, or widget state where needed. The app should remain useful if the host cannot render its component. Verify bridge behavior against the [current UI documentation](https://developers.openai.com/plugins/build/chatgpt-ui).
