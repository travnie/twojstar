export const WEBMCP_SCRIPT = String.raw`"use strict";
(() => {
  const context = document.modelContext;
  if (!context?.registerTool) return;

  const runtime = globalThis;
  const ownerKey = "__trfnyWeatherWebMcpLifecycle";
  const previous = runtime[ownerKey];
  if (previous && typeof previous.abort === "function") previous.abort();

  const lifecycle = new AbortController();
  runtime[ownerKey] = lifecycle;

  const cleanup = () => {
    lifecycle.abort();
    if (runtime[ownerKey] === lifecycle) delete runtime[ownerKey];
  };
  window.addEventListener("pagehide", (event) => {
    if (!event.persisted) cleanup();
  }, { once: true });

  const tool = {
    name: "read_weather_state",
    title: "Read Kościelec weather",
    description: "Read the current multi-source Kościelec/Chrzanów weather ensemble, air quality and active IMGW warnings.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    async execute(input = {}, options = {}) {
      if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length !== 0) {
        return { ok: false, error: "This tool does not accept arguments." };
      }
      const response = await fetch("/state.json", {
        cache: "no-store",
        headers: { accept: "application/json" },
        signal: options.signal,
      });
      if (!response.ok) {
        return { ok: false, status: response.status, error: "Weather state is unavailable." };
      }
      return { ok: true, state: await response.json() };
    },
  };

  try {
    Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal }))
      .catch((error) => console.warn("Weather WebMCP registration failed", error));
  } catch (error) {
    console.warn("Weather WebMCP registration failed", error);
  }
})();
`;
