/**
 * Markdown and text utility functions
 */

export function getLineStartOffset(text, targetLine) {
  const safeLine = Math.max(Number(targetLine) || 1, 1);
  const raw = String(text || "");
  let currentLine = 1;
  let offset = 0;
  while (currentLine < safeLine && offset < raw.length) {
    const nextNewline = raw.indexOf("\n", offset);
    if (nextNewline === -1) {
      break;
    }
    offset = nextNewline + 1;
    currentLine += 1;
  }
  return offset;
}

export function resolveTargetLine(content, line, searchText) {
  const safeLine = Math.max(Number(line) || 1, 1);
  const text = String(content || "");
  if (!text) return safeLine;

  const lines = text.split(/\r?\n/);

  if (safeLine <= lines.length) {
    const lineText = lines[safeLine - 1] || "";
    if (!searchText || lineText.includes(String(searchText).trim())) {
      return safeLine;
    }
  }

  if (searchText && String(searchText).trim()) {
    const cleanSearch = String(searchText).trim();
    const matchIndex = lines.findIndex((l) => l.includes(cleanSearch));
    if (matchIndex !== -1) {
      return matchIndex + 1;
    }
  }

  return Math.min(safeLine, lines.length);
}

export function replaceTextAtSelection(value, start, end, insertion) {
  const safeStart = Number.isInteger(start) ? start : value.length;
  const safeEnd = Number.isInteger(end) ? end : safeStart;
  return value.slice(0, safeStart) + insertion + value.slice(safeEnd);
}

