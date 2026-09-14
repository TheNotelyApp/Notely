/**
 * mcpService.js
 * Frontend service wrappers for interacting with the Notely MCP Server via Electron IPC.
 */

function getNotesApi() {
  if (typeof window !== "undefined" && window.notesApi) {
    return window.notesApi;
  }
  return {};
}

/**
 * Get the current MCP Server status and metrics.
 */
export async function mcpGetStatus() {
  const api = getNotesApi();
  if (typeof api.mcpGetStatus !== "function") {
    return { enabled: false, running: false, port: 3700, host: '127.0.0.1' };
  }
  return api.mcpGetStatus();
}

/**
 * Get the MCP Server configuration.
 */
export async function mcpGetConfig() {
  const api = getNotesApi();
  if (typeof api.mcpGetConfig !== "function") {
    return { enabled: true, port: 3700, host: '127.0.0.1', bearerToken: '' };
  }
  return api.mcpGetConfig();
}

/**
 * Update the MCP Server configuration.
 */
export async function mcpSetConfig(updates) {
  const api = getNotesApi();
  if (typeof api.mcpSetConfig !== "function") {
    return { config: updates, status: { running: false } };
  }
  return api.mcpSetConfig(updates);
}

/**
 * Start the MCP Server.
 */
export async function mcpStart() {
  const api = getNotesApi();
  if (typeof api.mcpStart !== "function") return { running: false };
  return api.mcpStart();
}

/**
 * Stop the MCP Server.
 */
export async function mcpStop() {
  const api = getNotesApi();
  if (typeof api.mcpStop !== "function") return { running: false };
  return api.mcpStop();
}

/**
 * Restart the MCP Server.
 */
export async function mcpRestart() {
  const api = getNotesApi();
  if (typeof api.mcpRestart !== "function") return { running: false };
  return api.mcpRestart();
}

/**
 * Get active sessions connected to the MCP Server.
 */
export async function mcpGetSessions() {
  const api = getNotesApi();
  if (typeof api.mcpGetSessions !== "function") return { active: [], stats: {} };
  return api.mcpGetSessions();
}

/**
 * Subscribe to MCP Server status change events.
 */
export function onMcpStatusChanged(callback) {
  const api = getNotesApi();
  if (typeof api.onMcpStatusChanged !== "function") return () => {};
  return api.onMcpStatusChanged(callback);
}
