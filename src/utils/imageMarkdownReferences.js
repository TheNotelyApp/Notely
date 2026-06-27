export function normalizeImageAssetKey(value) {
  let next = String(value || "").trim().replace(/\\/g, "/");
  for (let index = 0; index < 5; index += 1) {
    try {
      const decoded = decodeURIComponent(next);
      if (decoded === next) break;
      next = decoded;
    } catch {
      break;
    }
  }
  return next.replace(/^\.\//, "").toLowerCase();
}

export function removeImageReferenceFromMarkdown(source, assetPath) {
  const target = normalizeImageAssetKey(assetPath);
  if (!target) return source;

  return String(source || "").replace(/!\[[^\]]*\]\((<[^>]+>|[^)]+)\)/g, (match, rawPath) => {
    const unwrapped = String(rawPath || "").trim();
    const current = unwrapped.startsWith("<") && unwrapped.endsWith(">")
      ? unwrapped.slice(1, -1)
      : unwrapped;
    return normalizeImageAssetKey(current) === target ? "" : match;
  });
}