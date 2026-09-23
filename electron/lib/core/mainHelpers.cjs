const { shouldHideDirectory } = require("./folderPolicy.cjs");

function createMainHelpers(deps) {
  const {
    fs,
    path,
    process,
    app,
    projectRoot,
    userConfigPath,
    ensureDir,
    hashContent,
    rootProjectSlug,
    getNotesRoot,
    getActiveProjectSlug,
    setActiveProjectSlug,
  } = deps;

  function readUserSettings() {
    if (!fs.existsSync(userConfigPath)) {
      return {};
    }

    try {
      return JSON.parse(fs.readFileSync(userConfigPath, "utf8"));
    } catch {
      return {};
    }
  }

  function normalizeStoredWorkspacePath(rawPath) {
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

  function writeUserSettings(nextSettings) {
    ensureDir(path.dirname(userConfigPath));
    fs.writeFileSync(userConfigPath, JSON.stringify(nextSettings, null, 2), "utf8");
  }



  function resolveInitialNotesRoot() {
    const envNotesRoot = process.env.NOTES_ROOT;
    if (envNotesRoot && envNotesRoot.trim()) {
      const sanitizedEnvPath = normalizeStoredWorkspacePath(envNotesRoot);
      if (sanitizedEnvPath) {
        return sanitizedEnvPath;
      }
    }

    const settings = readUserSettings();
    if (settings?.notesRoot && typeof settings.notesRoot === "string") {
      const sanitizedNotesRoot = normalizeStoredWorkspacePath(settings.notesRoot);
      const sanitizedRecentWorkspaces = Array.isArray(settings?.recentWorkspaces)
        ? settings.recentWorkspaces.map((entry) => normalizeStoredWorkspacePath(entry)).filter(Boolean)
        : [];

      if (sanitizedNotesRoot || sanitizedRecentWorkspaces.length > 0) {
        const nextSettings = { ...settings };
        if (sanitizedNotesRoot) {
          nextSettings.notesRoot = sanitizedNotesRoot;
        }
        if (sanitizedRecentWorkspaces.length > 0) {
          nextSettings.recentWorkspaces = sanitizedRecentWorkspaces;
        } else {
          delete nextSettings.recentWorkspaces;
        }
        if (nextSettings.notesRoot !== settings.notesRoot || JSON.stringify(nextSettings.recentWorkspaces || []) !== JSON.stringify(settings.recentWorkspaces || [])) {
          writeUserSettings(nextSettings);
        }
      }

      if (sanitizedNotesRoot) {
        return sanitizedNotesRoot;
      }
    }

    return path.join(app.getPath("documents"), "Notely Notes");
  }

  function readP2PStatusSnapshot() {
    const harnessRoot = path.join(projectRoot, ".artifacts", "p2p-harness");
    const summaryPath = path.join(harnessRoot, "summary.json");

    if (!fs.existsSync(summaryPath)) {
      return {
        available: false,
        source: summaryPath,
        generatedAt: null,
        sessionId: null,
        workspaceId: null,
        peerCount: 0,
        trustedLinkCount: 0,
        workspaceKeyCount: 0,
        peers: []
      };
    }

    let summary;
    try {
      summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
    } catch {
      return {
        available: false,
        source: summaryPath,
        generatedAt: null,
        sessionId: null,
        workspaceId: null,
        peerCount: 0,
        trustedLinkCount: 0,
        workspaceKeyCount: 0,
        peers: []
      };
    }

    const peers = Array.isArray(summary?.peers)
      ? summary.peers
        .filter((peer) => peer && typeof peer === "object")
        .map((peer) => ({
          name: String(peer.name || "Unknown peer"),
          peerId: String(peer.peerId || ""),
          trustedPeerCount: Array.isArray(peer.trustedPeers) ? peer.trustedPeers.length : 0,
          workspaceKeyCount: Array.isArray(peer.workspaceKeys) ? peer.workspaceKeys.length : 0,
          inboxCount: Number.isFinite(peer.inboxCount) ? peer.inboxCount : 0
        }))
      : [];

    const trustedLinkCount = peers.reduce((total, peer) => total + peer.trustedPeerCount, 0);
    const workspaceKeyCount = peers.reduce((total, peer) => total + peer.workspaceKeyCount, 0);

    return {
      available: true,
      source: summaryPath,
      generatedAt: summary?.generatedAt || null,
      sessionId: summary?.sessionId || null,
      workspaceId: summary?.workspaceId || null,
      peerCount: peers.length,
      trustedLinkCount,
      workspaceKeyCount,
      peers
    };
  }

    function getSubfoldersForPath(targetDir) {
      if (!targetDir || !fs.existsSync(targetDir)) return [];
      const result = [];
      const walk = (dir, prefix = "") => {
        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory() && !shouldHideDirectory(entry.name)) {
              const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
              result.push({ name: entry.name, relativePath: rel });
              if (rel.split("/").length < 3) {
                walk(path.join(dir, entry.name), rel);
              }
            }
          }
        } catch {
          // ignore
        }
      };
      walk(targetDir);
      return result;
    }

    function listProjectsState() {
    const notesRoot = getNotesRoot();
    ensureDir(notesRoot);
    const projects = [
      {
        slug: rootProjectSlug,
        name: "Root",
        rootPath: notesRoot,
        isRoot: true
      },
      ...fs.readdirSync(notesRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .filter((entry) => !shouldHideDirectory(entry.name))
        .map((entry) => ({
          slug: entry.name,
          name: entry.name,
          rootPath: path.join(notesRoot, entry.name),
          isRoot: false
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
    ];

    const activeProjectSlug = getActiveProjectSlug();
    if (!projects.some((item) => item.slug === activeProjectSlug)) {
      setActiveProjectSlug(rootProjectSlug);
    }

    const finalActiveProjectSlug = projects.some((item) => item.slug === activeProjectSlug)
      ? activeProjectSlug
      : rootProjectSlug;

    const activeProject = projects.find((item) => item.slug === finalActiveProjectSlug)
      || projects[0]
      || {
        slug: rootProjectSlug,
        name: "Root",
        rootPath: notesRoot,
        isRoot: true
      };

    return {
      projects: projects.map((item) => ({
        slug: item.slug,
        name: item.name,
        rootPath: item.rootPath,
        isRoot: Boolean(item.isRoot),
        subfolders: getSubfoldersForPath(item.rootPath)
      })),
      activeProject: {
        slug: activeProject.slug,
        name: activeProject.name,
        rootPath: activeProject.rootPath,
        isRoot: Boolean(activeProject.isRoot),
        subfolders: getSubfoldersForPath(activeProject.rootPath)
      }
    };
  }

  function getActiveProject() {
    const state = listProjectsState();
    return state.activeProject;
  }

  function parseDocument(content, filePath) {
    let normalized = (content || "").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
    const lines = normalized.split("\n");
    let yamlLines = [];
    let kvLines = [];
    let contentStartIndex = 0;

    let i = 0;
    while (i < lines.length && !lines[i].trim()) i++;

    if (i < lines.length && /^\s*---\s*$/.test(lines[i])) {
      yamlLines.push(lines[i]);
      i++;
      while (i < lines.length) {
        yamlLines.push(lines[i]);
        if (/^\s*(---\s*|\.\.\.\s*)$/.test(lines[i])) {
          i++;
          break;
        }
        i++;
      }
    }

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();
      if (!trimmed) {
        let nextIsKv = false;
        for (let j = i + 1; j < lines.length; j++) {
          if (!lines[j].trim()) continue;
          if (/^\s*[a-zA-Z0-9_\-\s]+:\s*.*$/.test(lines[j]) && !lines[j].trim().startsWith("#")) {
            nextIsKv = true;
          }
          break;
        }
        if (!nextIsKv) {
          contentStartIndex = i + 1;
          break;
        }
        i++;
        continue;
      }

      if (trimmed.startsWith("#")) {
        contentStartIndex = i;
        break;
      }

      if (/^\s*[a-zA-Z0-9_\-\s]+:\s*.*$/.test(line) || /^\s*-\s+.*$/.test(line) || /^\s{2,}.*$/.test(line)) {
        kvLines.push(line);
        i++;
        contentStartIndex = i;
      } else {
        contentStartIndex = i;
        break;
      }
    }

    const yamlPart = yamlLines.join("\n").trim();
    const kvPart = kvLines.join("\n").trim();
    let header = "";
    if (yamlPart && kvPart) header = yamlPart + "\n" + kvPart;
    else if (yamlPart) header = yamlPart;
    else if (kvPart) header = kvPart;

    const rawNotes = lines.slice(contentStartIndex).join("\n").trim();

    if (!header && filePath) {
      try {
        const workspaceDir = path.dirname(filePath);
        let curr = workspaceDir;
        let sidecarPath = null;
        for (let depth = 0; depth < 5; depth++) {
          const candidate = path.join(curr, ".notes-app", "note-metadata.json");
          if (fs.existsSync(candidate)) {
            sidecarPath = candidate;
            break;
          }
          const parent = path.dirname(curr);
          if (parent === curr) break;
          curr = parent;
        }
        if (sidecarPath) {
          const wsRoot = path.dirname(path.dirname(sidecarPath));
          const relKey = path.relative(wsRoot, filePath).replace(/\\/g, "/");
          const sidecarData = JSON.parse(fs.readFileSync(sidecarPath, "utf8"));
          if (sidecarData[relKey]?.header) {
            header = sidecarData[relKey].header;
          }
        }
      } catch {
        // Best effort sidecar lookup
      }
    }

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
      rawNotes,
      cleansed: "",
      hasRawNotes: Boolean(rawNotes),
      hasCleansed: false,
      hash: hashContent(content)
    };
  }

  function buildDocumentContent(document) {
    const header = (document.header || "").trim();
    const rawNotes = (document.rawNotes || "").trim();
    const cleansed = (document.cleansed || "").trim();
    const parts = [];
    if (header) parts.push(header);
    if (rawNotes) parts.push(rawNotes);
    if (cleansed) parts.push(cleansed);
    return parts.join("\n\n") + "\n";
  }

  return {
    readUserSettings,
    writeUserSettings,
    resolveInitialNotesRoot,
    readP2PStatusSnapshot,
    listProjectsState,
    getSubfoldersForPath,
    getActiveProject,
    parseDocument,
    buildDocumentContent,
  };
}

module.exports = { createMainHelpers };
