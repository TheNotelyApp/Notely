/**
 * Utility functions for extracting and managing media (images, videos, audio, PDFs, etc.)
 */

import { MEDIA_TYPES } from "./mediaTypeUtils";

export function extractImagesFromMarkdown(content) {
  if (!content) return [];

  const regex = /!\[([^\]]*)\]\((<[^>]+>|[^)]+)\)/g;
  const images = [];
  let match;

  while ((match = regex.exec(content))) {
    const rawPath = (match[2] || "").trim();
    const path = rawPath.startsWith("<") && rawPath.endsWith(">") ? rawPath.slice(1, -1) : rawPath;
    images.push({
      altText: match[1] || "Image",
      path,
      id: path,
    });
  }

  return images;
}

export function extractAllMediaFromMarkdown(content) {
  if (!content) return [];

  // Match both image syntax and regular markdown links:
  // ![alt](path) and [label](path)
  const regex = /(!)?\[([^\]]*)\]\((<[^>]+>|[^)]+)\)/g;
  const mediaItems = [];
  const seen = new Set();
  let match;

  while ((match = regex.exec(content))) {
    const isImageSyntax = Boolean(match[1]);
    const rawPath = (match[3] || "").trim();
    const path = rawPath.startsWith("<") && rawPath.endsWith(">") ? rawPath.slice(1, -1) : rawPath;
    if (!path) continue;
    if (/^(https?:|data:|blob:|mailto:|#)/i.test(path)) continue;

    // Detect media type from path
    const ext = path.split(".").pop()?.toLowerCase();
    const mediaType = getMediaTypeFromExtension(ext) || MEDIA_TYPES.DOCUMENT;
    const id = path;

    if (seen.has(id)) continue;
    seen.add(id);

    mediaItems.push({
      altText: match[2] || path.split("/").pop() || (isImageSyntax ? "Image" : "Media"),
      path,
      id,
      type: mediaType,
      extension: ext,
    });
  }

  return mediaItems;
}

export function getMediaTypeFromExtension(extension) {
  if (!extension) return null;

  const ext = extension.toLowerCase();

  // Images
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico"].includes(ext)) {
    return MEDIA_TYPES.IMAGE;
  }
  // Videos
  if (["mp4", "webm", "avi", "mov", "mkv", "flv", "wmv", "m4v"].includes(ext)) {
    return MEDIA_TYPES.VIDEO;
  }
  // Audio
  if (["mp3", "wav", "ogg", "m4a", "aac", "flac", "wma"].includes(ext)) {
    return MEDIA_TYPES.AUDIO;
  }
  // PDFs
  if (["pdf"].includes(ext)) {
    return MEDIA_TYPES.PDF;
  }
  // Documents
  if ([
    "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "rtf",
    "odt", "ods", "odp", "csv", "tsv", "md", "markdown", "json",
    "xml", "yaml", "yml", "log", "zip", "7z", "rar",
  ].includes(ext)) {
    return MEDIA_TYPES.DOCUMENT;
  }

  return null;
}

export function isLocalImagePath(path) {
  return path.startsWith("./images/") || path.startsWith(".\\images\\");
}

export function isLocalMediaPath(path) {
  return (
    path.startsWith("./") ||
    path.startsWith(".\\") ||
    (!path.startsWith("http") && !path.startsWith("data:") && !path.startsWith("blob:"))
  );
}

export function getImageFileName(path) {
  return path.split(/[\\/]/).pop() || "image";
}

export function getMediaFileName(path) {
  return path.split(/[\\/]/).pop() || "media";
}

