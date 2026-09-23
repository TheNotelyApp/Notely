/**
 * Electron service for Wireframe diagram file operations
 * Handles reading, writing, and managing wireframe diagram files.
 * Follows the same pattern as drawioService.js.
 */

function invokeWireframe(method, payload) {
  const apiMethod = window.notesApi?.[method];
  if (typeof apiMethod === 'function') {
    return apiMethod(payload);
  }
  throw new Error(`Wireframe API method unavailable: ${method}`);
}

/**
 * Read wireframe source file (.wireframe.json)
 */
export async function readWireframeSource(diagramId, documentPath) {
  try {
    const response = await invokeWireframe('wireframeReadSource', { diagramId, documentPath });
    if (response && response.success) {
      return response.data;
    }
    return null;
  } catch (err) {
    console.error('Failed to read wireframe source:', err);
    return null;
  }
}

/**
 * Write wireframe source file (.wireframe.json)
 */
export async function writeWireframeSource(diagramId, data, documentPath) {
  try {
    const response = await invokeWireframe('wireframeWriteSource', { diagramId, data, documentPath });
    return response?.success ?? false;
  } catch (err) {
    console.error('Failed to write wireframe source:', err);
    return false;
  }
}

/**
 * Write wireframe image file (.png)
 */
export async function writeWireframeImage(diagramId, imageData, documentPath) {
  try {
    const response = await invokeWireframe('wireframeWriteImage', { diagramId, imageData, documentPath });
    return response?.success ?? false;
  } catch (err) {
    console.error('Failed to write wireframe image:', err);
    return false;
  }
}

/**
 * Read wireframe image file (.png) as a data URL
 */
export async function readWireframeImage(diagramId, documentPath) {
  try {
    const response = await invokeWireframe('wireframeReadImage', { diagramId, documentPath });
    if (response?.success && response?.data) {
      return response.data;
    }
    return null;
  } catch (err) {
    console.error('Failed to read wireframe image:', err);
    return null;
  }
}

/**
 * Delete wireframe diagram files
 */
export async function deleteWireframe(diagramId, documentPath) {
  try {
    const response = await invokeWireframe('wireframeDelete', { diagramId, documentPath });
    return response?.success ?? false;
  } catch (err) {
    console.error('Failed to delete wireframe:', err);
    return false;
  }
}

/**
 * Check if wireframe diagram exists
 */
export async function wireframeExists(diagramId, documentPath) {
  try {
    const response = await invokeWireframe('wireframeExists', { diagramId, documentPath });
    return response?.exists ?? false;
  } catch (err) {
    console.error('Failed to check wireframe existence:', err);
    return false;
  }
}
