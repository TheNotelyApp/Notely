

class WorkspaceMetadata {
  constructor(deps) {
    this.fs = deps.fs;
    this.path = deps.path;
    this.getAppDataDir = deps.getAppDataDir;
    this.getNotesRoot = deps.getNotesRoot;
    this.filePathWithin = deps.filePathWithin;
    this.normalizeToPosix = deps.normalizeToPosix;

    // We'll read state lazily to ensure appDataDir is resolved.
    this.state = null;
  }

  get jsonPath() {
    const appDataDir = this.getAppDataDir();
    return appDataDir ? this.path.join(appDataDir, "metadata.json") : null;
  }

  _load() {
    if (this.state) return;
    const p = this.jsonPath;
    if (!p) return;
    try {
      if (this.fs.existsSync(p)) {
        this.state = JSON.parse(this.fs.readFileSync(p, "utf8"));
      } else {
        this.state = { items: {}, favorites: [], info: {} };
      }
    } catch {
      this.state = { items: {}, favorites: [], info: {} };
    }
    if (!this.state.items) this.state.items = {};
    if (!Array.isArray(this.state.favorites)) this.state.favorites = [];
    if (!this.state.info || typeof this.state.info !== "object") {
      const root = this.getNotesRoot();
      const defaultName = root ? this.path.basename(root) : "Workspace";
      this.state.info = {
        name: defaultName,
        description: "",
        domainTags: [],
        projectType: "General",
        primaryGoal: "",
        icon: "",
        color: "",
      };
    }
  }

  _save() {
    if (!this.state) return;
    const p = this.jsonPath;
    if (!p) return;
    try {
      this.fs.writeFileSync(p, JSON.stringify(this.state, null, 2), "utf8");
    } catch (e) {
      console.error("[WorkspaceMetadata] Save error:", e);
    }
  }

  _getRelativePath(absolutePath) {
    const root = this.getNotesRoot();
    if (!root) return null;
    const resolved = this.path.resolve(String(absolutePath || ""));
    if (!this.filePathWithin(root, resolved)) return null;
    
    // Use posix-style relative path as key for consistency
    const relative = this.path.relative(root, resolved);
    return this.normalizeToPosix(relative);
  }

  getMetadata(absolutePath) {
    this._load();
    const relPath = this._getRelativePath(absolutePath);
    if (!relPath) return {};
    return this.state.items[relPath] || {};
  }

  getAllMetadata() {
    this._load();
    return this.state?.items || {};
  }

  getFavorites() {
    this._load();
    return Array.isArray(this.state?.favorites) ? this.state.favorites : [];
  }

  setFavorites(favoritesList) {
    this._load();
    this.state.favorites = Array.isArray(favoritesList) ? favoritesList : [];
    this._save();
    return this.state.favorites;
  }

  getWorkspaceInfo() {
    this._load();
    const root = this.getNotesRoot();
    const defaultName = root ? this.path.basename(root) : "Workspace";
    return {
      name: this.state.info?.name || defaultName,
      description: this.state.info?.description || "",
      domainTags: Array.isArray(this.state.info?.domainTags) ? this.state.info.domainTags : [],
      projectType: this.state.info?.projectType || "General",
      primaryGoal: this.state.info?.primaryGoal || "",
      icon: this.state.info?.icon || "",
      color: this.state.info?.color || "",
    };
  }

  updateWorkspaceInfo(infoPayload) {
    this._load();
    const current = this.getWorkspaceInfo();
    this.state.info = {
      ...current,
      ...infoPayload,
    };
    this._save();
    return this.state.info;
  }

  updateMetadata(absolutePath, { icon, color }) {
    this._load();
    const relPath = this._getRelativePath(absolutePath);
    if (!relPath) return false;

    if (!this.state.items[relPath]) {
      this.state.items[relPath] = {};
    }

    if (icon !== undefined) this.state.items[relPath].icon = icon;
    if (color !== undefined) this.state.items[relPath].color = color;

    // Cleanup if both are null/empty
    if (!this.state.items[relPath].icon && !this.state.items[relPath].color) {
      delete this.state.items[relPath];
    }

    this._save();
    return true;
  }
}

function validateIsWorkspace(fs, path, dirPath) {
  if (!dirPath || typeof dirPath !== "string") return false;
  try {
    const metaFolder = path.join(dirPath, ".notes-app");
    return fs.existsSync(metaFolder) && fs.statSync(metaFolder).isDirectory();
  } catch {
    return false;
  }
}

function createWorkspaceMetadata(deps) {
  return new WorkspaceMetadata(deps);
}

module.exports = { createWorkspaceMetadata, validateIsWorkspace };
