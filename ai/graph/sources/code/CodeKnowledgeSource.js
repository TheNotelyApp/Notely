/**
 * CodeKnowledgeSource
 * KnowledgeSource implementation that indexes code repositories.
 *
 * Orchestrates:
 *   RepositoryScanner  — file discovery
 *   TreeSitterCodeParser — AST parsing (with regex fallback)
 *   CodeEvidenceBuilder  — provenance for every relationship
 */

const fs = require('fs');
const path = require('path');
const KnowledgeSource = require('../KnowledgeSource');
const { RepositoryScanner } = require('./RepositoryScanner');
const { CodeEvidenceBuilder } = require('./CodeEvidenceBuilder');
const treeSitterParser = require('./TreeSitterCodeParser');

class CodeKnowledgeSource extends KnowledgeSource {
  /**
   * @param {Array<{id: string, name: string, path: string}>} attachedRepos
   */
  constructor(attachedRepos = []) {
    super();
    this.attachedRepos = Array.isArray(attachedRepos) ? attachedRepos : [];
    this._scanner = new RepositoryScanner();
    this._evidenceBuilder = new CodeEvidenceBuilder();
    this._astCache = new Map();
  }

  sourceType() { return 'code'; }
  baseConfidence() { return 0.95; }

  supports(filePath) {
    return this._scanner.supports(filePath);
  }

  // ─── Discovery ─────────────────────────────────────────────────────────────

  /**
   * Discover all code files from all attached repositories.
   * Falls back to reading metadata.json when no repos were passed directly.
   */
  discover(workspaceRoot) {
    const repos = this._resolveRepos(workspaceRoot);
    const discovered = [];

    for (const repo of repos) {
      if (!repo || !repo.path || !fs.existsSync(repo.path)) continue;
      const files = this._scanner.scan(repo.path);
      discovered.push(...files);
    }

    return discovered;
  }

  _resolveRepos(workspaceRoot) {
    if (this.attachedRepos.length > 0) return this.attachedRepos;

    // Fallback: load from workspace metadata.json
    if (!workspaceRoot) return [];
    try {
      const metaPath = path.join(workspaceRoot, '.notes-app', 'metadata.json');
      if (fs.existsSync(metaPath)) {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        if (Array.isArray(meta.attachedRepos)) {
          // Also populate this.attachedRepos so _getRepoForFile works correctly
          this.attachedRepos = meta.attachedRepos;
          return this.attachedRepos;
        }
      }
    } catch { /* ignore read errors */ }
    return [];
  }

  // ─── Repo resolution ───────────────────────────────────────────────────────

  /**
   * Find the repo entry that owns filePath.
   * Returns null if the file doesn't belong to any attached repo (prevents phantom provenance).
   */
  _getRepoForFile(filePath) {
    const normalized = path.resolve(filePath);
    for (const repo of this.attachedRepos) {
      if (repo && repo.path && normalized.startsWith(path.resolve(repo.path))) {
        return repo;
      }
    }
    return null; // not null-coalesced to a fake repo — let callers handle this
  }

  // ─── AST cache ─────────────────────────────────────────────────────────────

  async _getAstParsed(filePath, fileContent, repoPrefix, relPath) {
    const cacheKey = `${filePath}:${fileContent.length}`;
    if (this._astCache.has(cacheKey)) return this._astCache.get(cacheKey);

    const result = await treeSitterParser.parse(filePath, fileContent, repoPrefix, relPath);
    if (result) this._astCache.set(cacheKey, result);
    return result;
  }

  // ─── Entities ──────────────────────────────────────────────────────────────

