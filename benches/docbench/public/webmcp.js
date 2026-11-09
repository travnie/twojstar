"use strict";

(() => {

  const context = document.modelContext;
  if (!context?.registerTool) return;

  const registration = globalThis.BenchWebMcp?.createRegistrationLifecycle(context, "Docbench");
  if (!registration) return;
  const { register } = registration;

  const editor = document.querySelector("#editor");
  const formatSelect = document.querySelector("#format-select");
  const eolSelect = document.querySelector("#eol-select");
  const statusBadge = document.querySelector("#status-badge");
  const preview = document.querySelector("#preview");
  const filenameLabel = document.querySelector("#filename-label");
  const documentFormats = globalThis.DocBenchTextFormats?.formatIds
    || ["txt", "md", "json", "jsonc", "json5", "jsonl", "yaml", "xml"];
  const allowedFormats = new Set(documentFormats);

  if (!editor || !formatSelect || !eolSelect || !statusBadge || !preview) return;

  const validateThroughUi = () => {
    const validateButton = document.querySelector("#validate-button");
    if (!validateButton) return { ready: false, ok: false };
    validateButton.click();
    return { ready: true, ok: !statusBadge.classList.contains("bad") };
  };

  const snapshot = ({ includeText = false } = {}) => {
    const value = editor.value;
    const result = {
      filename: filenameLabel?.textContent || "",
      format: formatSelect.value,
      lineEndings: eolSelect.value,
      status: statusBadge.textContent || "",
      preview: (preview.textContent || "").slice(0, 5000),
      lines: value.split("\n").length,
      characters: value.length,
    };
    if (includeText) {
      result.text = value.slice(0, 50000);
      result.textTruncated = value.length > 50000;
    }
    return result;
  };


  // The Files module loads after this classic script in both hosted and portable builds.
  // Expose the existing visible workspace state, never a second file store.
  let filesToolsRegistered = false;
  function registerFilesTools() {
    const files = globalThis.DocBenchFiles;
    if (filesToolsRegistered || !files) return;
    filesToolsRegistered = true;

    register({
      name: "read_file_workspace",
      title: "Read Docbench Files workspace",
      description: "Read bounded local file queue metadata. Names and paths are hidden unless explicitly requested.",
      inputSchema: {
        type: "object",
        properties: {
          includeNames: { type: "boolean", default: false },
          limit: { type: "integer", minimum: 1, maximum: 100, default: 30 },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute({ includeNames = false, limit = 30 } = {}) {
        if (typeof includeNames !== "boolean" || !Number.isInteger(limit) || limit < 1 || limit > 100) {
          return { ok: false, error: "Invalid includeNames or limit." };
        }
        return { ok: true, ...files.snapshot({ includeNames, limit }) };
      },
    });

    register({
      name: "inspect_local_file",
      title: "Inspect local file header",
      description: "Inspect a user-imported file by short-lived ID. Returns format/evidence only, not source bytes or filename.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string", maxLength: 128 } },
        required: ["id"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      async execute({ id } = {}) {
        if (typeof id !== "string" || id.length > 128) {
          return { ok: false, error: "Invalid file ID." };
        }
        return files.inspect(id);
      },
    });

    register({
      name: "select_local_files",
      title: "Select Docbench Files entries",
      description: "Update the visible local file selection by IDs. Does not open OS file pickers or read contents.",
      inputSchema: {
        type: "object",
        properties: {
          ids: { type: "array", maxItems: 100, items: { type: "string", maxLength: 128 } },
        },
        required: ["ids"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute({ ids } = {}) {
        if (!Array.isArray(ids) || ids.length > 100
          || ids.some((id) => typeof id !== "string" || id.length > 128)) {
          return { ok: false, error: "Invalid file IDs." };
        }
        if (!files.select(ids)) return { ok: false, error: "Unknown or stale file ID." };
        return { ok: true, ...files.snapshot() };
      },
    });

    register({
      name: "focus_local_file",
      title: "Focus Docbench file inspector",
      description: "Focus an imported file by ID using the existing Files UI, without selecting extra files.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string", maxLength: 128 } },
        required: ["id"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute({ id } = {}) {
        if (typeof id !== "string" || id.length > 128 || !files.focus(id)) {
          return { ok: false, error: "Unknown or stale file ID." };
        }
        return { ok: true, ...files.snapshot() };
      },
    });
  }
  document.addEventListener("docbench:files-ready", registerFilesTools, { once: true });
  registerFilesTools();

  register({
    name: "read_document",
    title: "Read Docbench document",
    description: "Read the current Docbench document state and optionally its text without changing it.",
    inputSchema: {
      type: "object",
      properties: { includeText: { type: "boolean", default: false } },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute({ includeText = false } = {}) {
      return snapshot({ includeText });
    },
  });


  for (const [name, title, action] of [
    ["undo_document", "Undo last document edit", "undo"],
    ["redo_document", "Redo document edit", "redo"],
  ]) {
    register({
      name,
      title,
      description: "Use the visible Documents editor history. Local only; cannot restore another opened file.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute() {
        const history = globalThis.DocBenchDocumentHistory;
        if (!history) return { ok: false, error: "Document history is unavailable." };
        const changed = history[action]();
        return { ok: changed, changed, ...history.status() };
      },
    });
  }

  register({
    name: "set_document_text",
    title: "Set Docbench document text",
    description: "Replace the document editor text and optionally select its format using the existing Docbench UI state.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", maxLength: 500000 },
        format: { type: "string", enum: documentFormats },
      },
      required: ["text"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute({ text, format } = {}) {
      if (typeof text !== "string" || text.length > 500000) {
        return { ok: false, error: "text must be a string of at most 500000 characters." };
      }
      if (format !== undefined && !allowedFormats.has(format)) {
        return { ok: false, error: `format must be one of: ${documentFormats.join(", ")}.` };
      }
      const setTextAndFormat = () => {
        editor.value = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
        editor.dispatchEvent(new Event("input", { bubbles: true }));
        if (format) {
          formatSelect.value = format;
          formatSelect.dispatchEvent(new Event("change", { bubbles: true }));
        }
        eolSelect.dispatchEvent(new Event("change", { bubbles: true }));
      };
      const history = globalThis.DocBenchDocumentHistory;
      if (history?.transaction) history.transaction(setTextAndFormat);
      else setTextAndFormat();
      const validation = validateThroughUi();
      if (!validation.ready) return { ok: false, error: "Document validator is not ready." };
      return { ok: validation.ok, ...snapshot({ includeText: true }) };
    },
  });

  register({
    name: "validate_document",
    title: "Validate Docbench document",
    description: "Validate or inspect the current supported Docbench text format and update the visible result.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute() {
      const validation = validateThroughUi();
      if (!validation.ready) return { ok: false, error: "Document validator is not ready." };
      return { ok: validation.ok, ...snapshot() };
    },
  });

  register({
    name: "format_document",
    title: "Format Docbench document",
    description: "Auto-format the current document with Docbench's existing formatter and return the resulting text and status.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute() {
      const before = editor.value;
      document.querySelector("#format-button")?.click();
      const result = snapshot({ includeText: true });
      const failed = statusBadge.dataset.formatResult === "failed";
      return { ok: !failed, changed: editor.value !== before, ...result };
    },
  });


  register({
    name: "preview_document_repairs",
    title: "Preview Docbench text repairs",
    description: "Plan exact-offset text repairs without changing the editor. Returns counts and bounded codepoint/offset descriptions, never document contents. Applying requires user review in Docbench.",
    inputSchema: {
      type: "object",
      properties: {
        groups: {
          type: "array", maxItems: 4, uniqueItems: true,
          items: { type: "string", enum: ["bidi", "controls", "invisible", "spaces"] },
        },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute({ groups } = {}) {
      const repair = globalThis.DocBenchTextRepair;
      const inspect = globalThis.DocBenchTextInspector;
      if (!repair?.planRepairs || !inspect?.scanText) {
        return { ok: false, error: "Text repair engine is not ready." };
      }
      if (groups !== undefined && (!Array.isArray(groups) || groups.length > 4
        || new Set(groups).size !== groups.length
        || groups.some((group) => !repair.groups.some((item) => item.id === group)))) {
        return { ok: false, error: "Invalid repair groups." };
      }
      const source = editor.value;
      const findings = inspect.scanText(source);
      const plan = repair.planRepairs(source, findings, groups);
      return {
        ok: !plan.blocked,
        blocked: plan.blocked,
        reason: plan.reason,
        categories: plan.counts,
        proposed: plan.changes.length,
        examples: plan.changes.slice(0, 30).map((change) => ({
          group: change.group,
          codepoint: change.codepoint,
          offset: change.offset,
          operation: change.replacement ? "replace_with_space" : "remove",
        })),
        examplesTruncated: plan.changes.length > 30,
      };
    },
  });

  register({
    name: "inspect_document",
    title: "Inspect Docbench document",
    description: "Read Docbench's local text-safety inspection for hidden characters, markers and prompt-injection-like patterns without changing the document.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute() {
      const inspector = globalThis.DocBenchTextInspector;
      if (!inspector?.scanText || !inspector?.summarizeFindings) {
        return { ok: false, error: "Text inspector is not ready." };
      }
      const findings = inspector.scanText(editor.value);
      return {
        ok: true,
        count: findings.length,
        truncated: Boolean(findings.truncated || findings.length > 100),
        summary: inspector.summarizeFindings(findings),
        findings: findings.slice(0, 100).map((finding) => ({
          severity: finding.severity,
          label: finding.label,
          detail: finding.detail,
          line: finding.line,
          column: finding.column,
          offset: finding.offset,
          length: finding.length,
        })),
      };
    },
  });
})();
