import { getNotesApi } from "./base";

export async function listDocuments(folderPath) {
  const api = getNotesApi();
  return api.listDocuments({ folderPath });
}

export async function listWorkspaceTaskDocuments() {
  const api = getNotesApi();
  if (typeof api.listWorkspaceTaskDocuments !== "function") {
    return [];
  }
  const documents = await api.listWorkspaceTaskDocuments();
  return Array.isArray(documents) ? documents : [];
}

export async function getDashboardCache() {
  const api = getNotesApi();
  if (typeof api.getDashboardCache !== "function") {
    return { continueWriting: [], recentNotes: [] };
  }
  const cache = await api.getDashboardCache();
  return {
    continueWriting: Array.isArray(cache?.continueWriting) ? cache.continueWriting : [],
    recentNotes: Array.isArray(cache?.recentNotes) ? cache.recentNotes : [],
  };
}

export async function createDocument(title, parentPath) {
  const api = getNotesApi();
  if (typeof api.createDocument !== "function") {
    throw new Error("Create note action unavailable. Please restart the app.");
  }
  return api.createDocument({ title, parentPath });
}

export async function createFolder(name, parentPath) {
  const api = getNotesApi();
  if (typeof api.createFolder !== "function") {
    throw new Error("Create folder action unavailable. Please restart the app.");
  }
  return api.createFolder({ name, parentPath });
}

export async function deleteFolder(folderPath) {
  const api = getNotesApi();
  if (typeof api.deleteFolder !== "function") {
    throw new Error("Delete folder action unavailable. Please restart the app.");
  }
  return api.deleteFolder({ folderPath });
}

export async function renameDocument(filePath, title) {
  const api = getNotesApi();
  if (typeof api.renameDocument !== "function") {
    throw new Error("Rename note action unavailable. Please restart the app.");
  }
  return api.renameDocument({ filePath, title });
}

export async function deleteDocument(filePath) {
  const api = getNotesApi();
  if (typeof api.deleteDocument !== "function") {
    throw new Error("Delete note action unavailable. Please restart the app.");
  }
  return api.deleteDocument({ filePath });
}

export async function readDocument(filePath) {
  const api = getNotesApi();
  return api.readDocument(filePath);
}

export function onDocumentChangedOnDisk(callback) {
  const api = getNotesApi();
  if (typeof api.onDocumentChangedOnDisk !== "function") {
    return () => {};
  }
  return api.onDocumentChangedOnDisk(callback);
}

export async function stopWatching() {
  const api = getNotesApi();
  if (typeof api.stopWatching !== "function") {
    return;
  }
  return api.stopWatching();
}

export async function markDocumentOpened(filePath) {
  const api = getNotesApi();
  if (typeof api.markDocumentOpened !== "function") {
    return false;
  }
  return api.markDocumentOpened(filePath);
}

export async function readMarkdownSource(filePath) {
  const api = getNotesApi();
  if (typeof api.readMarkdownSource !== "function") {
    throw new Error("Markdown source read action unavailable. Please restart the app.");
  }
  return api.readMarkdownSource(filePath);
}

export async function saveDocument(payload) {
  const api = getNotesApi();
  return api.saveDocument(payload);
}

export async function openInEditor(filePath) {
  const api = getNotesApi();
  const openFn =
    (typeof api.openInEditor === "function" && api.openInEditor) ||
    (typeof api.openFileInEditor === "function" && api.openFileInEditor);

  if (!openFn) {
    throw new Error("Open action unavailable. Please restart the app to load the latest desktop API.");
  }

  return openFn(filePath);
}

export async function openWebView(filePath, content) {
  const api = getNotesApi();
  if (typeof api.openWebView !== "function") {
    throw new Error("Web view action unavailable. Please restart the app to load the latest desktop API.");
  }

  if (!filePath) {
    return api.openWebView({});
  }

  return api.openWebView({ filePath, content });
}
