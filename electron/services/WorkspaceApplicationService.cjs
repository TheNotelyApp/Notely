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
}

module.exports = {
  WorkspaceApplicationService
};
