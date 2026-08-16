/**
 * Base IPC helper for Electron window.notesApi bridge
 */

export function getNotesApi() {
  if (typeof window !== "undefined" && window.notesApi) {
    return window.notesApi;
  }
  return {};
}
