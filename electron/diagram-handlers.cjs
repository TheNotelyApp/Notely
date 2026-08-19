/**
 * Electron Main Process IPC Handlers for Diagram File Operations
 * 
 * Usage in main.cjs:
 * const { setupDiagramHandlers } = require('./electron/diagram-handlers.cjs');
 * setupDiagramHandlers(ipcMain);
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

function isNotFoundError(err) {
  return Boolean(err && err.code === 'ENOENT');
}

/**
 * Setup diagram IPC handlers
 * @param {Object} ipcMain - Electron's ipcMain
 * @param {string} appDataPath - Application data directory
 */
function setupDiagramHandlers(ipcMain, appDataPath, deps = {}) {
  const {
    getNotesRoot = () => "",
    filePathWithin = () => false,
    emitLocalP2PSyncEvent = null,
    hashContent = null,
  } = deps;

  function resolveWorkspaceRoot(documentPath) {
    const notesRoot = getNotesRoot();
    if (notesRoot && fsSync.existsSync(notesRoot)) {
      return notesRoot;
    }
    if (documentPath) {
      let curr = path.resolve(documentPath);
      while (curr && curr !== path.dirname(curr)) {
        if (fsSync.existsSync(path.join(curr, '.notes-app'))) {
          return curr;
        }
        curr = path.dirname(curr);
      }
      return path.resolve(documentPath);
    }
    return "";
  }

  function getCurrentDiagramDir(documentPath, diagramId) {
    const root = resolveWorkspaceRoot(documentPath);
    return path.join(root, 'media', 'excalidraw', diagramId);
  }

  function getLegacyDiagramDir(documentPath, diagramId) {
    const root = resolveWorkspaceRoot(documentPath);
    return path.join(root, 'excali-diagrams', diagramId);
  }

  function getPreferredExistingDiagramDir(documentPath, diagramId) {
    const root = resolveWorkspaceRoot(documentPath);
    const mediaExcaliDir = path.join(root, 'media', 'excalidraw', diagramId);
    if (fsSync.existsSync(mediaExcaliDir)) return mediaExcaliDir;

    const mediaDiagramsDir = path.join(root, 'media', 'diagrams', diagramId);
    if (fsSync.existsSync(mediaDiagramsDir)) return mediaDiagramsDir;

    const currentDir = path.join(root, '.notes-app', 'excali-diagrams', diagramId);
    if (fsSync.existsSync(currentDir)) return currentDir;

    if (documentPath && documentPath !== root) {
      const subDir = path.join(documentPath, '.notes-app', 'excali-diagrams', diagramId);
      if (fsSync.existsSync(subDir)) return subDir;
    }

    const legacyDir = path.join(root, 'excali-diagrams', diagramId);
    if (fsSync.existsSync(legacyDir)) return legacyDir;

    return mediaExcaliDir;
  }

  function emitDiagramSync(filePath, options = {}) {
    if (typeof emitLocalP2PSyncEvent !== 'function' || typeof hashContent !== 'function') {
      return;
    }

    const { op = 'update', baseHash = null } = options;
    const notesRoot = getNotesRoot();
    const resolved = path.resolve(String(filePath || ''));
    if (!resolved || !filePathWithin(notesRoot, resolved)) {
      return;
    }

    if (op === 'delete') {
      emitLocalP2PSyncEvent({
        op: 'delete',
        filePath: resolved,
        baseHash,
        newHash: null,
        content: null,
        contentBase64: null,
        contentEncoding: 'base64',
      });
      return;
    }

    if (!fsSync.existsSync(resolved)) {
      return;
    }

    const contentBase64 = fsSync.readFileSync(resolved).toString('base64');
    emitLocalP2PSyncEvent({
      op,
      filePath: resolved,
      baseHash,
      newHash: hashContent(contentBase64),
      content: null,
      contentBase64,
      contentEncoding: 'base64',
    });
  }
  /**
   * Read diagram source file
   */
  ipcMain.handle('diagram:read-source', async (event, { documentPath, diagramId }) => {
    try {
      const sourceFile = path.join(getPreferredExistingDiagramDir(documentPath, diagramId), 'diagram.excalidraw');
      const data = await fs.readFile(sourceFile, 'utf-8');
      
      return {
        success: true,
        data,
      };
    } catch (err) {
      if (isNotFoundError(err)) {
        return {
          success: false,
          notFound: true,
        };
      }
      console.error('Failed to read diagram source:', err);
      return {
        success: false,
        error: err.message,
      };
    }
  });

  /**
   * Write diagram source file
   */
  ipcMain.handle('diagram:write-source', async (event, { documentPath, diagramId, data }) => {
    try {
      const diagramDir = getCurrentDiagramDir(documentPath, diagramId);
      const sourceFile = path.join(diagramDir, 'diagram.excalidraw');
      const existed = fsSync.existsSync(sourceFile);
      const previousBase64 = existed ? fsSync.readFileSync(sourceFile).toString('base64') : null;
      const previousHash = previousBase64 && typeof hashContent === 'function' ? hashContent(previousBase64) : null;
      
      // Create directory if it doesn't exist
      await mkdirRecursive(diagramDir);

      await fs.writeFile(sourceFile, data, 'utf-8');
      emitDiagramSync(sourceFile, { op: existed ? 'update' : 'create', baseHash: previousHash });
      
      return {
        success: true,
      };
    } catch (err) {
      console.error('Failed to write diagram source:', err);
      return {
        success: false,
        error: err.message,
      };
    }
  });

  /**
   * Write diagram image file
   */
  ipcMain.handle('diagram:write-image', async (event, { documentPath, diagramId, imageData }) => {
    try {
      const primaryDir = getCurrentDiagramDir(documentPath, diagramId);
      const primaryImageFile = path.join(primaryDir, 'diagram.png');
      const existed = fsSync.existsSync(primaryImageFile);
      const previousBase64 = existed ? fsSync.readFileSync(primaryImageFile).toString('base64') : null;
      const previousHash = previousBase64 && typeof hashContent === 'function' ? hashContent(previousBase64) : null;
      
      await mkdirRecursive(primaryDir);

      let buffer;
      if (typeof imageData === 'string') {
        const base64Data = imageData.replace(/^data:image\/png;base64,/, '');
        buffer = Buffer.from(base64Data, 'base64');
      } else {
        buffer = imageData;
      }
      
      await fs.writeFile(primaryImageFile, buffer);

      // Also mirror to legacy notes-app dir if it exists
      const notesRoot = getNotesRoot();
      const legacyNotesAppDir = path.join(resolveWorkspaceRoot(documentPath), '.notes-app', 'excali-diagrams', diagramId);
      if (fsSync.existsSync(legacyNotesAppDir)) {
        await fs.writeFile(path.join(legacyNotesAppDir, 'diagram.png'), buffer);
      }

      // Also mirror to legacy flat media/diagrams dir if it already exists
      const legacyFlatFile = path.join(notesRoot, 'media', 'diagrams', `${diagramId}.png`);
      if (fsSync.existsSync(legacyFlatFile)) {
        await fs.writeFile(legacyFlatFile, buffer);
      }

      emitDiagramSync(primaryImageFile, { op: existed ? 'update' : 'create', baseHash: previousHash });
      
      return {
        success: true,
      };
    } catch (err) {
      console.error('Failed to write diagram image:', err);
      return {
        success: false,
        error: err.message,
      };
    }
  });

  /**
   * Delete diagram folder
   */
  ipcMain.handle('diagram:delete', async (event, { documentPath, diagramId }) => {
    try {
      const diagramDirs = [
        getCurrentDiagramDir(documentPath, diagramId),
        getLegacyDiagramDir(documentPath, diagramId),
      ];
      const sourceFileHashes = [];
      const imageFileHashes = [];
      for (const diagramDir of diagramDirs) {
        const sourceFile = path.join(diagramDir, 'diagram.excalidraw');
        const imageFile = path.join(diagramDir, 'diagram.png');
        const sourceHash = (typeof hashContent === 'function' && fsSync.existsSync(sourceFile))
          ? hashContent(fsSync.readFileSync(sourceFile).toString('base64'))
          : null;
        const imageHash = (typeof hashContent === 'function' && fsSync.existsSync(imageFile))
          ? hashContent(fsSync.readFileSync(imageFile).toString('base64'))
          : null;
        sourceFileHashes.push({ filePath: sourceFile, hash: sourceHash });
        imageFileHashes.push({ filePath: imageFile, hash: imageHash });
      }
      for (const diagramDir of diagramDirs) {
        await rmRecursive(diagramDir);
      }
      sourceFileHashes.forEach((entry) => emitDiagramSync(entry.filePath, { op: 'delete', baseHash: entry.hash }));
      imageFileHashes.forEach((entry) => emitDiagramSync(entry.filePath, { op: 'delete', baseHash: entry.hash }));
      
      return {
        success: true,
      };
    } catch (err) {
      console.error('Failed to delete diagram:', err);
      return {
        success: false,
        error: err.message,
      };
    }
  });

  /**
   * Check if diagram exists
   */
  ipcMain.handle('diagram:exists', async (event, { documentPath, diagramId }) => {
    try {
      const sourceFile = path.join(getPreferredExistingDiagramDir(documentPath, diagramId), 'diagram.excalidraw');
      
      try {
        await fs.access(sourceFile);
        return {
          exists: true,
        };
      } catch {
        return {
          exists: false,
        };
      }
    } catch (err) {
      console.error('Failed to check diagram existence:', err);
      return {
        exists: false,
        error: err.message,
      };
    }
  });

  /**
   * Read diagram image file as base64
   */
  ipcMain.handle('diagram:read-image', async (event, { documentPath, diagramId }) => {
    try {
      const notesRoot = getNotesRoot();
      let imageFile = path.join(notesRoot, 'media', 'diagrams', `${diagramId}.png`);
      if (!fsSync.existsSync(imageFile)) {
        imageFile = path.join(getPreferredExistingDiagramDir(documentPath, diagramId), 'diagram.png');
      }
      const imageData = await fs.readFile(imageFile);
      const base64 = imageData.toString('base64');
      
      return {
        success: true,
        data: `data:image/png;base64,${base64}`,
      };
    } catch (err) {
      if (isNotFoundError(err)) {
        return {
          success: false,
          notFound: true,
        };
      }
      console.error('Failed to read diagram image:', err);
      return {
        success: false,
        error: err.message,
      };
    }
  });

  function getDrawioSourceFile(diagramId, documentPath) {
    const root = resolveWorkspaceRoot(documentPath);
    const mediaFile = path.join(root, 'media', 'draw.io', `${diagramId}.drawio`);
    if (fsSync.existsSync(mediaFile)) return mediaFile;

    const primaryFile = path.join(root, '.notes-app', 'drawio-diagrams', `${diagramId}.drawio`);
    if (fsSync.existsSync(primaryFile)) return primaryFile;

    if (documentPath && documentPath !== root) {
      const subFile = path.join(documentPath, '.notes-app', 'drawio-diagrams', `${diagramId}.drawio`);
      if (fsSync.existsSync(subFile)) return subFile;
    }

    return mediaFile;
  }

  function getDrawioImageFile(diagramId, documentPath) {
    const root = resolveWorkspaceRoot(documentPath);
    const mediaFile = path.join(root, 'media', 'draw.io', `${diagramId}.png`);
    if (fsSync.existsSync(mediaFile)) return mediaFile;

    const primaryFile = path.join(root, '.notes-app', 'drawio-diagrams', `${diagramId}.png`);
    if (fsSync.existsSync(primaryFile)) return primaryFile;

    if (documentPath && documentPath !== root) {
      const subFile = path.join(documentPath, '.notes-app', 'drawio-diagrams', `${diagramId}.png`);
      if (fsSync.existsSync(subFile)) return subFile;
    }

    return mediaFile;
  }

  /**
   * Read drawio source file
   */
  ipcMain.handle('drawio:read-source', async (event, { diagramId, documentPath }) => {
    try {
      const sourceFile = getDrawioSourceFile(diagramId, documentPath);
      const data = await fs.readFile(sourceFile, 'utf-8');
      
      return {
        success: true,
        data,
      };
    } catch (err) {
      if (isNotFoundError(err)) {
        return {
          success: false,
          notFound: true,
        };
      }
      console.error('Failed to read drawio source:', err);
      return {
        success: false,
        error: err.message,
      };
    }
  });

  /**
   * Write drawio source file
   */
  ipcMain.handle('drawio:write-source', async (event, { diagramId, data, documentPath }) => {
    try {
      const root = resolveWorkspaceRoot(documentPath);
      const drawioDir = path.join(root, 'media', 'draw.io');
      const sourceFile = path.join(drawioDir, `${diagramId}.drawio`);
      const existed = fsSync.existsSync(sourceFile);
      const previousBase64 = existed ? fsSync.readFileSync(sourceFile).toString('base64') : null;
      const previousHash = previousBase64 && typeof hashContent === 'function' ? hashContent(previousBase64) : null;
      
      await mkdirRecursive(drawioDir);
      await fs.writeFile(sourceFile, data, 'utf-8');

      // Also mirror to legacy notes-app dir if it already exists
      const legacyDir = path.join(root, '.notes-app', 'drawio-diagrams');
      if (fsSync.existsSync(legacyDir)) {
        await fs.writeFile(path.join(legacyDir, `${diagramId}.drawio`), data, 'utf-8');
      }

      emitDiagramSync(sourceFile, { op: existed ? 'update' : 'create', baseHash: previousHash });
      
      return {
        success: true,
      };
    } catch (err) {
      console.error('Failed to write drawio source:', err);
      return {
        success: false,
        error: err.message,
      };
    }
  });

  /**
   * Write drawio image file
   */
  ipcMain.handle('drawio:write-image', async (event, { diagramId, imageData, documentPath }) => {
    try {
      const root = resolveWorkspaceRoot(documentPath);
      const drawioDir = path.join(root, 'media', 'draw.io');
      const imageFile = path.join(drawioDir, `${diagramId}.png`);
      const existed = fsSync.existsSync(imageFile);
      const previousBase64 = existed ? fsSync.readFileSync(imageFile).toString('base64') : null;
      const previousHash = previousBase64 && typeof hashContent === 'function' ? hashContent(previousBase64) : null;
      
      await mkdirRecursive(drawioDir);

      let buffer;
      if (typeof imageData === 'string') {
        const base64Data = imageData.replace(/^data:image\/png;base64,/, '');
        buffer = Buffer.from(base64Data, 'base64');
      } else {
        buffer = imageData;
      }
      
      await fs.writeFile(imageFile, buffer);

      // Also mirror to legacy notes-app dir if it exists
      const legacyDir = path.join(root, '.notes-app', 'drawio-diagrams');
      if (fsSync.existsSync(legacyDir)) {
        await fs.writeFile(path.join(legacyDir, `${diagramId}.png`), buffer);
      }

      emitDiagramSync(imageFile, { op: existed ? 'update' : 'create', baseHash: previousHash });
      
      return {
        success: true,
      };
    } catch (err) {
      console.error('Failed to write drawio image:', err);
      return {
        success: false,
        error: err.message,
      };
    }
  });

  /**
   * Read drawio image file as base64
   */
  ipcMain.handle('drawio:read-image', async (event, { diagramId, documentPath }) => {
    try {
      const imageFile = getDrawioImageFile(diagramId, documentPath);
      const imageData = await fs.readFile(imageFile);
      const base64 = imageData.toString('base64');
      
      return {
        success: true,
        data: `data:image/png;base64,${base64}`,
      };
    } catch (err) {
      if (isNotFoundError(err)) {
        return {
          success: false,
          notFound: true,
        };
      }
      console.error('Failed to read drawio image:', err);
      return {
        success: false,
        error: err.message,
      };
    }
  });

  /**
   * Delete drawio files
   */
  ipcMain.handle('drawio:delete', async (event, { diagramId, documentPath }) => {
    try {
      const root = resolveWorkspaceRoot(documentPath);
      const filesToDelete = [
        path.join(root, '.notes-app', 'drawio-diagrams', `${diagramId}.drawio`),
        path.join(root, '.notes-app', 'drawio-diagrams', `${diagramId}.png`),
        path.join(root, 'media', 'draw.io', `${diagramId}.drawio`),
        path.join(root, 'media', 'draw.io', `${diagramId}.png`),
      ];

      for (const file of filesToDelete) {
        if (fsSync.existsSync(file)) {
          const hash = (typeof hashContent === 'function')
            ? hashContent(fsSync.readFileSync(file).toString('base64'))
            : null;
          await fs.unlink(file);
          emitDiagramSync(file, { op: 'delete', baseHash: hash });
        }
      }
      
      return {
        success: true,
      };
    } catch (err) {
      console.error('Failed to delete drawio diagram:', err);
      return {
        success: false,
        error: err.message,
      };
    }
  });

  /**
   * Check if drawio diagram exists
   */
  ipcMain.handle('drawio:exists', async (event, { diagramId, documentPath }) => {
    try {
      const sourceFile = getDrawioSourceFile(diagramId, documentPath);
      try {
        await fs.access(sourceFile);
        return {
          exists: true,
        };
      } catch {
        return {
          exists: false,
        };
      }
    } catch (err) {
      console.error('Failed to check drawio existence:', err);
      return {
        exists: false,
        error: err.message,
      };
    }
  });
}

/**
 * Utility: Recursively create directory
 */
async function mkdirRecursive(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') {
      throw err;
    }
  }
}

/**
 * Utility: Recursively remove directory
 */
async function rmRecursive(dirPath) {
  try {
    const files = await fs.readdir(dirPath);
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = await fs.stat(filePath);
      
      if (stat.isDirectory()) {
        await rmRecursive(filePath);
      } else {
        await fs.unlink(filePath);
      }
    }
    
    await fs.rmdir(dirPath);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }
}

module.exports = {
  setupDiagramHandlers,
};
