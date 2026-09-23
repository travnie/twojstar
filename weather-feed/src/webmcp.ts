export const WEBMCP_SCRIPT = String.raw`"use strict";
(() => {
  const context = document.modelContext;
  if (!context?.registerTool) return;

  const ownerKey = Symbol.for("trfny.weather.webmcp.lifecycle");
  const previous = globalThis[ownerKey];
  if (previous && typeof previous.abort === "function") previous.abort();

  const lifecycle = new AbortController();
  globalThis[ownerKey] = lifecycle;

  const cleanup = () => {
    lifecycle.abort();
    if (globalThis[ownerKey] === lifecycle) delete globalThis[ownerKey];
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
