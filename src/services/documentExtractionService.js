/**
 * documentExtractionService.js
 * Renderer service wrapper for document extraction & cached text lookup.
 */

export async function getAllExtractionRecords() {
  if (window?.notesApi?.documentExtraction?.getAll) {
    try {
      return await window.notesApi.documentExtraction.getAll();
    } catch (err) {
      console.error('[documentExtractionService] getAll failed:', err);
    }
  }
  return [];
}

export async function getExtractionRecord(relativePath) {
  if (window?.notesApi?.documentExtraction?.getRecord) {
    try {
      return await window.notesApi.documentExtraction.getRecord(relativePath);
    } catch (err) {
      console.error('[documentExtractionService] getRecord failed:', err);
    }
  }
  return null;
}

export async function getExtractedContent(relativePath) {
  if (window?.notesApi?.documentExtraction?.getContent) {
    try {
      return await window.notesApi.documentExtraction.getContent(relativePath);
    } catch (err) {
      console.error('[documentExtractionService] getContent failed:', err);
    }
  }
  return '';
}

export async function forceReextract(relativePath) {
  if (window?.notesApi?.documentExtraction?.forceReextract) {
    try {
      return await window.notesApi.documentExtraction.forceReextract(relativePath);
    } catch (err) {
      console.error('[documentExtractionService] forceReextract failed:', err);
    }
  }
  return null;
}

export async function scanWorkspaceDocuments() {
  if (window?.notesApi?.documentExtraction?.scanWorkspace) {
    try {
      return await window.notesApi.documentExtraction.scanWorkspace();
    } catch (err) {
      console.error('[documentExtractionService] scanWorkspace failed:', err);
    }
  }
  return [];
}

export function subscribeExtractionStatus(callback) {
  if (window?.notesApi?.documentExtraction?.onStatusChange) {
    return window.notesApi.documentExtraction.onStatusChange(callback);
  }
  return () => {};
}
