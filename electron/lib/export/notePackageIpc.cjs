const fs = require("fs").promises;
const fsSync = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { ZipFile } = require("yazl");
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
  const drawioRegex = /media\/draw\.io\/([^/.]+)\.png/g;
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
function registerNotePackageIpc(ipcMain, deps) {
  const { BrowserWindow, dialog, getNotesRoot, filePathWithin, readUserSettings, getActiveProject } = deps;

  function handleTrusted(channel, handler) {
    ipcMain.handle(channel, async (event, payload) => {
      // Basic trusted sender check
      try {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win || win.isDestroyed()) throw new Error("Invalid sender window");
      } catch (err) {
        return { ok: false, error: err.message };
      }
      try {
        return await handler(event, payload);
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
      const activeProject = typeof getActiveProject === "function" ? getActiveProject() : null;
      destPath = path.resolve(activeProject?.rootPath || notesRoot);
    }

    const rootFolderName = path.basename(notesRoot) || "workspace";
    return {
      destinationPath: destPath,
      fileName: `${rootFolderName}.note`
    };
  });

  // --- Browse Export Destination ---
  handleTrusted("note-package:browse-export-destination", async (event, { defaultFileName }) => {
    const focusedWindow = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showSaveDialog(focusedWindow, {
      title: "Export Note Package",
      defaultPath: defaultFileName || "notes_package.note",
      filters: [{ name: "Notely Shareable Package", extensions: ["note"] }],
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
      filters: [{ name: "Notely Shareable Package", extensions: ["note"] }],
      properties: ["openFile"],
    });
    if (result.canceled || !result.filePaths?.[0]) {
      return { canceled: true };
    }
    return { canceled: false, filePath: result.filePaths[0] };
  });

  // --- Export Note Package ---
  handleTrusted("note-package:export", async (_event, { noteFilePaths, destinationPath, fileName, password }) => {
    const notesRoot = getNotesRoot();
    if (!notesRoot) throw new Error("No notes root configured.");

    const exportFileName = fileName || `export_${Date.now()}.note`;
    const resolvedDest = path.resolve(destinationPath);
    // Ensure destination directory exists (user may have typed a path manually)
    fsSync.mkdirSync(resolvedDest, { recursive: true });
    const finalDest = path.join(resolvedDest, exportFileName);

    // Staging dirs
    const tempDir = fsSync.mkdtempSync(path.join(os.tmpdir(), "notely-note-export-"));
    const stagingNotesDir = path.join(tempDir, "notes");
    const stagingMediaDir = path.join(tempDir, "media");
    const stagingExcaliDir = path.join(tempDir, "excalidraw");
    const stagingDrawioDir = path.join(tempDir, "drawio");

    fsSync.mkdirSync(stagingNotesDir);
    fsSync.mkdirSync(stagingMediaDir);
    fsSync.mkdirSync(stagingExcaliDir);
    fsSync.mkdirSync(stagingDrawioDir);

    let passwordSalt = "";
    let passwordHash = "";
    if (password) {
      passwordSalt = crypto.randomBytes(16).toString("hex");
      passwordHash = crypto.createHash("sha256").update(password + passwordSalt).digest("hex");
    }

    const manifest = {
      version: 1,
      notes: [],
      media: [],
      excalidraw: [],
      drawio: [],
      files: {}, // relative path in zip -> SHA-256 hash
      passwordSalt,
      passwordHash
    };

    const allMediaPaths = new Set();
    const allExcalidrawIds = new Set();
    const allDrawioIds = new Set();

    try {
      // 1. Gather all note contents and parse dependencies
      for (const inputPath of noteFilePaths) {
        // inputPath may be absolute or relative — normalise to absolute first
        const absolutePath = path.isAbsolute(inputPath)
          ? inputPath
          : path.resolve(notesRoot, inputPath);
        if (!filePathWithin(notesRoot, absolutePath) || !fsSync.existsSync(absolutePath)) {
          continue;
        }
        // Always use a root-relative path inside the zip / staging dirs
        const relPath = path.relative(notesRoot, absolutePath).replace(/\\/g, "/");

        const content = await fs.readFile(absolutePath, "utf8");
        const depsResult = scanNoteDependencies(content);

        depsResult.images.forEach(img => allMediaPaths.add(img));
        depsResult.excalidrawIds.forEach(id => allExcalidrawIds.add(id));
        depsResult.drawioIds.forEach(id => allDrawioIds.add(id));

        // Copy note to staging
        const stagingNotePath = path.join(stagingNotesDir, relPath);
        fsSync.mkdirSync(path.dirname(stagingNotePath), { recursive: true });
        await fs.writeFile(stagingNotePath, content, "utf8");

        manifest.notes.push(relPath);
      }

      // 2. Package standard media files
      for (const relMediaPath of allMediaPaths) {
        // Sanitize: strip leading slash (paths may be stored as /media/images/... in markdown),
        // strip query/fragment, normalise to forward slashes
        const cleanRelPath = relMediaPath.replace(/^\/+/, "").replace(/[?#].*$/, "").trim().replace(/\\/g, "/");
        if (!cleanRelPath) continue;
        const absPath = path.resolve(notesRoot, cleanRelPath);
        if (!filePathWithin(notesRoot, absPath) || !fsSync.existsSync(absPath)) continue;
        const stagingPath = path.join(stagingMediaDir, cleanRelPath);
        try {
          fsSync.mkdirSync(path.dirname(stagingPath), { recursive: true });
          await fs.copyFile(absPath, stagingPath);
          manifest.media.push(cleanRelPath);
        } catch {
          // Skip assets that can't be read (locked, missing, permission denied)
        }
      }

      // 3. Package Excalidraw diagrams
      for (const id of allExcalidrawIds) {
        if (!id) continue;
        const excaliSrcDir = path.join(notesRoot, ".notes-app", "excali-diagrams", id);
        const excaliDestDir = path.join(stagingExcaliDir, id);
        if (!fsSync.existsSync(excaliSrcDir)) continue;
        try {
          fsSync.mkdirSync(excaliDestDir, { recursive: true });
          const files = await fs.readdir(excaliSrcDir);
          for (const file of files) {
            try {
              await fs.copyFile(path.join(excaliSrcDir, file), path.join(excaliDestDir, file));
            } catch {
              // Skip unreadable excalidraw asset file
            }
          }
          manifest.excalidraw.push(id);
        } catch {
          // Skip entire diagram if unreadable
        }
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
          if (!fsSync.existsSync(srcPath)) continue;
          try {
            await fs.copyFile(srcPath, destPath);
            hasDiagram = true;
          } catch {
            // Skip unreadable draw.io asset
          }
        }
        if (hasDiagram) manifest.drawio.push(id);
      }

      // 5. Generate file hashes and build final manifest.json
      const zipFile = new ZipFile();
      const zipEntries = [];

      // Helper to add files to ZIP and record manifest hash
      async function addStagedFile(localStagedPath, zipRelativePath) {
        const hash = await calculateHash(localStagedPath);
        manifest.files[zipRelativePath] = hash;
        zipEntries.push({ localStagedPath, zipRelativePath });
      }

      // Add notes, media, and diagrams to hashes
      const walkAndStage = async (dir, relativePrefix) => {
        if (!fsSync.existsSync(dir)) return;
        const entries = await fs.readdir(dir, { withFileTypes: true });
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

      // Write manifest
      const manifestPath = path.join(tempDir, "metadata.json");
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
      // Add manifest itself to the zip (without self-hash)
      zipEntries.push({ localStagedPath: manifestPath, zipRelativePath: "metadata.json" });

      // Build ZIP in memory/tmp
      const zipOutputPath = path.join(tempDir, "temp.zip");
      const zipStream = fsSync.createWriteStream(zipOutputPath);

      await new Promise((resolve, reject) => {
        zipStream.on("close", resolve);
        zipFile.outputStream.on("error", reject);
        zipStream.on("error", reject);
        zipFile.outputStream.pipe(zipStream);

        for (const entry of zipEntries) {
          zipFile.addFile(entry.localStagedPath, entry.zipRelativePath);
        }
        zipFile.end();
      });

      // Encrypt zip file and write to final destination
      // Write to a .tmp sibling first then rename to avoid OneDrive / AV file-lock EPERM
      const zipBuffer = await fs.readFile(zipOutputPath);
      const encryptedBuffer = encryptBuffer(zipBuffer);
      const finalDestTmp = finalDest + ".tmp";
      await fs.writeFile(finalDestTmp, encryptedBuffer);
      try {
        // Remove existing file before rename (Windows requires this)
        if (fsSync.existsSync(finalDest)) {
          await fs.unlink(finalDest);
        }
        await fs.rename(finalDestTmp, finalDest);
      } catch {
        // Fallback: direct write if rename fails (e.g. cross-device)
        await fs.writeFile(finalDest, encryptedBuffer);
        try { await fs.unlink(finalDestTmp); } catch { /* ignore */ }
      }

      return { success: true, destination: finalDest };
    } finally {
      // Cleanup temp
      try {
        fsSync.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup error
      }
    }
  });

  // --- Import Note Package ---
  handleTrusted("note-package:import", async (_event, { packageFilePath, password }) => {
    const notesRoot = getNotesRoot();
    if (!notesRoot) throw new Error("No notes root configured.");

    const tempDir = fsSync.mkdtempSync(path.join(os.tmpdir(), "notely-note-import-"));
    const zipExtractPath = path.join(tempDir, "extracted.zip");

    try {
      // 1. Decrypt note package
      const encryptedBuffer = await fs.readFile(packageFilePath);
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
          return { success: false, error: "PASSWORD_REQUIRED" };
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
          const drawioDest = path.join(notesRoot, "media", "draw.io", `${currentId}.drawio`);
          if (!fsSync.existsSync(excaliDest) && !fsSync.existsSync(drawioDest)) {
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
        const targetDir = path.join(notesRoot, "media", "draw.io");

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
          content = content.replace(new RegExp(`media/draw\\.io/${oldId}\\.png`, "g"), `media/draw.io/${newId}.png`);
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

      return { success: true, importedNotes: Object.values(renameMap.notes) };
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
