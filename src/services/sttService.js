/**
 * Speech-to-Text (STT) Service
 * Orchestrates audio transcription across Local ONNX Whisper (via transformers.js / onnxruntime),
 * Cloud Whisper (Groq / OpenAI), or Browser SpeechRecognition.
 */

import { decodeAudioTo16kMono, encodeWavBlob } from "../utils/audioExtractor.js";
import { aiGetApiKey, aiGetPreferences } from "./electron/aiService.js";

const DEFAULT_STT_SETTINGS = {
  engine: "local-onnx", // "local-onnx" | "groq" | "openai" | "browser"
  localModel: "onnx-community/whisper-tiny.en",
  language: "auto",
  defaultSourceMode: "meeting", // "meeting" | "mic" | "system"
  autoTranscribe: true,
};

let localPipeline = null;
let isLocalLoading = false;

export async function getSTTPreferences() {
  try {
    const prefsRes = await aiGetPreferences();
    if (prefsRes?.success && prefsRes?.preferences?.stt) {
      return { ...DEFAULT_STT_SETTINGS, ...prefsRes.preferences.stt };
    }
  } catch (err) {
    console.warn("[sttService] Failed to load STT preferences from aiService:", err);
  }

  // Fallback to localStorage
  try {
    const local = localStorage.getItem("notely_stt_settings");
    if (local) {
      return { ...DEFAULT_STT_SETTINGS, ...JSON.parse(local) };
    }
  } catch {
    // localStorage not accessible
  }

  return { ...DEFAULT_STT_SETTINGS };
}

export async function setSTTPreferences(newSettings) {
  try {
    localStorage.setItem("notely_stt_settings", JSON.stringify(newSettings));
  } catch {
    // localStorage not accessible
  }

  try {
    const prefsRes = await aiGetPreferences();
    const currentPrefs = prefsRes?.preferences || {};
    await window.notesApi?.aiSetPreferences?.({
      preferences: {
        ...currentPrefs,
        stt: newSettings,
      },
    });
  } catch (err) {
    console.warn("[sttService] Failed to save STT preferences via IPC:", err);
  }
}

/**
 * Checks whether the given Whisper model is already cached locally.
 */
export async function checkLocalWhisperModelStatus(modelName = "onnx-community/whisper-tiny.en") {
  try {
    if (localPipeline) {
      return { downloaded: true, cachedFilesCount: 1 };
    }
    if (typeof caches === "undefined") {
      return { downloaded: false, cachedFilesCount: 0 };
    }
    const cacheNames = await caches.keys();
    const sanitizedName = modelName.replace(/^\/+|\/+$/g, "");
    let isDownloaded = false;
    let cachedFilesCount = 0;

    for (const name of cacheNames) {
      const cache = await caches.open(name);
      const keys = await cache.keys();
      const matching = keys.filter((req) => {
        const url = req.url || "";
        return url.includes(sanitizedName) || (url.includes("whisper") && (url.endsWith(".onnx") || url.endsWith(".json") || url.endsWith(".bin") || url.endsWith(".txt")));
      });
      if (matching.length > 0) {
        cachedFilesCount += matching.length;
        if (matching.some((req) => req.url.includes(".onnx") || req.url.includes("tokenizer") || req.url.includes("config.json"))) {
          isDownloaded = true;
        }
      }
    }

    return {
      downloaded: isDownloaded,
      cachedFilesCount,
    };
  } catch (err) {
    console.warn("[sttService] Error checking local model cache:", err);
    return { downloaded: Boolean(localPipeline), cachedFilesCount: 0 };
  }
}

let sttWorkerInstance = null;
let sttRequestIdCounter = 0;
const pendingWorkerTasks = new Map();

function getOrCreateSTTWorker() {
  if (sttWorkerInstance) return sttWorkerInstance;

  try {
    sttWorkerInstance = new Worker(
      new URL("../workers/sttWorker.js", import.meta.url),
      { type: "module" }
    );

    sttWorkerInstance.onmessage = (event) => {
      const { id, type, progressInfo, result, error } = event.data || {};
      const pending = pendingWorkerTasks.get(id);
      if (!pending) return;

      if (type === "PROGRESS") {
        if (typeof pending.onProgress === "function") {
          pending.onProgress(progressInfo);
        }
      } else if (type === "SUCCESS") {
        pendingWorkerTasks.delete(id);
        pending.resolve(result);
      } else if (type === "ERROR") {
        pendingWorkerTasks.delete(id);
        pending.reject(new Error(error || "Worker STT task failed"));
      }
    };

    sttWorkerInstance.onerror = (err) => {
      console.error("[sttService] Worker error:", err);
      // Clean up all pending with error
      for (const [id, pending] of pendingWorkerTasks.entries()) {
        pending.reject(new Error("STT Web Worker encountered an unexpected error"));
        pendingWorkerTasks.delete(id);
      }
      sttWorkerInstance = null;
    };
  } catch (err) {
    console.warn("[sttService] Could not spawn STT Web Worker, falling back to main thread:", err);
    sttWorkerInstance = null;
  }

  return sttWorkerInstance;
}

