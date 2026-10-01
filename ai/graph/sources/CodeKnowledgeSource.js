const fs = require('fs');
const path = require('path');
const KnowledgeSource = require('./KnowledgeSource');

// Supported extensions
const CODE_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.py',
  '.go',
  '.rs',
  '.java',
  '.c', '.cpp', '.h', '.hpp', '.cs',
  '.rb', '.php',
  '.vue', '.svelte'
]);

const IGNORED_DIRECTORIES = new Set([
  'node_modules', 'dist', 'build', '.git', '.svn', '.hg',
  'vendor', 'coverage', '.next', '.nuxt', '.output',
  '__pycache__', '.pytest_cache', '.venv', 'venv', 'env',
  'bin', 'obj', 'target', '.idea', '.vscode'
]);

class CodeKnowledgeSource extends KnowledgeSource {
  constructor(attachedRepos = []) {
    super();
    this.attachedRepos = Array.isArray(attachedRepos) ? attachedRepos : [];
  }

  sourceType() {
    return 'code';
  }

  baseConfidence() {
    return 0.95;
  }

  supports(filePath) {
    if (!filePath || typeof filePath !== 'string') return false;
    const ext = path.extname(filePath).toLowerCase();
    return CODE_EXTENSIONS.has(ext);
  }

  /**
   * Discovers code files from all attached repositories.
   */
  discover(workspaceRoot) {
    const discovered = [];

    // Also check if workspaceRoot itself has code or if attachedRepos are configured
    let repos = [...this.attachedRepos];

    // Attempt to load attached repos from workspace metadata if not pre-provided
    if (repos.length === 0 && workspaceRoot) {
      try {
        const metaPath = path.join(workspaceRoot, '.notes-app', 'metadata.json');
        if (fs.existsSync(metaPath)) {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
          if (Array.isArray(meta.attachedRepos)) {
            repos = meta.attachedRepos;
          }
        }
      } catch { /* ignore */ }
    }

    for (const repo of repos) {
      if (!repo || !repo.path || !fs.existsSync(repo.path)) continue;
      try {
        this._walkRepo(repo.path, repo, discovered, 0, 1500);
      } catch (err) {
        console.warn(`[CodeKnowledgeSource] Failed walking repo ${repo.name || repo.path}:`, err.message);
      }
    }

    return discovered;
  }

