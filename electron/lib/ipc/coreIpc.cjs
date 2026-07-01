const { assertTrustedIpcSender } = require("./ipcSecurity.cjs");

function registerCoreIpcHandlers(ipcMain, deps) {
  const {
    BrowserWindow,
    app,
    dialog,
    fs,
    process,
    path,
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
  } = deps;

  function registerTrustedHandler(channel, handler) {
    ipcMain.handle(channel, (event, payload) => {
      assertTrustedIpcSender(BrowserWindow, event, channel);
      return handler(event, payload);
    });
  }

  registerTrustedHandler("settings:get-notes-root", () => ({
    notesRoot: getNotesRoot(),
    notesRootSource: process.env.NOTES_ROOT ? "env" : "config"
  }));

  registerTrustedHandler("help:get-documents", () => {
    const docsRoot = path.join(projectRoot, "docs");
    const entries = [
      {
        slug: "overview",
        title: "Overview",
        fileName: "index.md",
        summary: "Start here to understand what Notely covers and where to find each workflow guide.",
        highlights: [
          "User workflows and navigation guidance",
          "Operations and support playbook",
          "Structured help architecture",
        ],
      },
      {
        slug: "user-guide",
        title: "User Guide",
        fileName: "user-guide.md",
        summary: "Step-by-step guidance for daily use: setup, authoring, diagrams, media, and note history.",
        highlights: [
          "First-time setup and workspace selection",
          "Editing, validation, and versions workflow",
          "Mermaid and Excalidraw usage guidance",
        ],
      },
      {
        slug: "operations-guide",
        title: "Operations Guide",
        fileName: "operations-guide.md",
        summary: "Operational handbook for metadata, sync, AI configuration, and release-quality checks.",
        highlights: [
          "Workspace metadata and recovery model",
          "P2P trust, sync, and conflict operations",
          "Build and verification sequence",
        ],
      },
      {
        slug: "help-center-ia",
        title: "Help Structure",
        fileName: "help-center-ia.md",
        summary: "Design intent for concise, task-driven in-app help with enterprise-grade clarity.",
        highlights: [
          "Section model for discoverability",
          "Task-first writing principles",
          "Support diagnostics visibility",
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

  registerTrustedHandler("settings:pick-folder", async () => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    const result = await dialog.showOpenDialog(win, {
      properties: ["openDirectory", "createDirectory"],
      title: "Select notes folder"
    });

    if (result.canceled || !result.filePaths?.length) {
      return null;
    }

    return result.filePaths[0];
  });

  registerTrustedHandler("settings:set-notes-root", (_event, payload) => {
    const nextPath = String(payload?.notesRoot || "").trim();
    if (!nextPath) {
      throw new Error("Notes folder path is required.");
    }

    const resolved = path.resolve(nextPath);
    ensureDir(resolved);

    const settings = readUserSettings();
    settings.notesRoot = resolved;
    writeUserSettings(settings);

    if (!process.env.NOTES_ROOT) {
      applyNotesRoot(resolved);
    }

    return {
      notesRoot: resolved,
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

  return {
    getActiveProjectSlug,
  };
}

module.exports = { registerCoreIpcHandlers };
