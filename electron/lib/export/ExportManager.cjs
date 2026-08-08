const fs = require("fs");
const fsAsync = require("fs").promises;
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { pathToFileURL } = require("url");
const { Notification } = require("electron");
const { ZipFile } = require("yazl");

const PDF_WRITE_RETRY_DELAYS_MS = [120, 320, 700];

function isRetryableWriteError(error) {
  const code = String(error?.code || "").toUpperCase();
  return code === "EBUSY" || code === "EPERM" || code === "EACCES";
}

async function writeFileWithRetries(filePath, data) {
  let lastError = null;
  for (let attempt = 0; attempt <= PDF_WRITE_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      fs.writeFileSync(filePath, data);
      return;
    } catch (error) {
      if (!isRetryableWriteError(error)) {
        throw error;
      }
      lastError = error;
      if (attempt >= PDF_WRITE_RETRY_DELAYS_MS.length) {
        break;
      }
      const waitMs = PDF_WRITE_RETRY_DELAYS_MS[attempt];
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  throw lastError;
}

function slugify(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const { encryptBuffer, scanNoteDependencies } = require("./notePackageIpc.cjs");

class ExportManager {
  constructor(deps = {}) {
    this.app = deps.app;
    this.BrowserWindow = deps.BrowserWindow;
    this.shell = deps.shell;
    this.exportHistoryStore = deps.exportHistoryStore;
    this.getNotesRoot = deps.getNotesRoot;
    this.filePathWithin = deps.filePathWithin;
    this.buildPdfExportMarkdown = deps.buildPdfExportMarkdown;
    this.buildPdfExportHtml = deps.buildPdfExportHtml;
    this.parseDocument = deps.parseDocument;
    this.getMarkdownIt = deps.getMarkdownIt;
  }

  setDeps(deps = {}) {
    if (deps.app) this.app = deps.app;
    if (deps.BrowserWindow) this.BrowserWindow = deps.BrowserWindow;
    if (deps.shell) this.shell = deps.shell;
    if (deps.exportHistoryStore) this.exportHistoryStore = deps.exportHistoryStore;
    if (deps.getNotesRoot) this.getNotesRoot = deps.getNotesRoot;
    if (deps.filePathWithin) this.filePathWithin = deps.filePathWithin;
    if (deps.buildPdfExportMarkdown) this.buildPdfExportMarkdown = deps.buildPdfExportMarkdown;
    if (deps.buildPdfExportHtml) this.buildPdfExportHtml = deps.buildPdfExportHtml;
    if (deps.parseDocument) this.parseDocument = deps.parseDocument;
    if (deps.getMarkdownIt) this.getMarkdownIt = deps.getMarkdownIt;
  }

  /**
   * Central parameterized export function
   * @param {Object} params
   * @param {'pdf'|'note_package'|'workspace_zip'|'diagram_image'|'media'|'persona'} params.type
   * @param {Object} params.payload
   */
  async runExport({ type, payload = {} }) {
    if (!type || typeof type !== "string") {
      throw new Error("Export type is required.");
    }

    const downloadDir = this._getDownloadDir();
    let result = null;

    switch (type) {
      case "pdf":
        result = await this._exportPdf(payload, downloadDir);
        break;
      case "note_package":
        result = await this._exportNotePackage(payload, downloadDir);
        break;
      case "workspace_zip":
        result = await this._exportWorkspaceZip(payload, downloadDir);
        break;
      case "diagram_image":
      case "media":
        result = await this._exportMediaOrDiagram(payload, downloadDir, type);
        break;
      case "persona":
        result = await this._exportPersona(payload, downloadDir);
        break;
      default:
        throw new Error(`Unsupported export type: "${type}"`);
    }

    if (!result || !result.success) {
      return result || { success: false, error: "Export execution failed" };
    }

    const { targetPath, filename, fileSize, exportType, category, sourceNote } = result;

    // 1. Record into SQLite database
    let record = null;
    if (this.exportHistoryStore && targetPath) {
      try {
        record = await this.exportHistoryStore.addRecord({
          filename,
          filePath: targetPath,
          fileSize: fileSize || 0,
          exportType: exportType || type,
          category: category || "document",
          sourceNote: sourceNote || "",
        });
      } catch (err) {
        console.warn("[ExportManager] DB record creation warning:", err);
      }
    }

    // 2. Dispatch EXACTLY ONE system notification
    this._notifyCompletion(filename);

    // 3. Broadcast record-added event to all windows
    if (this.BrowserWindow) {
      const payloadRecord = record || {
        filename,
        filePath: targetPath,
        fileSize,
        exportType: exportType || type,
        category: category || "document",
        timestamp: new Date().toISOString(),
        sourceNote: sourceNote || "",
      };
      this.BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send("exports:record-added", payloadRecord);
        }
      });
    }

    return {
      success: true,
      filePath: targetPath,
      filename,
      fileSize,
      record,
      ...(result.entryCount ? { entryCount: result.entryCount } : {}),
      ...(result.elapsedMs ? { elapsedMs: result.elapsedMs } : {})
    };
  }

  _getDownloadDir() {
    try {
      if (this.app) return this.app.getPath("downloads");
    } catch { /* ignore fallback */ }
    return process.cwd();
  }

  _resolveCollisionFreePath(downloadDir, defaultName) {
    const ext = path.extname(defaultName) || ".dat";
    const base = path.basename(defaultName, ext);

    let targetName = defaultName;
    let targetPath = path.join(downloadDir, targetName);
    let counter = 1;

    while (fs.existsSync(targetPath)) {
      targetName = `${base} (${counter})${ext}`;
      targetPath = path.join(downloadDir, targetName);
      counter++;
    }

    return { targetPath, targetName };
  }

  _notifyCompletion(filename) {
    try {
      if (Notification && Notification.isSupported()) {
        new Notification({
          title: "Export Complete",
          body: `Saved "${filename}" to Downloads`,
        }).show();
      }
    } catch (err) {
      console.warn("[ExportManager] Notification failed:", err);
    }
  }

  _sendWorkspaceExportProgress(progressPayload) {
    if (!this.BrowserWindow) return;
    this.BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        try {
          win.webContents.send("workspace-export:progress", progressPayload);
        } catch { /* ignore */ }
      }
    });
  }

  // --- Type 1: PDF Export ---
  async _exportPdf(payload, downloadDir) {
    const notesRoot = typeof this.getNotesRoot === "function" ? this.getNotesRoot() : null;
    const resolved = path.resolve(String(payload?.filePath || ""));

    if (notesRoot && typeof this.filePathWithin === "function") {
      if (!this.filePathWithin(notesRoot, resolved)) {
        throw new Error("Invalid document path.");
      }
    }

    const includeRawNotes = Boolean(payload?.includeRawNotes);
    const includeCleansed = Boolean(payload?.includeCleansed);
    const pdfQualityPreset = ["full", "balanced", "compact"].includes(payload?.pdfQualityPreset)
      ? payload.pdfQualityPreset
      : "full";
    const downsampleImages = Boolean(payload?.downsampleImages) || pdfQualityPreset !== "full";

    if (!includeRawNotes && !includeCleansed) {
      throw new Error("Select at least one section to export.");
    }

    const rawTitle = payload?.title || path.basename(resolved, ".md") || "document";
    const defaultName = `${rawTitle.replace(/[<>:"/\\|?*]/g, "_")}.pdf`;
    const { targetPath, targetName } = this._resolveCollisionFreePath(downloadDir, defaultName);

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "notely-pdf-"));
    const tempMarkdownPath = path.join(tempDir, `${slugify(path.basename(resolved))}-export.md`);
    const tempHtmlPath = path.join(tempDir, `${slugify(path.basename(resolved))}-export.html`);

    const markdownContent = typeof this.buildPdfExportMarkdown === "function"
      ? this.buildPdfExportMarkdown(payload, { includeRawNotes, includeCleansed })
      : (payload.cleansed || payload.rawNotes || "");

    fs.writeFileSync(tempMarkdownPath, markdownContent, "utf8");

    try {
      const baseHref = pathToFileURL(`${path.dirname(resolved)}${path.sep}`).href;
      const html = typeof this.buildPdfExportHtml === "function"
        ? this.buildPdfExportHtml({
            title: rawTitle,
            markdownContent,
            baseHref,
            sourceDir: path.dirname(resolved),
            downsampleImages,
            pdfQualityPreset
          })
        : `<html><body>${markdownContent}</body></html>`;

      fs.writeFileSync(tempHtmlPath, html, "utf8");

      const pdfWindow = new this.BrowserWindow({
        show: false,
        width: 1280,
        height: 1600,
        backgroundColor: "#ffffff",
        webPreferences: {
          backgroundThrottling: false,
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          webviewTag: false
        }
      });

      try {
        await pdfWindow.loadFile(tempHtmlPath);
        await pdfWindow.webContents.executeJavaScript("document.fonts ? document.fonts.ready : Promise.resolve()");

        const pdfData = await pdfWindow.webContents.printToPDF({
          printBackground: true,
          preferCSSPageSize: true
        });

        await writeFileWithRetries(targetPath, pdfData);
      } finally {
        if (!pdfWindow.isDestroyed()) {
          pdfWindow.close();
        }
      }

      let fileSize = 0;
      try { fileSize = fs.statSync(targetPath).size; } catch { /* ignore */ }

      return {
        success: true,
        targetPath,
        filename: targetName,
        fileSize,
        exportType: "pdf",
        category: "document",
        sourceNote: path.basename(resolved)
      };
    } finally {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }

  // --- Type 2: Note Package (.nly) ---
  async _exportNotePackage(payload, downloadDir) {
    const notesRoot = typeof this.getNotesRoot === "function" ? this.getNotesRoot() : null;
    if (!notesRoot) throw new Error("No notes root configured.");

    const { noteFilePaths, destinationPath, fileName, password, notePaths, outputPath } = payload;
    const pathsToExport = noteFilePaths || notePaths || [];
    
    let finalDest = "";
    let targetName = "";
    if (outputPath) {
      finalDest = path.resolve(outputPath);
      targetName = path.basename(finalDest);
      fs.mkdirSync(path.dirname(finalDest), { recursive: true });
    } else if (destinationPath) {
      const exportFileName = fileName || `export_${Date.now()}.nly`;
      const resolvedDest = path.resolve(destinationPath);
      fs.mkdirSync(resolvedDest, { recursive: true });
      finalDest = path.join(resolvedDest, exportFileName);
      targetName = exportFileName;
    } else {
      const rootFolderName = path.basename(notesRoot) || "notes";
      const defaultName = fileName || `${rootFolderName}_package.nly`;
      const res = this._resolveCollisionFreePath(downloadDir, defaultName);
      finalDest = res.targetPath;
      targetName = res.targetName;
    }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "notely-note-export-"));
    const stagingNotesDir = path.join(tempDir, "notes");
    const stagingMediaDir = path.join(tempDir, "media");
    const stagingExcaliDir = path.join(tempDir, "excalidraw");
    const stagingDrawioDir = path.join(tempDir, "drawio");

    fs.mkdirSync(stagingNotesDir, { recursive: true });
    fs.mkdirSync(stagingMediaDir, { recursive: true });
    fs.mkdirSync(stagingExcaliDir, { recursive: true });
    fs.mkdirSync(stagingDrawioDir, { recursive: true });

    let passwordSalt = "";
    let passwordHash = "";
    if (password) {
      passwordSalt = crypto.randomBytes(16).toString("hex");
      passwordHash = crypto.createHash("sha256").update(password + passwordSalt).digest("hex");
    }

    const manifest = {
      version: 1,
      exportedAt: new Date().toISOString(),
      notes: [],
      media: [],
      excalidraw: [],
      drawio: [],
      files: {},
      passwordSalt,
      passwordHash
    };

    const allMediaPaths = new Set();
    const allExcalidrawIds = new Set();
    const allDrawioIds = new Set();

    try {
      // 1. Gather note contents & dependencies
      for (const inputPath of pathsToExport) {
        const absPath = path.isAbsolute(inputPath) ? inputPath : path.resolve(notesRoot, inputPath);
        if (typeof this.filePathWithin === "function" && !this.filePathWithin(notesRoot, absPath)) continue;
        if (!fs.existsSync(absPath)) continue;

        const relPath = path.relative(notesRoot, absPath).replace(/\\/g, "/");
        const content = await fsAsync.readFile(absPath, "utf8");
        const depsResult = scanNoteDependencies(content);

        depsResult.images.forEach(img => allMediaPaths.add(img));
        depsResult.excalidrawIds.forEach(id => allExcalidrawIds.add(id));
        depsResult.drawioIds.forEach(id => allDrawioIds.add(id));

        const stagingNotePath = path.join(stagingNotesDir, relPath);
        fs.mkdirSync(path.dirname(stagingNotePath), { recursive: true });
        await fsAsync.writeFile(stagingNotePath, content, "utf8");
        manifest.notes.push(relPath);
      }

      // 2. Package media assets
      for (const relMediaPath of allMediaPaths) {
        const cleanRelPath = relMediaPath.replace(/^\/+/, "").replace(/[?#].*$/, "").trim().replace(/\\/g, "/");
        if (!cleanRelPath) continue;
        const absPath = path.resolve(notesRoot, cleanRelPath);
        if (typeof this.filePathWithin === "function" && !this.filePathWithin(notesRoot, absPath)) continue;
        if (!fs.existsSync(absPath)) continue;
        const stagingPath = path.join(stagingMediaDir, cleanRelPath);
        try {
          fs.mkdirSync(path.dirname(stagingPath), { recursive: true });
          await fsAsync.copyFile(absPath, stagingPath);
          manifest.media.push(cleanRelPath);
        } catch { /* ignore unreadable media */ }
      }

      // 3. Package Excalidraw diagrams
      for (const id of allExcalidrawIds) {
        if (!id) continue;
        const excaliSrcDir = path.join(notesRoot, ".notes-app", "excali-diagrams", id);
        const excaliDestDir = path.join(stagingExcaliDir, id);
        if (!fs.existsSync(excaliSrcDir)) continue;
        try {
          fs.mkdirSync(excaliDestDir, { recursive: true });
          const files = await fsAsync.readdir(excaliSrcDir);
          for (const file of files) {
            try { await fsAsync.copyFile(path.join(excaliSrcDir, file), path.join(excaliDestDir, file)); } catch { /* ignore */ }
          }
          manifest.excalidraw.push(id);
        } catch { /* ignore */ }
      }

      // 4. Package Draw.io diagrams
      for (const id of allDrawioIds) {
        if (!id) continue;
        const drawioSrcDir = path.join(notesRoot, "media", "draw.io");
        const drawioDestDir = stagingDrawioDir;
        const filesToCopy = [`${id}.drawio`, `${id}.png`];
        let hasDiagram = false;
        for (const file of filesToCopy) {
          const srcPath = path.join(drawioSrcDir, file);
          const destPath = path.join(drawioDestDir, file);
          if (!fs.existsSync(srcPath)) continue;
          try {
            await fsAsync.copyFile(srcPath, destPath);
            hasDiagram = true;
          } catch { /* ignore */ }
        }
        if (hasDiagram) manifest.drawio.push(id);
      }

      // 5. Generate ZIP & Manifest Hashes
      const zipfile = new ZipFile();
      const zipEntries = [];

      async function addStagedFile(localStagedPath, zipRelativePath) {
        const fileData = await fsAsync.readFile(localStagedPath);
        const hash = crypto.createHash("sha256").update(fileData).digest("hex");
        manifest.files[zipRelativePath] = hash;
        zipEntries.push({ localStagedPath, zipRelativePath });
      }

      const walkAndStage = async (dir, relativePrefix) => {
        if (!fs.existsSync(dir)) return;
        const entries = await fsAsync.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const zipPath = path.join(relativePrefix, entry.name).replace(/\\/g, "/");
          if (entry.isDirectory()) {
            await walkAndStage(fullPath, zipPath);
          } else {
            await addStagedFile(fullPath, zipPath);
          }
        }
      };

      await walkAndStage(stagingNotesDir, "notes");
      await walkAndStage(stagingMediaDir, "media");
      await walkAndStage(stagingExcaliDir, "excalidraw");
      await walkAndStage(stagingDrawioDir, "drawio");

      const manifestPath = path.join(tempDir, "metadata.json");
      await fsAsync.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
      zipEntries.push({ localStagedPath: manifestPath, zipRelativePath: "metadata.json" });

      const zipOutputPath = path.join(tempDir, "temp.zip");
      const zipStream = fs.createWriteStream(zipOutputPath);

      await new Promise((resolve, reject) => {
        zipStream.on("close", resolve);
        zipfile.outputStream.on("error", reject);
        zipStream.on("error", reject);
        zipfile.outputStream.pipe(zipStream);
        for (const entry of zipEntries) {
          zipfile.addFile(entry.localStagedPath, entry.zipRelativePath);
        }
        zipfile.end();
      });

      const zipBuffer = await fsAsync.readFile(zipOutputPath);
      const outputBuffer = password ? encryptBuffer(zipBuffer) : zipBuffer;

      const finalDestTmp = finalDest + ".tmp";
      await fsAsync.writeFile(finalDestTmp, outputBuffer);
      try {
        if (fs.existsSync(finalDest)) {
          await fsAsync.unlink(finalDest);
        }
        await fsAsync.rename(finalDestTmp, finalDest);
      } catch {
        await fsAsync.writeFile(finalDest, outputBuffer);
        try { await fsAsync.unlink(finalDestTmp); } catch { /* ignore */ }
      }

      let fileSize = 0;
      try { fileSize = fs.statSync(finalDest).size; } catch { /* ignore */ }

      return {
        success: true,
        targetPath: finalDest,
        filename: targetName,
        fileSize,
        exportType: "note_package",
        category: "document"
      };
    } finally {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }

  // --- Type 3: Workspace ZIP Backup ---
  async _exportWorkspaceZip(payload, downloadDir) {
    const notesRoot = typeof this.getNotesRoot === "function" ? this.getNotesRoot() : null;
    if (!notesRoot) throw new Error("No notes root configured.");

    const mode = payload.mode || "raw";
    const includeMetadata = Boolean(payload.includeMetadata);
    const requestedFileName = typeof payload.fileName === "string" ? payload.fileName.trim() : "";
    const folderName = path.basename(notesRoot) || "workspace";

    let destinationPath = payload.destinationPath ? path.resolve(payload.destinationPath) : downloadDir;
    fs.mkdirSync(destinationPath, { recursive: true });

    const defaultName = requestedFileName || `${folderName}_backup.zip`;
    const { targetPath, targetName } = this._resolveCollisionFreePath(destinationPath, defaultName);

    this._sendWorkspaceExportProgress({ phase: "Preparing export", percent: 5 });

    const zipfile = new ZipFile();
    let entryCount = 0;
    const start = Date.now();

    const walk = (dir) => {
      const list = fs.readdirSync(dir);
      for (const item of list) {
        if (item === ".git" || item === "node_modules" || item === "dist") continue;
        if (!includeMetadata && item === ".notes-app") continue;
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          walk(fullPath);
        } else {
          const relPath = path.relative(notesRoot, fullPath).replace(/\\/g, "/");
          zipfile.addFile(fullPath, relPath);
          entryCount += 1;
        }
      }
    };

    this._sendWorkspaceExportProgress({ phase: "Collecting workspace files", percent: 25 });
    walk(notesRoot);
    this._sendWorkspaceExportProgress({ phase: "Compressing workspace archive", percent: 70 });

    await new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(targetPath);
      zipfile.outputStream.pipe(writeStream);
      zipfile.outputStream.on("end", resolve);
      zipfile.outputStream.on("error", reject);
      zipfile.end();
    });

    this._sendWorkspaceExportProgress({ phase: "Export complete", percent: 100, done: true, filePath: targetPath });

    let fileSize = 0;
    try { fileSize = fs.statSync(targetPath).size; } catch { /* ignore */ }

    return {
      success: true,
      targetPath,
      filename: targetName,
      fileSize,
      exportType: mode === "pdf" ? "pdf" : mode === "web" ? "html" : "workspace_zip",
      category: "document",
      entryCount,
      elapsedMs: Date.now() - start
    };
  }

  // --- Type 4 & 5: Diagram Image & Media Download ---
  async _exportMediaOrDiagram(payload, downloadDir, exportType) {
    const { dataUrl, srcPath, base64Data, defaultFilename, filename } = payload;
    const rawName = filename || defaultFilename || (exportType === "diagram_image" ? "diagram.png" : "image.png");

    const { targetPath, targetName } = this._resolveCollisionFreePath(downloadDir, rawName);

    let resolvedSrc = srcPath && typeof srcPath === "string" ? srcPath : "";
    if (resolvedSrc.startsWith("file://")) {
      try {
        const { fileURLToPath } = require("url");
        resolvedSrc = fileURLToPath(resolvedSrc);
      } catch {
        resolvedSrc = resolvedSrc.replace(/^file:\/\/\/?/, "");
      }
    }

    if (resolvedSrc && fs.existsSync(resolvedSrc)) {
      fs.copyFileSync(resolvedSrc, targetPath);
    } else if (dataUrl || base64Data) {
      const rawBase64 = (dataUrl || base64Data).replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(rawBase64, "base64");
      fs.writeFileSync(targetPath, buffer);
    } else {
      throw new Error("Invalid image or media source provided for export.");
    }

    let fileSize = 0;
    try { fileSize = fs.statSync(targetPath).size; } catch { /* ignore */ }

    return {
      success: true,
      targetPath,
      filename: targetName,
      fileSize,
      exportType: exportType === "diagram_image" ? "diagram_excalidraw" : "image",
      category: exportType === "diagram_image" ? "diagram" : "media"
    };
  }

  // --- Type 6: Persona Export ---
  async _exportPersona(payload, _downloadDir) {
    const { destPath, filePath, filename } = payload || {};
    const targetPath = destPath || filePath;
    if (!targetPath || typeof targetPath !== "string") {
      throw new Error("Invalid persona export destination path.");
    }

    const targetName = filename || path.basename(targetPath);
    let fileSize = 0;
    try { fileSize = fs.statSync(targetPath).size; } catch { /* ignore */ }

    return {
      success: true,
      targetPath,
      filename: targetName,
      fileSize,
      exportType: "persona",
      category: "document"
    };
  }
}

let instance = null;

function getExportManager(deps) {
  if (!instance) {
    instance = new ExportManager(deps);
  } else if (deps) {
    instance.setDeps(deps);
  }
  return instance;
}

module.exports = { ExportManager, getExportManager };

