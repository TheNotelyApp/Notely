const { assertTrustedIpcSender } = require("../ipc/ipcSecurity.cjs");

function registerWorkspaceExportIpcHandlers(ipcMain, deps) {
  const {
    BrowserWindow,
    dialog,
    fs,
    path,
    getNotesRoot,
    getActiveProject,
  } = deps;

  function registerTrustedHandler(channel, handler) {
    ipcMain.handle(channel, (event, payload) => {
      assertTrustedIpcSender(BrowserWindow, event, channel);
      return handler(event, payload);
    });
  }

  function getDefaultDestinationPath() {
    const { app } = require("electron");
    try {
      const downloads = app ? app.getPath("downloads") : "";
      if (downloads && fs.existsSync(downloads)) return downloads;
    } catch {
      /* ignore default downloads dir resolution error */
    }
    const activeProject = getActiveProject();
    return path.resolve(activeProject?.rootPath || getNotesRoot());
  }

  registerTrustedHandler("workspace-export:get-defaults", () => {
    const mode = "raw";
    const notesRoot = path.resolve(getNotesRoot());
    const folderName = path.basename(notesRoot) || "workspace";
    const cleanedFolder = folderName.replace(/[<>:"/\\|?*]/g, "_").replace(/\s+/g, "_").trim() || "workspace";
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    return {
      destinationPath: getDefaultDestinationPath(),
      fileName: `${cleanedFolder}_docs_${day}_${month}_${year}.zip`,
      includeMetadata: false,
      mode,
      contentMode: "combined",
    };
  });

  registerTrustedHandler("workspace-export:browse-destination", async () => {
    const focusedWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null;
    const result = await dialog.showOpenDialog(focusedWindow, {
      title: "Select export destination",
      defaultPath: getDefaultDestinationPath(),
      properties: ["openDirectory", "createDirectory"],
    });

    if (result.canceled || !result.filePaths?.[0]) {
      return { canceled: true };
    }

    const destinationPath = path.resolve(result.filePaths[0]);
    return { canceled: false, destinationPath };
  });

  registerTrustedHandler("workspace-export:run", async (_event, payload) => {
    const { getExportManager } = require("./ExportManager.cjs");
    return await getExportManager().runExport({ type: "workspace_zip", payload });
  });
}

module.exports = { registerWorkspaceExportIpcHandlers };