function runWorkerTask(type, payload, onProgress) {
  const worker = getOrCreateSTTWorker();
  if (!worker) {
    return null; // Signals caller to fall back to main thread
  }

  return new Promise((resolve, reject) => {
    const id = ++sttRequestIdCounter;
    pendingWorkerTasks.set(id, { resolve, reject, onProgress });
    worker.postMessage({ id, type, payload });
  });
}

/**
 * Pre-downloads and caches the local ONNX Whisper model with progress reporting.
 */
export async function preDownloadLocalWhisperModel(modelName = "onnx-community/whisper-tiny.en", onProgress = null) {
  // Reset cached pipeline reference to force fresh initialization if necessary
  localPipeline = null;

  // Try Web Worker first for non-blocking download
  const workerRes = await runWorkerTask("PRELOAD", { modelName }, onProgress);
  if (workerRes) return workerRes;

  return await getLocalWhisperPipeline(modelName, onProgress);
}

/**
 * Removes cached Whisper model files from browser Cache Storage.
 */
export async function deleteLocalWhisperModel(modelName = "onnx-community/whisper-tiny.en") {
  try {
    localPipeline = null;
    if (sttWorkerInstance) {
      sttWorkerInstance.terminate();
      sttWorkerInstance = null;
      pendingWorkerTasks.clear();
    }
    if (typeof caches === "undefined") return { success: true };
    const cacheNames = await caches.keys();
    const sanitizedName = modelName.replace(/^\/+|\/+$/g, "");
    let deletedCount = 0;

    for (const name of cacheNames) {
      const cache = await caches.open(name);
      const keys = await cache.keys();
      for (const req of keys) {
        const url = req.url || "";
        if (url.includes(sanitizedName) || (url.includes("whisper") && (url.endsWith(".onnx") || url.endsWith(".json") || url.endsWith(".bin") || url.endsWith(".txt")))) {
          await cache.delete(req);
          deletedCount++;
        }
      }
    }
    return { success: true, deletedCount };
  } catch (err) {
    console.warn("[sttService] Failed to delete local Whisper model:", err);
    throw err;
  }
}

/**
 * Initializes or retrieves cached HuggingFace Transformers pipeline for local Whisper (fallback).
 */
async function getLocalWhisperPipeline(modelName = "onnx-community/whisper-tiny.en", onProgress = null) {
  if (localPipeline) return localPipeline;
  if (isLocalLoading) {
    // Wait for in-flight initialization
    let attempts = 0;
    while (isLocalLoading && attempts < 100) {
      await new Promise((r) => setTimeout(r, 200));
      attempts++;
    }
    if (localPipeline) return localPipeline;
  }

  isLocalLoading = true;
  try {
    const { pipeline, env } = await import("@huggingface/transformers");
    // Ensure ONNX runtime loads properly in browser / Electron renderer
    env.allowLocalModels = false;
    env.useBrowserCache = true;
    if (env.backends?.onnx?.wasm) {
      env.backends.onnx.wasm.numThreads = 1;
    }

    const pipelineOpts = {
      progress_callback: (info) => {
        if (typeof onProgress === "function") {
          try {
            onProgress(info);
          } catch (cbErr) {
            console.warn("[sttService] progress_callback error:", cbErr);
          }
        }
      },
    };

    // Avoid q8 on whisper-small: ONNX runtime TransposeDQWeightsForMatMulNBits optimizer crashes with missing scale tensor
    if (modelName.includes("small")) {
      pipelineOpts.dtype = {
        encoder_model: "fp32",
        decoder_model_merged: "q4"
      };
    }

    localPipeline = await pipeline("automatic-speech-recognition", modelName, pipelineOpts);
    return localPipeline;
  } catch (err) {
    console.error("[sttService] Failed to initialize local Whisper pipeline:", err);
    throw err;
  } finally {
    isLocalLoading = false;
  }
}

/**
 * Transcribe using Groq Whisper API (whisper-large-v3).
 */
