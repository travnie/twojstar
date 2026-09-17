import { countDocumentStats } from "./token-counter-core.mjs";

let encoderPromise = null;
let encoderKey = "";

async function getEncoder(liteModuleUrl, rankModuleUrl) {
  const key = `${liteModuleUrl}\u0000${rankModuleUrl}`;
  if (!encoderPromise || key !== encoderKey) {
    encoderKey = key;
    encoderPromise = Promise.all([
      import(liteModuleUrl),
      import(rankModuleUrl),
    ])
      .then(([{ Tiktoken }, { default: o200kBase }]) => new Tiktoken(o200kBase))
      .catch((error) => {
        encoderPromise = null;
        encoderKey = "";
        throw error;
      });
  }
  return encoderPromise;
}

self.addEventListener("message", async (event) => {
  const task = event.data;
  if (!task || typeof task !== "object" || !Number.isInteger(task.revision)) return;

  try {
    if (task.type === "stats") {
      const stats = countDocumentStats(String(task.text ?? ""), task.serialization ?? {});
      self.postMessage({ type: "stats", revision: task.revision, stats });
      return;
    }

    if (task.type === "tokens") {
      const encoder = await getEncoder(task.liteModuleUrl, task.rankModuleUrl);
      const count = encoder.encode(String(task.text ?? "")).length;
      self.postMessage({ type: "tokens", revision: task.revision, count });
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      taskType: task.type,
      revision: task.revision,
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
