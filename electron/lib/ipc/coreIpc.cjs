const { assertTrustedIpcSender } = require("./ipcSecurity.cjs");

function registerCoreIpcHandlers(ipcMain, deps) {
  const {
    BrowserWindow,
    app,
    dialog,
    clipboard,
    fs,
    process,
    path,
    shell,
    filePathWithin,
    projectRoot,
    ensureDir,
    readUserSettings,
    writeUserSettings,
    applyNotesRoot,
    getGitWorkspaceMetadata,
    setAutoIgnoreMetadataInGit,
    getAppInfo,
    getNotesRoot,
    listProjectsState,
    getActiveProjectSlug,
    setActiveProjectSlug,
    createReferenceWindow,
  } = deps;

  const RECENT_WORKSPACES_LIMIT = 8;

  function normalizeWorkspacePathValue(rawPath) {
    if (typeof rawPath !== "string") return "";
    const trimmed = rawPath.trim();
    if (!trimmed) return "";

    const cleaned = trimmed
      .split(/[\\/]+/)
      .filter((segment) => segment && segment !== "[object Object]")
      .join(path.sep);
    if (!cleaned) return "";

    try {
      return path.resolve(cleaned);
    } catch {
      return "";
    }
  }

  function normalizeRecentWorkspaces(settings) {
    const rawEntries = Array.isArray(settings?.recentWorkspaces)
      ? settings.recentWorkspaces
      : [];
    const seen = new Set();
    const normalized = [];

    for (const entry of rawEntries) {
      const resolved = normalizeWorkspacePathValue(entry);
      if (!resolved) continue;

      const key = resolved.toLowerCase();
      if (seen.has(key) || !fs.existsSync(resolved)) continue;
      seen.add(key);
      normalized.push(resolved);
      if (normalized.length >= RECENT_WORKSPACES_LIMIT) break;
    }

    return normalized;
  }

  function registerTrustedHandler(channel, handler) {
    ipcMain.handle(channel, (event, payload) => {
      assertTrustedIpcSender(BrowserWindow, event, channel);
      return handler(event, payload);
    });
  }

  function normalizeThemePreference(value) {
    return value === "light" || value === "dark" ? value : "auto";
  }

  function resolveEffectiveTheme(themePreference) {
    const preference = normalizeThemePreference(themePreference);
    if (preference === "light" || preference === "dark") return preference;
    const shouldUseDark = Boolean(deps?.nativeTheme?.shouldUseDarkColors);
    return shouldUseDark ? "dark" : "light";
  }

  function normalizeZoomFactor(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0.8;
    return Math.max(0.75, Math.min(2, Number(numeric.toFixed(2))));
  }

  function resolveWorkspaceFolderPath(rawFolderPath) {
    const requestedPath = normalizeWorkspacePathValue(rawFolderPath);
    const notesRoot = normalizeWorkspacePathValue(getNotesRoot());
    const resolved = requestedPath || notesRoot;

    if (!resolved) {
      throw new Error("Workspace path is unavailable.");
    }

    const isSameAsRoot = notesRoot && resolved.toLowerCase() === notesRoot.toLowerCase();
    if (!isSameAsRoot && !filePathWithin(notesRoot, resolved)) {
      throw new Error("Invalid workspace path.");
    }
    if (!fs.existsSync(resolved)) {
      throw new Error("Workspace folder does not exist.");
    }

    return resolved;
  }

  function broadcastThemeChange(themePreference) {
    const effectiveTheme = resolveEffectiveTheme(themePreference);
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win || win.isDestroyed()) continue;
      win.webContents.send("appearance:theme-changed", { themePreference, effectiveTheme });
    }
  }

  registerTrustedHandler("settings:get-notes-root", () => ({
    notesRoot: getNotesRoot(),
    notesRootSource: process.env.NOTES_ROOT ? "env" : "config",
    recentWorkspaces: [
      getNotesRoot(),
      ...normalizeRecentWorkspaces(readUserSettings()),
    ].filter((entry, index, list) => {
      const normalized = String(entry || "").trim().toLowerCase();
      return normalized && list.findIndex((candidate) => String(candidate || "").trim().toLowerCase() === normalized) === index;
    }).slice(0, RECENT_WORKSPACES_LIMIT)
  }));

  registerTrustedHandler("help:get-documents", () => {
    const docsRoot = path.join(projectRoot, "docs");
    const entries = [
      {
        slug: "overview",
        title: "Start Here",
        fileName: "index.md",
        summary: "Quick orientation for first-time users and a map to the most important guides.",
        highlights: [
          "First-use checklist",
          "Keyboard shortcuts for core tasks",
          "Guide map by user goal",
        ],
      },
      {
        slug: "user-guide",
        title: "User Guide",
        fileName: "user-guide.md",
        summary: "Step-by-step daily workflows: setup, writing, search, media, and version recovery.",
        highlights: [
          "Create and organize notes",
          "Edit with preview and validation",
          "Work with diagrams and images",
        ],
      },
      {
        slug: "feature-reference",
        title: "Feature Reference",
        fileName: "feature-reference.md",
        summary: "Complete explanation of all major user-facing features in Notely.",
        highlights: [
          "Editor, search, and versioning",
          "Media, Mermaid, and Excalidraw",
          "AI assistance and P2P sync",
        ],
      },
      {
        slug: "top-tasks",
        title: "Top Common Tasks",
        fileName: "top-tasks.md",
        summary: "Fast click-by-click steps for the actions users perform most often.",
        highlights: [
          "Create notes and folders",
          "Search, edit, and preview",
          "History, diagrams, and help",
        ],
      },
      {
        slug: "settings-reference",
        title: "Settings Reference",
        fileName: "settings-reference.md",
        summary: "Reference for appearance, terminal, screen capture, AI, and other configurable behavior.",
        highlights: [
          "Theme, zoom, and density",
          "Terminal and screen capture",
          "AI providers and privacy controls",
        ],
      },
      {
        slug: "feature-availability",
        title: "Feature Availability",
        fileName: "feature-availability.md",
        summary: "See what works offline and what requires optional setup or internet access.",
        highlights: [
          "Offline vs online features",
          "AI setup dependencies",
          "P2P sync prerequisites",
        ],
      },
      {
        slug: "data-sync-security",
        title: "Data & Sync",
        fileName: "data-sync-security.md",
        summary: "How your data is stored, how sync works, and the privacy basics to know.",
        highlights: [
          "Where app data is stored",
          "P2P pairing and conflict basics",
          "Daily safety checklist",
        ],
      },
      {
        slug: "troubleshooting",
        title: "Troubleshooting",
        fileName: "troubleshooting.md",
        summary: "Quick fixes for common issues with notes, preview, links, sync, and AI setup.",
        highlights: [
          "Notes not showing",
          "Preview or link issues",
          "Sync and AI troubleshooting",
        ],
      },
      {
        slug: "faq",
        title: "FAQ",
        fileName: "faq.md",
        summary: "Answers to common questions about workspaces, storage, sync, AI, and exports.",
        highlights: [
          "Where data is stored",
          "Offline and AI behavior",
          "Export and sync basics",
        ],
      },
      {
        slug: "release-notes",
        title: "Release Notes",
        fileName: "release-notes.md",
        summary: "Current release highlights and recent documentation-impacting changes.",
        highlights: [
          "Latest doc and shortcut changes",
          "New help content",
          "Recent workflow additions",
        ],
      },
    ];

    return entries
      .map((entry) => {
        const fullPath = path.join(docsRoot, entry.fileName);
        if (!fs.existsSync(fullPath)) return null;
        const markdown = String(fs.readFileSync(fullPath, "utf8") || "");
        return {
          slug: entry.slug,
          title: entry.title,
          fileName: entry.fileName,
          summary: entry.summary,
          highlights: Array.isArray(entry.highlights) ? entry.highlights : [],
          markdown,
        };
      })
      .filter(Boolean);
  });

  registerTrustedHandler("settings:get-app-info", () => {
    const fallbackName = String(app?.getName?.() || "Notely");
    const fallbackVersion = String(app?.getVersion?.() || "0.0.0");
    const computed = typeof getAppInfo === "function" ? getAppInfo() : null;
    return {
      appName: String(computed?.appName || fallbackName),
      version: String(computed?.version || fallbackVersion),
      versionCore: String(computed?.versionCore || fallbackVersion),
      commitHash: String(computed?.commitHash || ""),
    };
  });

  registerTrustedHandler("settings:get-appearance", () => {
    const settings = readUserSettings();
    const themePreference = normalizeThemePreference(settings?.themePreference);
    const zoomFactor = normalizeZoomFactor(settings?.zoomFactor);
    return {
      themePreference,
      effectiveTheme: resolveEffectiveTheme(themePreference),
      zoomFactor,
    };
  });

  registerTrustedHandler("settings:set-theme-preference", (_event, payload) => {
    const settings = readUserSettings();
    const themePreference = normalizeThemePreference(payload?.themePreference);
    settings.themePreference = themePreference;
    writeUserSettings(settings);

    if (deps?.nativeTheme) {
      deps.nativeTheme.themeSource = themePreference === "auto" ? "system" : themePreference;
    }

    broadcastThemeChange(themePreference);

    return {
      themePreference,
      effectiveTheme: resolveEffectiveTheme(themePreference),
    };
  });

  registerTrustedHandler("settings:set-zoom-factor", (event, payload) => {
    const nextZoom = normalizeZoomFactor(payload?.zoomFactor);
    const settings = readUserSettings();
    settings.zoomFactor = nextZoom;
    writeUserSettings(settings);

    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    if (senderWindow && !senderWindow.isDestroyed()) {
      senderWindow.webContents.setZoomFactor(nextZoom);
    }

    return { zoomFactor: nextZoom };
  });

  registerTrustedHandler("settings:pick-folder", async () => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    const result = await dialog.showOpenDialog(win, {
      properties: ["openDirectory", "createDirectory"],
      title: "Select workspace"
    });

    if (result.canceled || !result.filePaths?.length) {
      return null;
    }

    return result.filePaths[0];
  });

  registerTrustedHandler("workspace:open-in-editor", async (_event, payload) => {
    const resolved = resolveWorkspaceFolderPath(payload?.folderPath);

    try {
      const vscodeUri = `vscode://file/${resolved.replace(/\\/g, "/")}`;
      await shell.openExternal(encodeURI(vscodeUri));
      return { openedWith: "vscode", folderPath: resolved };
    } catch {
      const fallbackResult = await shell.openPath(resolved);
      if (fallbackResult) {
        throw new Error(fallbackResult);
      }
      return { openedWith: "default", folderPath: resolved };
    }
  });

  registerTrustedHandler("workspace:reveal-in-explorer", (_event, payload) => {
    const resolved = resolveWorkspaceFolderPath(payload?.folderPath);

    shell.showItemInFolder(resolved);
    return { revealed: true, folderPath: resolved };
  });

  registerTrustedHandler("window:open-reference-note", (_event, payload) => {
    const nextFilePath = String(payload?.filePath || "").trim();
    if (!nextFilePath) {
      throw new Error("Reference note path is required.");
    }

    const resolved = path.resolve(nextFilePath);
    if (!filePathWithin(getNotesRoot(), resolved) || path.extname(resolved).toLowerCase() !== ".md") {
      throw new Error("Invalid reference note path.");
    }
    if (!fs.existsSync(resolved)) {
      throw new Error("Reference note does not exist.");
    }

    createReferenceWindow(resolved);
    return { opened: true, filePath: resolved };
  });

  registerTrustedHandler("settings:set-notes-root", (_event, payload) => {
    const nextPath = normalizeWorkspacePathValue(payload?.notesRoot);
    if (!nextPath) {
      throw new Error("Workspace path is required.");
    }

    const resolved = nextPath;
    ensureDir(resolved);

    const settings = readUserSettings();
    settings.notesRoot = resolved;
    settings.recentWorkspaces = [
      resolved,
      ...normalizeRecentWorkspaces(settings).filter((entry) => entry.toLowerCase() !== resolved.toLowerCase()),
    ].slice(0, RECENT_WORKSPACES_LIMIT);
    writeUserSettings(settings);

    if (!process.env.NOTES_ROOT) {
      applyNotesRoot(resolved);
    }

    return {
      notesRoot: resolved,
      recentWorkspaces: settings.recentWorkspaces,
      restartRequired: Boolean(process.env.NOTES_ROOT),
      ignoredByEnv: Boolean(process.env.NOTES_ROOT)
    };
  });

  registerTrustedHandler("projects:list", () => listProjectsState());

  registerTrustedHandler("projects:set-active", (_event, payload) => {
    const slug = String(payload?.slug || "").trim();
    const exists = listProjectsState().projects.some((item) => item.slug === slug);
    if (!exists) {
      throw new Error("Project not found.");
    }

    setActiveProjectSlug(slug);
    return listProjectsState();
  });

  registerTrustedHandler("settings:get-git-workspace-meta", () => getGitWorkspaceMetadata());

  registerTrustedHandler("settings:set-auto-ignore-git-metadata", (_event, payload) => {
    return setAutoIgnoreMetadataInGit(payload?.enabled !== false);
  });

  registerTrustedHandler("screen:capture-current-display", async (event) => {
    if (process.platform !== "win32") {
      throw new Error("Area snip is currently supported on Windows only.");
    }

    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    const beforeImage = clipboard.readImage();
    const beforePngBase64 = beforeImage.isEmpty() ? "" : beforeImage.toPNG().toString("base64");

    if (senderWindow && !senderWindow.isDestroyed()) {
      try {
        senderWindow.minimize();
        senderWindow.blur();
      } catch {
        // Continue even if minimize fails.
      }
    }

    try {
      await shell.openExternal("ms-screenclip:");

      const startedAt = Date.now();
      const timeoutMs = 25000;
      while (Date.now() - startedAt < timeoutMs) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        const clipped = clipboard.readImage();
        if (clipped.isEmpty()) continue;

        const pngBase64 = clipped.toPNG().toString("base64");
        if (!pngBase64 || pngBase64 === beforePngBase64) continue;

        return {
          dataUrl: `data:image/png;base64,${pngBase64}`,
          displayName: "Snipped area",
          canceled: false,
        };
      }

      return {
        dataUrl: "",
        displayName: "",
        canceled: true,
      };
    } finally {
      if (senderWindow && !senderWindow.isDestroyed()) {
        try {
          senderWindow.restore();
          senderWindow.focus();
        } catch {
          // Best effort window restoration.
        }
      }
    }
  });

  return {
    getActiveProjectSlug,
  };
}

module.exports = { registerCoreIpcHandlers };
