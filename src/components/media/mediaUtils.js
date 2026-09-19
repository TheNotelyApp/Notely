/**
 * Utility functions for media and document previewers
 */

export function dataUrlToUint8Array(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") return null;
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex === -1) return null;
  try {
    const binary = atob(dataUrl.slice(commaIndex + 1));
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

export function dataUrlToArrayBuffer(dataUrl) {
  const bytes = dataUrlToUint8Array(dataUrl);
  return bytes ? bytes.buffer : null;
}

export function getDocumentKind(extension) {
  const ext = String(extension || "").toLowerCase();
  if (["doc", "docx", "odt", "rtf"].includes(ext)) return { icon: "📝", family: "Word Document", type: "word" };
  if (["xls", "xlsx", "csv", "tsv", "ods"].includes(ext)) return { icon: "📊", family: "Spreadsheet", type: "spreadsheet" };
  if (["ppt", "pptx", "odp"].includes(ext)) return { icon: "📽️", family: "Presentation", type: "presentation" };
  if (["txt", "md", "markdown", "log"].includes(ext)) return { icon: "📄", family: "Text File", type: "text" };
  if (["json", "xml", "yaml", "yml"].includes(ext)) return { icon: "🧩", family: "Data File", type: "text" };
  if (["zip", "7z", "rar"].includes(ext)) return { icon: "🗜️", family: "Archive", type: "archive" };
  if (["pdf"].includes(ext)) return { icon: "📑", family: "PDF Document", type: "pdf" };
  if (["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "ico"].includes(ext)) return { icon: "🖼️", family: "Image", type: "image" };
  if (["mp4", "webm", "ogg", "mov", "mkv"].includes(ext)) return { icon: "🎬", family: "Video", type: "video" };
  if (["mp3", "wav", "m4a", "flac", "aac"].includes(ext)) return { icon: "🎵", family: "Audio", type: "audio" };
  return { icon: "📃", family: "Document", type: "document" };
}
