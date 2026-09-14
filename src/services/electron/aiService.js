import { getNotesApi } from "./base";

// aiQuery, aiQueryStream, aiQueryAbort, onChatStreamChunk removed — chat moved to MCP layer


export async function aiGetApiKey(provider) {
  const api = getNotesApi();
  if (typeof api.aiGetApiKey !== "function") {
    throw new Error("AI configuration is unavailable. Please restart the app.");
  }
  return api.aiGetApiKey({ provider });
}

export async function aiGetProviderList() {
  const api = getNotesApi();
  if (typeof api.aiGetProviderList !== "function") {
    throw new Error("AI configuration is unavailable. Please restart the app.");
  }
  return api.aiGetProviderList();
}

export async function aiEnable() {
  const api = getNotesApi();
  if (typeof api.aiEnable !== "function") return { success: false };
  return api.aiEnable();
}

export async function aiDisable() {
  const api = getNotesApi();
  if (typeof api.aiDisable !== "function") return { success: false };
  return api.aiDisable();
}

export async function aiGetHealth() {
  const api = getNotesApi();
  if (typeof api.aiGetHealth !== "function") return { success: false };
  return api.aiGetHealth();
}

export async function aiSetApiKey(provider, apiKey) {
  const api = getNotesApi();
  if (typeof api.aiSetApiKey !== "function") {
    throw new Error("AI configuration is unavailable. Please restart the app.");
  }
  return api.aiSetApiKey({ provider, apiKey });
}

export async function aiGetProviderModel(provider) {
  const api = getNotesApi();
  if (typeof api.aiGetProviderModel !== 'function') return { success: false };
  return api.aiGetProviderModel({ provider });
}

export async function aiSetProviderModel(provider, model) {
  const api = getNotesApi();
  if (typeof api.aiSetProviderModel !== 'function') return { success: false };
  return api.aiSetProviderModel({ provider, model });
}

export async function aiGetPreferences() {
  const api = getNotesApi();
  if (typeof api.aiGetPreferences !== "function") {
    throw new Error("AI preferences are unavailable. Please restart the app.");
  }
  return api.aiGetPreferences({});
}

export async function aiSetPreferences(preferences) {
  const api = getNotesApi();
  if (typeof api.aiSetPreferences !== "function") {
    throw new Error("AI preferences are unavailable. Please restart the app.");
  }
  return api.aiSetPreferences({ preferences });
}

export async function aiTestConnection(provider) {
  const api = getNotesApi();
  if (typeof api.aiTestConnection !== "function") {
    throw new Error("AI connection testing is unavailable. Please restart the app.");
  }
  return api.aiTestConnection({ provider });
}

export async function aiClearData() {
  const api = getNotesApi();
  if (typeof api.aiClearData !== "function") {
    throw new Error("AI data management is unavailable. Please restart the app.");
  }
  return api.aiClearData({});
}

export async function aiGenerateEmbeddings(forceRefresh = true) {
  const api = getNotesApi();
  if (typeof api.aiGenerateEmbeddings !== "function") {
    throw new Error("AI embeddings are unavailable. Please restart the app.");
  }
  return api.aiGenerateEmbeddings({ forceRefresh });
}

export async function aiRebuildEmbeddings() {
  const api = getNotesApi();
  if (typeof api.aiRebuildEmbeddings !== 'function') throw new Error('AI embeddings are unavailable.');
  return api.aiRebuildEmbeddings();
}

export async function aiGetEmbeddingsStatus(payload = {}) {
  const api = getNotesApi();
  if (typeof api.aiGetEmbeddingsStatus !== 'function') throw new Error('AI embeddings are unavailable.');
  return api.aiGetEmbeddingsStatus(payload);
}

export async function aiPauseWorker() {
  const api = getNotesApi();
  if (typeof api.aiPauseWorker !== 'function') throw new Error('AI worker is unavailable.');
  return api.aiPauseWorker();
}

export async function aiResumeWorker() {
  const api = getNotesApi();
  if (typeof api.aiResumeWorker !== 'function') throw new Error('AI worker is unavailable.');
  return api.aiResumeWorker();
}

export async function aiDownloadModel() {
  const api = getNotesApi();
  if (typeof api.aiDownloadModel !== 'function') throw new Error('ONNX downloader is unavailable.');
  return api.aiDownloadModel();
}

export async function aiDeleteModel() {
  const api = getNotesApi();
  if (typeof api.aiDeleteModel !== 'function') throw new Error('ONNX deletion is unavailable.');
  return api.aiDeleteModel();
}

export async function aiDownloadGraphModel() {
  const api = getNotesApi();
  if (typeof api.aiDownloadGraphModel !== 'function') throw new Error('Graph model downloader is unavailable.');
  return api.aiDownloadGraphModel();
}

export async function aiDeleteGraphModel() {
  const api = getNotesApi();
  if (typeof api.aiDeleteGraphModel !== 'function') throw new Error('Graph model deletion is unavailable.');
  return api.aiDeleteGraphModel();
}

export async function aiGetModelStatus() {
  const api = getNotesApi();
  if (typeof api.aiGetModelStatus !== 'function') throw new Error('ONNX downloader is unavailable.');
  return api.aiGetModelStatus();
}

export async function aiGetGraphModelStatus() {
  const api = getNotesApi();
  if (typeof api.aiGetGraphModelStatus !== 'function') throw new Error('Graph model downloader is unavailable.');
  return api.aiGetGraphModelStatus();
}

