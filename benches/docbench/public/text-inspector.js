"use strict";

(() => {
const { scanText, summarizeFindings } = globalThis.DocBenchTextInspector;
const { planRepairs, groups: repairGroups } = globalThis.DocBenchTextRepair;
let lastRepair = null;
let internalEdit = false;

const t = (value) => globalThis.BenchI18n?.t(value) || value;


const select = (selector) => document.querySelector(selector);
const editor = select("#editor");
const preview = select("#preview");
const previewTitle = select("#preview-title");
const statusBadge = select("#status-badge");
const inspectButton = select("#inspect-button");

function setStatus(kind, text) {
  statusBadge.className = `status ${kind}`;
  statusBadge.textContent = text;
  statusBadge.removeAttribute("title");
}

function revealFinding(finding) {
  const start = Math.max(0, Math.min(editor.value.length, finding.offset));
  const end = Math.max(start, Math.min(editor.value.length, start + finding.length));
  editor.focus({ preventScroll: true });
  editor.setSelectionRange(start, end);
}

function severityLabel(severity) {
  if (severity === "high") return "High";
  if (severity === "medium") return "Review";
  return "Info";
}

function findingRow(finding) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `inspect-finding severity-${finding.severity}`;
  button.addEventListener("click", () => revealFinding(finding));

  const heading = document.createElement("span");
  heading.className = "inspect-finding-heading";
  const severity = document.createElement("span");
  severity.className = `inspect-severity severity-${finding.severity}`;
  severity.textContent = severityLabel(finding.severity);
  const title = document.createElement("strong");
  title.textContent = finding.label;
  const position = document.createElement("span");
  position.className = "inspect-position";
  position.textContent = `line ${finding.line}:${finding.column}`;
  heading.append(severity, title, position);

  const detail = document.createElement("span");
  detail.className = "inspect-detail";
  detail.textContent = finding.detail;
  button.append(heading, detail);
  return button;
}

function cleanResult() {
  const box = document.createElement("div");
  box.className = "inspect-clean";
  const title = document.createElement("strong");
  title.textContent = "No suspicious text patterns found";
  const note = document.createElement("span");
  note.textContent = "This is a local heuristic scan, not proof that a document is safe.";
  box.append(title, note);
  return box;
}

function summaryRow(summary, truncated) {
  const row = document.createElement("div");
  row.className = "inspect-summary";
  for (const [severity, count] of Object.entries(summary)) {
    const chip = document.createElement("span");
    chip.className = `inspect-summary-chip severity-${severity}`;
    chip.textContent = `${severityLabel(severity)} ${count}`;
    row.append(chip);
  }
  const note = document.createElement("span");
  note.className = "inspect-summary-note";
  note.textContent = truncated
    ? "Showing the retained findings in source order; additional matches were truncated. Click a finding to jump to source."
    : "Prompt-injection and marker findings are heuristic; click any finding to jump to source.";
  row.append(note);
  return row;
}

function repairSection(findings) {
  const eligible = planRepairs(editor.value, findings, []);
  const canUndo = lastRepair && editor.value === lastRepair.after;
  if (!findings.length && !canUndo) return null;

  const box = document.createElement("section");
  box.className = "inspect-repairs";
  const title = document.createElement("h3");
  title.className = "inspect-repair-title";
  title.textContent = t("Repair suggestions");
  const note = document.createElement("p");
  note.className = "inspect-repair-note";
  note.textContent = t("Repairs change only the editor. Saving may overwrite an opened file; review changes first.");
  box.append(title, note);

  if (canUndo) {
    const undo = document.createElement("button");
    undo.type = "button";
    undo.className = "button compact";
    undo.textContent = t("Undo last repair");
    undo.addEventListener("click", () => {
      if (!lastRepair || editor.value !== lastRepair.after) return;
      const previous = lastRepair.before;
      lastRepair = null;
      updateEditor(previous);
      inspectDocument();
    });
    box.append(undo);
  }

  if (eligible.blocked) {
    const warning = document.createElement("p");
    warning.className = "inspect-repair-warning";
    warning.textContent = t("Inspection truncated. Repair a smaller document to avoid partial changes.");
    box.append(warning);
    return box;
  }
  if (!Object.values(eligible.counts).some(Boolean)) {
    if (findings.length) {
      const warning = document.createElement("p");
      warning.textContent = t("These findings need manual review; no deterministic repair is available.");
      box.append(warning);
    }
    return box;
  }

  const options = document.createElement("fieldset");
  options.className = "inspect-repair-options";
  const legend = document.createElement("legend");
  legend.textContent = t("Choose repair types");
  options.append(legend);
  const checkboxes = [];
  for (const group of repairGroups) {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = group.id;
    checkbox.checked = group.defaultOn && eligible.counts[group.id] > 0;
    checkbox.disabled = eligible.counts[group.id] === 0;
    const labelText = document.createElement("span");
    labelText.textContent = t(group.label) + " (" + eligible.counts[group.id] + ")";
    label.append(checkbox, labelText);
    options.append(label);
    checkboxes.push(checkbox);
  }
  box.append(options);

  const actions = document.createElement("div");
  actions.className = "inspect-repair-actions";
  const previewButton = document.createElement("button");
  previewButton.id = "inspect-preview-repairs";
  previewButton.className = "button compact";
  previewButton.type = "button";
  previewButton.textContent = t("Preview repairs");
  const applyButton = document.createElement("button");
  applyButton.id = "inspect-apply-repairs";
  applyButton.className = "button compact primary";
  applyButton.type = "button";
  applyButton.textContent = t("Apply reviewed repairs");
  applyButton.disabled = true;
  actions.append(previewButton, applyButton);
  const result = document.createElement("div");
  result.className = "inspect-repair-result";
  result.setAttribute("aria-live", "polite");
  box.append(actions, result);

  let planned = null;
  for (const checkbox of checkboxes) {
    checkbox.addEventListener("change", () => {
      planned = null;
      applyButton.disabled = true;
      result.replaceChildren();
    });
  }
  previewButton.addEventListener("click", () => {
    const selected = checkboxes.filter((item) => item.checked).map((item) => item.value);
    const source = editor.value;
    const current = scanText(source);
    planned = planRepairs(source, current, selected);
    result.replaceChildren();
    applyButton.disabled = planned.blocked || planned.changes.length === 0;
    const status = document.createElement("p");
    status.textContent = planned.blocked
      ? t("Inspection truncated. Repair a smaller document to avoid partial changes.")
      : t(planned.changes.length + (planned.changes.length === 1
        ? " proposed change." : " proposed changes."));
    result.append(status);
    if (applyButton.disabled) return;
    const changes = document.createElement("ol");
    changes.className = "inspect-repair-changes";
    for (const change of planned.changes.slice(0, 32)) {
      const item = document.createElement("li");
      const group = repairGroups.find((entry) => entry.id === change.group);
      item.textContent = change.codepoint + " · " + t(group?.label || change.group)
        + " · " + t(change.replacement ? "replace with a space" : "remove")
        + " · " + t("offset") + " " + change.offset;
      changes.append(item);
    }
    result.append(changes);
    if (planned.changes.length > 32) {
      const extra = document.createElement("p");
      extra.textContent = t("Showing the first 32 proposed changes. All selected changes will apply.");
      result.append(extra);
    }
  });
  applyButton.addEventListener("click", () => {
    if (!planned || planned.blocked || !planned.changes.length) return;
    if (editor.value !== planned.source) {
      planned = null;
      applyButton.disabled = true;
      result.textContent = t("Document changed. Preview repairs again.");
      return;
    }
    lastRepair = { before: planned.source, after: planned.result };
    updateEditor(planned.result);
    inspectDocument();
  });
  return box;
}

function updateEditor(value) {
  internalEdit = true;
  try {
    editor.value = value;
    editor.dispatchEvent(new Event("input", { bubbles: true }));
    document.dispatchEvent(new Event("docbench:document-change"));
  } finally {
    internalEdit = false;
  }
}

function inspectDocument() {
  document.dispatchEvent(new Event("docbench:inspect-start"));
  const findings = scanText(editor.value);
  const summary = summarizeFindings(findings);
  preview.className = "preview-inspector";
  previewTitle.textContent = "Text safety inspection";
  if (!findings.length) {
    const repairs = repairSection(findings);
    preview.replaceChildren(cleanResult(), ...(repairs ? [repairs] : []));
    setStatus("good", "Inspect · clean");
    return;
  }
  const list = document.createElement("div");
  list.className = "inspect-findings";
  for (const finding of findings) list.append(findingRow(finding));
  const repairs = repairSection(findings);
  preview.replaceChildren(summaryRow(summary, findings.truncated), ...(repairs ? [repairs] : []), list);
  setStatus(summary.high ? "bad" : "neutral", `Inspect · ${findings.length}${findings.truncated ? "+" : ""}`);
}

function enableInspectionAfterInitialPreview() {
  setTimeout(() => {
    inspectButton.disabled = false;
  }, 0);
}

editor.addEventListener("input", () => {
  if (!internalEdit) lastRepair = null;
});
document.addEventListener("docbench:document-change", () => {
  if (!internalEdit) lastRepair = null;
});
inspectButton.disabled = true;
inspectButton.addEventListener("click", inspectDocument);
if (document.readyState === "complete") enableInspectionAfterInitialPreview();
else window.addEventListener("load", enableInspectionAfterInitialPreview, { once: true });
})();

import("./token-counter.mjs").catch((error) => {
  console.warn("DocBench token counter failed to initialize", error);
});
