/**
 * Electron Main Process IPC Handlers for Diagram File Operations
 * 
 * Usage in main.cjs:
 * const { setupDiagramHandlers } = require('./electron/diagram-handlers.cjs');
 * setupDiagramHandlers(ipcMain);
 */

const fs = require('fs').promises;
const path = require('path');
const fsMkdir = require('fs').mkdir;

function isNotFoundError(err) {
  return Boolean(err && err.code === 'ENOENT');
}

/**
 * Setup diagram IPC handlers
 * @param {Object} ipcMain - Electron's ipcMain
 * @param {string} appDataPath - Application data directory
 */
function setupDiagramHandlers(ipcMain, appDataPath) {
  /**
   * Read diagram source file
   */
  ipcMain.handle('diagram:read-source', async (event, { documentPath, diagramId }) => {
    try {
      const sourceFile = path.join(documentPath, 'excali-diagrams', diagramId, 'diagram.excalidraw');
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
      const diagramDir = path.join(documentPath, 'excali-diagrams', diagramId);
      
      // Create directory if it doesn't exist
      await mkdirRecursive(diagramDir);
      
      const sourceFile = path.join(diagramDir, 'diagram.excalidraw');
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
      const diagramDir = path.join(documentPath, 'excali-diagrams', diagramId);
      
      // Create directory if it doesn't exist
      await mkdirRecursive(diagramDir);
      
      const imageFile = path.join(diagramDir, 'diagram.png');
      
      // Handle both base64 strings and buffers
      let buffer;
      if (typeof imageData === 'string') {
        // Remove data URL prefix if present
        const base64Data = imageData.replace(/^data:image\/png;base64,/, '');
        buffer = Buffer.from(base64Data, 'base64');
      } else {
        buffer = imageData;
      }
      
      await fs.writeFile(imageFile, buffer);
      
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
      const diagramDir = path.join(documentPath, 'excali-diagrams', diagramId);
      await rmRecursive(diagramDir);
      
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
      const sourceFile = path.join(documentPath, 'excali-diagrams', diagramId, 'diagram.excalidraw');
      
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
      const imageFile = path.join(documentPath, 'excali-diagrams', diagramId, 'diagram.png');
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
