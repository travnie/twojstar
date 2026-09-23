"use strict";

(() => {
  function createRegistrationLifecycle(context, label) {
    if (!context?.registerTool) return null;

    const lifecycle = new AbortController();
    const warning = `${label} WebMCP registration failed`;
    const register = (tool) => {
      try {
        Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal }))
          .catch((error) => console.warn(warning, error));
      } catch (error) {
        console.warn(warning, error);
      }
    };

    const cleanup = () => {
      lifecycle.abort();
      if (owners.get(label) === lifecycle) owners.delete(label);
    };

    window.addEventListener("pagehide", (event) => {
      if (!event.persisted) cleanup();
    }, { once: true });

    return Object.freeze({ register, cleanup });
  }

  globalThis.BenchWebMcp = Object.freeze({ createRegistrationLifecycle });
})();