async function transcribeWithGroq(wavBlob, apiKey, language = "en") {
  if (!apiKey) throw new Error("Groq API key not configured. Add it in AI Settings.");

  const formData = new FormData();
  formData.append("file", wavBlob, "audio.wav");
  formData.append("model", "whisper-large-v3");
  formData.append("response_format", "verbose_json");
  if (language && language !== "auto") {
    formData.append("language", language);
  }

  const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq Whisper transcription failed (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Transcribe using OpenAI Whisper API (whisper-1).
 */
async function transcribeWithOpenAI(wavBlob, apiKey, language = "en") {
  if (!apiKey) throw new Error("OpenAI API key not configured. Add it in AI Settings.");

  const formData = new FormData();
  formData.append("file", wavBlob, "audio.wav");
  formData.append("model", "whisper-1");
  formData.append("response_format", "verbose_json");
  if (language && language !== "auto") {
    formData.append("language", language);
  }

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI Whisper transcription failed (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Generate heuristic summary (key points and action items) from transcription text.
 */
function extractSummaryFromText(text = "") {
  if (!text || text.length < 40) {
    return { keyPoints: [], actionItems: [] };
  }

  const sentences = text
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const actionKeywords = /\b(action|todo|will|need to|should|must|assign|follow up|deadline|by friday|by monday)\b/i;
  const actionItems = [];
  const keyPoints = [];

  for (const sentence of sentences) {
    if (actionKeywords.test(sentence)) {
      if (actionItems.length < 5) actionItems.push(sentence);
    } else {
      if (keyPoints.length < 5 && sentence.length > 20) keyPoints.push(sentence);
    }
  }

  return {
    keyPoints: keyPoints.length > 0 ? keyPoints : sentences.slice(0, 3),
    actionItems,
  };
}

/**
 * Main transcription function
 * @param {Blob} audioBlob
 * @param {Object} options
 * @param {Function} [options.onProgress]
 * @returns {Promise<{ fullText: string, segments: Array, duration: number, summary: Object, sourceMode: string, createdAt: string }>}
 */
export async function transcribeAudio(audioBlob, options = {}) {
  const settings = await getSTTPreferences();
  const engine = options.engine || settings.engine || "local-onnx";
  const sourceMode = options.sourceMode || settings.defaultSourceMode || "meeting";

  const { pcmData, duration } = await decodeAudioTo16kMono(audioBlob, 16000);
  const wavBlob = encodeWavBlob(pcmData, 16000);

  let fullText = "";
  let segments = [];

  if (engine === "groq") {
    let groqKey = "";
    try {
      const keyRes = await aiGetApiKey({ provider: "groq" });
      groqKey = keyRes?.apiKey || "";
    } catch {
      // Groq key not set
    }
    const result = await transcribeWithGroq(wavBlob, groqKey, settings.language);
    fullText = result.text || "";
    if (Array.isArray(result.segments)) {
      segments = result.segments.map((seg) => ({
        start: seg.start,
        end: seg.end,
        text: seg.text?.trim() || "",
        speaker: sourceMode === "meeting" ? "Participant" : "Speaker",
      }));
    }
  } else if (engine === "openai") {
    let openAiKey = "";
    try {
      const keyRes = await aiGetApiKey({ provider: "openai" });
      openAiKey = keyRes?.apiKey || "";
    } catch {
      // OpenAI key not set
    }
    const result = await transcribeWithOpenAI(wavBlob, openAiKey, settings.language);
    fullText = result.text || "";
    if (Array.isArray(result.segments)) {
      segments = result.segments.map((seg) => ({
        start: seg.start,
        end: seg.end,
        text: seg.text?.trim() || "",
        speaker: sourceMode === "meeting" ? "Participant" : "Speaker",
      }));
    }
  } else {
    // Local ONNX Whisper (or fallback)
    try {
      // 1. Try running inside dedicated Web Worker (0 UI thread block)
      let workerRes = null;
      try {
        workerRes = await runWorkerTask("TRANSCRIBE", {
          pcmData,
          modelName: settings.localModel,
          duration,
          sourceMode,
        }, options.onProgress);
      } catch (workerErr) {
        console.warn("[sttService] Worker transcription failed, trying inline:", workerErr);
      }

      if (workerRes) {
        fullText = workerRes.fullText || "";
        segments = workerRes.segments || [];
      } else {
        // Fallback: run on main thread if worker was unavailable
        const transcriber = await getLocalWhisperPipeline(settings.localModel, options.onProgress);
        const out = await transcriber(pcmData, {
          return_timestamps: true,
          chunk_length_s: 30,
          stride_length_s: 5,
        });

        fullText = out.text?.trim() || "";
        if (Array.isArray(out.chunks)) {
          segments = out.chunks.map((chunk) => ({
            start: chunk.timestamp?.[0] ?? 0,
            end: chunk.timestamp?.[1] ?? duration,
            text: chunk.text?.trim() || "",
            speaker: sourceMode === "meeting" ? "Participant" : "Speaker",
          }));
        }
      }
    } catch (localErr) {
      console.warn("[sttService] Local ONNX transcription failed, trying cloud/browser fallback:", localErr);
      // If local failed and groq/openai key exists, try groq
      let groqKey = "";
      try {
        const keyRes = await aiGetApiKey({ provider: "groq" });
        groqKey = keyRes?.apiKey || "";
      } catch {
        // Groq fallback key not set
      }
      if (groqKey) {
        const result = await transcribeWithGroq(wavBlob, groqKey, settings.language);
        fullText = result.text || "";
      } else {
        throw new Error(`Local transcription failed: ${localErr.message}`);
      }
    }
  }

  // Fallback single segment if no segmented timestamps returned
  if (segments.length === 0 && fullText) {
    segments = [
      {
        start: 0,
        end: duration,
        text: fullText,
        speaker: sourceMode === "meeting" ? "Participant" : "Speaker",
      },
    ];
  }

  const summary = extractSummaryFromText(fullText);

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    duration: Math.round(duration * 10) / 10,
    sourceMode,
    engine,
    fullText,
    segments,
    summary,
  };
}
