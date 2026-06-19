const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("notesApi", {
  listDocuments: () => ipcRenderer.invoke("documents:list"),
  readDocument: (filePath) => ipcRenderer.invoke("documents:read", filePath),
  saveDocument: (payload) => ipcRenderer.invoke("documents:save", payload),
  getHistory: (filePath) => ipcRenderer.invoke("documents:history", filePath),
  restoreHistory: (payload) => ipcRenderer.invoke("documents:restore", payload)
});
