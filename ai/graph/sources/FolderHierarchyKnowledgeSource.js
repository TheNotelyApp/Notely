/**
 * FolderHierarchyKnowledgeSource - Models folder tree as semantic graph structure
 */

const fs = require('fs');
const path = require('path');
const KnowledgeSource = require('./KnowledgeSource');

const DEFAULT_EXCLUDE_DIRS = new Set([
  '.notes-app', '.versions', 'node_modules', '.git', '.svn', '.hg',
  'dist', 'build', '.artifacts', '.cache', '__pycache__', 'removed'
]);

class FolderHierarchyKnowledgeSource extends KnowledgeSource {
  sourceType() {
    return 'folder_hierarchy';
  }

  baseConfidence() {
    return 1.0;
  }

  discover(workspaceRoot) {
    if (!workspaceRoot || !fs.existsSync(workspaceRoot)) return [];
    const folders = [];

    const scan = (dir) => {
      const base = path.basename(dir);
      if (base.startsWith('.') || DEFAULT_EXCLUDE_DIRS.has(base)) return;
      folders.push(dir);

      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            scan(path.join(dir, entry.name));
          }
        }
      } catch { /* ignore directory read error */ }
    };

    scan(workspaceRoot);
    return folders;
  }

  async extractEntities(folderPath) {
    const folderName = path.basename(folderPath);
    return [
      {
        name: folderName,
        type: 'Folder',
        properties: { path: folderPath }
      }
    ];
  }

  async extractRelationships(folderPath) {
    const relationships = [];
    const folderName = path.basename(folderPath);

    try {
      const entries = fs.readdirSync(folderPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (!entry.name.startsWith('.') && !DEFAULT_EXCLUDE_DIRS.has(entry.name)) {
            relationships.push({
              source_name: folderName,
              target_name: entry.name,
              source_type: 'Folder',
              target_type: 'Folder',
              type: 'contains_folder',
              weight: 1.0,
              confidence: 1.0
            });
          }
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          const noteName = path.basename(entry.name, '.md');
          relationships.push({
            source_name: folderName,
            target_name: noteName,
            source_type: 'Folder',
            target_type: 'Note',
            type: 'contains_note',
            weight: 1.0,
            confidence: 1.0
          });
        }
      }
    } catch { /* ignore */ }

    return relationships;
  }
}

module.exports = FolderHierarchyKnowledgeSource;
