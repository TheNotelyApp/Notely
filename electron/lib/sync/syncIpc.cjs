const { assertTrustedIpcSender } = require("../ipc/ipcSecurity.cjs");

function registerSyncIpcHandlers(ipcMain, deps) {
  const {
    BrowserWindow,
    path,
    normalizeToPosix,
    getMetadataStore,
    getNotesRoot,
    getActiveProject,
  } = deps;

  function registerTrustedHandler(channel, handler) {
    ipcMain.handle(channel, (event, payload) => {
      assertTrustedIpcSender(BrowserWindow, event, channel);
      return handler(event, payload);
    });
  }

  registerTrustedHandler("activity:get-workspace", (_event, payload) => {
    const notesRoot = getNotesRoot();
    const activeProject = getActiveProject();
    const workspaceRoot = path.resolve(activeProject?.rootPath || notesRoot);
    const rows = getMetadataStore().getWorkspaceActivity(workspaceRoot, payload?.limit);

    const activity = rows.map((entry, index) => {
      const rawReason = String(entry.reason || "unknown");
      return {
        id: `${entry.createdAt || "unknown"}-${index}`,
        filePath: entry.filePath,
        fileName: path.basename(entry.filePath || ""),
        relativePath: normalizeToPosix(path.relative(workspaceRoot, entry.filePath || "")),
        reason: rawReason,
        createdAt: entry.createdAt || null,
        versionPath: entry.versionPath || "",
        fileHash: entry.fileHash || "",
        actor: "local-user"
      };
    });

    return {
      workspaceRoot,
      workspaceLabel: activeProject?.isRoot ? "Root" : (activeProject?.name || "Workspace"),
      total: activity.length,
      activity
    };
  });
}

module.exports = { registerSyncIpcHandlers };
