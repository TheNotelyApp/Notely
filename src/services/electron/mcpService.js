import { getNotesApi } from "./base";

export async function mcpGetStatus() {
  const api = getNotesApi();
  if (typeof api.mcpGetStatus !== "function") {
    return { running: false, port: 3721 };
  }
  return api.mcpGetStatus();
}

export async function mcpStart() {
  const api = getNotesApi();
  if (typeof api.mcpStart !== "function") {
    return { running: false };
  }
  return api.mcpStart();
}

export async function mcpStop() {
  const api = getNotesApi();
  if (typeof api.mcpStop !== "function") {
    return { running: false };
  }
  return api.mcpStop();
}

export async function mcpGetConfigSnippets() {
  const api = getNotesApi();
  if (typeof api.mcpGetConfigSnippets !== "function") {
    return null;
  }
  return api.mcpGetConfigSnippets();
}
