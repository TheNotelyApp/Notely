/**
 * WorkspaceApplicationService.cjs
 * Application service for Workspace level statistics, health, and activity monitoring.
 */

const fs = require('fs');
const path = require('path');
const { collectMarkdownFiles } = require('./NoteApplicationService.cjs');

class WorkspaceApplicationService {
  /**
   * Get workspace statistics and health metrics.
   */
  async getStatistics({ workspaceRoot }) {
    if (!workspaceRoot || !fs.existsSync(workspaceRoot)) {
      throw new Error('Invalid workspace root.');
    }

    const files = collectMarkdownFiles(workspaceRoot);
    let totalSizeBytes = 0;
    let totalLinkCount = 0;
    let totalTaskCount = 0;

    for (const filePath of files) {
      try {
        const stat = fs.statSync(filePath);
        totalSizeBytes += stat.size;
        const text = fs.readFileSync(filePath, 'utf8');

        // Count markdown wiki links [[link]] or [text](url)
        const wikiLinks = text.match(/\[\[.+?\]\]/g) || [];
        const mdLinks = text.match(/\[.+?\]\(.+?\)/g) || [];
        totalLinkCount += wikiLinks.length + mdLinks.length;

        // Count checklist tasks
        const tasks = text.match(/^\s*[-*+]?\s*\[[ xX/]\]\s+/gm) || [];
        totalTaskCount += tasks.length;
      } catch {
        // skip
      }
    }

    return {
      workspaceRoot,
      noteCount: files.length,
      storageBytes: totalSizeBytes,
      linkCount: totalLinkCount,
      taskCount: totalTaskCount,
      health: 'healthy'
    };
  }

