import { countDocumentStats } from "./token-counter-core.mjs";

const editor = document.querySelector("#editor");
const detailStatus = document.querySelector("#detail-status");
const eolSelect = document.querySelector("#eol-select");
const encodingLabel = document.querySelector("#encoding-label");

if (editor && detailStatus) {
  const STORAGE_KEY = "docbench:token-count-enabled";
  const BASIC_STATS_DELAY = 120;
  const TOKEN_COUNT_DELAY = 360;
  const numberFormatter = new Intl.NumberFormat();
  const tokenizerAssets = globalThis.__docbenchTokenizerAssets || {};
  const liteModuleUrl = tokenizerAssets.liteUrl || new URL("./vendor/js-tiktoken/lite.js", import.meta.url).href;
  const rankModuleUrl = tokenizerAssets.rankUrl || new URL("./vendor/js-tiktoken/ranks/o200k_base.js", import.meta.url).href;

  const style = document.createElement("style");
  style.textContent = `
    .document-stats-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px 14px;
      padding: 8px 12px 10px;
      color: var(--muted);
      font: 600 0.69rem/1.35 "Space Mono", ui-monospace, monospace;
    }
    .document-stats-bar .detail-status {
      margin: 0;
      padding: 0;
    }
    .document-counters {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: flex-end;
      gap: 5px 10px;
    }
    .document-counter {
      white-space: nowrap;
    }
    .token-counter-toggle {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      cursor: pointer;
      white-space: nowrap;
    }
    .token-counter-toggle input {
      width: 14px;
      height: 14px;
      margin: 0;
    }
    #token-count-value {
      color: var(--text-soft);
    }
    @media (max-width: 680px) {
      .document-stats-bar,
      .document-counters {
        align-items: flex-start;
        justify-content: flex-start;
      }
      .document-stats-bar {
        flex-direction: column;
      }
    }
  `;
  document.head.append(style);

  const bar = document.createElement("div");
  bar.className = "document-stats-bar";
  detailStatus.before(bar);
  bar.append(detailStatus);

  const counters = document.createElement("div");
  counters.className = "document-counters";
  counters.setAttribute("aria-label", "Document statistics");

  const words = document.createElement("span");
  words.className = "document-counter";
  const characters = document.createElement("span");
  characters.className = "document-counter";
  const bytes = document.createElement("span");
  bytes.className = "document-counter";

  const tokenToggle = document.createElement("label");
  tokenToggle.className = "token-counter-toggle";
  tokenToggle.title = "Count locally with the o200k_base tokenizer";
  const tokenCheckbox = document.createElement("input");
  tokenCheckbox.type = "checkbox";
  const tokenToggleText = document.createElement("span");
  tokenToggleText.textContent = "Tokens";
  tokenToggle.append(tokenCheckbox, tokenToggleText);

  const tokenValue = document.createElement("span");
  tokenValue.id = "token-count-value";
  tokenValue.className = "document-counter";
  tokenValue.setAttribute("aria-live", "polite");
  tokenValue.hidden = true;

  counters.append(words, characters, bytes, tokenToggle, tokenValue);
  bar.append(counters);

  let statsTimer = 0;
  let tokenTimer = 0;
  let statsRevision = 0;
  let tokenRevision = 0;
  let workerBlobUrl = "";
  let analysisWorker = null;

  const formatNumber = (value) => numberFormatter.format(value);

  function serializationOptions() {
    return {
      eol: eolSelect?.value || "LF",
      bom: encodingLabel?.textContent?.startsWith("UTF-8 BOM") || false,
    };
  }

  function renderBasicStats(stats) {
    words.textContent = `${formatNumber(stats.words)} word${stats.words === 1 ? "" : "s"}`;
    characters.textContent = `${formatNumber(stats.characters)} char${stats.characters === 1 ? "" : "s"}`;
    bytes.textContent = `${formatNumber(stats.bytes)} B`;
  }

  function createAnalysisWorker() {
    try {
      const portableSource = globalThis.__docbenchTokenWorkerSource;
      if (typeof portableSource === "string" && portableSource) {
        workerBlobUrl = URL.createObjectURL(new Blob([portableSource], { type: "text/javascript" }));
        return new Worker(workerBlobUrl, { type: "module", name: "docbench-document-stats" });
      }
      return new Worker(new URL("./token-counter-worker.mjs", import.meta.url), {
        type: "module",
        name: "docbench-document-stats",
      });
    } catch (error) {
      console.warn("DocBench document worker unavailable", error);
      return null;
    }
  }

  function stopAnalysisWorker() {
    analysisWorker?.terminate();
    analysisWorker = null;
    if (workerBlobUrl) {
      URL.revokeObjectURL(workerBlobUrl);
      workerBlobUrl = "";
    }
  }

  function handleWorkerMessage(event) {
    const result = event.data;
    if (!result || typeof result !== "object") return;

    if (result.type === "stats" && result.revision === statsRevision) {
      renderBasicStats(result.stats);
      return;
    }

    if (result.type === "tokens" && result.revision === tokenRevision && tokenCheckbox.checked) {
      const count = result.count;
      tokenValue.textContent = `${formatNumber(count)} token${count === 1 ? "" : "s"} · o200k`;
      tokenValue.removeAttribute("aria-busy");
      return;
    }

    if (result.type !== "error") return;
    if (result.taskType === "stats" && result.revision === statsRevision) {
      renderBasicStats(countDocumentStats(editor.value, serializationOptions()));
    }
    if (result.taskType === "tokens" && result.revision === tokenRevision) {
      console.warn("DocBench token counter unavailable", result.message);
      tokenValue.textContent = "token count unavailable";
      tokenValue.removeAttribute("aria-busy");
    }
  }

  analysisWorker = createAnalysisWorker();
  analysisWorker?.addEventListener("message", handleWorkerMessage);
  analysisWorker?.addEventListener("error", (error) => {
    console.warn("DocBench document worker failed", error);
    stopAnalysisWorker();
    scheduleBasicStats(0);
    if (tokenCheckbox.checked) {
      tokenValue.textContent = "token count unavailable";
      tokenValue.removeAttribute("aria-busy");
    }
  });

  function updateBasicStats(revision) {
    const text = editor.value;
    const serialization = serializationOptions();
    if (analysisWorker) {
      analysisWorker.postMessage({ type: "stats", revision, text, serialization });
      return;
    }
    if (revision === statsRevision) renderBasicStats(countDocumentStats(text, serialization));
  }

  function scheduleBasicStats(delay = BASIC_STATS_DELAY) {
    statsRevision += 1;
    clearTimeout(statsTimer);
    const revision = statsRevision;
    statsTimer = setTimeout(() => updateBasicStats(revision), delay);
  }

  function updateTokenCount(revision) {
    if (revision !== tokenRevision || !tokenCheckbox.checked) return;
    tokenValue.textContent = "counting…";
    tokenValue.setAttribute("aria-busy", "true");
    if (!analysisWorker) {
      tokenValue.textContent = "token count unavailable";
      tokenValue.removeAttribute("aria-busy");
      return;
    }
    analysisWorker.postMessage({
      type: "tokens",
      revision,
      text: editor.value,
      liteModuleUrl,
      rankModuleUrl,
    });
  }

  function scheduleTokenCount(delay = TOKEN_COUNT_DELAY) {
    tokenRevision += 1;
    clearTimeout(tokenTimer);
    if (!tokenCheckbox.checked) {
      tokenValue.hidden = true;
      tokenValue.removeAttribute("aria-busy");
      return;
    }
    tokenValue.hidden = false;
    const revision = tokenRevision;
    tokenTimer = setTimeout(() => updateTokenCount(revision), delay);
  }

  function refreshCounters(delay = 0) {
    scheduleBasicStats(delay);
    scheduleTokenCount(delay || TOKEN_COUNT_DELAY);
  }

  function storedTokenPreference() {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  }

  function storeTokenPreference(enabled) {
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
    } catch {
      // File URLs and hardened browsers may deny storage. The toggle still works for this session.
    }
  }

  tokenCheckbox.checked = storedTokenPreference();
  tokenCheckbox.addEventListener("change", () => {
    storeTokenPreference(tokenCheckbox.checked);
    scheduleTokenCount(0);
  });
  editor.addEventListener("input", () => {
    scheduleBasicStats();
    scheduleTokenCount();
  });
  eolSelect?.addEventListener("change", () => refreshCounters(0));
  document.addEventListener("docbench:document-change", () => refreshCounters(0));
  if (encodingLabel) {
    new MutationObserver(() => scheduleBasicStats(0)).observe(encodingLabel, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }
  addEventListener("pagehide", stopAnalysisWorker, { once: true });

  scheduleBasicStats(0);
  scheduleTokenCount(0);
}
