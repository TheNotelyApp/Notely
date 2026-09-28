/**
 * Dedicated Speech-to-Text (STT) Web Worker
 * Runs Whisper ONNX inference completely off the main thread.
 * Guarantees 0 main UI freeze, stutter, or lag.
 */

import { pipeline, env } from "@huggingface/transformers";

// Configure transformers.js inside the worker
env.allowLocalModels = false;
env.useBrowserCache = true;
if (env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.numThreads = 1;
}

let activePipeline = null;
let activeModelName = null;

async function getWorkerPipeline(modelName, onProgress) {
  if (activePipeline && activeModelName === modelName) {
    return activePipeline;
  }

  const pipelineOpts = {
    progress_callback: (info) => {
      if (typeof onProgress === "function") {
        onProgress(info);
      }
    },
  };

  // Avoid q8 on whisper-small to bypass missing scale tensor crash in ONNX runtime optimizer
  if (modelName.includes("small")) {
    pipelineOpts.dtype = {
      encoder_model: "fp32",
      decoder_model_merged: "q4",
    };
  }

  activePipeline = await pipeline("automatic-speech-recognition", modelName, pipelineOpts);
  activeModelName = modelName;
  return activePipeline;
}

self.addEventListener("message", async (event) => {
  const { id, type, payload } = event.data || {};
  if (!id) return;

  try {
    switch (type) {
      case "PRELOAD": {
        const { modelName } = payload;
        await getWorkerPipeline(modelName, (progressInfo) => {
          self.postMessage({ id, type: "PROGRESS", progressInfo });
        });
        self.postMessage({ id, type: "SUCCESS", result: { downloaded: true } });
        break;
      }

      case "TRANSCRIBE": {
        const { pcmData, modelName, duration, sourceMode } = payload;

        // Ensure Float32Array
        const floatData = pcmData instanceof Float32Array ? pcmData : new Float32Array(pcmData);

        const transcriber = await getWorkerPipeline(modelName, (progressInfo) => {
          self.postMessage({ id, type: "PROGRESS", progressInfo });
        });

        const out = await transcriber(floatData, {
          return_timestamps: true,
          chunk_length_s: 30,
          stride_length_s: 5,
        });

        const fullText = out.text?.trim() || "";
        let segments = [];
        if (Array.isArray(out.chunks)) {
          segments = out.chunks.map((chunk) => ({
            start: chunk.timestamp?.[0] ?? 0,
            end: chunk.timestamp?.[1] ?? (duration || 0),
            text: chunk.text?.trim() || "",
            speaker: sourceMode === "meeting" ? "Participant" : "Speaker",
          }));
        }

        self.postMessage({
          id,
          type: "SUCCESS",
          result: { fullText, segments },
        });
        break;
      }

      default:
        throw new Error(`Unknown worker message type: ${type}`);
    }
  } catch (err) {
    self.postMessage({
      id,
      type: "ERROR",
      error: err.message || String(err),
    });
  }
});
