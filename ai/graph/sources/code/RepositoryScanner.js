/**
 * RepositoryScanner
 * Handles recursive file discovery within a repository, applying ignore rules.
 */

const fs = require('fs');
const path = require('path');

const IGNORED_DIRECTORIES = new Set([
  'node_modules', 'dist', '__dist', 'dist__', '__dist__', '_dist',
  'build', '__build__', '_build', 'out', '__out__', '_out',
  'assets', 'chunks', 'bundle', 'bundles', 'static',
  'test', 'tests', '__tests__', '__test__', 'spec', 'specs',
  'mocks', '__mocks__', 'fixtures', '__fixtures__',
  'cypress', 'playwright', 'e2e',
  '.git', '.svn', '.hg',
  'vendor', 'bower_components', 'coverage', '.nyc_output',
  '.next', '.nuxt', '.output', '.svelte-kit', '.vite', '.parcel-cache', '.turbo', '.webpack', '.rollup.cache',
  '__pycache__', '.pytest_cache', '.mypy_cache', '.ruff_cache', '.tox',
  '.venv', 'venv', 'env', '.env', 'virtualenv', '.conda',
  'bin', 'obj', 'target', 'pkg',
  '.idea', '.vscode', '.vs', '.settings', '.cache', '.gradle', '.cargo',
  'tmp', '.tmp', 'temp', '.temp', 'logs', '.logs'
]);

const IGNORED_DIR_PATTERNS = [
  /^__.*__$/,
  /.*[-_.]dist.*/i,
  /.*[-_.]build.*/i,
  /.*[-_.]out.*/i,
  /.*[-_.]cache.*/i,
  /.*[-_.]test(s)?$/i,
  /.*[-_.]spec(s)?$/i,
  /^\.egg-info$/,
  /.*\.egg-info$/i
];

const IGNORED_FILE_SUFFIXES = [
  '.min.js', '.min.mjs', '.min.cjs', '.min.css',
  '.bundle.js', '.chunk.js', '.chunk.mjs',
  '.map', '.d.ts.map', '.d.ts',
  // Test and spec file suffixes
  '.test.js', '.test.jsx', '.test.ts', '.test.tsx', '.test.mjs', '.test.cjs',
  '.spec.js', '.spec.jsx', '.spec.ts', '.spec.tsx', '.spec.mjs', '.spec.cjs',
  '.cy.js', '.cy.ts', '.cy.jsx', '.cy.tsx',
  '.stories.jsx', '.stories.tsx', '.stories.js', '.stories.ts',
  '_test.go'
];

const IGNORED_FILE_PATTERNS = [
  /^test_.*\.py$/i,
  /.*_test\.py$/i,
  /\.[a-zA-Z0-9_-]{8,16}\.(js|mjs|cjs|css)$/i
];

const CODE_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.py',
  '.go',
  '.rs',
  '.java',
  '.c', '.cpp', '.h', '.hpp', '.cc', '.cs',
  '.rb', '.php',
  '.vue', '.svelte',
  '.lua', '.kt', '.swift', '.scala', '.sh', '.bash'
]);

const MAX_FILE_SIZE_BYTES = 512 * 1024; // 512 KB

class RepositoryScanner {
  /**
   * @param {object} options
   * @param {Set<string>} [options.ignoredDirs]   - directory names to skip
   * @param {Set<string>} [options.codeExtensions] - file extensions to include
   * @param {number}      [options.maxFiles]       - cap on discovered file count
   * @param {number}      [options.maxDepth]       - max directory traversal depth
   * @param {number}      [options.maxFileSizeBytes]
   */
  constructor(options = {}) {
    this.ignoredDirs = options.ignoredDirs || IGNORED_DIRECTORIES;
    this.codeExtensions = options.codeExtensions || CODE_EXTENSIONS;
    this.maxFiles = options.maxFiles || 1500;
    this.maxDepth = options.maxDepth || 12;
    this.maxFileSizeBytes = options.maxFileSizeBytes || MAX_FILE_SIZE_BYTES;
  }

  /**
   * Returns true if this scanner supports the given file extension.
   * @param {string} filePath
   */
  supports(filePath) {
    if (!filePath || typeof filePath !== 'string') return false;
    const lower = path.basename(filePath).toLowerCase();
    const ext = path.extname(filePath).toLowerCase();
    if (!this.codeExtensions.has(ext)) return false;
    if (IGNORED_FILE_SUFFIXES.some(s => lower.endsWith(s))) return false;
    if (IGNORED_FILE_PATTERNS.some(p => p.test(lower))) return false;
    return true;
  }

  /**
   * Walk a repository root and return absolute paths of all indexable code files.
   * @param {string} repoPath  - absolute path to repository root
   * @returns {string[]}
   */
  scan(repoPath) {
    if (!repoPath || !fs.existsSync(repoPath)) return [];
    const result = [];
    try {
      this._walk(repoPath, result, 0);
    } catch (err) {
      console.warn(`[RepositoryScanner] Failed scanning ${repoPath}:`, err.message);
    }
    return result;
  }

  _walk(dir, result, depth) {
    if (depth > this.maxDepth || result.length >= this.maxFiles) return;

    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (result.length >= this.maxFiles) break;

      const lowerName = entry.name.toLowerCase();

      // Skip hidden dirs (except .github, etc.) and explicitly ignored dirs/patterns
      if (entry.isDirectory()) {
        if (this.ignoredDirs.has(entry.name) || this.ignoredDirs.has(lowerName) || entry.name.startsWith('.')) continue;
        const matchesPattern = IGNORED_DIR_PATTERNS.some(p => p.test(lowerName));
        if (matchesPattern) continue;

        this._walk(path.join(dir, entry.name), result, depth + 1);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (!this.codeExtensions.has(ext)) continue;
        if (IGNORED_FILE_SUFFIXES.some(s => lowerName.endsWith(s))) continue;
        if (IGNORED_FILE_PATTERNS.some(p => p.test(lowerName))) continue;

        const fullPath = path.join(dir, entry.name);
        try {
          if (fs.statSync(fullPath).size <= this.maxFileSizeBytes) {
            result.push(fullPath);
          }
        } catch { /* skip inaccessible */ }
      }
    }
  }
}

module.exports = { RepositoryScanner, IGNORED_DIRECTORIES, CODE_EXTENSIONS };
