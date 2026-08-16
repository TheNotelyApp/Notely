import { getNotesApi } from "./base";

export async function captureCurrentDisplay() {
  const api = getNotesApi();
  if (typeof api.captureCurrentDisplay !== "function") {
    throw new Error("Area snipping is unavailable. Please restart the app.");
  }
  return api.captureCurrentDisplay();
}

export async function saveImage(fileName, base64Data, basePath, options = {}) {
  const api = getNotesApi();
  return api.saveImage({
    fileName,
    base64Data,
    basePath,
    storageTarget: options.storageTarget,
  });
}

export async function listImages(basePath, options = {}) {
  const api = getNotesApi();
  return api.listImages({
    basePath,
    includeAnnotations: Boolean(options.includeAnnotations),
    includeOriginalStatus: Boolean(options.includeOriginalStatus),
  });
}

export async function getImageUsage(basePath) {
  const api = getNotesApi();
  if (typeof api.getImageUsage !== "function") {
    throw new Error("Image usage action unavailable. Please restart the app.");
  }
  return api.getImageUsage({ basePath });
}

export async function readImage(basePath, assetPath, options = {}) {
  const api = getNotesApi();
  return api.readImage({ basePath, assetPath, thumbnail: Boolean(options.thumbnail) });
}

export async function openMediaInDefaultApp(basePath, assetPath) {
  const api = getNotesApi();
  if (typeof api.openMediaInDefaultApp !== "function") {
    throw new Error("Open media action unavailable. Please restart the app.");
  }
  return api.openMediaInDefaultApp({ basePath, assetPath });
}

export async function getImageAnnotation(basePath, assetPath) {
  const api = getNotesApi();
  if (typeof api.getImageAnnotation !== "function") return null;
  return api.getImageAnnotation({ basePath, assetPath });
}

export async function setImageAnnotation(basePath, assetPath, annotation) {
  const api = getNotesApi();
  if (typeof api.setImageAnnotation !== "function") {
    throw new Error("Image annotation action unavailable. Please restart the app.");
  }
  return api.setImageAnnotation({ basePath, assetPath, annotation });
}

export async function getImageOriginalStatus(basePath, assetPath) {
  const api = getNotesApi();
  if (typeof api.getImageOriginalStatus !== "function") {
    return { hasOriginal: false };
  }
  return api.getImageOriginalStatus({ basePath, assetPath });
}

export async function restoreImageOriginal(basePath, assetPath) {
  const api = getNotesApi();
  if (typeof api.restoreImageOriginal !== "function") {
    throw new Error("Image restore action unavailable. Please restart the app.");
  }
  return api.restoreImageOriginal({ basePath, assetPath });
}

export async function deleteImage(basePath, assetPath, options = {}) {
  const api = getNotesApi();
  return api.deleteImage({
    basePath,
    assetPath,
    removeAllReferences: Boolean(options.removeAllReferences),
  });
}

export async function replaceImage(basePath, assetPath, base64Data) {
  const api = getNotesApi();
  return api.replaceImage({ basePath, assetPath, base64Data });
}

export async function renameImage(basePath, assetPath, nextFileName) {
  const api = getNotesApi();
  if (typeof api.renameImage !== "function") {
    throw new Error("Image rename action unavailable. Please restart the app.");
  }
  return api.renameImage({ basePath, assetPath, nextFileName });
}
