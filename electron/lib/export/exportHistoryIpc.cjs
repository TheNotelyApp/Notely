const { assertTrustedIpcSender } = require("../ipc/ipcSecurity.cjs");

function registerExportHistoryIpc({ ipcMain, BrowserWindow, shell, app, exportHistoryStore }) {
  function registerTrustedHandler(channel, handler) {
    ipcMain.handle(channel, (event, payload) => {
      assertTrustedIpcSender(BrowserWindow, event, channel);
      return handler(event, payload);
    });
  }

  registerTrustedHandler("exports:getHistory", async () => {
    return await exportHistoryStore.getHistory();
  });

  registerTrustedHandler("exports:addRecord", async (_, record) => {
    return await exportHistoryStore.addRecord(record);
  });

  registerTrustedHandler("exports:removeRecord", async (_, { id }) => {
    return await exportHistoryStore.removeRecord(id);
  });

  registerTrustedHandler("exports:clearHistory", async () => {
    return await exportHistoryStore.clearHistory();
  });

  registerTrustedHandler("exports:showInFolder", async (_, { filePath }) => {
    if (!filePath || typeof filePath !== "string") return false;
    try {
      shell.showItemInFolder(filePath);
      return true;
    } catch (err) {
      console.warn("[exportHistoryIpc] Failed to show in folder:", err);
      return false;
    }
  });

  registerTrustedHandler("exports:openFile", async (_, { filePath }) => {
    if (!filePath || typeof filePath !== "string") return false;
    try {
      const result = await shell.openPath(filePath);
      return result === ""; // empty string means success in Electron shell.openPath
    } catch (err) {
      console.warn("[exportHistoryIpc] Failed to open file:", err);
      return false;
    }
  });

  registerTrustedHandler("exports:getDefaultDownloadDir", async () => {
    try {
      return app.getPath("downloads");
    } catch {
      return app.getPath("documents");
    }
  });
}

module.exports = { registerExportHistoryIpc };
