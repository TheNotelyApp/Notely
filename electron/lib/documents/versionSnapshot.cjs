function createVersionHistoryHelpers(deps) {
  const {
    fs,
    path,
    slugify,
    nowStamp,
    ensureDir,
    filePathWithin,
    getVersionsRoot,
    getMetadataStore,
    versionHistoryLimit = 50,
  } = deps;

  function createVersionSnapshot(filePath, content, tag) {
    const versionsRoot = getVersionsRoot();
    const slug = slugify(path.basename(filePath));
    const versionDir = path.join(versionsRoot, slug);
    ensureDir(versionDir);
    const stamp = nowStamp();
    const versionPath = path.join(versionDir, `${stamp}-${slugify(tag || "snapshot")}.md`);
    fs.writeFileSync(versionPath, content, "utf8");
    return versionPath;
  }

  function isFileBackedVersionPath(versionPath) {
    const versionsRoot = getVersionsRoot();
    if (!versionPath || typeof versionPath !== "string") return false;
    try {
      const resolvedVersionPath = path.resolve(versionPath);
      return filePathWithin(versionsRoot, resolvedVersionPath)
        && path.extname(resolvedVersionPath).toLowerCase() === ".md";
    } catch {
      return false;
    }
  }

  function pruneVersionHistory(filePath, limit = versionHistoryLimit) {
    const metadataStore = getMetadataStore();
    if (!metadataStore || !filePath) return;

    const safeLimit = Math.max(1, Number(limit) || versionHistoryLimit);
    const fileBackedEntries = metadataStore.getHistory(filePath)
      .filter((entry) => isFileBackedVersionPath(entry.versionPath));

    for (const entry of fileBackedEntries.slice(safeLimit)) {
      const resolvedVersionPath = path.resolve(entry.versionPath);
      try {
        if (fs.existsSync(resolvedVersionPath)) {
          fs.unlinkSync(resolvedVersionPath);
        }
      } catch {
        // History cleanup is best-effort; stale metadata is removed below.
      }
      metadataStore.deleteHistoryVersion(filePath, entry.versionPath);
    }
  }

  function hasMatchingFileBackedVersion(filePath, fileHash) {
    const metadataStore = getMetadataStore();
    if (!metadataStore || !filePath || !fileHash) return false;
    return metadataStore.getHistory(filePath).some((entry) => {
      if (entry.fileHash !== fileHash || !isFileBackedVersionPath(entry.versionPath)) return false;
      try {
        return fs.existsSync(path.resolve(entry.versionPath));
      } catch {
        return false;
      }
    });
  }

  return {
    createVersionSnapshot,
    pruneVersionHistory,
    hasMatchingFileBackedVersion,
  };
}

module.exports = { createVersionHistoryHelpers };
