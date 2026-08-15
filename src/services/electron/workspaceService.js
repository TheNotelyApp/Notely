import { getNotesApi } from "./base";
import { runExport } from "./exportService";

export async function getNotesRootSetting() {
  const api = getNotesApi();
  if (typeof api.getNotesRootSetting !== "function") {
    throw new Error("Workspace settings are unavailable. Please restart the app.");
  }
  return api.getNotesRootSetting();
}

export async function getAppInfo() {
  const api = getNotesApi();
  if (typeof api.getAppInfo !== "function") {
    return {
      appName: "Notely",
      version: "0.0.0",
      versionCore: "0.0.0",
      commitHash: "",
    };
  }
  return api.getAppInfo();
}

export async function setNotesRootSetting(notesRoot) {
  const api = getNotesApi();
  if (typeof api.setNotesRootSetting !== "function") {
    throw new Error("Workspace settings are unavailable. Please restart the app.");
  }
  return api.setNotesRootSetting({ notesRoot });
}

export async function getGitWorkspaceMetadata() {
  const api = getNotesApi();
  if (typeof api.getGitWorkspaceMetadata !== "function") {
    return {
      workspaceRoot: "",
      isGitRoot: false,
      branch: "",
      autoIgnoreMetadataInGit: true,
      gitignoreHasNotesApp: false,
    };
  }
  return api.getGitWorkspaceMetadata();
}

export async function setAutoIgnoreGitMetadata(enabled) {
  const api = getNotesApi();
  if (typeof api.setAutoIgnoreGitMetadata !== "function") {
    throw new Error("Git metadata settings are unavailable. Please restart the app.");
  }
  return api.setAutoIgnoreGitMetadata({ enabled: enabled !== false });
}

export async function pickFolder() {
  const api = getNotesApi();
  if (typeof api.pickFolder !== "function") {
    throw new Error("Folder picker is unavailable. Please restart the app.");
  }
  return api.pickFolder();
}

export async function listProjects() {
  const api = getNotesApi();
  if (typeof api.listProjects !== "function") {
    throw new Error("Project list action unavailable. Please restart the app.");
  }
  return api.listProjects();
}

export async function setActiveProject(slug) {
  const api = getNotesApi();
  if (typeof api.setActiveProject !== "function") {
    throw new Error("Switch project action unavailable. Please restart the app.");
  }
  return api.setActiveProject({ slug });
}

export async function getWorkspaceActivity(limit = 200) {
  const api = getNotesApi();
  if (typeof api.getWorkspaceActivity !== "function") {
    throw new Error("Workspace activity unavailable. Please restart the app.");
  }
  return api.getWorkspaceActivity({ limit });
}

export async function openWorkspaceInEditor(folderPath) {
  const api = getNotesApi();
  if (typeof api.openWorkspaceInEditor !== "function") {
    throw new Error("Workspace open action unavailable. Please restart the app to load the latest desktop API.");
  }
  return api.openWorkspaceInEditor({ folderPath });
}

export async function revealWorkspaceInExplorer(folderPath) {
  const api = getNotesApi();
  if (typeof api.revealWorkspaceInExplorer !== "function") {
    throw new Error("Workspace reveal action unavailable. Please restart the app to load the latest desktop API.");
  }
  return api.revealWorkspaceInExplorer({ folderPath });
}

export async function getWorkspaceExportDefaults() {
  const api = getNotesApi();
  if (typeof api.getWorkspaceExportDefaults !== "function") {
    return {
      destinationPath: "",
      fileName: "notelyproject.zip",
      includeMetadata: false,
      mode: "raw",
    };
  }
  return api.getWorkspaceExportDefaults();
}

export async function browseWorkspaceExportDestination() {
  const api = getNotesApi();
  if (typeof api.browseWorkspaceExportDestination !== "function") {
    throw new Error("Export destination browser unavailable. Please restart the app.");
  }
  return api.browseWorkspaceExportDestination();
}

export async function exportWorkspaceZip(payload) {
  return runExport("workspace_zip", payload);
}

export function onWorkspaceExportProgress(callback) {
  const api = getNotesApi();
  if (typeof api.onWorkspaceExportProgress !== "function") {
    return () => {};
  }
  return api.onWorkspaceExportProgress(callback);
}

export async function checkForUpdates() {
  const api = getNotesApi();
  if (typeof api.checkForUpdates !== "function") {
    return { success: false, error: "Auto-updater API not available" };
  }
  return api.checkForUpdates();
}

export async function checkIsDirectory(folderPath, relativeTo) {
  const api = getNotesApi();
  if (typeof api.checkIsDirectory !== "function") {
    return false;
  }
  return api.checkIsDirectory({ folderPath, relativeTo });
}

export async function openFolder(folderPath, relativeTo) {
  const api = getNotesApi();
  if (typeof api.openFolder !== "function") {
    throw new Error("Shell openFolder API is not available");
  }
  return api.openFolder({ folderPath, relativeTo });
}

export async function openExternal(url) {
  const api = getNotesApi();
  if (typeof api.openExternal !== "function") {
    window.open(url, "_blank");
    return { success: true };
  }
  return api.openExternal(url);
}
