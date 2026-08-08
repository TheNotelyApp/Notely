const fs = require("fs");
const path = require("path");
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
    const res = await exportHistoryStore.addRecord(record);
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send("exports:record-added", record);
      }
    });
    return res;
  });

  registerTrustedHandler("exports:saveToDownloads", async (_, { dataUrl, srcPath, filename }) => {
    try {
      const downloadDir = app.getPath("downloads");
      let targetName = filename || "download.png";
      let targetPath = path.join(downloadDir, targetName);

      let counter = 1;
      const ext = path.extname(targetName) || ".png";
      const base = path.basename(targetName, ext);
      while (fs.existsSync(targetPath)) {
        targetName = `${base} (${counter})${ext}`;
        targetPath = path.join(downloadDir, targetName);
        counter++;
      }

      if (srcPath && fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, targetPath);
      } else if (dataUrl && typeof dataUrl === "string") {
        const base64Data = dataUrl.replace(/^data:[^;]+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        fs.writeFileSync(targetPath, buffer);
      } else {
        return { success: false, error: "Invalid image source" };
      }

      let fileSize = 0;
      try {
        fileSize = fs.statSync(targetPath).size;
      } catch {
        fileSize = 0;
      }

      const record = {
        filename: targetName,
        filePath: targetPath,
        fileSize,
        exportType: "image",
        category: "media",
      };

      await exportHistoryStore.addRecord(record);

      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send("exports:record-added", record);
        }
      });

      return { success: true, filePath: targetPath, filename: targetName, fileSize };
    } catch (err) {
      console.error("[exportHistoryIpc] saveToDownloads failed:", err);
      return { success: false, error: err.message };
    }
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
