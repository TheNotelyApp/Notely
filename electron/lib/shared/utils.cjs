const path = require("node:path");
const crypto = require("node:crypto");

function slugify(value) {
  return value
    .replace(/\.md$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "document";
}

function nowStamp() {
  const date = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("-") + "_" + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join("-");
}

function randomId(bytes = 10) {
  return crypto.randomBytes(bytes).toString("hex");
}

function hashContent(content) {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

function filePathWithin(rootDir, targetPath) {
  if (!rootDir || !targetPath) {
    return false;
  }

  const resolvedRoot = path.resolve(rootDir);
  const resolvedTarget = path.resolve(targetPath);

  // Same path is considered "within".
  if (resolvedRoot === resolvedTarget) {
    return true;
  }

  // Use path.relative so confinement is evaluated on path segment boundaries.
  // A sibling like `<root>-evil` produces a relative path starting with `..`,
  // which a naive startsWith() prefix check would incorrectly accept.
  const relative = path.relative(resolvedRoot, resolvedTarget);
  if (!relative) {
    return true;
  }

  return !relative.startsWith("..") && !path.isAbsolute(relative);
}

function normalizeToPosix(relPath) {
  return relPath.split(path.sep).join("/");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function encodePathForUrl(relPath) {
  return normalizeToPosix(relPath)
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function decodeUrlPath(pathname, prefix) {
  const sliced = pathname.slice(prefix.length).replace(/^\/+/, "");
  return safeDecode(sliced);
}

function contentTypeForFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".json": "application/json; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".pdf": "application/pdf"
  };
  return map[ext] || "application/octet-stream";
}

module.exports = {
  slugify,
  nowStamp,
  randomId,
  hashContent,
  filePathWithin,
  normalizeToPosix,
  escapeHtml,
  safeDecode,
  encodePathForUrl,
  decodeUrlPath,
  contentTypeForFile
};
