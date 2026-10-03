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
  } = deps;

  function resolveWorkspaceRoot(documentPath) {
    const notesRoot = getNotesRoot();
    if (notesRoot && fsSync.existsSync(notesRoot)) {
      return notesRoot;
    }
    if (documentPath) {
      let curr = path.resolve(documentPath);
      try {
        if (fsSync.existsSync(curr) && fsSync.statSync(curr).isFile()) {
          curr = path.dirname(curr);
        } else if (curr.endsWith('.md') || curr.endsWith('.markdown')) {
          curr = path.dirname(curr);
        }
      } catch {
        // fallback if unreadable
      }
      let check = curr;
      while (check && check !== path.dirname(check)) {
        if (fsSync.existsSync(path.join(check, '.notes-app'))) {
          return check;
        }
        check = path.dirname(check);
      }
      return curr;
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
      // Create directory if it doesn't exist
      await mkdirRecursive(diagramDir);

      await fs.writeFile(sourceFile, data, 'utf-8');
      
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
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      await mkdirRecursive(primaryDir);
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
      for (const diagramDir of diagramDirs) {
        await rmRecursive(diagramDir);
      }
      
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
      await mkdirRecursive(drawioDir);
      await fs.writeFile(sourceFile, data, 'utf-8');

      // Also mirror to legacy notes-app dir if it already exists
      const legacyDir = path.join(root, '.notes-app', 'drawio-diagrams');
      if (fsSync.existsSync(legacyDir)) {
        await fs.writeFile(path.join(legacyDir, `${diagramId}.drawio`), data, 'utf-8');
      }
      
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
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      await mkdirRecursive(drawioDir);
      await fs.writeFile(imageFile, buffer);

      // Also mirror to legacy notes-app dir if it exists
      const legacyDir = path.join(root, '.notes-app', 'drawio-diagrams');
      if (fsSync.existsSync(legacyDir)) {
        await fs.writeFile(path.join(legacyDir, `${diagramId}.png`), buffer);
      }
      
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
          await fs.unlink(file);
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

  // ── Wireframe handlers ────────────────────────────────────────────────────

  function getWireframeSourceFile(diagramId, documentPath) {
    const root = resolveWorkspaceRoot(documentPath);
    const pluralFile = path.join(root, 'media', 'wireframes', `${diagramId}.wireframe.json`);
    if (fsSync.existsSync(pluralFile)) return pluralFile;
    const singularFile = path.join(root, 'media', 'wireframe', `${diagramId}.wireframe.json`);
    if (fsSync.existsSync(singularFile)) return singularFile;
    return pluralFile;
  }

  function getWireframeImageFile(diagramId, documentPath) {
    const root = resolveWorkspaceRoot(documentPath);
    const pluralFile = path.join(root, 'media', 'wireframes', `${diagramId}.png`);
    if (fsSync.existsSync(pluralFile)) return pluralFile;
    const singularFile = path.join(root, 'media', 'wireframe', `${diagramId}.png`);
    if (fsSync.existsSync(singularFile)) return singularFile;
    return pluralFile;
  }

  /**
   * Read wireframe source file
   */
  ipcMain.handle('wireframe:read-source', async (event, { diagramId, documentPath }) => {
    try {
      const sourceFile = getWireframeSourceFile(diagramId, documentPath);
      const data = await fs.readFile(sourceFile, 'utf-8');
      return { success: true, data };
    } catch (err) {
      if (isNotFoundError(err)) {
        return { success: false, notFound: true };
      }
      console.error('Failed to read wireframe source:', err);
      return { success: false, error: err.message };
    }
  });

  /**
   * Write wireframe source file
   */
  ipcMain.handle('wireframe:write-source', async (event, { diagramId, data, documentPath }) => {
    try {
      const root = resolveWorkspaceRoot(documentPath);
      const wireframeDir = path.join(root, 'media', 'wireframes');
      const sourceFile = path.join(wireframeDir, `${diagramId}.wireframe.json`);
      await mkdirRecursive(wireframeDir);
      await fs.writeFile(sourceFile, data, 'utf-8');

      return { success: true };
    } catch (err) {
      console.error('Failed to write wireframe source:', err);
      return { success: false, error: err.message };
    }
  });

  /**
   * Write wireframe image file
   */
  ipcMain.handle('wireframe:write-image', async (event, { diagramId, imageData, documentPath }) => {
    try {
      const root = resolveWorkspaceRoot(documentPath);
      const wireframeDir = path.join(root, 'media', 'wireframes');
      const imageFile = path.join(wireframeDir, `${diagramId}.png`);
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      await mkdirRecursive(wireframeDir);
      await fs.writeFile(imageFile, buffer);

      return { success: true };
    } catch (err) {
      console.error('Failed to write wireframe image:', err);
      return { success: false, error: err.message };
    }
  });

  /**
   * Read wireframe image file as base64
   */
  ipcMain.handle('wireframe:read-image', async (event, { diagramId, documentPath }) => {
    try {
      const imageFile = getWireframeImageFile(diagramId, documentPath);
      const imageData = await fs.readFile(imageFile);
      const base64 = imageData.toString('base64');
      return { success: true, data: `data:image/png;base64,${base64}` };
    } catch (err) {
      if (isNotFoundError(err)) {
        return { success: false, notFound: true };
      }
      console.error('Failed to read wireframe image:', err);
      return { success: false, error: err.message };
    }
  });

  /**
   * Delete wireframe files
   */
  ipcMain.handle('wireframe:delete', async (event, { diagramId, documentPath }) => {
    try {
      const root = resolveWorkspaceRoot(documentPath);
      const filesToDelete = [
        path.join(root, 'media', 'wireframes', `${diagramId}.wireframe.json`),
        path.join(root, 'media', 'wireframes', `${diagramId}.png`),
        path.join(root, 'media', 'wireframe', `${diagramId}.wireframe.json`),
        path.join(root, 'media', 'wireframe', `${diagramId}.png`),
      ];

      for (const file of filesToDelete) {
        if (fsSync.existsSync(file)) {
          await fs.unlink(file);
        }
      }

      return { success: true };
    } catch (err) {
      console.error('Failed to delete wireframe diagram:', err);
      return { success: false, error: err.message };
    }
  });

  /**
   * Check if wireframe diagram exists
   */
  ipcMain.handle('wireframe:exists', async (event, { diagramId, documentPath }) => {
    try {
      const sourceFile = getWireframeSourceFile(diagramId, documentPath);
      try {
        await fs.access(sourceFile);
        return { exists: true };
      } catch {
        return { exists: false };
      }
    } catch (err) {
      console.error('Failed to check wireframe existence:', err);
      return { exists: false, error: err.message };
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
