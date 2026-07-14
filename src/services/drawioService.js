/**
 * Electron service for Draw.io diagram file operations
 * Handles reading, writing, and managing drawio diagram files
 */

function invokeDrawio(method, payload) {
  const apiMethod = window.notesApi?.[method];
  if (typeof apiMethod === 'function') {
    return apiMethod(payload);
  }
  throw new Error(`Drawio API method unavailable: ${method}`);
}

/**
 * Read drawio source file (.xml)
 */
export async function readDrawioSource(diagramId) {
  try {
    const response = await invokeDrawio('drawioReadSource', { diagramId });
    if (response && response.success) {
      return response.data;
    }
    return null;
  } catch (err) {
    console.error('Failed to read drawio source:', err);
    return null;
  }
}

/**
 * Write drawio source file (.xml)
 */
export async function writeDrawioSource(diagramId, data) {
  try {
    const response = await invokeDrawio('drawioWriteSource', { diagramId, data });
    return response?.success ?? false;
  } catch (err) {
    console.error('Failed to write drawio source:', err);
    return false;
  }
}

/**
 * Write drawio image file (.png)
 */
export async function writeDrawioImage(diagramId, imageData) {
  try {
    const response = await invokeDrawio('drawioWriteImage', { diagramId, imageData });
    return response?.success ?? false;
  } catch (err) {
    console.error('Failed to write drawio image:', err);
    return false;
  }
}

/**
 * Read drawio image file (.png) as a data URL
 */
export async function readDrawioImage(diagramId) {
  try {
    const response = await invokeDrawio('drawioReadImage', { diagramId });
    if (response?.success && response?.data) {
      return response.data;
    }
    return null;
  } catch (err) {
    console.error('Failed to read drawio image:', err);
    return null;
  }
}

/**
 * Delete drawio diagram
 */
export async function deleteDrawio(diagramId) {
  try {
    const response = await invokeDrawio('drawioDelete', { diagramId });
    return response?.success ?? false;
  } catch (err) {
    console.error('Failed to delete drawio:', err);
    return false;
  }
}

/**
 * Check if drawio diagram exists
 */
export async function drawioExists(diagramId) {
  try {
    const response = await invokeDrawio('drawioExists', { diagramId });
    return response?.exists ?? false;
  } catch (err) {
    console.error('Failed to check drawio existence:', err);
    return false;
  }
}
