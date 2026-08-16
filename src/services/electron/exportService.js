import { getNotesApi } from "./base";

export async function runExport(type, payload = {}) {
  const api = getNotesApi();
  if (typeof api?.exportFile === "function") {
    const res = await api.exportFile(type, payload);
    if (res?.success && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("app:download-complete", { detail: res }));
    }
    return res;
  }
  throw new Error(`Export service is unavailable for type: ${type}`);
}

export async function downloadPdf(payload) {
  return runExport("pdf", payload);
}

export async function downloadImage(base64Data, defaultFilename) {
  return runExport("diagram_image", { base64Data, defaultFilename });
}

export async function getExportHistory() {
  const api = getNotesApi();
  if (typeof api.getExportHistory !== "function") return [];
  return api.getExportHistory();
}

export async function addExportRecord(record) {
  if (!record) return null;
  const api = getNotesApi();
  const rawPath = String(record.filePath || record.filename || "download").replace(/\\/g, "/");
  const cleanPath = rawPath.startsWith("data:") || rawPath.startsWith("blob:")
    ? (record.filename || "download")
    : rawPath;
  const filename = record.filename || cleanPath.split("/").pop() || "download";

  const cleanRecord = {
    filename,
    filePath: cleanPath,
    fileSize: record.fileSize || 0,
    exportType: record.exportType || "media",
    category: record.category || "media",
    sourceNote: record.sourceNote || "",
  };

  let res = null;
  if (typeof api?.addExportRecord === "function") {
    try {
      res = await api.addExportRecord(cleanRecord);
    } catch (err) {
      console.warn("[addExportRecord] IPC error:", err);
    }
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("app:download-complete", { detail: cleanRecord }));
  }
  return res;
}

export async function saveToDownloads({ dataUrl, srcPath, filename }) {
  return runExport("media", { dataUrl, srcPath, filename });
}

export async function removeExportRecord(id) {
  const api = getNotesApi();
  if (typeof api.removeExportRecord !== "function") return false;
  return api.removeExportRecord(id);
}

export async function clearExportHistory() {
  const api = getNotesApi();
  if (typeof api.clearExportHistory !== "function") return false;
  return api.clearExportHistory();
}

export async function showInFolder(filePath) {
  const api = getNotesApi();
  if (typeof api.showInFolder !== "function") return false;
  return api.showInFolder(filePath);
}

export async function openExportFile(filePath) {
  const api = getNotesApi();
  if (typeof api.openExportFile !== "function") return false;
  return api.openExportFile(filePath);
}

export async function getDefaultDownloadDir() {
  const api = getNotesApi();
  if (typeof api.getDefaultDownloadDir !== "function") return "";
  return api.getDefaultDownloadDir();
}

export function onExportRecordAdded(callback) {
  const api = getNotesApi();
  if (typeof api?.onExportRecordAdded === "function") {
    return api.onExportRecordAdded(callback);
  }
  return () => {};
}