export function insertTextAtCursor(value, onChange, text, textareaRef) {
  if (!textareaRef?.current) {
    console.error("Textarea ref not available");
    const textarea = document.querySelector(".markdown-textarea");
    if (!textarea) {
      console.error("Could not find textarea element");
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const next = replaceTextAtSelection(value, start, end, text);
    onChange(next);
    return;
  }

  const textarea = textareaRef.current;
  const previousScrollTop = Number(textarea.scrollTop) || 0;
  const previousScrollLeft = Number(textarea.scrollLeft) || 0;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const next = replaceTextAtSelection(value, start, end, text);
  onChange(next);

  // Set focus and selection after React updates
  setTimeout(() => {
    const el = textareaRef.current;
    if (el) {
      el.focus();
      if (typeof el.setSelectionRange === "function") {
        el.setSelectionRange(start + text.length, start + text.length);
      } else {
        el.selectionStart = start + text.length;
        el.selectionEnd = start + text.length;
      }
      el.scrollTop = previousScrollTop;
      el.scrollLeft = previousScrollLeft;
    }
  }, 0);
}

export function applySnippet(
  value,
  onChange,
  textareaRef,
  before,
  after = "",
  placeholder = ""
) {
  const textarea = textareaRef?.current;
  if (!textarea) {
    console.error("Textarea not available for snippet");
    return;
  }
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = value.slice(start, end) || placeholder;
  const next =
    value.slice(0, start) + before + selected + after + value.slice(end);
  onChange(next);
  requestAnimationFrame(() => {
    textarea.focus();
    const newStart = start + before.length;
    const newEnd = start + before.length + selected.length;
    if (typeof textarea.setSelectionRange === "function") {
      textarea.setSelectionRange(newStart, newEnd);
    } else {
      textarea.selectionStart = newStart;
      textarea.selectionEnd = newEnd;
    }
  });
}

export function canonicalPathKey(pathValue) {
  const normalized = String(pathValue || "").trim().replace(/\\/g, "/");
  if (!normalized) return "";
  const trimmed = normalized.replace(/\/+$/, "");
  return trimmed.toLowerCase();
}

function isAbsoluteFilePath(pathValue) {
  const norm = String(pathValue || "").replace(/\\/g, "/").trim();
  return /^[A-Za-z]:\//.test(norm) || norm.startsWith("/");
}

export function toRelativeDocPath(fromFilePath, toFilePath, workspacePath = "") {
  if (!fromFilePath || !toFilePath) return toFilePath || "";
  let fromNormalized = String(fromFilePath).replace(/\\/g, "/").trim();
  let toNormalized = String(toFilePath).replace(/\\/g, "/").trim();
  const wsNormalized = String(workspacePath || "").replace(/\\/g, "/").trim().replace(/\/+$/, "");

  // If toFilePath is a workspace-relative path (e.g. media/... or images/...)
  if (!isAbsoluteFilePath(toNormalized)) {
    if (wsNormalized && isAbsoluteFilePath(wsNormalized)) {
      toNormalized = `${wsNormalized}/${toNormalized.replace(/^\.\//, "")}`;
    } else if (isAbsoluteFilePath(fromNormalized)) {
      // If no workspacePath passed, check if fromFilePath contains workspace root or use directory
      const fromDir = fromNormalized.split("/").slice(0, -1).join("/");
      toNormalized = `${fromDir}/${toNormalized.replace(/^\.\//, "")}`;
    } else {
      // Both fromFilePath and toFilePath are relative paths
      const fromParts = fromNormalized.split("/").filter(Boolean);
      fromParts.pop(); // remove note filename
      const up = Array.from({ length: fromParts.length }, () => "..");
      const cleanTo = toNormalized.replace(/^\.\//, "");
      if (up.length === 0) {
        return cleanTo.startsWith(".") ? cleanTo : cleanTo;
      }
      return `${up.join("/")}/${cleanTo}`;
    }
  }

  if (canonicalPathKey(fromNormalized) === canonicalPathKey(toNormalized)) {
    return "";
  }

  const fromDrive = fromNormalized.match(/^([A-Za-z]:)\//)?.[1]?.toLowerCase() || "";
  const toDrive = toNormalized.match(/^([A-Za-z]:)\//)?.[1]?.toLowerCase() || "";
  if (fromDrive && toDrive && fromDrive !== toDrive) {
    return toNormalized;
  }

  const fromParts = fromNormalized.split(/[\\/]+/).filter(Boolean);
  const toParts = toNormalized.split(/[\\/]+/).filter(Boolean);

  fromParts.pop();
  while (fromParts.length && toParts.length && fromParts[0].toLowerCase() === toParts[0].toLowerCase()) {
    fromParts.shift();
    toParts.shift();
  }

  const up = Array.from({ length: fromParts.length }, () => "..");
  const relative = [...up, ...toParts].join("/");
  if (!relative) return "./";
  if (relative.startsWith(".")) return relative;
  if (/^(?:media|images|\.notes-app)\//i.test(relative)) {
    return relative;
  }
  return `./${relative}`;
}

export function normalizeImagePathForMarkdown(pathValue) {
  if (!pathValue) return pathValue;
  const trimmed = pathValue.trim();
  const unwrapped =
    trimmed.startsWith("<") && trimmed.endsWith(">")
      ? trimmed.slice(1, -1)
      : trimmed;

  let decoded = unwrapped;
  for (let i = 0; i < 5; i += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }

  // Keep full URI semantics for URLs while still handling spaces.
  if (/^(https?:|file:|blob:|data:|mailto:)/i.test(decoded)) {
    return encodeURI(decoded);
  }

  // For local paths, encode each segment to avoid broken markdown links for
  // spaces and reserved characters in file/folder names.
  const normalized = decoded.replace(/\\/g, "/");
  const windowsAbsoluteMatch = normalized.match(/^([A-Za-z]:)\/(.*)$/);
  if (windowsAbsoluteMatch) {
    const drive = windowsAbsoluteMatch[1];
    const rest = windowsAbsoluteMatch[2]
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    return `${drive}/${rest}`;
  }

  const leading = normalized.startsWith("../")
    ? "../"
    : normalized.startsWith("./")
      ? "./"
      : normalized.startsWith("/")
        ? "/"
        : "";
  const body = leading ? normalized.slice(leading.length) : normalized;
  const encodedBody = body
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${leading}${encodedBody}`;
}

export function createImageMarkdown(altText, imagePath) {
  return `![${altText}](${normalizeImagePathForMarkdown(imagePath)})`;
}

export function createMediaMarkdown(labelText, mediaPath) {
  const normalizedPath = normalizeImagePathForMarkdown(mediaPath);
  const fallbackLabel = (labelText || "media").trim();
  const extension = String(normalizedPath || "")
    .split(/[?#]/)[0]
    .split(".")
    .pop()
    ?.toLowerCase();

  const isImage = new Set(["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico"]).has(extension);
  if (isImage) {
    return `![${fallbackLabel}](${normalizedPath})`;
  }

  return `[${fallbackLabel}](${normalizedPath})`;
}

export function extractNoteSnippet(text, maxLength = 140) {
  if (!text || typeof text !== "string") return "";
  const cleanLines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      if (line.startsWith("![")) return false;
      if (line.startsWith("```")) return false;
      return true;
    });

  if (!cleanLines.length) return "";
  const raw = cleanLines
    .slice(0, 3)
    .join(" ")
    .replace(/^#+\s*/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (raw.length <= maxLength) return raw;
  return raw.slice(0, maxLength).trim() + "…";
}
