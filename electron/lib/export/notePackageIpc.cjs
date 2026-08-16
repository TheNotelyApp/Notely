const fs = require("fs").promises;
const fsSync = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const yauzl = require("yauzl");

// Static app key for seamless Notely-to-Notely imports
const APP_ESSENCE_SECRET = "NotelyAppEssenceSecretKey";
const DERIVED_KEY = crypto.createHash("sha256").update(APP_ESSENCE_SECRET).digest();

/**
 * Encrypt buffer using AES-256-GCM
 */
function encryptBuffer(buffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", DERIVED_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Pack: [iv (12 bytes)][tag (16 bytes)][encrypted data]
  return Buffer.concat([iv, tag, encrypted]);
}

/**
 * Decrypt buffer using AES-256-GCM
 */
function decryptBuffer(buffer) {
  if (buffer.length < 28) {
    throw new Error("Invalid encrypted package format.");
  }
  const iv = buffer.subarray(0, 12);
  const tag = buffer.subarray(12, 28);
  const encrypted = buffer.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", DERIVED_KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

/**
 * Calculate SHA-256 hash of a file
 */
async function calculateHash(filePath) {
  const data = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * Scan markdown for media, Excalidraw, and Draw.io dependencies
 */
function scanNoteDependencies(content) {
  const images = [];
  const excalidrawIds = new Set();
  const drawioIds = new Set();

  const imageRegex = /!\[.*?\]\(((?!\s*https?:\/\/)(?!\s*file:\/\/)(?!\s*mailto:)(?!\s*data:)[^)?"#]+)(?:\?[^)]*)?(?:#[^)]*)?\)/g;
  let match;
  while ((match = imageRegex.exec(content)) !== null) {
    // Strip leading slash (markdown may use /media/... absolute-from-root paths),
    // then strip any query/fragment leftover and trim whitespace
    const rawPath = match[1].replace(/^\/+/, "").replace(/[?#].*$/, "").trim();
    if (!rawPath) continue;
    // Exclude excalidraw/draw.io from direct raw images if they will be handled separately
    if (!rawPath.includes("excali-diagrams") && !rawPath.includes("draw.io") && !rawPath.includes("media/diagrams")) {
      images.push(rawPath);
    }
  }

  // 2. Scan for Excalidraw diagram attributes
  const excaliAttrRegex = /data-diagram-id=["'“]([^"'”]+)["'”]/g;
  while ((match = excaliAttrRegex.exec(content)) !== null) {
    excalidrawIds.add(match[1]);
  }

  // Also check URL pattern for excalidraw
  const excaliUrlRegex = /(?:excali-diagrams|media\/diagrams)\/([^/.]+)\.png/g;
  while ((match = excaliUrlRegex.exec(content)) !== null) {
    excalidrawIds.add(match[1]);
  }

  // 3. Scan for Draw.io references
  const drawioRegex = /(?:\.notes-app\/drawio-diagrams\/|media\/draw\.io\/)([^/.]+)\.png/g;
  while ((match = drawioRegex.exec(content)) !== null) {
    drawioIds.add(match[1]);
  }

  return {
    images,
    excalidrawIds: Array.from(excalidrawIds),
    drawioIds: Array.from(drawioIds),
  };
}

/**
 * Recursively create directories (sync version for zip extract)
 */
function ensureDirSync(dirPath) {
  if (!fsSync.existsSync(dirPath)) {
    fsSync.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Register note package IPC handlers
 */
function registerNotePackageIpc(ipcMain, deps = {}) {
  const { BrowserWindow, dialog, getNotesRoot, readUserSettings, getActiveProject } = deps;
  const { app } = require("electron");

  function assertTrustedIpcSender(BrowserWindow, event, _channel) {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed()) throw new Error("Invalid sender window");
  }

  function handleTrusted(channel, fn) {
    ipcMain.handle(channel, async (event, ...args) => {
      assertTrustedIpcSender(BrowserWindow, event, channel);
      try {
        return await fn(event, ...args);
      } catch (err) {
        console.error(`[notePackageIpc] ${channel} error:`, err);
        return { ok: false, error: err.message };
      }
    });
  }

  // --- Get Defaults ---
  handleTrusted("note-package:get-defaults", async (_event) => {
    const notesRoot = getNotesRoot();
    if (!notesRoot) throw new Error("No notes root configured.");

    const settings = typeof readUserSettings === "function" ? readUserSettings() : {};
    let destPath = "";
    if (typeof settings.lastWorkspaceExportPath === "string" && settings.lastWorkspaceExportPath.trim()) {
      destPath = settings.lastWorkspaceExportPath.trim();
    } else if (typeof settings.lastPdfExportPath === "string" && settings.lastPdfExportPath.trim()) {
      destPath = settings.lastPdfExportPath.trim();
    }

    if (destPath) {
      try {
        const resolved = path.resolve(destPath);
        if (!fsSync.existsSync(resolved)) {
          destPath = "";
        }
      } catch {
        destPath = "";
      }
    }

    if (!destPath) {
      try {
        const downloadsPath = app ? app.getPath("downloads") : "";
        if (downloadsPath && fsSync.existsSync(downloadsPath)) {
          destPath = downloadsPath;
        }
      } catch {
        /* ignore fallback errors */
      }
    }

    if (!destPath) {
      const activeProject = typeof getActiveProject === "function" ? getActiveProject() : null;
      destPath = path.resolve(activeProject?.rootPath || notesRoot);
    }

    const rootFolderName = path.basename(notesRoot) || "workspace";
    return {
      destinationPath: destPath,
      fileName: `${rootFolderName}.nly`
    };
  });

  // --- Browse Export Destination ---
  handleTrusted("note-package:browse-export-destination", async (event, { defaultFileName }) => {
    const focusedWindow = BrowserWindow.fromWebContents(event.sender);
    let defaultDir = "";
    try {
      defaultDir = app ? app.getPath("downloads") : "";
    } catch {
      /* ignore default dir error */
    }
    const defaultPath = defaultDir ? path.join(defaultDir, defaultFileName || "notes_package.nly") : (defaultFileName || "notes_package.nly");
    const result = await dialog.showSaveDialog(focusedWindow, {
      title: "Export Note Package",
      defaultPath,
      filters: [{ name: "Notely Shareable Package", extensions: ["nly", "note"] }],
    });
    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }
    return { canceled: false, filePath: result.filePath };
  });

  // --- Browse Import File ---
  handleTrusted("note-package:browse-import-file", async (event) => {
    const focusedWindow = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(focusedWindow, {
      title: "Select Note Package to Import",
      filters: [{ name: "Notely Shareable Package", extensions: ["nly", "note"] }],
      properties: ["openFile"],
    });
    if (result.canceled || !result.filePaths?.[0]) {
      return { canceled: true };
    }
    return { canceled: false, filePath: result.filePaths[0] };
  });

  // --- Export Note Package ---
  handleTrusted("note-package:export", async (_event, payload = {}) => {
    const { getExportManager } = require("./ExportManager.cjs");
    return await getExportManager().runExport({ type: "note_package", payload });
  });

  // --- Import Note Package ---
  handleTrusted("note-package:import", async (_event, payload = {}) => {
    const { packageFilePath, packagePath, password } = payload;
    const inputPackagePath = packageFilePath || packagePath;
    if (!inputPackagePath) {
      throw new Error("No package file path provided for import.");
    }

    const notesRoot = getNotesRoot();
    if (!notesRoot) throw new Error("No notes root configured.");

    const tempDir = fsSync.mkdtempSync(path.join(os.tmpdir(), "notely-note-import-"));
    const zipExtractPath = path.join(tempDir, "extracted.zip");

    try {
      // 1. Decrypt note package
      const encryptedBuffer = await fs.readFile(inputPackagePath);
      const decryptedBuffer = decryptBuffer(encryptedBuffer);
      await fs.writeFile(zipExtractPath, decryptedBuffer);

      // 2. Unzip contents
      await new Promise((resolve, reject) => {
        yauzl.open(zipExtractPath, { lazyEntries: true }, (err, zipfile) => {
          if (err) return reject(err);
          zipfile.readEntry();
          zipfile.on("entry", (entry) => {
            if (/\/$/.test(entry.fileName)) {
              // Directory
              ensureDirSync(path.join(tempDir, entry.fileName));
              zipfile.readEntry();
            } else {
              // File
              ensureDirSync(path.dirname(path.join(tempDir, entry.fileName)));
              zipfile.openReadStream(entry, (err, readStream) => {
                if (err) return reject(err);
                const writeStream = fsSync.createWriteStream(path.join(tempDir, entry.fileName));
                readStream.pipe(writeStream);
                writeStream.on("close", () => {
                   zipfile.readEntry();
                });
              });
            }
          });
          zipfile.on("end", resolve);
          zipfile.on("error", reject);
        });
      });

      // 3. Read manifest and verify password / SHA-256 hashes
      const manifestPath = path.join(tempDir, "metadata.json");
      if (!fsSync.existsSync(manifestPath)) {
        throw new Error("Metadata file missing from note package.");
      }

      const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));

      // Password Check
      if (manifest.passwordHash) {
        if (!password) {
          return { success: false, passwordRequired: true, error: "PASSWORD_REQUIRED" };
        }
        const checkHash = crypto.createHash("sha256").update(password + (manifest.passwordSalt || "")).digest("hex");
        if (checkHash !== manifest.passwordHash) {
          return { success: false, error: "INCORRECT_PASSWORD" };
        }
      }

      for (const [relZipPath, expectedHash] of Object.entries(manifest.files || {})) {
        const filePath = path.join(tempDir, relZipPath);
        if (!fsSync.existsSync(filePath)) {
          throw new Error(`File ${relZipPath} is missing from package.`);
        }
        const actualHash = await calculateHash(filePath);
        if (actualHash !== expectedHash) {
          throw new Error(`Integrity check failed: ${relZipPath} got tampered or corrupted.`);
        }
      }

      // Collision mapping registry
      const renameMap = {
        notes: {}, // original relPath -> imported relPath
        media: {}, // original relPath -> imported relPath
        diagrams: {} // original diagramId -> imported diagramId
      };

      // Helper to generate unique filename in destination workspace
      function getUniqueWorkspacePath(baseDir, relativePath) {
        const fullDest = path.join(baseDir, relativePath);
        if (!fsSync.existsSync(fullDest)) {
          return relativePath;
        }
        const ext = path.extname(relativePath);
        const dir = path.dirname(relativePath);
        const name = path.basename(relativePath, ext);
        let counter = 1;
        while (true) {
          const candidate = path.join(dir, `${name}-${counter}${ext}`).replace(/\\/g, "/");
          if (!fsSync.existsSync(path.join(baseDir, candidate))) {
            return candidate;
          }
          counter++;
        }
      }

      // Helper to generate unique diagram ID
      function getUniqueDiagramId(diagramId) {
        let currentId = diagramId;
        let counter = 1;
        while (true) {
          const excaliDest = path.join(notesRoot, ".notes-app", "excali-diagrams", currentId);
          const drawioDest1 = path.join(notesRoot, ".notes-app", "drawio-diagrams", `${currentId}.drawio`);
          const drawioDest2 = path.join(notesRoot, "media", "draw.io", `${currentId}.drawio`);
          if (!fsSync.existsSync(excaliDest) && !fsSync.existsSync(drawioDest1) && !fsSync.existsSync(drawioDest2)) {
            return currentId;
          }
          currentId = `${diagramId.slice(0, 6)}_${counter}`;
          counter++;
        }
      }

      // 4. Resolve name collisions and register mappings
      for (const relNotePath of manifest.notes || []) {
        const uniquePath = getUniqueWorkspacePath(notesRoot, relNotePath);
        renameMap.notes[relNotePath] = uniquePath;
      }

      for (const relMediaPath of manifest.media || []) {
        const uniquePath = getUniqueWorkspacePath(notesRoot, relMediaPath);
        renameMap.media[relMediaPath] = uniquePath;
      }

      for (const diagId of manifest.excalidraw || []) {
        const uniqueId = getUniqueDiagramId(diagId);
        renameMap.diagrams[diagId] = uniqueId;
      }

      for (const diagId of manifest.drawio || []) {
        // Skip renaming if it's already mapped via excalidraw (sharing the same ID)
        if (!renameMap.diagrams[diagId]) {
          const uniqueId = getUniqueDiagramId(diagId);
          renameMap.diagrams[diagId] = uniqueId;
        }
      }

      // 5. Copy files into destination workspace and rewrite references based on metadata mapping
      // Copy media files
      for (const relMediaPath of manifest.media || []) {
        const sourceFile = path.join(tempDir, "media", relMediaPath);
        const targetRelPath = renameMap.media[relMediaPath];
        const targetFile = path.join(notesRoot, targetRelPath);

        ensureDirSync(path.dirname(targetFile));
        await fs.copyFile(sourceFile, targetFile);
      }

      // Copy Excalidraw diagrams
      for (const diagId of manifest.excalidraw || []) {
        const sourceDir = path.join(tempDir, "excalidraw", diagId);
        const targetId = renameMap.diagrams[diagId];
        const targetDir = path.join(notesRoot, ".notes-app", "excali-diagrams", targetId);

        if (fsSync.existsSync(sourceDir)) {
          ensureDirSync(targetDir);
          const files = await fs.readdir(sourceDir);
          for (const file of files) {
            await fs.copyFile(path.join(sourceDir, file), path.join(targetDir, file));
          }
          // Copy preview image to media/diagrams/ as well
          const previewSrc = path.join(targetDir, "diagram.png");
          if (fsSync.existsSync(previewSrc)) {
            const previewDest = path.join(notesRoot, "media", "diagrams", `${targetId}.png`);
            ensureDirSync(path.dirname(previewDest));
            await fs.copyFile(previewSrc, previewDest);
          }
        }
      }

      // Copy Draw.io diagrams
      for (const diagId of manifest.drawio || []) {
        const sourceDir = path.join(tempDir, "drawio");
        const targetId = renameMap.diagrams[diagId];
        const targetDir = path.join(notesRoot, ".notes-app", "drawio-diagrams");

        ensureDirSync(targetDir);
        const filesToCopy = [`${diagId}.drawio`, `${diagId}.png`];
        for (const file of filesToCopy) {
          const srcPath = path.join(sourceDir, file);
          if (fsSync.existsSync(srcPath)) {
            const ext = path.extname(file);
            await fs.copyFile(srcPath, path.join(targetDir, `${targetId}${ext}`));
          }
        }
      }

      // Copy notes and rewrite links using renames mapping
      for (const relNotePath of manifest.notes || []) {
        const sourceFile = path.join(tempDir, "notes", relNotePath);
        const targetRelPath = renameMap.notes[relNotePath];
        const targetFile = path.join(notesRoot, targetRelPath);

        let content = await fs.readFile(sourceFile, "utf8");

        // A. Rewrite normal media file links
        for (const [oldRel, newRel] of Object.entries(renameMap.media)) {
          if (oldRel === newRel) continue;
          // Escape regex special chars in old path
          const escapedOld = oldRel.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
          const regex = new RegExp(`(!\\[.*?\\]\\()${escapedOld}(\\))`, "g");
          content = content.replace(regex, `$1${newRel}$2`);
        }

        // B. Rewrite Excalidraw diagram refs (ID + image references)
        for (const [oldId, newId] of Object.entries(renameMap.diagrams)) {
          if (oldId === newId) continue;
          // Replace excalidraw diagram metadata attribute references
          content = content.replace(new RegExp(`data-diagram-id=["'“]${oldId}["'”]`, "g"), `data-diagram-id="${newId}"`);
          // Replace excalidraw preview image path references
          content = content.replace(new RegExp(`excali-diagrams/${oldId}/diagram\\.png`, "g"), `excali-diagrams/${newId}/diagram.png`);
          content = content.replace(new RegExp(`media/diagrams/${oldId}\\.png`, "g"), `media/diagrams/${newId}.png`);
          // Replace Draw.io diagram references
          content = content.replace(new RegExp(`\\.notes-app/drawio-diagrams/${oldId}\\.png`, "g"), `.notes-app/drawio-diagrams/${newId}.png`);
          content = content.replace(new RegExp(`media/draw\\.io/${oldId}\\.png`, "g"), `.notes-app/drawio-diagrams/${newId}.png`);
        }

        // C. Rewrite relative cross-note links if target notes got renamed
        for (const [oldRel, newRel] of Object.entries(renameMap.notes)) {
          if (oldRel === newRel) continue;
          const escapedOld = oldRel.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
          const regex = new RegExp(`(\\[.*?\\]\\()${escapedOld}(\\))`, "g");
          content = content.replace(regex, `$1${newRel}$2`);
        }

        ensureDirSync(path.dirname(targetFile));
        await fs.writeFile(targetFile, content, "utf8");
      }

      return {
        success: true,
        importedNotes: Object.values(renameMap.notes),
        importedNotesCount: (manifest.notes || []).length,
      };
    } finally {
      // Cleanup temp
      try {
        fsSync.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup error
      }
    }
  });
}

module.exports = {
  registerNotePackageIpc,
  encryptBuffer,
  decryptBuffer,
  scanNoteDependencies,
  calculateHash
};
