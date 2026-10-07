/**
 * workspaceIgnorePolicy.cjs
 * Single Source of Truth for workspace file and directory ignore rules across Notely.
 * Used by File Tree, Knowledge Graph, Semantic Embeddings, Document Extractions,
 * Task Database, MCP Tool Suite, and External AI IDE Bridge.
 */

const path = require('path');

// 1. Directories that are always excluded from note trees, indexing, and scans
const RESERVED_WORKSPACE_DIRS = new Set([
  // Hidden system & IDE folders
  '.git',
  '.svn',
  '.hg',
  '.notes-app',
  '.note-app',
  '.vscode',
  '.github',
  '.cursor',
  '.agents',
  '.artifacts',
  '.cache',
  '.versions',
  '.codegraph',
  '.vitepress',
  '.venv',
  '.next',
  '.nuxt',

  // Build, output, and dependency directories
  'node_modules',
  'dist',
  'build',
  'out',
  'coverage',
  'chunks',
  'bundle',
  'static',
  'scratch',
  'docs-site-dist',
  '__pycache__',
  'venv',

  // Test directories
  'test',
  'tests',
  '__tests__',
  '__test__',
  'spec',
  'specs',
  'fixtures',
  'mocks',
  'cypress',
  'playwright',
  'e2e',

  // App-internal asset storage (not user notes)
  'images',
  'removed',
  'excali-diagrams',
  'media'
]);

// 2. Individual files that are always excluded from user note trees, graph, and task indexing
const RESERVED_WORKSPACE_FILES = new Set([
  // AI Bridge & Agent instructions root files
  'agents.md',
  'claude.md',
  'copilot.md',
  'gemini.md',
  'ai_instructions.md',

  // Hidden config & system files
  '.cursorrules',
  '.gitignore',
  '.gitattributes',
  '.npmrc',
  '.env',
  '.ds_store',
  'thumbs.db'
]);

/**
 * Checks if a folder name should be ignored/hidden from workspace note scans.
 * @param {string} dirName
 * @returns {boolean}
 */
function shouldHideDirectory(dirName) {
  if (!dirName || typeof dirName !== 'string') return true;
  const trimmed = dirName.trim();
  if (trimmed === '.' || trimmed === '..') return false;
  const lower = trimmed.toLowerCase();
  return (
    lower.startsWith('.') ||
    RESERVED_WORKSPACE_DIRS.has(lower)
  );
}

/**
 * Checks if a file name or path should be ignored/hidden from workspace note scans.
 * @param {string} fileName
 * @param {string} [filePath]
 * @returns {boolean}
 */
function shouldHideFile(fileName, filePath = '') {
  if (!fileName || typeof fileName !== 'string') return true;
  const lower = fileName.trim().toLowerCase();
  
  if (lower.startsWith('.')) return true;
  if (RESERVED_WORKSPACE_FILES.has(lower)) return true;
  if (/\.(test|spec)\.md$/i.test(lower)) return true;

  if (filePath && typeof filePath === 'string') {
    const normalized = filePath.replace(/\\/g, '/');
    if (
      normalized.includes('/.notes-app/') ||
      normalized.includes('/.git/') ||
      normalized.includes('/.vscode/') ||
      normalized.includes('/.github/') ||
      normalized.includes('/.cursor/') ||
      normalized.includes('/.agents/') ||
      normalized.includes('/node_modules/')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Comprehensive path validator checking all parent directory segments and filename.
 * @param {string} targetPath - Absolute or relative file/directory path
 * @param {string} [workspaceRoot] - Optional workspace root for relative resolution
 * @returns {boolean}
 */
function isWorkspaceIgnoredPath(targetPath, workspaceRoot = '') {
  if (!targetPath || typeof targetPath !== 'string') return true;

  const resolvedTarget = path.resolve(targetPath);
  const fileName = path.basename(resolvedTarget);

  let rel = resolvedTarget;
  if (workspaceRoot && typeof workspaceRoot === 'string') {
    const resolvedRoot = path.resolve(workspaceRoot);
    rel = path.relative(resolvedRoot, resolvedTarget);
  }

  const normalized = rel.replace(/\\/g, '/');
  const segments = normalized.split('/').filter(s => s && s !== '.' && s !== '..');

  for (let i = 0; i < segments.length; i++) {
    if (shouldHideDirectory(segments[i])) return true;
  }

  if (shouldHideFile(fileName, resolvedTarget)) return true;

  return false;
}

module.exports = {
  RESERVED_WORKSPACE_DIRS,
  RESERVED_WORKSPACE_FILES,
  DEFAULT_WALK_EXCLUDE_DIRS: RESERVED_WORKSPACE_DIRS,
  IGNORED_DIRS: RESERVED_WORKSPACE_DIRS,
  shouldHideDirectory,
  shouldHideFile,
  isWorkspaceIgnoredPath,
  isIgnoredPath: isWorkspaceIgnoredPath,
  isIgnoredDirectory: shouldHideDirectory,
  isIgnoredFile: shouldHideFile
};
