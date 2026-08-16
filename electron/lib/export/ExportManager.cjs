const fs = require("fs");
const fsAsync = require("fs").promises;
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { pathToFileURL } = require("node:url");
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

    // 2. Broadcast record-added event to all windows
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
        const drawioDestDir = stagingDrawioDir;
        const filesToCopy = [`${id}.drawio`, `${id}.png`];
        let hasDiagram = false;
        for (const file of filesToCopy) {
          let srcPath = path.join(notesRoot, ".notes-app", "drawio-diagrams", file);
          if (!fs.existsSync(srcPath)) {
            srcPath = path.join(notesRoot, "media", "draw.io", file);
          }
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

  _walkFiles(rootDir, options = {}) {
    const exclude = new Set(options.excludeDirs || []);
    const files = [];

    const visit = (currentDir) => {
      if (!fs.existsSync(currentDir)) return;
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const nextPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          if (exclude.has(entry.name)) continue;
          visit(nextPath);
          continue;
        }
        if (entry.isFile()) {
          files.push(nextPath);
        }
      }
    };

    visit(rootDir);
    return files;
  }

  _copyDirRecursive(sourceRoot, targetRoot, options = {}) {
    const exclude = new Set(options.excludeDirs || []);

    const copyDir = (currentSource, currentTarget) => {
      fs.mkdirSync(currentTarget, { recursive: true });
      const entries = fs.readdirSync(currentSource, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && exclude.has(entry.name)) continue;
        const sourcePath = path.join(currentSource, entry.name);
        const targetPath = path.join(currentTarget, entry.name);

        if (entry.isDirectory()) {
          copyDir(sourcePath, targetPath);
          continue;
        }

        if (entry.isFile()) {
          fs.mkdirSync(path.dirname(targetPath), { recursive: true });
          try { fs.copyFileSync(sourcePath, targetPath); } catch { /* ignore */ }
        }
      }
    };

    copyDir(sourceRoot, targetRoot);
  }

  async _exportPdfWorkspace({ notesRoot, stagingRoot, _contentMode }) {
    const markdownFiles = this._walkFiles(notesRoot, {
      excludeDirs: [".notes-app", "node_modules", ".git", ".artifacts", "dist", "build"],
    }).filter((filePath) => path.extname(filePath).toLowerCase() === ".md");

    const tempHtmlDir = path.join(stagingRoot, "_pdf-html");
    fs.mkdirSync(tempHtmlDir, { recursive: true });

    const outputRoot = path.join(stagingRoot, "pdf");
    fs.mkdirSync(outputRoot, { recursive: true });

    for (const markdownPath of markdownFiles) {
      const content = fs.readFileSync(markdownPath, "utf8");
      const parsed = typeof this.parseDocument === "function" ? this.parseDocument(content, markdownPath) : { title: path.basename(markdownPath, ".md") };
      const relativeMdPath = path.relative(notesRoot, markdownPath);

      const markdownContent = typeof this.buildPdfExportMarkdown === "function"
        ? this.buildPdfExportMarkdown(parsed, { includeRawNotes: true, includeCleansed: true })
        : content;
      const html = typeof this.buildPdfExportHtml === "function"
        ? this.buildPdfExportHtml({
            title: parsed.title || path.basename(markdownPath, ".md"),
            markdownContent,
            baseHref: pathToFileURL(`${path.dirname(markdownPath)}${path.sep}`).href,
            sourceDir: path.dirname(markdownPath),
            downsampleImages: false,
            pdfQualityPreset: "full",
          })
        : `<html><body>${markdownContent}</body></html>`;

      const relativePdfPath = relativeMdPath.replace(/\.md$/i, ".pdf");
      const htmlTempPath = path.join(tempHtmlDir, `${relativePdfPath.replace(/[\\/]/g, "__")}.html`);
      const pdfOutputPath = path.join(outputRoot, relativePdfPath);

      fs.mkdirSync(path.dirname(pdfOutputPath), { recursive: true });
      fs.writeFileSync(htmlTempPath, html, "utf8");

      if (this.BrowserWindow) {
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
            webviewTag: false,
          },
        });

        try {
          await pdfWindow.loadFile(htmlTempPath);
          await pdfWindow.webContents.executeJavaScript("document.fonts ? document.fonts.ready : Promise.resolve()", true);

          const pdfData = await pdfWindow.webContents.printToPDF({
            printBackground: true,
            preferCSSPageSize: true,
          });

          await writeFileWithRetries(pdfOutputPath, pdfData);
        } finally {
          if (!pdfWindow.isDestroyed()) {
            pdfWindow.close();
          }
        }
      }
    }
  }

  _exportWebWorkspace({ notesRoot, stagingRoot, _contentMode }) {
    const allFiles = this._walkFiles(notesRoot, {
      excludeDirs: [".notes-app", "node_modules", ".git", ".artifacts", "dist", "build"],
    });
    const markdownFiles = allFiles.filter((filePath) => path.extname(filePath).toLowerCase() === ".md");
    const nonMarkdownFiles = allFiles.filter((filePath) => path.extname(filePath).toLowerCase() !== ".md");

    const webRoot = path.join(stagingRoot, "web");
    fs.mkdirSync(webRoot, { recursive: true });

    const mdToHtmlMap = new Map();
    for (const markdownPath of markdownFiles) {
      const relMdPath = path.relative(notesRoot, markdownPath).replace(/\\/g, "/");
      const relHtmlPath = relMdPath.replace(/\.md$/i, ".html");
      mdToHtmlMap.set(relMdPath, relHtmlPath);
    }

    let markdownIt = null;
    if (typeof this.getMarkdownIt === "function") {
      try {
        const MarkdownItCtor = this.getMarkdownIt();
        markdownIt = new MarkdownItCtor({ html: false, linkify: true, typographer: true });
      } catch { /* fallback */ }
    }

    const indexLinks = [];

    for (const markdownPath of markdownFiles) {
      const relMdPath = path.relative(notesRoot, markdownPath).replace(/\\/g, "/");
      const relHtmlPath = mdToHtmlMap.get(relMdPath);
      const htmlPath = path.join(webRoot, relHtmlPath);
      const content = fs.readFileSync(markdownPath, "utf8");

      const title = path.basename(markdownPath, ".md");
      const renderedHtml = markdownIt ? markdownIt.render(content) : `<pre>${content}</pre>`;
      const pageHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <style>
      body { margin: 0; padding: 28px; font-family: "Segoe UI", Arial, sans-serif; color: #12323a; background: #f5f8f8; }
      .page { max-width: 980px; margin: 0 auto; background: #ffffff; border: 1px solid #d9e3e4; border-radius: 12px; padding: 24px; }
      h1, h2, h3 { color: #163e46; }
      pre { background: #11242b; color: #e3f2f2; border-radius: 8px; padding: 12px; overflow-x: auto; }
      code { font-family: Consolas, "Cascadia Code", monospace; }
      img { max-width: 100%; height: auto; }
      a { color: #0f5f76; }
      ul { padding-left: 20px; }
    </style>
  </head>
  <body>
    <main class="page">
      <h1>${title}</h1>
      ${renderedHtml}
    </main>
  </body>
</html>`;

      fs.mkdirSync(path.dirname(htmlPath), { recursive: true });
      fs.writeFileSync(htmlPath, pageHtml, "utf8");
      indexLinks.push({ title, href: relHtmlPath });
    }

    for (const assetPath of nonMarkdownFiles) {
      const relPath = path.relative(notesRoot, assetPath);
      const targetPath = path.join(webRoot, relPath);
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      try { fs.copyFileSync(assetPath, targetPath); } catch { /* ignore unreadable */ }
    }

    indexLinks.sort((left, right) => left.title.localeCompare(right.title));
    const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Notely Workspace Export</title>
    <style>
      body { margin: 0; padding: 28px; font-family: "Segoe UI", Arial, sans-serif; color: #12323a; background: #f5f8f8; }
      .page { max-width: 980px; margin: 0 auto; background: #ffffff; border: 1px solid #d9e3e4; border-radius: 12px; padding: 24px; }
      h1 { color: #163e46; }
      a { color: #0f5f76; text-decoration: none; }
      a:hover { text-decoration: underline; }
      li { margin: 6px 0; }
    </style>
  </head>
  <body>
    <main class="page">
      <h1>Workspace Notes</h1>
      <ul>${indexLinks.map((entry) => `<li><a href="${entry.href}">${entry.title}</a></li>`).join("")}</ul>
    </main>
  </body>
</html>`;
    fs.writeFileSync(path.join(webRoot, "index.html"), indexHtml, "utf8");
  }

  // --- Type 3: Workspace ZIP Backup ---
  async _exportWorkspaceZip(payload, downloadDir) {
    const notesRoot = typeof this.getNotesRoot === "function" ? this.getNotesRoot() : null;
    if (!notesRoot) throw new Error("No notes root configured.");

    const mode = ["raw", "pdf", "web"].includes(payload.mode) ? payload.mode : "raw";
    const contentMode = payload.contentMode || "combined";
    const includeMetadata = Boolean(payload.includeMetadata);
    const requestedFileName = typeof payload.fileName === "string" ? payload.fileName.trim() : "";
    const folderName = path.basename(notesRoot) || "workspace";

    let destinationPath = payload.destinationPath ? path.resolve(payload.destinationPath) : downloadDir;
    fs.mkdirSync(destinationPath, { recursive: true });

    const defaultName = requestedFileName || `${folderName}_backup.zip`;
    const { targetPath, targetName } = this._resolveCollisionFreePath(destinationPath, defaultName);

    const start = Date.now();
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "notely-workspace-export-"));
    const stagingRoot = path.join(tempRoot, "staging");
    fs.mkdirSync(stagingRoot, { recursive: true });

    try {
      this._sendWorkspaceExportProgress({ phase: "Preparing export", percent: 5 });

      if (mode === "raw") {
        this._sendWorkspaceExportProgress({ phase: "Collecting workspace files", percent: 20 });
        const defaultExcludes = ["node_modules", ".git", "dist", ".artifacts", "build"];
        const excludeDirs = includeMetadata ? defaultExcludes : [".notes-app", ...defaultExcludes];
        this._copyDirRecursive(notesRoot, stagingRoot, { excludeDirs });
        this._sendWorkspaceExportProgress({ phase: "Workspace files staged", percent: 70 });
      } else if (mode === "pdf") {
        this._sendWorkspaceExportProgress({ phase: "Rendering PDF files", percent: 15 });
        await this._exportPdfWorkspace({ notesRoot, stagingRoot, contentMode });
        this._sendWorkspaceExportProgress({ phase: "PDF files rendered", percent: 75 });

        if (includeMetadata) {
          const metadataPath = path.join(notesRoot, ".notes-app");
          if (fs.existsSync(metadataPath)) {
            this._sendWorkspaceExportProgress({ phase: "Adding metadata", percent: 80 });
            this._copyDirRecursive(metadataPath, path.join(stagingRoot, ".notes-app"));
          }
        }
      } else {
        this._sendWorkspaceExportProgress({ phase: "Rendering web pages", percent: 15 });
        this._exportWebWorkspace({ notesRoot, stagingRoot, contentMode });
        this._sendWorkspaceExportProgress({ phase: "Web pages rendered", percent: 75 });

        if (includeMetadata) {
          const metadataPath = path.join(notesRoot, ".notes-app");
          if (fs.existsSync(metadataPath)) {
            this._sendWorkspaceExportProgress({ phase: "Adding metadata", percent: 80 });
            this._copyDirRecursive(metadataPath, path.join(stagingRoot, ".notes-app"));
          }
        }
      }

      this._sendWorkspaceExportProgress({ phase: "Compressing zip", percent: 85 });
      const zipfile = new ZipFile();
      let entryCount = 0;

      const stagedFiles = this._walkFiles(stagingRoot);
      for (const absFile of stagedFiles) {
        const relPath = path.relative(stagingRoot, absFile).replace(/\\/g, "/");
        const archivedPath = folderName ? `${folderName}/${relPath}` : relPath;
        zipfile.addFile(absFile, archivedPath);
        entryCount += 1;
      }

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
    } finally {
      try { fs.rmSync(tempRoot, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }

  // --- Type 4 & 5: Diagram Image & Media Download ---
  async _exportMediaOrDiagram(payload, downloadDir, exportType) {
    const { dataUrl, srcPath, base64Data, defaultFilename, filename, customExportType, category: customCategory } = payload || {};
    const rawName = filename || defaultFilename || (exportType === "diagram_image" ? "diagram.png" : "image.png");

    const { targetPath, targetName } = this._resolveCollisionFreePath(downloadDir, rawName);

    let rawSrc = srcPath && typeof srcPath === "string" ? srcPath.trim() : "";
    let effectiveDataUrl = dataUrl || base64Data || "";

    if (rawSrc.startsWith("data:")) {
      effectiveDataUrl = rawSrc;
      rawSrc = "";
    }

    let resolvedSrc = rawSrc;
    if (resolvedSrc.startsWith("file://")) {
      try {
        const { fileURLToPath } = require("url");
        resolvedSrc = fileURLToPath(resolvedSrc);
      } catch {
        resolvedSrc = resolvedSrc.replace(/^file:\/\/\/?/, "");
      }
    }
    resolvedSrc = resolvedSrc.split(/[?#]/)[0];
    try {
      resolvedSrc = decodeURIComponent(resolvedSrc);
    } catch {
      /* keep original */
    }

    const notesRoot = typeof this.getNotesRoot === "function" ? this.getNotesRoot() : null;

    if (resolvedSrc && !fs.existsSync(resolvedSrc) && notesRoot) {
      const candidate = path.resolve(notesRoot, resolvedSrc);
      if (fs.existsSync(candidate)) {
        resolvedSrc = candidate;
      }
    }

    if (resolvedSrc && fs.existsSync(resolvedSrc)) {
      fs.copyFileSync(resolvedSrc, targetPath);
    } else if (effectiveDataUrl) {
      if (effectiveDataUrl.includes(";base64,")) {
        const rawBase64 = effectiveDataUrl.replace(/^data:[^;]+;base64,/, "");
        const buffer = Buffer.from(rawBase64, "base64");
        fs.writeFileSync(targetPath, buffer);
      } else if (effectiveDataUrl.startsWith("data:")) {
        const commaIdx = effectiveDataUrl.indexOf(",");
        const rawContent = commaIdx >= 0 ? effectiveDataUrl.slice(commaIdx + 1) : effectiveDataUrl;
        const decodedContent = decodeURIComponent(rawContent);
        fs.writeFileSync(targetPath, decodedContent, "utf8");
      } else {
        fs.writeFileSync(targetPath, effectiveDataUrl, "utf8");
      }
    } else {
      return {
        success: false,
        error: `File not found on disk or invalid media source: ${rawSrc || "unknown"}`
      };
    }

    let fileSize = 0;
    try { fileSize = fs.statSync(targetPath).size; } catch { /* ignore */ }

    const ext = path.extname(targetName).toLowerCase().replace(/^\./, "");
    const derivedExportType = customExportType || (exportType === "diagram_image" ? "diagram_excalidraw" : ext || "image");
    const derivedCategory = customCategory || (exportType === "diagram_image" ? "diagram" : ["pdf", "csv", "txt", "md", "doc", "docx", "xls", "xlsx"].includes(ext) ? "document" : "media");

    return {
      success: true,
      targetPath,
      filename: targetName,
      fileSize,
      exportType: derivedExportType,
      category: derivedCategory
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