export function onModelDownloadProgress(callback) {
  const api = getNotesApi();
  if (typeof api.onModelDownloadProgress !== 'function') return () => {};
  return api.onModelDownloadProgress(callback);
}

export function onGraphModelDownloadProgress(callback) {
  const api = getNotesApi();
  if (typeof api.onGraphModelDownloadProgress !== 'function') return () => {};
  return api.onGraphModelDownloadProgress(callback);
}

export function onGraphProgress(callback) {
  const api = getNotesApi();
  if (typeof api.onGraphProgress !== 'function') return () => {};
  return api.onGraphProgress(callback);
}

export async function aiPauseGraphWorker() {
  const api = getNotesApi();
  if (typeof api.aiPauseGraphWorker !== "function") return { success: false };
  return api.aiPauseGraphWorker();
}

export async function aiResumeGraphWorker() {
  const api = getNotesApi();
  if (typeof api.aiResumeGraphWorker !== "function") return { success: false };
  return api.aiResumeGraphWorker();
}

export async function aiBuildGraph() {
  const api = getNotesApi();
  if (typeof api.aiBuildGraph !== "function") {
    throw new Error("AI graph operations are unavailable. Please restart the app.");
  }
  return api.aiBuildGraph({});
}

export async function aiGetGraph() {
  const api = getNotesApi();
  if (typeof api.aiGetGraph !== "function") {
    throw new Error("AI graph operations are unavailable. Please restart the app.");
  }
  return api.aiGetGraph({});
}

export async function aiGetGraphStatus() {
  const api = getNotesApi();
  if (typeof api.aiGetGraphStatus !== "function") {
    throw new Error("AI graph operations are unavailable. Please restart the app.");
  }
  return api.aiGetGraphStatus({});
}

export async function aiExportGraphAsJSON(options = {}) {
  const api = getNotesApi();
  if (typeof api.aiExportGraphAsJSON !== "function") {
    throw new Error("AI graph export is unavailable.");
  }
  return api.aiExportGraphAsJSON(options);
}

export async function aiExportGraphAsMarkdown(options = {}) {
  const api = getNotesApi();
  if (typeof api.aiExportGraphAsMarkdown !== "function") {
    throw new Error("AI graph export is unavailable.");
  }
  return api.aiExportGraphAsMarkdown(options);
}

export async function aiGetLogs(subsystem = null, limit = 100, conversationId = null) {
  const api = getNotesApi();
  if (typeof api.aiGetLogs !== "function") return { success: false, data: [] };
  return api.aiGetLogs({ subsystem, limit, conversationId });
}

export function onTelemetryEvent(callback) {
  const api = getNotesApi();
  if (typeof api.onTelemetryEvent !== 'function') return () => {};
  return api.onTelemetryEvent(callback);
}

export async function aiClearLogs(subsystem = null, beforeTimestamp = null) {
  const api = getNotesApi();
  if (typeof api.aiClearLogs !== "function") return { success: false };
  return api.aiClearLogs({ subsystem, beforeTimestamp });
}

export async function aiClearEmbeddingsData() {
  const api = getNotesApi();
  if (typeof api.aiClearEmbeddingsData !== "function") return { success: false };
  return api.aiClearEmbeddingsData();
}

export async function aiClearGraphData() {
  const api = getNotesApi();
  if (typeof api.aiClearGraphData !== "function") return { success: false };
  return api.aiClearGraphData();
}

// Conversation store removed from local AI — fallback stubs for health diagnostics
export async function aiListConversations() {
  return { success: true, data: [] };
}
export async function aiGetMessages() {
  return { success: true, data: [] };
}
export async function aiClearConversations() {
  return { success: true };
}


export async function aiListPersonas() {
  const api = getNotesApi();
  if (typeof api.aiListPersonas !== 'function') throw new Error('Persona API unavailable.');
  return api.aiListPersonas();
}

export async function aiGetPersona(id) {
  const api = getNotesApi();
  if (typeof api.aiGetPersona !== 'function') throw new Error('Persona API unavailable.');
  return api.aiGetPersona({ id });
}

export async function aiSavePersona(persona) {
  const api = getNotesApi();
  if (typeof api.aiSavePersona !== 'function') throw new Error('Persona API unavailable.');
  return api.aiSavePersona(persona);
}

export async function aiDeletePersona(id) {
  const api = getNotesApi();
  if (typeof api.aiDeletePersona !== 'function') throw new Error('Persona API unavailable.');
  return api.aiDeletePersona({ id });
}

export async function aiImportPersona(filePath) {
  const api = getNotesApi();
  if (typeof api.aiImportPersona !== 'function') throw new Error('Persona API unavailable.');
  return api.aiImportPersona({ filePath });
}

export async function aiExportPersona(id, destPath) {
  const api = getNotesApi();
  if (typeof api.aiExportPersona !== 'function') throw new Error('Persona API unavailable.');
  return api.aiExportPersona({ id, destPath });
}

// aiListPendingKnowledge/aiApproveKnowledge/aiRejectKnowledge removed — chat-only


export async function executeTool(toolName, args = {}, context = {}) {
  const api = getNotesApi();
  if (typeof api.executeTool !== 'function') {
    throw new Error('Tool API unavailable.');
  }
  return api.executeTool({ toolName, args, context });
}

export async function listTools() {
  const api = getNotesApi();
  if (typeof api.listTools !== 'function') {
    return { success: false, data: [] };
  }
  return api.listTools();
}