  /**
   * Get recently modified notes in the workspace.
   */
  async getRecentActivity({ workspaceRoot, limit = 10 }) {
    if (!workspaceRoot || !fs.existsSync(workspaceRoot)) {
      return [];
    }

    const files = collectMarkdownFiles(workspaceRoot);
    const fileStats = [];

    for (const filePath of files) {
      try {
        const stat = fs.statSync(filePath);
        fileStats.push({
          path: filePath,
          title: path.basename(filePath),
          modifiedAt: stat.mtime.toISOString(),
          sizeBytes: stat.size
        });
      } catch {
        // skip
      }
    }

    fileStats.sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));
    return fileStats.slice(0, limit);
  }

  /**
   * Get complete nested folder hierarchy tree with file counts and byte sizes.
   */
  async listTree({ workspaceRoot, maxDepth = 4 }) {
    if (!workspaceRoot || !fs.existsSync(workspaceRoot)) throw new Error('Invalid workspace root.');

    const buildTree = (dirPath, currentDepth = 1) => {
      if (currentDepth > maxDepth) return null;
      const baseName = path.basename(dirPath);
      const node = {
        name: baseName,
        path: dirPath,
        type: 'directory',
        children: []
      };

      try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
          const fullPath = path.join(dirPath, entry.name);
          if (entry.isDirectory()) {
            const childTree = buildTree(fullPath, currentDepth + 1);
            if (childTree) node.children.push(childTree);
          } else if (entry.isFile()) {
            const stat = fs.statSync(fullPath);
            node.children.push({
              name: entry.name,
              path: fullPath,
              type: 'file',
              sizeBytes: stat.size
            });
          }
        }
      } catch { /* skip */ }
      return node;
    };

    return buildTree(workspaceRoot, 1);
  }

  /**
   * Create a new folder directory in the workspace.
   */
  async createFolder({ workspaceRoot, folderPath }) {
    if (!folderPath) throw new Error('folderPath is required.');
    const { assertPathInWorkspace } = require('./NoteApplicationService.cjs');
    const validPath = assertPathInWorkspace(folderPath, workspaceRoot);
    if (!fs.existsSync(validPath)) {
      fs.mkdirSync(validPath, { recursive: true });
    }
    return { path: validPath, created: true };
  }

  /**
   * Delete a folder directory in the workspace.
   */
  async deleteFolder({ workspaceRoot, folderPath, recursive = false }) {
    if (!folderPath) throw new Error('folderPath is required.');
    const { assertPathInWorkspace } = require('./NoteApplicationService.cjs');
    const validPath = assertPathInWorkspace(folderPath, workspaceRoot);
    if (!fs.existsSync(validPath)) throw new Error(`Folder "${folderPath}" does not exist.`);

    fs.rmSync(validPath, { recursive, force: true });
    return { path: validPath, deleted: true };
  }

  /**
   * Export notes and assets into a portable package.
   */
  async exportPackage({ workspaceRoot, notePaths = [], outputFilename = 'export.note' }) {
    if (!workspaceRoot) throw new Error('workspaceRoot is required.');
    const { assertPathInWorkspace, collectMarkdownFiles } = require('./NoteApplicationService.cjs');
    const targets = notePaths.length > 0
      ? notePaths.map(p => assertPathInWorkspace(p, workspaceRoot))
      : collectMarkdownFiles(workspaceRoot);

    const exportManifest = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      workspace: path.basename(workspaceRoot),
      totalNotes: targets.length,
      notes: targets.map(t => path.basename(t))
    };

    const targetFile = assertPathInWorkspace(outputFilename.endsWith('.note') ? outputFilename : `${outputFilename}.note`, workspaceRoot);
    const bundleData = JSON.stringify({ manifest: exportManifest, files: targets.map(t => ({ name: path.basename(t), content: fs.readFileSync(t, 'utf8') })) }, null, 2);

    fs.writeFileSync(targetFile, bundleData, 'utf8');
    return { packagePath: targetFile, totalNotesExported: targets.length, status: 'ready' };
  }

  /**
   * Import a note package bundle into the workspace.
   */
  async importPackage({ workspaceRoot, packagePath }) {
    if (!packagePath) throw new Error('packagePath is required.');
    const { assertPathInWorkspace } = require('./NoteApplicationService.cjs');
    const validPkg = assertPathInWorkspace(packagePath, workspaceRoot);
    if (!fs.existsSync(validPkg)) throw new Error(`Package file at "${packagePath}" does not exist.`);

    const raw = fs.readFileSync(validPkg, 'utf8');
    const bundle = JSON.parse(raw);
    const importedFiles = [];

    if (bundle.files && Array.isArray(bundle.files)) {
      for (const fileObj of bundle.files) {
        const destPath = path.join(workspaceRoot, fileObj.name);
        fs.writeFileSync(destPath, fileObj.content, 'utf8');
        importedFiles.push(destPath);
      }
    }

    return { importedCount: importedFiles.length, files: importedFiles, status: 'imported' };
  }

  /**
   * List all known and recent workspaces.
   */
  async listWorkspaces({ workspaceRoot }) {
    const settingsPath = getUserSettingsPath();
    let recent = [];
    let savedNotesRoot = null;

    if (fs.existsSync(settingsPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        recent = Array.isArray(data.recentWorkspaces) ? data.recentWorkspaces : [];
        savedNotesRoot = data.notesRoot || null;
      } catch { /* ignore */ }
    }

    const current = workspaceRoot || savedNotesRoot || null;
    const seen = new Set();
    const workspaces = [];

    if (current) {
      seen.add(path.resolve(current).toLowerCase());
      workspaces.push({
        path: current,
        name: path.basename(current),
        exists: fs.existsSync(current),
        isCurrent: true
      });
    }

    for (const ws of recent) {
      if (typeof ws !== 'string' || !ws.trim()) continue;
      const resolved = path.resolve(ws.trim());
      const key = resolved.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      workspaces.push({
        path: ws.trim(),
        name: path.basename(resolved),
        exists: fs.existsSync(resolved),
        isCurrent: current ? path.resolve(current).toLowerCase() === key : false
      });
    }

    return {
      currentWorkspace: current,
      totalWorkspaces: workspaces.length,
      workspaces
    };
  }

  /**
   * Get active workspace status, total note counts, git branch, and app details.
   */
  async getCurrentWorkspace({ workspaceRoot }) {
    if (!workspaceRoot) throw new Error('Workspace root is required.');
    const resolvedRoot = path.resolve(workspaceRoot);
    const exists = fs.existsSync(resolvedRoot);
    const vaultName = path.basename(resolvedRoot);
    const files = exists ? collectMarkdownFiles(resolvedRoot) : [];

    let gitBranch = null;
    try {
      const gitDir = path.join(resolvedRoot, '.git');
      if (fs.existsSync(gitDir)) {
        const head = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();
        const m = head.match(/^ref:\s+refs\/heads\/(.+)$/);
        gitBranch = m ? m[1] : head.slice(0, 7);
      }
    } catch { /* ignore */ }

    const configPath = path.join(resolvedRoot, '.notes-app', 'workspace-config.json');
    let config = {};
    if (fs.existsSync(configPath)) {
      try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch { /* ignore */ }
    }

    return {
      workspaceRoot: resolvedRoot,
      vaultName,
      exists,
      totalNotes: files.length,
      gitBranch,
      appVersion: '0.1.41',
      config
    };
  }

  /**
   * Catalog and index all markdown notes with word count, tags, task stats, and frontmatter.
   */
  async getNotesIndex({ workspaceRoot, folder, tag }) {
    if (!workspaceRoot || !fs.existsSync(workspaceRoot)) throw new Error('Invalid workspace root.');
    const { assertPathInWorkspace, toWorkspaceRelative } = require('./NoteApplicationService.cjs');
    const targetDir = folder ? assertPathInWorkspace(folder, workspaceRoot) : path.resolve(workspaceRoot);
    const files = collectMarkdownFiles(targetDir);

    let totalWords = 0;
    let totalTasks = 0;
    let totalCompletedTasks = 0;
    const notes = [];

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const stat = fs.statSync(file);
        const lines = content.split(/\r?\n/);

        const textOnly = content.replace(/```[\s\S]*?```/g, '').replace(/[#*`_~[\]()]/g, ' ');
        const words = textOnly.trim().split(/\s+/).filter(Boolean).length;
        totalWords += words;

        const taskMatches = content.match(/^\s*[-*+]?\s*\[([ xX/])\]\s+/gm) || [];
        const taskCount = taskMatches.length;
        const completedCount = (content.match(/^\s*[-*+]?\s*\[[xX]\]\s+/gm) || []).length;
        totalTasks += taskCount;
        totalCompletedTasks += completedCount;

        let tags = [];
        let hasFrontmatter = false;
        const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        if (fmMatch) {
          hasFrontmatter = true;
          try {
            const yaml = require('js-yaml');
            const meta = yaml.load(fmMatch[1]);
            if (meta?.tags) {
              tags = Array.isArray(meta.tags) ? meta.tags.map(String) : [String(meta.tags)];
            }
          } catch { /* ignore */ }
        }

        const inlineTags = content.match(/(?:^|\s)#[a-zA-Z0-9_\-/]+/g) || [];
        for (const it of inlineTags) {
          const cleanTag = it.trim().replace(/^#/, '');
          if (!tags.includes(cleanTag)) tags.push(cleanTag);
        }

        if (tag && !tags.some(t => t.toLowerCase() === tag.toLowerCase())) {
          continue;
        }

        const h1Match = content.match(/^#\s+(.+)$/m);
        const title = h1Match ? h1Match[1].trim() : path.basename(file, '.md');

        notes.push({
          path: toWorkspaceRelative(file, workspaceRoot),
          title,
          wordCount: words,
          lineCount: lines.length,
          tags,
          taskCount,
          completedTaskCount: completedCount,
          hasFrontmatter,
          modifiedAt: stat.mtime.toISOString(),
          sizeBytes: stat.size
        });
      } catch { /* skip */ }
    }

    return {
      workspaceRoot,
      totalNotes: notes.length,
      totalWords,
      totalTasks,
      totalCompletedTasks,
      notes
    };
  }

  /**
   * Extract index of all media assets actively referenced across notes.
   */
  async getMediaUsedIndex({ workspaceRoot, category }) {
    if (!workspaceRoot || !fs.existsSync(workspaceRoot)) throw new Error('Invalid workspace root.');
    const { toWorkspaceRelative } = require('./NoteApplicationService.cjs');
    const files = collectMarkdownFiles(workspaceRoot);
    const docs = files.map(f => {
      try {
        return {
          filePath: toWorkspaceRelative(f, workspaceRoot),
          title: path.basename(f, '.md'),
          content: fs.readFileSync(f, 'utf8')
        };
      } catch { return null; }
    }).filter(Boolean);

    const { extractWorkspaceUsedAssets, filterAssets } = await import('../../src/services/workspaceMediaService.js');
    let assets = extractWorkspaceUsedAssets(docs);

    if (category) {
      assets = filterAssets(assets, category);
    }

    let brokenCount = 0;
    const enrichedAssets = assets.map(a => {
      let existsOnDisk = false;
      if (a.path) {
        const abs = path.resolve(workspaceRoot, a.path);
        existsOnDisk = fs.existsSync(abs);
      }
      if (!existsOnDisk && a.category !== 'diagram') {
        brokenCount++;
      }
      return {
        ...a,
        existsOnDisk
      };
    });

    return {
      workspaceRoot,
      totalReferencedAssets: enrichedAssets.length,
      brokenReferencesCount: brokenCount,
      assets: enrichedAssets
    };
  }
}

function getUserSettingsPath() {
  try {
    const { app } = require('electron');
    if (app && typeof app.getPath === 'function') {
      return path.join(app.getPath('userData'), 'settings.json');
    }
  } catch { /* not in electron */ }

  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || '', 'Notely', 'settings.json');
  }
  if (process.platform === 'darwin') {
    return path.join(process.env.HOME || '', 'Library', 'Application Support', 'Notely', 'settings.json');
  }
  return path.join(process.env.HOME || '', '.config', 'Notely', 'settings.json');
}

module.exports = {
  WorkspaceApplicationService,
  getUserSettingsPath
};
