import { getNotesApi } from "./base";

export async function createTerminalSession(cwd, options = {}) {
  const api = getNotesApi();
  if (typeof api.createTerminalSession !== "function") {
    throw new Error("Interactive terminal is unavailable. Please restart the app.");
  }
  return api.createTerminalSession({
    cwd,
    role: typeof options.role === "string" ? options.role : undefined,
    shell: options.shell === "bash" || options.shell === "cmd" ? options.shell : undefined,
  });
}

export async function writeTerminalInput(sessionId, data) {
  const api = getNotesApi();
  if (typeof api.writeTerminalInput !== "function") {
    throw new Error("Interactive terminal is unavailable. Please restart the app.");
  }
  return api.writeTerminalInput({ sessionId, data });
}

export async function resizeTerminal(sessionId, cols, rows) {
  const api = getNotesApi();
  if (typeof api.resizeTerminal !== "function") {
    return true;
  }
  return api.resizeTerminal({ sessionId, cols, rows });
}

export async function killTerminalSession(sessionId) {
  const api = getNotesApi();
  if (typeof api.killTerminalSession !== "function") {
    return true;
  }
  return api.killTerminalSession({ sessionId });
}

export function onTerminalData(callback) {
  const api = getNotesApi();
  if (typeof api.onTerminalData !== "function") {
    return () => {};
  }
  return api.onTerminalData(callback);
}

export function onTerminalExit(callback) {
  const api = getNotesApi();
  if (typeof api.onTerminalExit !== "function") {
    return () => {};
  }
  return api.onTerminalExit(callback);
}

export async function executeCodeBlock(language, code) {
  const api = getNotesApi();
  if (typeof api.executeCodeBlock !== "function") {
    return { success: false, stdout: "", stderr: "Code execution API is not available", exitCode: -1 };
  }
  return api.executeCodeBlock({ language, code });
}