  async extractEntities(filePath, content = null) {
    const fileContent = content ?? this._readFile(filePath);
    if (!fileContent) return [];

    const repo = this._getRepoForFile(filePath);
    const repoPrefix = repo?.name || 'code';
    const relPath = repo?.path
      ? path.relative(repo.path, filePath).replace(/\\/g, '/')
      : path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();

    const moduleEntity = {
      name: `${repoPrefix}/${relPath}`,
      canonical_name: `${repoPrefix}/${relPath}`,
      type: 'CodeModule',
      properties: {
        repoId: repo?.id || 'unknown',
        repoName: repoPrefix,
        filePath: relPath,
        absolutePath: filePath,
        language: ext.replace('.', ''),
        lines: fileContent.split('\n').length
      }
    };

    // Prefer Tree-Sitter AST
    const astResult = await this._getAstParsed(filePath, fileContent, repoPrefix, relPath);
    if (astResult?.entities?.length > 0) {
      return [moduleEntity, ...astResult.entities];
    }

    // Regex fallback
    const entities = [moduleEntity];
    const lines = fileContent.split('\n');
    if (['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'].includes(ext)) {
      this._extractJsTsEntities(lines, repoPrefix, relPath, filePath, entities);
    } else if (ext === '.py') {
      this._extractPythonEntities(lines, repoPrefix, relPath, filePath, entities);
    } else {
      this._extractGenericEntities(lines, repoPrefix, relPath, filePath, ext, entities);
    }

    return entities;
  }

  // ─── Relationships ─────────────────────────────────────────────────────────

  async extractRelationships(filePath, content = null) {
    const fileContent = content ?? this._readFile(filePath);
    if (!fileContent) return [];

    const repo = this._getRepoForFile(filePath);
    const repoPrefix = repo?.name || 'code';
    const relPath = repo?.path
      ? path.relative(repo.path, filePath).replace(/\\/g, '/')
      : path.basename(filePath);
    const moduleName = `${repoPrefix}/${relPath}`;

    const relationships = [
      {
        source_name: repoPrefix,
        source_type: 'Repo',
        target_name: moduleName,
        target_type: 'CodeModule',
        type: 'CONTAINS',
        weight: 1.0,
        confidence: 1.0
      }
    ];

    // Prefer Tree-Sitter AST
    const astResult = await this._getAstParsed(filePath, fileContent, repoPrefix, relPath);
    if (astResult?.relationships?.length > 0) {
      relationships.push(...astResult.relationships);
      return relationships;
    }

    // Regex fallback: import detection
    const importRegex = /(?:import\s+.*?from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))/g;
    let match;
    while ((match = importRegex.exec(fileContent)) !== null) {
      const target = match[1] || match[2];
      if (target && (target.startsWith('.') || target.startsWith('/'))) {
        relationships.push({
          source_name: moduleName,
          source_type: 'CodeModule',
          target_name: target,
          target_type: 'CodeModule',
          type: 'IMPORTS',
          weight: 0.8,
          confidence: 0.9
        });
      }
    }

