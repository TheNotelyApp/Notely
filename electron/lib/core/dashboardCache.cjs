const DASHBOARD_CACHE_FILE = "dashboard-cache.json";
const DASHBOARD_CACHE_LIMIT = 50;

function createDashboardCache(deps) {
  const {
    fs,
    path,
    ensureDir,
    getNotesRoot,
    getActiveProject,
    filePathWithin,
    listWorkspaceFileEntries,
  } = deps;

  function createDefaultState() {
    return {
      version: 1,
      continueWriting: [],
      recentNotes: [],
    };
  }

  function getWorkspaceRoot() {
    return path.resolve(getActiveProject()?.rootPath || getNotesRoot());
  }

  function getCachePath(workspaceRoot = getWorkspaceRoot()) {
    return path.join(workspaceRoot, ".notes-app", DASHBOARD_CACHE_FILE);
  }

  function normalizeEntry(workspaceRoot, entry) {
    const filePath = String(entry?.filePath || "").trim();
    if (!filePath) return null;

    const resolvedFilePath = path.resolve(filePath);
    if (!filePathWithin(workspaceRoot, resolvedFilePath)) {
      return null;
    }

    return {
      entryType: "file",
      filePath: resolvedFilePath,
      title: String(entry?.title || path.basename(resolvedFilePath, path.extname(resolvedFilePath)) || "Untitled").trim() || "Untitled",
      updatedAt: String(entry?.updatedAt || "").trim() || new Date().toISOString(),
      activityAt: String(entry?.activityAt || entry?.updatedAt || new Date().toISOString()).trim(),
      lastOpenedAt: entry?.lastOpenedAt ? String(entry.lastOpenedAt).trim() : "",
      lastSavedAt: entry?.lastSavedAt ? String(entry.lastSavedAt).trim() : "",
    };
  }

  function normalizeList(workspaceRoot, entries) {
    const byPath = new Map();

    for (const entry of Array.isArray(entries) ? entries : []) {
      const normalized = normalizeEntry(workspaceRoot, entry);
      if (!normalized) continue;

      const key = normalized.filePath.toLowerCase();
      const previous = byPath.get(key);
      if (!previous || normalized.activityAt > previous.activityAt) {
        byPath.set(key, normalized);
      }
    }

    return [...byPath.values()]
      .sort((left, right) => String(right.activityAt || "").localeCompare(String(left.activityAt || "")))
      .slice(0, DASHBOARD_CACHE_LIMIT);
  }

  function readState(workspaceRoot = getWorkspaceRoot()) {
    const cachePath = getCachePath(workspaceRoot);
    if (!fs.existsSync(cachePath)) {
      return createDefaultState();
    }

    try {
      const parsed = JSON.parse(String(fs.readFileSync(cachePath, "utf8") || "{}"));
      return {
        version: 1,
        continueWriting: normalizeList(workspaceRoot, parsed?.continueWriting),
        recentNotes: normalizeList(workspaceRoot, parsed?.recentNotes),
      };
    } catch {
      return createDefaultState();
    }
  }

  function writeState(workspaceRoot, state) {
    const cachePath = getCachePath(workspaceRoot);
    ensureDir(path.dirname(cachePath));
    const nextState = {
      version: 1,
      continueWriting: normalizeList(workspaceRoot, state?.continueWriting),
      recentNotes: normalizeList(workspaceRoot, state?.recentNotes),
    };
    fs.writeFileSync(cachePath, JSON.stringify(nextState, null, 2), "utf8");
    return nextState;
  }

  function upsertEntry(list, entry) {
    const key = entry.filePath.toLowerCase();
    return [
      entry,
      ...(Array.isArray(list) ? list : []).filter((item) => String(item?.filePath || "").toLowerCase() !== key),
    ];
  }

  function recordOpen(entry) {
    const workspaceRoot = getWorkspaceRoot();
    const now = new Date().toISOString();
    const currentState = readState(workspaceRoot);
    const normalized = normalizeEntry(workspaceRoot, {
      ...entry,
      activityAt: now,
      lastOpenedAt: now,
    });
    if (!normalized) return currentState;

    return writeState(workspaceRoot, {
      ...currentState,
      continueWriting: upsertEntry(currentState.continueWriting, normalized),
      recentNotes: upsertEntry(currentState.recentNotes, normalized),
    });
  }

  function recordSave(entry) {
    const workspaceRoot = getWorkspaceRoot();
    const now = new Date().toISOString();
    const currentState = readState(workspaceRoot);
    const normalized = normalizeEntry(workspaceRoot, {
      ...entry,
      activityAt: now,
      lastOpenedAt: entry?.lastOpenedAt || now,
      lastSavedAt: now,
    });
    if (!normalized) return currentState;

    return writeState(workspaceRoot, {
      ...currentState,
      continueWriting: upsertEntry(currentState.continueWriting, normalized),
      recentNotes: upsertEntry(currentState.recentNotes, normalized),
    });
  }

  function renameEntry(previousFilePath, nextEntry) {
    const workspaceRoot = getWorkspaceRoot();
    const previousKey = String(previousFilePath || "").trim().toLowerCase();
    if (!previousKey) {
      return readState(workspaceRoot);
    }

    const currentState = readState(workspaceRoot);
    const normalized = normalizeEntry(workspaceRoot, {
      ...nextEntry,
      activityAt: new Date().toISOString(),
    });
    if (!normalized) return currentState;

    const renameList = (list) => {
      const remaining = (Array.isArray(list) ? list : []).filter((item) => String(item?.filePath || "").toLowerCase() !== previousKey);
      return upsertEntry(remaining, normalized);
    };

    return writeState(workspaceRoot, {
      ...currentState,
      continueWriting: renameList(currentState.continueWriting),
      recentNotes: renameList(currentState.recentNotes),
    });
  }

  function removeFile(filePath) {
    const workspaceRoot = getWorkspaceRoot();
    const key = String(filePath || "").trim().toLowerCase();
    if (!key) return readState(workspaceRoot);
    const currentState = readState(workspaceRoot);
    return writeState(workspaceRoot, {
      ...currentState,
      continueWriting: currentState.continueWriting.filter((item) => String(item?.filePath || "").toLowerCase() !== key),
      recentNotes: currentState.recentNotes.filter((item) => String(item?.filePath || "").toLowerCase() !== key),
    });
  }

  function removeFolder(folderPath) {
    const workspaceRoot = getWorkspaceRoot();
    const resolvedFolder = path.resolve(String(folderPath || ""));
    const currentState = readState(workspaceRoot);
    const filterList = (list) => (Array.isArray(list) ? list : []).filter((item) => !filePathWithin(resolvedFolder, item?.filePath || ""));
    return writeState(workspaceRoot, {
      ...currentState,
      continueWriting: filterList(currentState.continueWriting),
      recentNotes: filterList(currentState.recentNotes),
    });
  }

  function getDashboardState() {
    const workspaceRoot = getWorkspaceRoot();
    const currentState = readState(workspaceRoot);
    if (currentState.recentNotes.length > 0) {
      return currentState;
    }

    const seededRecent = (typeof listWorkspaceFileEntries === "function" ? listWorkspaceFileEntries(workspaceRoot) : [])
      .filter((entry) => entry?.entryType === "file" && entry?.filePath)
      .map((entry) => normalizeEntry(workspaceRoot, {
        filePath: entry.filePath,
        title: entry.title,
        updatedAt: entry.updatedAt,
        activityAt: entry.updatedAt,
      }))
      .filter(Boolean)
      .sort((left, right) => String(right.activityAt || "").localeCompare(String(left.activityAt || "")))
      .slice(0, DASHBOARD_CACHE_LIMIT);

    return writeState(workspaceRoot, {
      ...currentState,
      recentNotes: seededRecent,
    });
  }

  return {
    getDashboardState,
    recordOpen,
    recordSave,
    renameEntry,
    removeFile,
    removeFolder,
  };
}

module.exports = { createDashboardCache };