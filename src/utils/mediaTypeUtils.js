/**
 * Media type detection and validation utilities
 * Supports images, videos, audio, PDFs, and documents
 */

export const MEDIA_TYPES = {
  IMAGE: "image",
  VIDEO: "video",
  AUDIO: "audio",
  PDF: "pdf",
  DOCUMENT: "document",
};

export const SUPPORTED_EXTENSIONS = {
  // Images
  image: {
    extensions: ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico"],
    mimeTypes: ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml", "image/bmp", "image/x-icon"],
  },
  // Videos
  video: {
    extensions: ["mp4", "webm", "avi", "mov", "mkv", "flv", "wmv", "m4v"],
    mimeTypes: ["video/mp4", "video/webm", "video/x-msvideo", "video/quicktime", "video/x-matroska", "video/x-flv", "video/x-ms-wmv", "video/x-m4v"],
  },
  // Audio
  audio: {
    extensions: ["mp3", "wav", "ogg", "m4a", "aac", "flac", "wma"],
    mimeTypes: ["audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "audio/aac", "audio/flac", "audio/x-ms-wma"],
  },
  // PDFs
  pdf: {
    extensions: ["pdf"],
    mimeTypes: ["application/pdf"],
  },
  // Documents
  document: {
    extensions: ["doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "rtf"],
    mimeTypes: [
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain",
      "application/rtf",
    ],
  },
};

export function getMediaType(file) {
  if (!file) return null;

  const mimeType = file.type.toLowerCase();
  const extension = file.name.split(".").pop()?.toLowerCase();

  // Check MIME type first
  for (const [type, config] of Object.entries(SUPPORTED_EXTENSIONS)) {
    if (config.mimeTypes.includes(mimeType)) {
      return type;
    }
  }

  // Fallback to extension check
  for (const [type, config] of Object.entries(SUPPORTED_EXTENSIONS)) {
    if (config.extensions.includes(extension)) {
      return type;
    }
  }

  return null;
}

export function isImageFile(file) {
  return getMediaType(file) === MEDIA_TYPES.IMAGE;
}

export function isVideoFile(file) {
  return getMediaType(file) === MEDIA_TYPES.VIDEO;
}

export function isAudioFile(file) {
  return getMediaType(file) === MEDIA_TYPES.AUDIO;
}

export function isPdfFile(file) {
  return getMediaType(file) === MEDIA_TYPES.PDF;
}

export function isDocumentFile(file) {
  return getMediaType(file) === MEDIA_TYPES.DOCUMENT;
}

export function isPreviewableMedia(file) {
  const type = getMediaType(file);
  // Images, videos, audio, and PDFs are previewable
  return [MEDIA_TYPES.IMAGE, MEDIA_TYPES.VIDEO, MEDIA_TYPES.AUDIO, MEDIA_TYPES.PDF].includes(type);
}

export function isEmbeddableMedia(file) {
  const type = getMediaType(file);
  // All supported types except some documents
  return type !== null;
}

export async function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function getMediaFileName(fileName) {
  return fileName.replace(/\.[^.]+$/, "");
}

export function getMediaAltText(fileName) {
  return getMediaFileName(fileName);
}

export function validateMediaFile(file) {
  if (!file) {
    throw new Error("No file selected");
  }
  if (!isEmbeddableMedia(file)) {
    throw new Error("File type not supported. Supported: images, videos, audio, PDFs, and documents.");
  }
  return true;
}

export function getMediaIcon(mediaType) {
  const icons = {
    [MEDIA_TYPES.IMAGE]: "🖼️",
    [MEDIA_TYPES.VIDEO]: "🎬",
    [MEDIA_TYPES.AUDIO]: "🎵",
    [MEDIA_TYPES.PDF]: "📄",
    [MEDIA_TYPES.DOCUMENT]: "📃",
  };
  return icons[mediaType] || "📎";
}
