const { app, BrowserWindow, ipcMain, Menu, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const rendererUrl = process.env.ELECTRON_RENDERER_URL;
const projectRoot = app.getAppPath();
const notesRoot = process.env.NOTES_ROOT || path.join(projectRoot, "notes");
const appDataDir = path.join(notesRoot, ".notes-app");
const projectsRoot = path.join(notesRoot, "projects");
const projectsRegistryPath = path.join(appDataDir, "projects.json");
const versionsRoot = path.join(projectRoot, ".versions");

const DEFAULT_PROJECT = {
  slug: "default",
  name: "Default",
  rootPath: notesRoot
};

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

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

function hashContent(content) {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

function filePathWithin(rootDir, targetPath) {
  const normalizedRoot = path.resolve(rootDir).toLowerCase();
  const normalizedTarget = path.resolve(targetPath).toLowerCase();
  return normalizedTarget.startsWith(normalizedRoot);
}

function makeProjectSlug(name, projects) {
  const base = slugify(String(name || "project"));
  const existing = new Set((projects || []).map((item) => item.slug));
  let candidate = base;
  let index = 2;

  while (existing.has(candidate)) {
    candidate = `${base}-${index}`;
    index += 1;
  }

  return candidate;
}

function normalizeProjectEntry(entry) {
  const slug = slugify(entry?.slug || entry?.name || "project");
  const name = String(entry?.name || slug || "Project").trim() || "Project";
  const rootPath = path.resolve(entry?.rootPath || path.join(projectsRoot, slug));
  return { slug, name, rootPath };
}

function loadProjectRegistry() {
  ensureDir(appDataDir);
  ensureDir(projectsRoot);

  let state = null;
  if (fs.existsSync(projectsRegistryPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(projectsRegistryPath, "utf8"));
      const projects = Array.isArray(parsed?.projects)
        ? parsed.projects.map(normalizeProjectEntry).filter((item) => item.slug)
        : [];
      state = {
        projects,
        activeProjectSlug: parsed?.activeProjectSlug || ""
      };
    } catch {
      state = null;
    }
  }

  if (!state) {
    state = {
      projects: [{ ...DEFAULT_PROJECT }],
      activeProjectSlug: DEFAULT_PROJECT.slug
    };
  }

  if (!state.projects.some((item) => item.slug === DEFAULT_PROJECT.slug)) {
    state.projects.unshift({ ...DEFAULT_PROJECT });
  }

  if (!state.activeProjectSlug || !state.projects.some((item) => item.slug === state.activeProjectSlug)) {
    state.activeProjectSlug = DEFAULT_PROJECT.slug;
  }

  for (const item of state.projects) {
    ensureDir(item.rootPath);
  }

  fs.writeFileSync(projectsRegistryPath, JSON.stringify(state, null, 2), "utf8");
  return state;
}

function listProjectsState() {
  const activeProject = projectRegistry.projects.find((item) => item.slug === projectRegistry.activeProjectSlug)
    || projectRegistry.projects[0]
    || { ...DEFAULT_PROJECT };
  return {
    projects: projectRegistry.projects.map((item) => ({
      slug: item.slug,
      name: item.name,
      rootPath: item.rootPath
    })),
    activeProject: {
      slug: activeProject.slug,
      name: activeProject.name,
      rootPath: activeProject.rootPath
    }
  };
}

function getActiveProjectRoot() {
  const state = listProjectsState();
  return state.activeProject.rootPath;
}

function parseDocument(content, filePath) {
  const normalized = content.replace(/\r\n/g, "\n");
  const rawMatch = normalized.match(/^#\s*(RawNotes|Notes|Quick Notes)\s*$/im);
  const cleansedMatch = normalized.match(/^#\s*(Cleansed|Formal Notes|Professional Version)\s*$/im);
  const firstSectionIndex = Math.min(
    ...[rawMatch?.index, cleansedMatch?.index].filter((value) => Number.isInteger(value))
  );
  const header = Number.isFinite(firstSectionIndex)
    ? normalized.slice(0, firstSectionIndex).trim()
    : normalized.trim();

  const rawStart = rawMatch ? rawMatch.index + rawMatch[0].length : -1;
  const cleansedStart = cleansedMatch ? cleansedMatch.index + cleansedMatch[0].length : -1;
  const rawEnd = cleansedMatch ? cleansedMatch.index : normalized.length;
  const cleansedEnd = normalized.length;

  const metadata = {};
  header.split("\n").forEach((line) => {
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (match) metadata[match[1].trim().toLowerCase()] = match[2].trim();
  });

  return {
    filePath,
    fileName: path.basename(filePath),
    title: path.basename(filePath, ".md"),
    metadata,
    header,
    rawNotes: rawStart >= 0 ? normalized.slice(rawStart, rawEnd).trim() : "",
    cleansed: cleansedStart >= 0 ? normalized.slice(cleansedStart, cleansedEnd).trim() : "",
    hasRawNotes: rawStart >= 0,
    hasCleansed: cleansedStart >= 0,
    hash: hashContent(content)
  };
}

function buildDocumentContent(document) {
  const header = (document.header || "").trim();
  const parts = [];
  if (header) parts.push(header);
  parts.push("# RawNotes\n" + (document.rawNotes || "").trim());
  parts.push("# Cleansed\n" + (document.cleansed || "").trim());
  return parts.join("\n\n") + "\n";
}

function listMarkdownFiles(rootDir) {
  ensureDir(rootDir);
  return fs.readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
    .map((entry) => {
      const filePath = path.join(rootDir, entry.name);
      const content = fs.readFileSync(filePath, "utf8");
      const parsed = parseDocument(content, filePath);
      const stat = fs.statSync(filePath);
      return {
        filePath,
        fileName: parsed.fileName,
        title: parsed.title,
        metadata: parsed.metadata,
        updatedAt: stat.mtime.toISOString(),
        hash: parsed.hash
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}

function createDocumentInProject(rootDir, payload) {
  const requestedTitle = String(payload?.title || "").trim();
  if (!requestedTitle) {
    throw new Error("Note title is required.");
  }

  const safeBaseName = slugify(requestedTitle);
  let fileName = `${safeBaseName}.md`;
  let filePath = path.join(rootDir, fileName);
  let counter = 2;

  while (fs.existsSync(filePath)) {
    fileName = `${safeBaseName}-${counter}.md`;
    filePath = path.join(rootDir, fileName);
    counter += 1;
  }

  const initialContent = buildDocumentContent({
    header: `Title: ${requestedTitle}`,
    rawNotes: "",
    cleansed: ""
  });

  fs.writeFileSync(filePath, initialContent, "utf8");
  return parseDocument(initialContent, filePath);
}

class MetadataStore {
  constructor() {
    ensureDir(appDataDir);
    this.jsonPath = path.join(appDataDir, "app-state.json");
    this.dbPath = path.join(appDataDir, "app.sqlite");
    this.db = null;

    try {
      const { DatabaseSync } = require("node:sqlite");
      this.db = new DatabaseSync(this.dbPath);
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS history_entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          file_path TEXT NOT NULL,
      version_path TEXT NOT NULL,
          file_hash TEXT NOT NULL,
          reason TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
      `);
    } catch (error) {
      this.state = fs.existsSync(this.jsonPath)
        ? JSON.parse(fs.readFileSync(this.jsonPath, "utf8"))
        : { history: [] };
    }
  }

  addHistory(entry) {
    if (this.db) {
      this.db.prepare(`
        INSERT INTO history_entries (file_path, version_path, file_hash, reason, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(entry.filePath, entry.versionPath, entry.fileHash, entry.reason, entry.createdAt);
      return;
    }

    this.state.history.push(entry);
    fs.writeFileSync(this.jsonPath, JSON.stringify(this.state, null, 2));
  }

  getHistory(filePath) {
    if (this.db) {
      return this.db.prepare(`
        SELECT version_path AS versionPath, file_hash AS fileHash, reason, created_at AS createdAt
        FROM history_entries
        WHERE file_path = ?
        ORDER BY created_at DESC
      `).all(filePath);
    }

    return this.state.history
      .filter((entry) => entry.filePath === filePath)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  deleteHistoryVersion(filePath, versionPath) {
    if (this.db) {
      this.db.prepare(`
        DELETE FROM history_entries
        WHERE file_path = ? AND version_path = ?
      `).run(filePath, versionPath);
      return;
    }

    this.state.history = this.state.history.filter(
      (entry) => !(entry.filePath === filePath && entry.versionPath === versionPath)
    );
    fs.writeFileSync(this.jsonPath, JSON.stringify(this.state, null, 2));
  }
}

let metadataStore;
let projectRegistry;

function sendMenuAction(win, action) {
  if (!win || win.isDestroyed()) return;
  win.webContents.send("app-menu:action", action);
}

function buildAppMenu(win, context = {}) {
  const screen = context?.screen === "document" ? "document" : "landing";
  const viewMode = context?.viewMode === "table" ? "table" : "tile";
  const dirty = Boolean(context?.dirty);

  const fileSubmenu = screen === "document"
    ? [
        {
          label: dirty ? "Save*" : "Save",
          accelerator: "CmdOrCtrl+S",
          enabled: dirty,
          click: () => sendMenuAction(win, "save-document")
        },
        {
          label: "Open in VS Code",
          accelerator: "CmdOrCtrl+Shift+O",
          click: () => sendMenuAction(win, "open-in-editor")
        },
        {
          label: "Back to Notes",
          accelerator: "Esc",
          click: () => sendMenuAction(win, "back-to-notes")
        },
        { type: "separator" },
        {
          label: "New Note",
          accelerator: "CmdOrCtrl+N",
          click: () => sendMenuAction(win, "new-note")
        },
        {
          label: "New Project",
          accelerator: "CmdOrCtrl+Shift+N",
          click: () => sendMenuAction(win, "new-project")
        },
        { type: "separator" },
        { role: "quit" }
      ]
    : [
        {
          label: "New Note",
          accelerator: "CmdOrCtrl+N",
          click: () => sendMenuAction(win, "new-note")
        },
        {
          label: "New Project",
          accelerator: "CmdOrCtrl+Shift+N",
          click: () => sendMenuAction(win, "new-project")
        },
        { type: "separator" },
        { role: "quit" }
      ];

  const viewSubmenu = screen === "document"
    ? [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" }
      ]
    : [
        {
          label: "Tile Notes",
          accelerator: "CmdOrCtrl+1",
          type: "radio",
          checked: viewMode === "tile",
          click: () => sendMenuAction(win, "view-tile")
        },
        {
          label: "Table Notes",
          accelerator: "CmdOrCtrl+2",
          type: "radio",
          checked: viewMode === "table",
          click: () => sendMenuAction(win, "view-table")
        },
        { type: "separator" },
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" }
      ];

  return Menu.buildFromTemplate([
    {
      label: "File",
      submenu: fileSubmenu
    },
    {
      label: "View",
      submenu: viewSubmenu
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" }
      ]
    }
  ]);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 980,
    minHeight: 640,
    show: false,
    backgroundColor: "#f5f3ef",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.once("ready-to-show", () => {
    win.center();
    win.show();
    win.focus();
  });

  if (rendererUrl) {
    win.loadURL(rendererUrl);
  } else {
    win.loadFile(path.join(projectRoot, "dist", "index.html"));
  }

  win.__menuContext = { screen: "landing", viewMode: "tile", dirty: false };
  Menu.setApplicationMenu(buildAppMenu(win, win.__menuContext));
}

app.whenReady().then(() => {
  ensureDir(notesRoot);
  ensureDir(versionsRoot);
  metadataStore = new MetadataStore();
  projectRegistry = loadProjectRegistry();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("browser-window-focus", (_event, win) => {
  const context = win?.__menuContext || { screen: "landing", viewMode: "tile", dirty: false };
  Menu.setApplicationMenu(buildAppMenu(win, context));
});

ipcMain.on("app-menu:update-context", (event, context) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) return;

  win.__menuContext = {
    screen: context?.screen === "document" ? "document" : "landing",
    viewMode: context?.viewMode === "table" ? "table" : "tile",
    dirty: Boolean(context?.dirty)
  };

  Menu.setApplicationMenu(buildAppMenu(win, win.__menuContext));
});

ipcMain.handle("projects:list", () => listProjectsState());

ipcMain.handle("projects:create", (_event, payload) => {
  const name = String(payload?.name || "").trim();
  if (!name) {
    throw new Error("Project name is required.");
  }

  const slug = makeProjectSlug(name, projectRegistry.projects);
  const rootPath = path.join(projectsRoot, slug);
  ensureDir(rootPath);

  projectRegistry.projects.push({ slug, name, rootPath });
  projectRegistry.activeProjectSlug = slug;
  fs.writeFileSync(projectsRegistryPath, JSON.stringify(projectRegistry, null, 2), "utf8");

  return listProjectsState();
});

ipcMain.handle("projects:set-active", (_event, payload) => {
  const slug = String(payload?.slug || "").trim();
  const exists = projectRegistry.projects.some((item) => item.slug === slug);
  if (!exists) {
    throw new Error("Project not found.");
  }

  projectRegistry.activeProjectSlug = slug;
  fs.writeFileSync(projectsRegistryPath, JSON.stringify(projectRegistry, null, 2), "utf8");
  return listProjectsState();
});

ipcMain.handle("documents:list", () => listMarkdownFiles(getActiveProjectRoot()));

ipcMain.handle("documents:create", (_event, payload) => {
  const rootDir = getActiveProjectRoot();
  return createDocumentInProject(rootDir, payload);
});

ipcMain.handle("documents:read", (_event, filePath) => {
  const resolved = path.resolve(filePath);
  if (!filePathWithin(notesRoot, resolved) || path.extname(resolved).toLowerCase() !== ".md") {
    throw new Error("Invalid document path.");
  }
  return parseDocument(fs.readFileSync(resolved, "utf8"), resolved);
});

ipcMain.handle("documents:save", (_event, payload) => {
  const resolved = path.resolve(payload.filePath);
  if (!filePathWithin(notesRoot, resolved) || path.extname(resolved).toLowerCase() !== ".md") {
    throw new Error("Invalid document path.");
  }

  const previous = fs.readFileSync(resolved, "utf8");
  const slug = slugify(path.basename(resolved));
  const versionDir = path.join(versionsRoot, slug);
  ensureDir(versionDir);

  const stamp = nowStamp();
  const versionPath = path.join(versionDir, `${stamp}.md`);
  fs.writeFileSync(versionPath, previous, "utf8");

  const next = buildDocumentContent(payload);
  fs.writeFileSync(resolved, next, "utf8");

  metadataStore.addHistory({
    filePath: resolved,
    versionPath,
    fileHash: hashContent(previous),
    reason: payload.reason || "manual-save",
    createdAt: new Date().toISOString()
  });

  return parseDocument(next, resolved);
});

ipcMain.handle("documents:history", (_event, filePath) => {
  const resolved = path.resolve(filePath);
  return metadataStore.getHistory(resolved);
});

ipcMain.handle("documents:restore", (_event, payload) => {
  const resolved = path.resolve(payload.filePath);
  const versionPath = path.resolve(payload.versionPath);
  if (!filePathWithin(notesRoot, resolved) || !filePathWithin(versionsRoot, versionPath)) {
    throw new Error("Invalid restore path.");
  }

  const current = fs.readFileSync(resolved, "utf8");
  const rollbackDir = path.join(versionsRoot, slugify(path.basename(resolved)));
  ensureDir(rollbackDir);
  const rollbackPath = path.join(rollbackDir, `${nowStamp()}-before-restore.md`);
  fs.writeFileSync(rollbackPath, current, "utf8");

  const restored = fs.readFileSync(versionPath, "utf8");
  fs.writeFileSync(resolved, restored, "utf8");

  metadataStore.addHistory({
    filePath: resolved,
    versionPath: rollbackPath,
    fileHash: hashContent(current),
    reason: "before-restore",
    createdAt: new Date().toISOString()
  });

  return parseDocument(restored, resolved);
});

ipcMain.handle("documents:open-in-editor", async (_event, filePath) => {
  const resolved = path.resolve(filePath || "");
  if (!filePathWithin(notesRoot, resolved) || path.extname(resolved).toLowerCase() !== ".md") {
    throw new Error("Invalid document path.");
  }
  if (!fs.existsSync(resolved)) {
    throw new Error("Document file does not exist.");
  }

  try {
    const vscodeUri = `vscode://file/${resolved.replace(/\\/g, "/")}`;
    await shell.openExternal(encodeURI(vscodeUri));
    return { openedWith: "vscode" };
  } catch {
    const fallbackResult = await shell.openPath(resolved);
    if (fallbackResult) {
      throw new Error(fallbackResult);
    }
    return { openedWith: "default" };
  }
});

ipcMain.handle("documents:read-version", (_event, payload) => {
  const resolvedFilePath = path.resolve(payload?.filePath || "");
  const resolvedVersionPath = path.resolve(payload?.versionPath || "");

  if (!filePathWithin(notesRoot, resolvedFilePath) || path.extname(resolvedFilePath).toLowerCase() !== ".md") {
    throw new Error("Invalid document path.");
  }
  if (!filePathWithin(versionsRoot, resolvedVersionPath) || path.extname(resolvedVersionPath).toLowerCase() !== ".md") {
    throw new Error("Invalid version path.");
  }
  if (!fs.existsSync(resolvedVersionPath)) {
    throw new Error("Version file does not exist.");
  }

  return fs.readFileSync(resolvedVersionPath, "utf8");
});

ipcMain.handle("documents:delete-version", (_event, payload) => {
  const resolvedFilePath = path.resolve(payload?.filePath || "");
  const resolvedVersionPath = path.resolve(payload?.versionPath || "");

  if (!filePathWithin(notesRoot, resolvedFilePath) || path.extname(resolvedFilePath).toLowerCase() !== ".md") {
    throw new Error("Invalid document path.");
  }
  if (!filePathWithin(versionsRoot, resolvedVersionPath) || path.extname(resolvedVersionPath).toLowerCase() !== ".md") {
    throw new Error("Invalid version path.");
  }

  if (fs.existsSync(resolvedVersionPath)) {
    fs.unlinkSync(resolvedVersionPath);
  }
  metadataStore.deleteHistoryVersion(resolvedFilePath, resolvedVersionPath);
  return true;
});

ipcMain.handle("images:save", (_event, payload) => {
  const { fileName, base64Data } = payload || {};
  if (!fileName || typeof fileName !== "string") {
    throw new Error("Invalid image filename.");
  }
  if (!base64Data || typeof base64Data !== "string" || !base64Data.includes(",")) {
    throw new Error("Invalid image payload.");
  }

  const imagesDir = path.join(notesRoot, "images");
  ensureDir(imagesDir);

  // Generate unique filename if it already exists
  const safeFileName = path.basename(fileName).replace(/[<>:"/\\|?*]+/g, "-");
  const ext = path.extname(safeFileName);
  const baseName = path.basename(safeFileName, ext) || "image";
  const finalExt = ext || ".png";
  let finalName = `${baseName}${finalExt}`;
  let counter = 1;

  while (fs.existsSync(path.join(imagesDir, finalName))) {
    finalName = `${baseName}-${counter}${finalExt}`;
    counter++;
  }

  const imagePath = path.join(imagesDir, finalName);
  const buffer = Buffer.from(base64Data.split(",")[1], "base64");
  if (!buffer.length) {
    throw new Error("Image data is empty.");
  }
  fs.writeFileSync(imagePath, buffer);

  // Return relative path for markdown insertion
  return `./images/${finalName}`;
});

ipcMain.handle("images:list", (_event, payload) => {
  const { basePath } = payload || {};
  if (!basePath || typeof basePath !== "string") {
    throw new Error("Invalid base path.");
  }

  const resolvedBasePath = path.resolve(basePath).toLowerCase();
  const normalizedNotesRoot = path.resolve(notesRoot).toLowerCase();
  if (!resolvedBasePath.startsWith(normalizedNotesRoot)) {
    throw new Error("Invalid document path.");
  }

  const imagesDir = path.join(notesRoot, "images");
  if (!fs.existsSync(imagesDir)) return [];

  const allowedExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);
  return fs.readdirSync(imagesDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => allowedExtensions.has(path.extname(name).toLowerCase()))
    .map((name) => `./images/${name}`);
});

function resolveImageAssetPath(basePath, assetPath) {
  const rawAsset = (assetPath || "").trim();
  if (!rawAsset) return null;

  let resolvedAssetPath = "";
  if (/^https?:/i.test(rawAsset)) {
    try {
      const url = new URL(rawAsset);
      let localPath = url.pathname || "";
      for (let i = 0; i < 5; i += 1) {
        try {
          const next = decodeURIComponent(localPath);
          if (next === localPath) break;
          localPath = next;
        } catch {
          break;
        }
      }
      if (/^\/images\//i.test(localPath)) {
        resolvedAssetPath = path.resolve(notesRoot, `.${localPath}`);
      } else {
        return null;
      }
    } catch {
      return null;
    }
  } else if (/^file:/i.test(rawAsset)) {
    try {
      const url = new URL(rawAsset);
      resolvedAssetPath = decodeURI(url.pathname);
      if (/^\/[A-Za-z]:\//.test(resolvedAssetPath)) {
        resolvedAssetPath = resolvedAssetPath.slice(1);
      }
    } catch {
      return null;
    }
  } else {
    let decodedAsset = rawAsset;
    for (let i = 0; i < 5; i += 1) {
      try {
        const next = decodeURIComponent(decodedAsset);
        if (next === decodedAsset) break;
        decodedAsset = next;
      } catch {
        break;
      }
    }
    const baseDir = path.dirname(path.resolve(basePath));
    const normalizedAsset = decodedAsset
      .replace(/^\.\//, "")
      .replace(/^[/\\]+images[/\\]/i, "images/");
    resolvedAssetPath = path.resolve(baseDir, normalizedAsset);
  }

  const normalizedNotesRoot = path.resolve(notesRoot).toLowerCase();
  const normalizedResolvedPath = path.resolve(resolvedAssetPath).toLowerCase();
  if (!normalizedResolvedPath.startsWith(normalizedNotesRoot)) {
    return null;
  }

  return path.resolve(resolvedAssetPath);
}

ipcMain.handle("images:delete", (_event, payload) => {
  const { basePath, assetPath } = payload || {};
  if (!basePath || typeof basePath !== "string") {
    throw new Error("Invalid base path.");
  }
  if (!assetPath || typeof assetPath !== "string") {
    throw new Error("Invalid asset path.");
  }

  const resolvedAssetPath = resolveImageAssetPath(basePath, assetPath);
  if (!resolvedAssetPath || !fs.existsSync(resolvedAssetPath)) {
    return false;
  }

  fs.unlinkSync(resolvedAssetPath);
  return true;
});

ipcMain.handle("images:replace", (_event, payload) => {
  const { basePath, assetPath, base64Data } = payload || {};
  if (!basePath || typeof basePath !== "string") {
    throw new Error("Invalid base path.");
  }
  if (!assetPath || typeof assetPath !== "string") {
    throw new Error("Invalid asset path.");
  }
  if (!base64Data || typeof base64Data !== "string" || !base64Data.includes(",")) {
    throw new Error("Invalid image payload.");
  }

  const resolvedAssetPath = resolveImageAssetPath(basePath, assetPath);
  if (!resolvedAssetPath || !fs.existsSync(resolvedAssetPath)) {
    throw new Error("Image file not found.");
  }

  const buffer = Buffer.from(base64Data.split(",")[1], "base64");
  if (!buffer.length) {
    throw new Error("Image data is empty.");
  }

  fs.writeFileSync(resolvedAssetPath, buffer);
  return true;
});

ipcMain.handle("images:read", (_event, payload) => {
  const { basePath, assetPath } = payload || {};
  if (!basePath || typeof basePath !== "string") {
    throw new Error("Invalid base path.");
  }
  if (!assetPath || typeof assetPath !== "string") {
    throw new Error("Invalid asset path.");
  }

  const rawAsset = assetPath.trim();
  if (/^(data:|blob:)/i.test(rawAsset)) {
    return assetPath;
  }

  const resolvedAssetPath = resolveImageAssetPath(basePath, rawAsset);
  if (!resolvedAssetPath) {
    return rawAsset;
  }
  if (!fs.existsSync(resolvedAssetPath)) {
    return rawAsset;
  }

  const ext = path.extname(resolvedAssetPath).toLowerCase();
  const mimeMap = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml"
  };
  const mimeType = mimeMap[ext] || "application/octet-stream";
  const buffer = fs.readFileSync(resolvedAssetPath);
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
});