    return relationships;
  }

  // ─── Evidence ──────────────────────────────────────────────────────────────

  /**
   * Produce evidence records for every relationship in this file.
   * This is what gives code relationships real provenance in the graph.
   */
  async extractEvidence(filePath, content = null) {
    const fileContent = content ?? this._readFile(filePath);
    if (!fileContent) return [];

    const repo = this._getRepoForFile(filePath);
    if (!repo) return []; // no provenance if file doesn't match a known repo

    const relPath = path.relative(repo.path, filePath).replace(/\\/g, '/');
    const relationships = await this.extractRelationships(filePath, fileContent);

    const pairs = this._evidenceBuilder.buildForRelationships({
      repoId: repo.id,
      repoName: repo.name,
      filePath,
      relPath,
      relationships
    });

    return pairs.map(p => p.evidence);
  }

  extractMetadata(filePath) {
    const repo = this._getRepoForFile(filePath);
    return {
      source: 'code',
      sourceType: 'repository',
      repoId: repo?.id || null,
      repoName: repo?.name || null,
      path: filePath
    };
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  _readFile(filePath) {
    if (!filePath || !fs.existsSync(filePath)) return null;
    try { return fs.readFileSync(filePath, 'utf8'); } catch { return null; }
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

      let match;
      classRegex.lastIndex = 0;
      while ((match = classRegex.exec(lineText)) !== null) {
        entities.push({ name: match[1], canonical_name: `${repoPrefix}::${match[1]}`, type: 'CodeClass',
          properties: { filePath: relPath, absolutePath: filePath, line: lineNum, extends: match[2] || null, kind: 'class' } });
      }

      interfaceRegex.lastIndex = 0;
      while ((match = interfaceRegex.exec(lineText)) !== null) {
        entities.push({ name: match[1], canonical_name: `${repoPrefix}::${match[1]}`, type: 'CodeInterface',
          properties: { filePath: relPath, absolutePath: filePath, line: lineNum, kind: 'interface' } });
      }

      funcRegex.lastIndex = 0;
      while ((match = funcRegex.exec(lineText)) !== null) {
        entities.push({ name: `${match[1]}()`, canonical_name: `${repoPrefix}::${relPath}::${match[1]}`, type: 'CodeFunction',
          properties: { filePath: relPath, absolutePath: filePath, line: lineNum, symbol: match[1], kind: 'function' } });
      }

      constFuncRegex.lastIndex = 0;
      while ((match = constFuncRegex.exec(lineText)) !== null) {
        entities.push({ name: `${match[1]}()`, canonical_name: `${repoPrefix}::${relPath}::${match[1]}`, type: 'CodeFunction',
          properties: { filePath: relPath, absolutePath: filePath, line: lineNum, symbol: match[1], kind: 'arrow_function' } });
      }

      routeRegex.lastIndex = 0;
      while ((match = routeRegex.exec(lineText)) !== null) {
        const method = match[1].toUpperCase();
        entities.push({ name: `${method} ${match[2]}`, canonical_name: `${method} ${match[2]}`, type: 'APIEndpoint',
          properties: { method, route: match[2], filePath: relPath, line: lineNum } });
      }

      modelRegex.lastIndex = 0;
      while ((match = modelRegex.exec(lineText)) !== null) {
        entities.push({ name: match[1], canonical_name: `${repoPrefix}::model::${match[1]}`, type: 'DBModel',
          properties: { filePath: relPath, line: lineNum, kind: 'schema_model' } });
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
        entities.push({ name: match[1], canonical_name: `${repoPrefix}::${match[1]}`, type: 'CodeClass',
          properties: { filePath: relPath, absolutePath: filePath, line: lineNum, baseClass: match[2] || null } });
      }

      defRegex.lastIndex = 0;
      while ((match = defRegex.exec(trimmed)) !== null) {
        if (!match[1].startsWith('__')) {
          entities.push({ name: `${match[1]}()`, canonical_name: `${repoPrefix}::${relPath}::${match[1]}`, type: 'CodeFunction',
            properties: { filePath: relPath, absolutePath: filePath, line: lineNum, symbol: match[1] } });
        }
      }

      routeRegex.lastIndex = 0;
      while ((match = routeRegex.exec(trimmed)) !== null) {
        const method = match[1].toUpperCase();
        entities.push({ name: `${method} ${match[2]}`, canonical_name: `${method} ${match[2]}`, type: 'APIEndpoint',
          properties: { method, route: match[2], filePath: relPath, line: lineNum } });
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
          entities.push({ name: `${match[1]}()`, canonical_name: `${repoPrefix}::${relPath}::${match[1]}`, type: 'CodeFunction',
            properties: { filePath: relPath, line: lineNum, symbol: match[1] } });
        }
        goStructRegex.lastIndex = 0;
        if ((match = goStructRegex.exec(trimmed)) !== null) {
          entities.push({ name: match[1], canonical_name: `${repoPrefix}::${match[1]}`, type: 'CodeClass',
            properties: { filePath: relPath, line: lineNum } });
        }
      } else if (ext === '.rs') {
        rustFnRegex.lastIndex = 0;
        if ((match = rustFnRegex.exec(trimmed)) !== null) {
          entities.push({ name: `${match[1]}()`, canonical_name: `${repoPrefix}::${relPath}::${match[1]}`, type: 'CodeFunction',
            properties: { filePath: relPath, line: lineNum, symbol: match[1] } });
        }
        rustStructRegex.lastIndex = 0;
        if ((match = rustStructRegex.exec(trimmed)) !== null) {
          entities.push({ name: match[1], canonical_name: `${repoPrefix}::${match[1]}`, type: 'CodeClass',
            properties: { filePath: relPath, line: lineNum } });
        }
      }
    });
  }
}

module.exports = CodeKnowledgeSource;