  _walkRepo(dir, repo, result, depth = 0, maxFiles = 1500) {
    if (depth > 12 || result.length >= maxFiles) return;
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (result.length >= maxFiles) break;
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name) && !entry.name.startsWith('.')) {
          this._walkRepo(fullPath, repo, result, depth + 1, maxFiles);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (CODE_EXTENSIONS.has(ext)) {
          // Check file size (skip minified / huge files > 512KB)
          try {
            const stat = fs.statSync(fullPath);
            if (stat.size < 512 * 1024) {
              result.push(fullPath);
            }
          } catch { /* ignore */ }
        }
      }
    }
  }

  /**
   * Find matching repo for a file path
   */
  _getRepoForFile(filePath) {
    const normalized = path.resolve(filePath);
    for (const repo of this.attachedRepos) {
      if (repo && repo.path && normalized.startsWith(path.resolve(repo.path))) {
        return repo;
      }
    }
    return { name: 'Repository', id: 'repo-unknown' };
  }

  /**
   * Extract code entities (Classes, Functions, Routes, Models, Modules)
   */
  async extractEntities(filePath, content = null) {
    const entities = [];
    let fileContent = content;
    if (fileContent === null && fs.existsSync(filePath)) {
      try {
        fileContent = fs.readFileSync(filePath, 'utf8');
      } catch {
        return entities;
      }
    }
    if (!fileContent) return entities;

    const repo = this._getRepoForFile(filePath);
    const repoPrefix = repo.name || 'code';
    const relPath = repo.path ? path.relative(repo.path, filePath).replace(/\\/g, '/') : path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();

    // 1. File / Module Entity
    entities.push({
      name: `${repoPrefix}/${relPath}`,
      canonical_name: `${repoPrefix}/${relPath}`,
      type: 'CodeModule',
      properties: {
        repoId: repo.id,
        repoName: repoPrefix,
        filePath: relPath,
        absolutePath: filePath,
        language: ext.replace('.', ''),
        lines: fileContent.split('\n').length
      }
    });

    const lines = fileContent.split('\n');

    // 2. JS / TS Parsing
    if (['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'].includes(ext)) {
      this._extractJsTsEntities(lines, repoPrefix, relPath, filePath, entities);
    } 
    // 3. Python Parsing
    else if (ext === '.py') {
      this._extractPythonEntities(lines, repoPrefix, relPath, filePath, entities);
    }
    // 4. Generic (Go, Rust, etc.)
    else {
      this._extractGenericEntities(lines, repoPrefix, relPath, filePath, ext, entities);
    }

    return entities;
  }

  _extractJsTsEntities(lines, repoPrefix, relPath, filePath, entities) {
    const classRegex = /(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z0-9_$]+)(?:\s+extends\s+([A-Za-z0-9_$]+))?/g;
    const interfaceRegex = /(?:export\s+)?interface\s+([A-Za-z0-9_$]+)/g;
    const funcRegex = /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/g;
    const constFuncRegex = /(?:export\s+)?const\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z0-9_$]+)\s*=>/g;
    const routeRegex = /(?:app|router|server)\.(get|post|put|delete|patch|options|use)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
    const modelRegex = /(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:mongoose\.model|new\s+Schema|model)\s*\(/g;

    lines.forEach((lineText, index) => {
      const lineNum = index + 1;
      const trimmed = lineText.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;

      // Classes
      let match;
      classRegex.lastIndex = 0;
      while ((match = classRegex.exec(lineText)) !== null) {
        const className = match[1];
        entities.push({
          name: className,
          canonical_name: `${repoPrefix}::${className}`,
          type: 'CodeClass',
          properties: {
            filePath: relPath,
            absolutePath: filePath,
            line: lineNum,
            extends: match[2] || null,
            kind: 'class'
          }
        });
      }

      // Interfaces
      interfaceRegex.lastIndex = 0;
      while ((match = interfaceRegex.exec(lineText)) !== null) {
        const ifaceName = match[1];
        entities.push({
          name: ifaceName,
          canonical_name: `${repoPrefix}::${ifaceName}`,
          type: 'CodeInterface',
          properties: {
            filePath: relPath,
            absolutePath: filePath,
            line: lineNum,
            kind: 'interface'
          }
        });
      }

      // Functions
      funcRegex.lastIndex = 0;
      while ((match = funcRegex.exec(lineText)) !== null) {
        const funcName = match[1];
        entities.push({
          name: `${funcName}()`,
          canonical_name: `${repoPrefix}::${relPath}::${funcName}`,
          type: 'CodeFunction',
          properties: {
            filePath: relPath,
            absolutePath: filePath,
            line: lineNum,
            symbol: funcName,
            kind: 'function'
          }
        });
      }

      // Const Arrow Functions
      constFuncRegex.lastIndex = 0;
      while ((match = constFuncRegex.exec(lineText)) !== null) {
        const funcName = match[1];
        entities.push({
          name: `${funcName}()`,
          canonical_name: `${repoPrefix}::${relPath}::${funcName}`,
          type: 'CodeFunction',
          properties: {
            filePath: relPath,
            absolutePath: filePath,
            line: lineNum,
            symbol: funcName,
            kind: 'arrow_function'
          }
        });
      }

      // API Endpoints
      routeRegex.lastIndex = 0;
      while ((match = routeRegex.exec(lineText)) !== null) {
        const method = match[1].toUpperCase();
        const routePath = match[2];
        entities.push({
          name: `${method} ${routePath}`,
          canonical_name: `${method} ${routePath}`,
          type: 'APIEndpoint',
          properties: {
            method,
            route: routePath,
            filePath: relPath,
            line: lineNum
          }
        });
      }

      // Models
      modelRegex.lastIndex = 0;
      while ((match = modelRegex.exec(lineText)) !== null) {
        const modelName = match[1];
        entities.push({
          name: modelName,
          canonical_name: `${repoPrefix}::model::${modelName}`,
          type: 'DBModel',
          properties: {
            filePath: relPath,
            line: lineNum,
            kind: 'schema_model'
          }
        });
      }
    });
  }

  _extractPythonEntities(lines, repoPrefix, relPath, filePath, entities) {
    const classRegex = /^class\s+([A-Za-z0-9_$]+)(?:\(([^)]+)\))?:/g;
    const defRegex = /^(?:\s+)?def\s+([A-Za-z0-9_$]+)\s*\(/g;
    const routeRegex = /@(?:app|router|api)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g;

    lines.forEach((lineText, index) => {
      const lineNum = index + 1;
      const trimmed = lineText.trim();
      if (trimmed.startsWith('#')) return;

      let match;
      classRegex.lastIndex = 0;
      while ((match = classRegex.exec(trimmed)) !== null) {
        const className = match[1];
        entities.push({
          name: className,
          canonical_name: `${repoPrefix}::${className}`,
          type: 'CodeClass',
          properties: {
            filePath: relPath,
            absolutePath: filePath,
            line: lineNum,
            baseClass: match[2] || null
          }
        });
      }

      defRegex.lastIndex = 0;
      while ((match = defRegex.exec(trimmed)) !== null) {
        const funcName = match[1];
        if (!funcName.startsWith('__')) {
          entities.push({
            name: `${funcName}()`,
            canonical_name: `${repoPrefix}::${relPath}::${funcName}`,
            type: 'CodeFunction',
            properties: {
              filePath: relPath,
              absolutePath: filePath,
              line: lineNum,
              symbol: funcName
            }
          });
        }
      }

      routeRegex.lastIndex = 0;
      while ((match = routeRegex.exec(trimmed)) !== null) {
        const method = match[1].toUpperCase();
        const routePath = match[2];
        entities.push({
          name: `${method} ${routePath}`,
          canonical_name: `${method} ${routePath}`,
          type: 'APIEndpoint',
          properties: {
            method,
            route: routePath,
            filePath: relPath,
            line: lineNum
          }
        });
      }
    });
  }

  _extractGenericEntities(lines, repoPrefix, relPath, filePath, ext, entities) {
    const goFuncRegex = /^func\s+(?:\([^)]+\)\s+)?([A-Za-z0-9_$]+)\s*\(/g;
    const goStructRegex = /^type\s+([A-Za-z0-9_$]+)\s+struct/g;
    const rustFnRegex = /^pub\s+fn\s+([A-Za-z0-9_$]+)\s*\(/g;
    const rustStructRegex = /^pub\s+struct\s+([A-Za-z0-9_$]+)/g;

    lines.forEach((lineText, index) => {
      const lineNum = index + 1;
      const trimmed = lineText.trim();
      let match;

      if (ext === '.go') {
        goFuncRegex.lastIndex = 0;
        if ((match = goFuncRegex.exec(trimmed)) !== null) {
          entities.push({
            name: `${match[1]}()`,
            canonical_name: `${repoPrefix}::${relPath}::${match[1]}`,
            type: 'CodeFunction',
            properties: { filePath: relPath, line: lineNum, symbol: match[1] }
          });
        }
        goStructRegex.lastIndex = 0;
        if ((match = goStructRegex.exec(trimmed)) !== null) {
          entities.push({
            name: match[1],
            canonical_name: `${repoPrefix}::${match[1]}`,
            type: 'CodeClass',
            properties: { filePath: relPath, line: lineNum }
          });
        }
      } else if (ext === '.rs') {
        rustFnRegex.lastIndex = 0;
        if ((match = rustFnRegex.exec(trimmed)) !== null) {
          entities.push({
            name: `${match[1]}()`,
            canonical_name: `${repoPrefix}::${relPath}::${match[1]}`,
            type: 'CodeFunction',
            properties: { filePath: relPath, line: lineNum, symbol: match[1] }
          });
        }
        rustStructRegex.lastIndex = 0;
        if ((match = rustStructRegex.exec(trimmed)) !== null) {
          entities.push({
            name: match[1],
            canonical_name: `${repoPrefix}::${match[1]}`,
            type: 'CodeClass',
            properties: { filePath: relPath, line: lineNum }
          });
        }
      }
    });
  }

  /**
   * Extract relationships (CONTAINS, IMPORTS)
   */
  async extractRelationships(filePath, content = null) {
    const relationships = [];
    let fileContent = content;
    if (fileContent === null && fs.existsSync(filePath)) {
      try {
        fileContent = fs.readFileSync(filePath, 'utf8');
      } catch {
        return relationships;
      }
    }
    if (!fileContent) return relationships;

    const repo = this._getRepoForFile(filePath);
    const repoPrefix = repo.name || 'code';
    const relPath = repo.path ? path.relative(repo.path, filePath).replace(/\\/g, '/') : path.basename(filePath);
    const moduleName = `${repoPrefix}/${relPath}`;

    // 1. Repo -> Module CONTAINS
    relationships.push({
      source_name: repoPrefix,
      source_type: 'Repo',
      target_name: moduleName,
      target_type: 'CodeModule',
      type: 'CONTAINS',
      weight: 1.0,
      confidence: 1.0
    });

    // 2. Extract Import relationships
    const importRegex = /(?:import\s+.*?from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))/g;
    let match;
    while ((match = importRegex.exec(fileContent)) !== null) {
      const targetImport = match[1] || match[2];
      if (targetImport && (targetImport.startsWith('.') || targetImport.startsWith('/'))) {
        relationships.push({
          source_name: moduleName,
          source_type: 'CodeModule',
          target_name: targetImport,
          target_type: 'CodeModule',
          type: 'IMPORTS',
          weight: 0.8,
          confidence: 0.9
        });
      }
    }

    return relationships;
  }

  async extractEvidence(filePath, _content = null) {
    return [];
  }

  extractMetadata(filePath, _content = null) {
    return {
      source: 'code',
      path: filePath
    };
  }
}

module.exports = CodeKnowledgeSource;
