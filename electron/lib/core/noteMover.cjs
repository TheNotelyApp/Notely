const fs = require("fs");
const path = require("path");

function ensureDirSync(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Parses embedded local asset paths (excalidraw, drawio, media images) from Markdown content.
 * Returns array of relative asset paths found in the note.
 */
function extractLocalAssetPaths(content) {
  if (!content) return [];
  const text = String(content).replace(/\\/g, "/");
  const assets = new Set();

  // Matches .notes-app/... or media/... with optional ./ ../ or / prefixes
  const assetRegex = /(?:(?:\.\.\/|\.\/|\/)*)(?:\.notes-app|media)\/[^\s")}\]>]+/gi;
  let match;
  while ((match = assetRegex.exec(text))) {
    const raw = match[0].trim();
    const cleanPath = raw.replace(/^(?:\.\.\/|\.\/|\/)+/, "");
    if (cleanPath) {
      assets.add(cleanPath);
    }
  }

  return Array.from(assets);
}

/**
 * Transfers (Copies or Moves) a Markdown document and its local assets
 * from its source workspace to a destination workspace.
 */
function transferDocumentWorkspace(deps, payload) {
  const { getNotesRoot, listProjectsState } = deps;
  const {
    filePath,
    targetWorkspaceSlug,
    targetSubfolder = "",
    action = "copy", // "copy" | "move"
    overwrite = false,
  } = payload || {};

  if (!filePath || typeof filePath !== "string") {
    throw new Error("Invalid file path provided.");
  }

  const normalizedSourcePath = path.resolve(filePath);
  if (!fs.existsSync(normalizedSourcePath)) {
    throw new Error(`Source note does not exist at path: ${filePath}`);
  }

  const projectsState = typeof listProjectsState === "function" ? listProjectsState() : { projects: [] };
  const projects = projectsState?.projects || [];

  // Resolve target workspace root
  let targetWorkspaceRoot = "";
  const targetProject = projects.find((p) => p.slug === targetWorkspaceSlug);

  if (targetWorkspaceSlug && typeof targetWorkspaceSlug === "string" && targetWorkspaceSlug.startsWith("recent:")) {
    const rawPath = decodeURIComponent(targetWorkspaceSlug.slice(7));
    if (rawPath && fs.existsSync(rawPath)) {
      targetWorkspaceRoot = path.resolve(rawPath);
    }
  }

  if (!targetWorkspaceRoot) {
    if (targetProject && targetProject.rootPath) {
      targetWorkspaceRoot = targetProject.rootPath;
    } else if (targetWorkspaceSlug && typeof targetWorkspaceSlug === "string" && fs.existsSync(targetWorkspaceSlug)) {
      targetWorkspaceRoot = path.resolve(targetWorkspaceSlug);
    } else if (targetWorkspaceSlug === "root" || !targetWorkspaceSlug) {
      targetWorkspaceRoot = getNotesRoot();
    } else {
      // If slug matches a directory directly under notes root
      targetWorkspaceRoot = path.join(getNotesRoot(), targetWorkspaceSlug);
    }
  }

  // Resolve target folder path (including optional subfolder inside target workspace)
  let targetFolder = targetWorkspaceRoot;
  if (targetSubfolder && typeof targetSubfolder === "string") {
    const cleanSub = targetSubfolder.trim().replace(/^[\\/]+/, "");
    if (cleanSub) {
      targetFolder = path.join(targetWorkspaceRoot, cleanSub);
    }
  }

  ensureDirSync(targetFolder);

  const fileName = path.basename(normalizedSourcePath);
  const fileExt = path.extname(fileName);
  const baseNameWithoutExt = path.basename(fileName, fileExt);

  // Source workspace root determination
  let sourceWorkspaceRoot = getNotesRoot();
  const normSourceLower = normalizedSourcePath.toLowerCase();
  for (const proj of projects) {
    if (proj.rootPath && normSourceLower.startsWith(proj.rootPath.toLowerCase()) && proj.rootPath !== getNotesRoot()) {
      sourceWorkspaceRoot = proj.rootPath;
      break;
    }
  }

  // Resolve target file path & collision handling
  let targetFilePath = path.join(targetFolder, fileName);
  if (fs.existsSync(targetFilePath) && !overwrite) {
    if (normalizedSourcePath.toLowerCase() === targetFilePath.toLowerCase() && action === "move") {
      throw new Error("Note is already in the target workspace.");
    }
    // Auto-rename with index
    let counter = 1;
    const suffix = action === "copy" ? " Copy" : "";
    while (fs.existsSync(targetFilePath)) {
      const candidateName = `${baseNameWithoutExt}${suffix} (${counter})${fileExt}`;
      targetFilePath = path.join(targetFolder, candidateName);
      counter++;
    }
  }

  // Read note content & detect assets
  let noteContent = fs.readFileSync(normalizedSourcePath, "utf8");
  const assetRelativePaths = extractLocalAssetPaths(noteContent);
  let transferredAssetsCount = 0;

  // Transfer assets safely
  for (const relAssetPath of assetRelativePaths) {
    const sourceAssetPath = path.join(sourceWorkspaceRoot, relAssetPath);
    const targetAssetPath = path.join(targetWorkspaceRoot, relAssetPath);

    if (fs.existsSync(sourceAssetPath)) {
      ensureDirSync(path.dirname(targetAssetPath));
      try {
        fs.copyFileSync(sourceAssetPath, targetAssetPath);
        transferredAssetsCount++;
      } catch (err) {
        console.warn(`[noteMover] Failed to copy asset ${relAssetPath}:`, err?.message);
      }
    }

    // Rewrite relative asset reference in noteContent if target note directory depth differs
    const absoluteTargetAsset = path.resolve(targetWorkspaceRoot, relAssetPath);
    const targetNoteDir = path.dirname(targetFilePath);
    let newRelativeAssetPath = path.relative(targetNoteDir, absoluteTargetAsset).replace(/\\/g, "/");
    if (!newRelativeAssetPath.startsWith(".")) {
      newRelativeAssetPath = `./${newRelativeAssetPath}`;
    }

    if (relAssetPath !== newRelativeAssetPath) {
      noteContent = noteContent.split(relAssetPath).join(newRelativeAssetPath);
    }
  }

  // Transfer main Markdown file
  fs.writeFileSync(targetFilePath, noteContent, "utf8");
  if (action === "move" && normalizedSourcePath !== targetFilePath) {
    try {
      fs.unlinkSync(normalizedSourcePath);
    } catch {
      // Ignore if unlinking fails
    }
  }

  const finalFileName = path.basename(targetFilePath);

  return {
    success: true,
    action,
    sourceFilePath: normalizedSourcePath,
    targetFilePath,
    targetWorkspaceSlug,
    targetWorkspaceName: targetProject?.name || targetWorkspaceSlug,
    fileName: finalFileName,
    transferredAssetsCount,
  };
}

module.exports = {
  extractLocalAssetPaths,
  transferDocumentWorkspace,
};
