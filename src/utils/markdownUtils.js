/**
 * Markdown and text utility functions
 */

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
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = start + text.length;
      textareaRef.current.selectionEnd = start + text.length;
      textareaRef.current.scrollTop = previousScrollTop;
      textareaRef.current.scrollLeft = previousScrollLeft;
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
    textarea.selectionStart = start + before.length;
    textarea.selectionEnd = start + before.length + selected.length;
  });
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
